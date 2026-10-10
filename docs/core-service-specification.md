# Core Service Specification: High-Throughput Inventory Reservation System

**Document Version**: 1.0.0  
**Status**: Implemented & Verified  
**Date**: October 2026  
**Target Service**: `indico-test` Core API Service  
**Module**: `github.com/fiqrisr/indico-test/core`

---

## 1. Executive Summary & Project Status

### 1.1 Project Overview
The `indico-test` core service is a high-concurrency microservice written in Go (Golang) using the Gin HTTP web framework and PostgreSQL 15. The system powers flash-sale inventory reservation, guaranteeing mathematical zero over-selling under extreme concurrent buyer competition while supporting a 5-minute checkout reservation hold.

### 1.2 Current Implementation Status
The project is organized in a clean monorepo architecture:

| Component | Status | Technology | Details |
|---|---|---|---|
| **Core API Service** | **Complete** | Go 1.23 + Gin | REST endpoints for reserve, confirm, stock, health |
| **Data Access Layer** | **Complete** | PostgreSQL 15 + `pgx/v5` | Pessimistic locking (`FOR UPDATE`), transactions |
| **Auto-Expiry Worker**| **Complete** | Go Goroutine + Ticker | Asynchronous sweep of expired reservations |
| **Infrastructure** | **Complete** | Docker + Docker Compose | Multi-stage Go build, PostgreSQL with init scripts |
| **Automated Testing** | **Complete** | Go test (`-race`), Testify | Unit, handler, worker, and concurrent integration tests |
| **Frontend Tracker** | **Pending** | React + Vite (planned) | Mini-dashboard, live countdown, polling |

All core backend components and database schemas have been fully implemented, verified with race detection, and pass both isolated unit tests and concurrent integration test suites.

---

## 2. System Architecture & Layered Design

The core service follows a **Layered Clean Architecture** where concerns are strictly decoupled into independent packages:

```
                  ┌────────────────────────────────────────────────┐
                  │                 HTTP Clients                   │
                  │        (Frontend Dashboard / Shoppers)         │
                  └───────────────────────┬────────────────────────┘
                                          │ HTTP (JSON)
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               CORE SERVICE                                       │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │  Router & Middleware (router.go)                                         │   │
│   │  - Recovery, Structured Logging, CORS Handlers                           │   │
│   └─────────────────────────────────────┬────────────────────────────────────┘   │
│                                         │                                        │
│   ┌─────────────────────────────────────▼────────────────────────────────────┐   │
│   │  Handler Layer (handler.go)                                              │   │
│   │  - JSON Request Binding & Validation                                     │   │
│   │  - HTTP Status Code Mapping (200, 400, 404, 409, 500)                    │   │
│   └─────────────────────────────────────┬────────────────────────────────────┘   │
│                                         │                                        │
│   ┌─────────────────────────────────────▼────────────────────────────────────┐   │
│   │  Service Layer (inventory_service.go)                                    │   │
│   │  - Business Logic & Stock Calculations                                   │   │
│   │  - Transaction Boundary Management (BeginTx, Commit, Rollback)           │   │
│   │  - Two-Phase Reservation State Orchestration                             │   │
│   └──────────────────┬───────────────────────────────────▲───────────────────┘   │
│                      │                                   │                       │
│                      │ Calls                             │ Scheduled Sweep       │
│                      ▼                                   │                       │
│   ┌────────────────────────────────────────┐ ┌───────────┴───────────────────┐   │
│   │  Repository Layer (postgres_repository)│ │  Background Worker            │   │
│   │  - Row-Level Locking (SELECT FOR UPDATE│ │  (expiry_worker.go)           │   │
│   │  - Atomic Inserts and Updates          │ │  - Configurable Ticker        │   │
│   │  - SQL Aggregate Calculations          │ │  - Graceful Shutdown Channel  │   │
│   └──────────────────┬─────────────────────┘ └───────────┬───────────────────┘   │
│                      │                                   │                       │
└──────────────────────┼───────────────────────────────────┼───────────────────────┘
                       │ SQL Queries                       │ Batch UPDATE
                       ▼                                   ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │                     PostgreSQL Database                         │
        │                     - inventory table                           │
        │                     - reservations table                        │
        │                     - Composite B-Tree Indexes                  │
        └─────────────────────────────────────────────────────────────────┘
```

### 2.1 Package Breakdown
- **`core/cmd/api/main.go`**: Application entrypoint. Boots configuration, opens database connection pool, wires dependencies, starts background worker, spins up HTTP server, and orchestrates OS signal-based graceful shutdown.
- **`core/internal/domain`**: Pure enterprise domain models (`Inventory`, `Reservation`, `ReservationStatus`), request/response DTOs, and sentinel domain errors. Free from external dependencies.
- **`core/internal/handler`**: Gin HTTP handlers. Handles JSON serialization, HTTP status mapping, and endpoint routing.
- **`core/internal/service`**: High-level business operations (`ReserveStock`, `ConfirmReservation`, `GetStock`). Coordinates transaction boundaries and enforces stock availability invariants.
- **`core/internal/repository`**: Data persistence contracts (`InventoryRepository`) and PostgreSQL implementation. Encapsulates SQL queries and raw database transactions (`*sql.Tx`).
- **`core/internal/worker`**: Goroutine-based background worker (`ExpiryWorker`). Runs periodic batch updates to transition past-due `PENDING` reservations to `EXPIRED`.
- **`core/internal/database`**: Database connection pool initializer using the high-performance `pgx/v5` driver.
- **`core/internal/config`**: Environment variable parsing with fallback defaults and `.env` loader.

---

## 3. Database Architecture & Data Invariants

### 3.1 Relational Schema (`scripts/init.sql`)

```sql
-- Table: inventory
CREATE TABLE IF NOT EXISTS inventory (
    item_id VARCHAR(255) PRIMARY KEY,
    total_stock INT NOT NULL CHECK (total_stock >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: reservations
CREATE TABLE IF NOT EXISTS reservations (
    reservation_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(255) NOT NULL REFERENCES inventory(item_id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.2 Schema Invariants & Protections
1. **`inventory.total_stock CHECK (total_stock >= 0)`**: Hardware-level guard preventing negative inventory under all conditions.
2. **`reservations.quantity CHECK (quantity > 0)`**: Enforces that reservations can only request positive integer quantities.
3. **`reservations.status CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED'))`**: Validates the discrete state machine at the database layer.
4. **Foreign Key with `ON DELETE CASCADE`**: Guarantees referential integrity between reservations and inventory items.
5. **Timezone Preservation**: All timestamp columns use `TIMESTAMP WITH TIME ZONE` stored in UTC to eliminate clock skew and DST shifts.

### 3.3 Indexing Strategy
To sustain low latency under intense concurrent read and write operations, two purpose-built composite B-Tree indexes are defined:

1. **`idx_reservations_item_pending_active` (`item_id, status, expires_at`)**:
   - **Optimizes**: Real-time stock queries and reservation lock calculations:
     ```sql
     WHERE item_id = $1 AND status = 'PENDING' AND expires_at > NOW()
     ```
   - **Benefit**: Allows PostgreSQL to execute an Index Scan or Index-Only Scan, eliminating full-table scans when calculating active reserved quantities.

2. **`idx_reservations_expiry_sweep` (`status, expires_at`)**:
   - **Optimizes**: Background ticker sweeps:
     ```sql
     WHERE status = 'PENDING' AND expires_at <= NOW()
     ```
   - **Benefit**: Enables the background worker to locate expired rows in milliseconds without inspecting non-pending or confirmed reservations.

---

## 4. Concurrency Model & Locking Strategy

### 4.1 The Concurrency Challenge
During a flash-sale event, hundreds or thousands of shoppers concurrently attempt to claim a limited number of items. Without strict synchronization:
- Two concurrent transactions could read an available stock of 1.
- Both transactions would pass the stock check and insert reservations for 1 item each.
- Total committed stock would exceed physical capacity, resulting in **over-selling**.

### 4.2 Pessimistic Row-Level Locking Sequence
The core service utilizes PostgreSQL's **Pessimistic Row-Level Locking** via `SELECT ... FOR UPDATE` inside a database transaction (`*sql.Tx`).

```
Request A (User 1, Qty: 2)           PostgreSQL Item Row           Request B (User 2, Qty: 1)
          │                                  │                                  │
          ├────────── BEGIN ─────────────────┼──────────────────────────────────┤
          │                                  │                                  │
          ├─ SELECT FOR UPDATE ─────────────►│                                  │
          │  (Acquires Row Lock)             │ [Row Locked by Tx A]             │
          │                                  │                                  │
          │                                  │◄─────── BEGIN ───────────────────┤
          │                                  │                                  │
          │                                  │◄─────── SELECT FOR UPDATE ───────┤
          │                                  │         (BLOCKED: Tx B waits)    │
          │                                  │                                  │
          ├─ SUM active PENDING              │                                  │
          ├─ Check available >= 2 (OK)       │                                  │
          ├─ INSERT reservation (PENDING)    │                                  │
          ├─ COMMIT ────────────────────────►│                                  │
          │  (Releases Row Lock)             │ [Row Unlocked]                   │
          │                                  │                                  │
          ▼ (200 OK)                         │◄─────── Lock Granted to Tx B ────┤
                                             │ [Row Locked by Tx B]             │
                                             │                                  │
                                             │         ├─ SUM active PENDING    │
                                             │         ├─ Check available >= 1  │
                                             │         ├─ INSERT reservation    │
                                             │         ├─ COMMIT ──────────────►│
                                             │                                  ▼ (200 OK)
```

### 4.3 Detailed Step-by-Step Locking Sequence

#### Reservation Flow (`POST /api/v1/inventory/reserve`):
1. **Begin Transaction**: `tx, err := s.repo.BeginTx(ctx)`
2. **Acquire Exclusive Row Lock**:
   ```sql
   SELECT item_id, total_stock, created_at, updated_at 
   FROM inventory 
   WHERE item_id = $1 
   FOR UPDATE;
   ```
   PostgreSQL queues any other transaction attempting to inspect or modify the same `item_id`.
3. **Calculate Active Reserved Stock**:
   ```sql
   SELECT COALESCE(SUM(quantity), 0)
   FROM reservations
   WHERE item_id = $1 
     AND status = 'PENDING' 
     AND expires_at > NOW();
   ```
4. **Availability Evaluation**:
   $$\text{available\_stock} = \text{total\_stock} - \text{reserved\_stock}$$
   - If $\text{available\_stock} < \text{requested\_quantity}$:
     Transaction rolls back immediately (`tx.Rollback()`) and returns `409 Conflict`.
5. **Create Reservation**:
   Inserts new reservation row with `status = 'PENDING'`, `expires_at = NOW() + 5m`.
6. **Commit Transaction**: `tx.Commit()` atomically persists the reservation and releases the row lock.

#### Confirmation Flow (`POST /api/v1/inventory/confirm`):
1. **Begin Transaction**: `tx, err := s.repo.BeginTx(ctx)`
2. **Lock Specific Reservation Row**:
   ```sql
   SELECT reservation_id, user_id, item_id, quantity, status, expires_at, created_at
   FROM reservations
   WHERE reservation_id = $1
   FOR UPDATE;
   ```
3. **Validate State & Lease**:
   - If `status != 'PENDING'`, abort with error.
   - If `NOW() > expires_at`, transition status to `EXPIRED`, commit, and return `400 Bad Request`.
4. **Transition Status**:
   `UPDATE reservations SET status = 'CONFIRMED' WHERE reservation_id = $1`
5. **Decrement Physical Inventory**:
   ```sql
   UPDATE inventory 
   SET total_stock = total_stock - $1, updated_at = NOW() 
   WHERE item_id = $2;
   ```
6. **Commit Transaction**: Persists changes atomically.

### 4.4 Deadlock Prevention
Deadlocks are mathematically prevented by adhering to strict lock hierarchy invariants:
1. **Single-Resource Locking in Reservations**: `ReserveStock` acquires a lock on exactly **one** table (`inventory`) for a single row (`item_id`). It never attempts to lock multiple inventory rows in a single call.
2. **Single-Resource Locking in Confirmations**: `ConfirmReservation` locks exactly **one** reservation row, then executes a direct row decrement on the associated item.
3. No circular dependency graph ($T_1 \to T_2 \to T_1$) can form.

---

## 5. Stock Accounting & Lifecycle State Machine

### 5.1 Dynamic Stock Accounting Formula
Physical stock in `inventory.total_stock` represents the physical merchandise owned by the merchant minus confirmed sales.

- **Total Physical Stock**: `inventory.total_stock` (only decremented when a reservation is `CONFIRMED`).
- **Reserved Stock**:
  $$\text{Reserved Stock} = \sum_{\text{reservations}} \text{quantity} \quad \text{where } \text{status} = \text{'PENDING'} \land \text{expires\_at} > \text{NOW()}$$
- **Available Stock**:
  $$\text{Available Stock} = \max(0, \; \text{Total Stock} - \text{Reserved Stock})$$

### 5.2 State Machine Transition Table

| Current State | Event / Trigger | Preconditions | Target State | Side Effects |
|---|---|---|---|---|
| *(None)* | `POST /reserve` | Available stock $\ge$ quantity | `PENDING` | Insert reservation; `expires_at = NOW() + 5m` |
| `PENDING` | `POST /confirm` | `NOW() <= expires_at` | `CONFIRMED` | `total_stock` decremented by `quantity` |
| `PENDING` | `POST /confirm` | `NOW() > expires_at` | `EXPIRED` | Status updated to `EXPIRED`; 400 returned |
| `PENDING` | Background Sweep | `NOW() >= expires_at` | `EXPIRED` | Batch updated by `ExpiryWorker` |
| `CONFIRMED` | Any | Final State | `CONFIRMED` | Immutable |
| `EXPIRED` | Any | Final State | `EXPIRED` | Immutable |

---

## 6. Auto-Expiry Architecture (Dual-Layer Strategy)

To guarantee zero stock starvation without creating lag windows, expiration is handled across two complementary layers:

### 6.1 Layer 1: Real-Time Temporal Filtering (Zero Latency)
Every stock lookup and reservation transaction evaluates `expires_at > NOW()`.
- If a reservation expired 200 milliseconds ago, it is **immediately omitted** from the reserved stock calculation.
- Shoppers can reserve newly freed stock instantly without waiting for any background process to execute.

### 6.2 Layer 2: Asynchronous Batch Sweeper (`ExpiryWorker`)
A long-running background goroutine (`worker.ExpiryWorker`) periodically sweeps the database:
- **Interval**: 30 seconds (configurable via `EXPIRY_INTERVAL`).
- **Execution**: Executes a single set-based SQL statement:
  ```sql
  UPDATE reservations
  SET status = 'EXPIRED'
  WHERE status = 'PENDING' 
    AND expires_at <= NOW();
  ```
- **Lifecycle**: Managed with `sync.WaitGroup` and graceful stop channel to ensure in-flight sweeps finish during server teardown.

---

## 7. REST API Contract Specification

All endpoints communicate using JSON over HTTP.

### 7.1 Reserve Stock
Holds temporary stock for a user for 5 minutes.

- **Endpoint**: `POST /api/v1/inventory/reserve`
- **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "user_id": "usr_9921",
  "item_id": "flash-item-1",
  "quantity": 2
}
```

#### Field Specifications:
| Field | Type | Validation | Description |
|---|---|---|---|
| `user_id` | string | Required, non-empty | Identifier of the customer reserving stock |
| `item_id` | string | Required, non-empty | Identifier of the inventory item |
| `quantity` | integer | Required, $> 0$ | Number of units requested |

#### Success Response: `200 OK`
```json
{
  "reservation_id": "550e8400-e29b-41d4-a716-446655440000",
  "item_id": "flash-item-1",
  "quantity": 2,
  "expires_at": "2026-10-09T14:35:00Z"
}
```

#### Error Responses:
- **`400 Bad Request`**:
  - Missing or empty `user_id`, `item_id`, or `quantity <= 0`.
  - Body: `{"error": "invalid input"}` or `{"error": "invalid request body: ..."}`
- **`404 Not Found`**:
  - Item does not exist in inventory table.
  - Body: `{"error": "item not found"}`
- **`409 Conflict`**:
  - Insufficient stock available.
  - Body: `{"error": "insufficient stock"}`
- **`500 Internal Server Error`**:
  - Database connectivity or query failure.
  - Body: `{"error": "internal server error: ..."}`

---

### 7.2 Confirm Reservation
Permanently confirms a pending reservation and decrements physical stock.

- **Endpoint**: `POST /api/v1/inventory/confirm`
- **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "reservation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Field Specifications:
| Field | Type | Validation | Description |
|---|---|---|---|
| `reservation_id` | string | Required, non-empty | UUID of the reservation to confirm |

#### Success Response: `200 OK`
```json
{
  "reservation_id": "550e8400-e29b-41d4-a716-446655440000",
  "confirmed_at": "2026-10-09T14:32:15Z"
}
```

#### Error Responses:
- **`400 Bad Request`**:
  - Reservation has expired: `{"error": "reservation has expired"}`
  - Reservation not in pending status (e.g. already confirmed): `{"error": "reservation is not in pending status"}`
  - Missing reservation ID: `{"error": "invalid input"}`
- **`404 Not Found`**:
  - Reservation does not exist.
  - Body: `{"error": "reservation not found"}`
- **`500 Internal Server Error`**:
  - Database commit failure.
  - Body: `{"error": "internal server error: ..."}`

---

### 7.3 Get Stock Status
Retrieves current real-time inventory counts for an item.

- **Endpoint**: `GET /api/v1/inventory/stock?item_id={item_id}`
- **Query Parameters**:
  - `item_id` (string, required): Item identifier.

#### Success Response: `200 OK`
```json
{
  "item_id": "flash-item-1",
  "total_stock": 5000,
  "reserved_stock": 15,
  "available_stock": 4985
}
```

#### Error Responses:
- **`400 Bad Request`**: Query parameter `item_id` missing. `{"error": "query parameter 'item_id' is required"}`
- **`404 Not Found`**: Item does not exist. `{"error": "item not found"}`

---

### 7.4 Health Check
Liveness and container orchestration health probe.

- **Endpoint**: `GET /health`
- **Success Response: `200 OK`**
  ```json
  {
    "status": "ok"
  }
  ```

---

## 8. Configuration & Environment Variables

All settings can be configured via environment variables or a `.env` file located in the root or `core/` directory:

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | string | `8080` | HTTP port on which the core service listens |
| `DATABASE_URL` | string | `postgres://postgres:postgres@localhost:5433/indico_test_db?sslmode=disable` | PostgreSQL connection string |
| `GIN_MODE` | string | `release` | Gin framework mode (`release`, `debug`, `test`) |
| `EXPIRY_INTERVAL` | string | `30s` | Time between background auto-expiry sweeps |
| `RESERVATION_EXPIRY_MINUTES` | integer | `5` | Lease duration granted to each reservation |

### Database Connection Pool Settings
Configured inside `core/internal/database/postgres.go`:
- `SetMaxOpenConns`: 50
- `SetMaxIdleConns`: 25
- `SetConnMaxLifetime`: 15 minutes
- `SetConnMaxIdleTime`: 5 minutes

---

## 9. Verification & Quality Assurance Results

The service implementation was rigorously tested across multiple testing dimensions:

### 9.1 Unit Test Coverage
- **Service Layer (`inventory_service_test.go`)**: Verifies reservation success, stock rejection (409), invalid input handling, expiration detection, and mock transaction rollback.
- **Handler Layer (`handler_test.go`)**: Verifies HTTP binding, status code mappings, and JSON response bodies.
- **Worker Layer (`expiry_worker_test.go`)**: Verifies ticker loop execution, worker start/stop lifecycle, and context cancellation.
- **Config Layer (`config_test.go`)**: Verifies environment parsing and fallback behavior.

### 9.2 Concurrency Integration Testing (`integration_test.go`)
Conducted with Go's race detector (`go test -race`):
- **Scenario**: 100 concurrent goroutines attempting to reserve stock for an item with only 20 physical units.
- **Observed Result**:
  - Exactly 20 reservations succeeded (`HTTP 200`).
  - Exactly 80 reservations failed with `ErrInsufficientStock` (`HTTP 409`).
  - Final database state: physical stock = 20, active reserved stock = 20, available stock = 0.
  - **Zero race conditions detected. Zero overselling occurrences.**

---

## 10. Architectural Decisions Summary

For full historical rationale, alternatives analyzed, and consequences, consult the Architecture Decision Records in `docs/decisions/`:

1. **[ADR-001: Concurrency Control via Pessimistic Row-Level Locking](decisions/ADR-001-concurrency-control-pessimistic-locking.md)**: Selection of PostgreSQL `SELECT ... FOR UPDATE` over Optimistic Concurrency Control and distributed locks.
2. **[ADR-002: Two-Phase Stock Reservation Lifecycle](decisions/ADR-002-two-phase-stock-reservation-lifecycle.md)**: Decoupling of physical ledger from active pending holds without write amplification.
3. **[ADR-003: Dual-Layer Reservation Expiration Strategy](decisions/ADR-003-dual-layer-reservation-expiration.md)**: Zero-latency real-time filtering paired with periodic batch sweeping.
4. **[ADR-004: PostgreSQL Schema, Indexes, and Connection Pool Tuning](decisions/ADR-004-database-schema-indexes-and-connection-pool.md)**: Database invariants, composite indexes, and `pgx` pool sizing.
5. **[ADR-005: Graceful Shutdown and Worker Lifecycle Management](decisions/ADR-005-graceful-shutdown-and-worker-lifecycle.md)**: Coordinated SIGTERM teardown preserving in-flight transactions.
