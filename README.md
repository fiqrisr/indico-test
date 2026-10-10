# High-Throughput Inventory Reservation System

A production-grade, microservice-based inventory reservation engine and real-time dashboard engineered to handle high-concurrency flash-sale traffic. The system mathematically guarantees **zero over-selling** through PostgreSQL row-level pessimistic locking, a two-phase stock reservation lifecycle, dual-layer expiration handling, and an interactive React web dashboard.

---

## Table of Contents

- [Architectural Highlights](#architectural-highlights)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Quick Start](#quick-start)
  - [Option A: Docker Compose (Recommended)](#option-a-docker-compose-recommended)
  - [Option B: Local Bare-Metal Development](#option-b-local-bare-metal-development)
- [Pre-Seeded Flash Sale Catalog](#pre-seeded-flash-sale-catalog)
- [API Reference](#api-reference)
  - [1. Reserve Stock](#1-reserve-stock)
  - [2. Confirm Reservation](#2-confirm-reservation)
  - [3. Check Inventory Stock](#3-check-inventory-stock)
  - [4. Service Health Check](#4-service-health-check)
  - [HTTP Error Status Matrix](#http-error-status-matrix)
- [Database Architecture & Indexes](#database-architecture--indexes)
- [Frontend Dashboard Features](#frontend-dashboard-features)
- [Verification & Testing](#verification--testing)
  - [1. Backend Unit Tests with Race Detection](#1-backend-unit-tests-with-race-detection)
  - [2. Multi-Item Concurrency Swarm Tests (100 Concurrent Users)](#2-multi-item-concurrency-swarm-tests-100-concurrent-users)
  - [3. Full Integration Test Suite](#3-full-integration-test-suite)
  - [4. External Multi-Item Stress Testing (k6, Docker, Python)](#4-external-multi-item-stress-testing-k6-docker-python)
  - [5. Frontend Quality Checks & Production Build](#5-frontend-quality-checks--production-build)
- [Configuration & Environment Variables](#configuration--environment-variables)
- [Architecture Decision Records (ADRs) & Documentation](#architecture-decision-records-adrs--documentation)

---

## Architectural Highlights

1. **Mathematical Zero Over-Selling**:
   - Concurrency control is enforced via PostgreSQL pessimistic row-level locking (`SELECT total_stock FROM inventory WHERE item_id = $1 FOR UPDATE`) within ACID transactions (`Read Committed`).
   - Every reservation request targeting the same item is strictly serialized at the row level, preventing race conditions even under thousands of concurrent requests.

2. **Two-Phase Reservation Lifecycle**:
   - **Phase 1 (Temporary Hold)**: Users secure stock for a configurable lease window (default: 5 minutes) in `PENDING` status. Physical stock (`total_stock`) remains untouched, avoiding write amplification and eliminating compensating transactions upon timeout.
   - **Phase 2 (Confirmation or Release)**: Upon purchase confirmation, the reservation transitions to `CONFIRMED` and `total_stock` is atomically decremented. Expired reservations naturally lapse without database rollbacks.

3. **Dual-Layer Expiration Engine**:
   - **Layer 1 (Zero-Latency Query-Time Filter)**: Every stock calculation dynamically applies `WHERE status = 'PENDING' AND expires_at > NOW()`. Expired reservations release their held inventory instantaneously at query time with zero delay.
   - **Layer 2 (Asynchronous Sweeper Worker)**: A background Go goroutine runs on a configurable ticker (default: 30 seconds) to batch-update expired records to `EXPIRED` status, reclaiming index bloat.

4. **Graceful Shutdown & Resilience**:
   - Full signal handling (`SIGINT`, `SIGTERM`) drains in-flight HTTP requests and background tickers within a 10-second deadline before safely terminating the database connection pool.

---

## System Architecture

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 HTTP Clients / Browser                 │
                  │             (Web Dashboard / Shoppers)                 │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
                      ▼ :3000                                         ▼ :8081
       ┌──────────────────────────────┐                ┌──────────────────────────────┐
       │   React 19 + Vite 8 Web UI   │                │     Go (Gin) Core Service    │
       │   - TanStack Query Polling   │                │   - REST Handlers & Router   │
       │   - TanStack Form Submission │──[API Proxy]──▶│   - Inventory Service        │
       │   - Live 5m Countdown Lease  │   (/api,       │   - Background Expiry Worker │
       │   - Sonner Notification Hub  │    /health)    │   - pgx Connection Pool      │
       └──────────────────────────────┘                └──────────────┬───────────────┘
                                                                      │
                                                Pessimistic Row Lock  │ (SELECT ... FOR UPDATE)
                                                ACID Transactions     ▼
                                               ┌──────────────────────────────┐
                                               │   PostgreSQL 15 Container    │
                                               │   - inventory table          │
                                               │   - reservations table       │
                                               │   - Composite Partial Indexes│
                                               └──────────────────────────────┘
```

---

## Tech Stack

| Domain | Technology | Version / Details |
|---|---|---|
| **Backend Core** | Go (Golang) | 1.25, Gin Framework (`github.com/gin-gonic/gin`) |
| **Database Driver** | `pgx/v5` stdlib | Connection pooling (`SetMaxOpenConns(50)`), PostgreSQL 15 |
| **Frontend Framework** | React + Vite | React 19, Vite 8, TypeScript |
| **Frontend State & Forms** | TanStack Suite | `@tanstack/react-query` v5, `@tanstack/react-form` |
| **UI & Styling** | Tailwind CSS v4 | `@tailwindcss/vite`, Radix UI Primitives, Lucide Icons, Sonner |
| **Containerization** | Docker & Compose | Multi-stage Go build, Alpine Linux, Healthchecks |
| **Testing** | Go Test & Testify | Concurrency testing with `-race`, isolated unit tests |

---

## Repository Structure

```
.
├── ARCHITECTURE.md          # Architectural summary and database lock analysis
├── requirements.md          # Original functional and technical requirements
├── docker-compose.yaml      # Multi-container orchestration (Postgres, Core, Web)
├── scripts/
│   └── init.sql             # Database schema DDL, composite indexes, seed catalog
├── core/                    # Go Core API Microservice
│   ├── cmd/api/main.go      # Server bootstrap, DI, worker startup, graceful shutdown
│   ├── internal/
│   │   ├── config/          # Environment configuration loading & duration parsers
│   │   ├── database/        # PostgreSQL connection pool setup (pgx/v5)
│   │   ├── domain/          # Domain entities, DTOs, and sentinel error values
│   │   ├── handler/         # Gin HTTP handlers, routing, CORS, status code mapping
│   │   ├── repository/      # PostgreSQL queries, FOR UPDATE locks, aggregations
│   │   ├── service/         # Business logic & two-phase transactional orchestration
│   │   └── worker/          # Asynchronous reservation auto-expiry sweeper goroutine
│   ├── test/                # High-concurrency integration tests (pessimistic locking)
│   ├── Dockerfile           # Optimized multi-stage Go build
│   └── go.mod
├── web/                     # React 19 + Vite 8 Web Application
│   ├── src/
│   │   ├── modules/
│   │   │   ├── inventory/   # Live stock tracker, item selector, stock badge
│   │   │   ├── reservation/ # TanStack reservation form, countdown timer, confirm card
│   │   │   └── layout/      # App shell, responsive header, theme switcher
│   │   ├── components/ui/   # Reusable accessible UI primitives (Radix UI)
│   │   ├── lib/             # API client, TanStack Query client, styling utilities
│   │   ├── app.tsx
│   │   └── main.tsx
│   ├── Dockerfile           # Node.js container build for web UI
│   └── package.json
└── docs/                    # In-depth architectural documentation
    ├── core-service-specification.md  # Detailed Go backend specification
    ├── frontend-specification.md      # Detailed React web specification
    ├── architecture.md                # Concurrency mechanics & scaling limits
    └── decisions/                     # Architecture Decision Records (ADR-001 - ADR-005)
```

---

## Quick Start

### Option A: Docker Compose (Recommended)

Spin up PostgreSQL, the Go Core API, and the React Web Dashboard with a single command:

```bash
docker compose up --build
```

#### Service Endpoints

| Service | URL | Notes |
|---|---|---|
| **Web Dashboard** | [http://localhost:3000](http://localhost:3000) | Live stock tracker, countdown, reservation form |
| **Core API** | [http://localhost:8081](http://localhost:8081) | REST endpoints for reservation engine |
| **Health Check** | [http://localhost:8081/health](http://localhost:8081/health) | Returns `{"status":"ok"}` |
| **PostgreSQL 15** | `localhost:5433` | User: `postgres`, Password: `postgres`, DB: `indico_test_db` |

To stop the containers:

```bash
docker compose down -v
```

---

### Option B: Local Bare-Metal Development

#### 1. Start PostgreSQL
Run the database via Docker or use an existing PostgreSQL instance:

```bash
docker compose up -d postgres
```

The database initializes automatically with schema tables and test catalog items from `scripts/init.sql`.

#### 2. Start Core API Service
```bash
cd core

# Copy example environment variables if needed
cp .env.example .env

# Run the API server
go run cmd/api/main.go
```
The server starts on `http://localhost:8081`.

#### 3. Start Web Dashboard
```bash
cd web

# Install dependencies
pnpm install

# Start Vite dev server
pnpm dev
```
Open `http://localhost:3000` in your browser.

---

## Pre-Seeded Flash Sale Catalog

When the database starts, `scripts/init.sql` seeds initial items for testing:

| Item ID | Initial Stock | Category | Description |
|---|---|---|---|
| `flash-item-1` | **5,000** | Hardware | High-demand flash sale primary SKU with multi-region inventory allocation |
| `flash-item-2` | **2,500** | Hardware | Secondary high-speed networking SKU with enterprise-grade allocation |
| `iphone-15-pro` | **1,200** | Phones | Flagship smartphone tier with titanium chassis and A17 Pro silicon |
| `limited-edition-sneakers` | **800** | Lifestyle | Exclusive designer streetwear runner drop with authenticated serials |
| `playstation-5-pro` | **3,500** | Gaming | Next-gen high-frame-rate 4K console with upgraded ray tracing architecture |
| `xbox-series-x-galaxy` | **1,800** | Gaming | 2TB custom edition home entertainment and gaming console |
| `nintendo-switch-oled` | **4,000** | Gaming | Handheld hybrid gaming system with vibrant 7-inch OLED display |
| `rtx-5090-oc` | **650** | Hardware | Ultra-enthusiast graphics card with 32GB GDDR7 memory for AI and gaming |
| `macbook-pro-m4` | **1,500** | Computing | Pro workstation laptop with 16-core CPU, 40-core GPU, and 48GB unified memory |
| `sony-wh1000xm5` | **3,200** | Audio | Industry-leading wireless noise-canceling headphones with dual processors |
| `airpods-max-usb-c` | **2,000** | Audio | High-fidelity over-ear spatial audio headphones with active noise cancellation |
| `steam-deck-oled` | **2,800** | Gaming | Portable PC gaming powerhouse with 90Hz HDR OLED screen and fast NVMe |
| `ipad-pro-m4` | **1,600** | Computing | Tandem OLED breakthrough display with ultra-thin enclosure and M4 processor |
| `apple-watch-ultra-2` | **2,200** | Wearables | Rugged 49mm titanium outdoor sports smartwatch with precision dual-frequency GPS |
| `samsung-galaxy-s24-ultra` | **1,400** | Phones | AI-accelerated flagship Android phone with built-in S Pen and quad telephoto zoom |
| `meta-quest-3s` | **4,500** | Gaming | Mixed-reality spatial computing and VR headset with color passthrough |
| `dji-mini-4-pro` | **1,100** | Hardware | Ultralight 4K/60fps HDR camera drone with omnidirectional obstacle sensing |
| `logitech-g-pro-superlight-2` | **6,000** | Gaming | 60g championship esports wireless gaming mouse with HERO 2 sensor |
| `keychron-q1-he` | **2,400** | Computing | Custom wireless magnetic switch mechanical keyboard with rapid trigger |
| `lg-ultragear-32-oled` | **950** | Gaming | Dual-mode 4K 240Hz / FHD 480Hz gaming monitor with 0.03ms GtG response |
---

## API Reference

Base URL: `http://localhost:8081/api/v1/inventory`

### 1. Reserve Stock
Creates a temporary hold on inventory for 5 minutes.

- **Method**: `POST`
- **Path**: `/api/v1/inventory/reserve`
- **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "user_id": "shopper-001",
  "item_id": "iphone-15-pro",
  "quantity": 2
}
```

#### Response (`200 OK`)
```json
{
  "reservation_id": "550e8400-e29b-41d4-a716-446655440000",
  "item_id": "iphone-15-pro",
  "quantity": 2,
  "expires_at": "2026-10-10T12:05:00Z"
}
```

#### Curl Example
```bash
curl -X POST http://localhost:8081/api/v1/inventory/reserve \
  -H "Content-Type: application/json" \
  -d '{"user_id":"shopper-001","item_id":"iphone-15-pro","quantity":2}'
```

---

### 2. Confirm Reservation
Confirms checkout, transitions reservation to `CONFIRMED`, and decrements physical inventory stock.

- **Method**: `POST`
- **Path**: `/api/v1/inventory/confirm`
- **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "reservation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Response (`200 OK`)
```json
{
  "reservation_id": "550e8400-e29b-41d4-a716-446655440000",
  "confirmed_at": "2026-10-10T12:02:15Z"
}
```

#### Curl Example
```bash
curl -X POST http://localhost:8081/api/v1/inventory/confirm \
  -H "Content-Type: application/json" \
  -d '{"reservation_id":"550e8400-e29b-41d4-a716-446655440000"}'
```

---

### 3. Check Inventory Stock
Queries the real-time stock balance. Calculates available stock dynamically taking active `PENDING` holds into account.

- **Method**: `GET`
- **Path**: `/api/v1/inventory/stock?item_id={item_id}`

#### Response (`200 OK`)
```json
{
  "item_id": "iphone-15-pro",
  "total_stock": 1200,
  "reserved_stock": 2,
  "available_stock": 1198
}
```

#### Curl Example
```bash
curl "http://localhost:8081/api/v1/inventory/stock?item_id=iphone-15-pro"
```

---

### 4. Service Health Check
Liveness and readiness probe for the Core API.

- **Method**: `GET`
- **Path**: `/health`

#### Response (`200 OK`)
```json
{
  "status": "ok"
}
```

---

### HTTP Error Status Matrix

| Status Code | Reason | Cause / Trigger |
|---|---|---|
| `400 Bad Request` | `invalid request body` | Missing required fields or non-positive quantity |
| `400 Bad Request` | `reservation has expired` | Attempting to confirm a reservation past `expires_at` |
| `400 Bad Request` | `reservation is not in pending status` | Attempting to re-confirm an already confirmed hold |
| `404 Not Found` | `item not found` | Requested `item_id` does not exist in inventory table |
| `404 Not Found` | `reservation not found` | Requested `reservation_id` does not exist |
| `409 Conflict` | `insufficient stock` | Requested quantity exceeds dynamically available stock |
| `500 Internal Server Error` | `internal server error` | Database connectivity failure or unexpected exception |

---

## Database Architecture & Indexes

### Schema Definition

```sql
CREATE TABLE IF NOT EXISTS inventory (
    item_id VARCHAR(255) PRIMARY KEY,
    total_stock INT NOT NULL CHECK (total_stock >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

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

### Specialized Indexes

To ensure sub-millisecond execution times under concurrent load, two composite indexes are applied:

1. **Active Pending Lookup Index**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_reservations_item_pending_active 
   ON reservations(item_id, status, expires_at);
   ```
   *Purpose*: Accelerates the aggregation query `SUM(quantity) WHERE item_id = $1 AND status = 'PENDING' AND expires_at > NOW()` during the row-locked critical section.

2. **Auto-Expiry Sweeper Index**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_reservations_expiry_sweep 
   ON reservations(status, expires_at);
   ```
   *Purpose*: Allows the background worker to execute index-only scans for `UPDATE reservations SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= NOW()`.

---

## Frontend Dashboard Features

The web frontend (`web/`) provides a real-time operations console:

- **Live Stock Visualizer**: Real-time polling with visual progress bars indicating total, reserved, and available quantities.
- **Contention Gauges**: Badges dynamically reflecting stock urgency (`Available`, `Low Stock`, `Sold Out`).
- **High-Performance Form**: Built with `@tanstack/react-form` for reactive validation and instant feedback.
- **5-Minute Countdown Lease**: Animated timer computed against `expires_at`.
- **Automatic Expiration Lockout**: As soon as the timer reaches zero, the checkout button is disabled and the user is informed of lease expiration.
- **Toast Notifications**: Sonner notifications handling stock conflicts (`409 Conflict`), network recovery, and confirmation success.
- **Theme Support**: Seamless Light / Dark mode toggle.

---

## Verification & Testing

### 1. Backend Unit Tests with Race Detection
Runs all internal package unit tests in `core` with Go's race detector enabled:

```bash
cd core
go test -race -v ./internal/...
```

---

### 2. Multi-Item Concurrency Swarm Tests (100 Concurrent Users)
Simulates a swarm of **100 concurrent users** competing for limited inventory across **at least 5 items in parallel**:

```bash
cd core
go test -race -v -run TestSwarmHundredConcurrentUsersReservation ./test
```

*What this test verifies*:
- **Synchronized Race Condition**: Releases 100 goroutines simultaneously using a start gate channel to maximize contention.
- **Multi-Item Parallel Locks**: Distributes load across 5 distinct item rows (`swarm-item-1` through `swarm-item-5`) to prove independent row locks do not block each other.
- **Zero Over-Selling Guarantee**: Exactly the allocated physical stock succeeds with HTTP `200 OK`; all remaining requests are cleanly rejected with HTTP `409 Conflict`.
- **Two-Phase Settlement**: Automatically executes concurrent confirmations (`POST /api/v1/inventory/confirm`) and asserts that physical inventory decrements to 0.
- **Replay Attack Protection**: Verifies duplicate confirmation requests are rejected with HTTP `400 Bad Request`.
- **Persistent Audit Logging**: Thread-safely records individual request traces, latency distributions, and invariant checks to `test_log.txt` at the repository root.

---

### 3. Full Integration Test Suite
Executes all database integration tests against a running PostgreSQL instance:

```bash
cd core
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5433/indico_test_db?sslmode=disable" \
go test -race -v ./test/...
```

---

### 4. External Multi-Item Stress Testing (k6, Docker, Python)
A dedicated load-testing suite outside the Go codebase located in [`scripts/stress-test/`](scripts/stress-test/) evaluates sustained flash-sale throughput and latency under high concurrency.

Ensure Core API is running (`docker compose up -d postgres core` or `go run cmd/api/main.go`), then run:

#### A. Automated Orchestrator (Auto-detects k6 / Docker / Python)
```bash
# Default multi-item run (100 Virtual Users across 5 catalog items for 10s)
./scripts/stress-test/run_stress_test.sh

# Reset 5 catalog items to 50 units each and stress test with 100 VUs
./scripts/stress-test/run_stress_test.sh --reset-stock --stock 50 --vus 100 --duration 10s

# Stress test custom list of items
./scripts/stress-test/run_stress_test.sh --items "flash-item-1,flash-item-2,iphone-15-pro,limited-edition-sneakers,playstation-5-pro"
```

#### B. Native k6
```bash
BASE_URL=http://localhost:8081 VUS=100 DURATION=10s k6 run scripts/stress-test/k6_stress_test.js
```

#### C. Dockerized k6 (No local k6 installation required)
```bash
./scripts/stress-test/run_stress_test.sh --tool docker-k6 --vus 100
```

#### D. Standalone Python 3 Runner (Zero external dependencies)
```bash
./scripts/stress-test/run_stress_test.sh --tool python --vus 50
# Or run directly:
python3 scripts/stress-test/stress_test.py --url http://localhost:8081 -c 100 -n 250
```

*Metrics captured*: Throughput (RPS), Min/Mean/$P_{50}$/$P_{90}$/$P_{95}$/$P_{99}$ latency, 409 conflict rate, and post-stress catalog inventory integrity audit ($\text{Total} == \text{Reserved} + \text{Available}$). See [`scripts/stress-test/README.md`](scripts/stress-test/README.md) for full documentation.

---

### 5. Frontend Quality Checks & Production Build
```bash
cd web
pnpm lint   # Oxlint static analysis
pnpm build  # TypeScript type-check and Vite production bundle
```
---

## Configuration & Environment Variables

| Variable | Default Value | Scope | Description |
|---|---|---|---|
| `PORT` | `8080` (mapped to `8081` on host) | Core API | HTTP server listen port |
| `GIN_MODE` | `release` (prod) / `debug` (dev) | Core API | Gin operational mode |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5433/indico_test_db?sslmode=disable` | Core API | PostgreSQL connection string |
| `EXPIRY_INTERVAL` | `30s` | Core API | Background sweeper tick frequency |
| `RESERVATION_EXPIRY_MINUTES` | `5` | Core API | Duration of temporary hold lease in minutes |
| `POSTGRES_USER` | `postgres` | PostgreSQL | Database superuser username |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL | Database superuser password |
| `POSTGRES_DB` | `indico_test_db` | PostgreSQL | Database name |
| `POSTGRES_PORT` | `5433` | Docker Host | Host port mapped to PostgreSQL `5432` |
| `WEB_PORT` | `3000` | Docker Host | Host port for React Vite web dashboard |
| `VITE_API_TARGET` | `http://core:8080` (docker) / `http://localhost:8081` (local) | Web App | Upstream Core API proxy target |

---

## Architecture Decision Records (ADRs) & Documentation

Comprehensive architectural design records and performance analyses are available in the [`docs/`](docs/) directory:

- [**docs/core-service-specification.md**](docs/core-service-specification.md): Complete Go core service specification.
- [**docs/frontend-specification.md**](docs/frontend-specification.md): Detailed web application architecture.
- [**docs/architecture.md**](docs/architecture.md): In-depth analysis of PostgreSQL lock lifecycles, single-item serialization ceilings (~1,500 TPS per row), and distributed scaling pathways.
- [**ADR-001: Concurrency Control via Pessimistic Row-Level Locking**](docs/decisions/ADR-001-concurrency-control-pessimistic-locking.md)
- [**ADR-002: Two-Phase Stock Reservation Lifecycle**](docs/decisions/ADR-002-two-phase-stock-reservation-lifecycle.md)
- [**ADR-003: Dual-Layer Reservation Expiration Strategy**](docs/decisions/ADR-003-dual-layer-reservation-expiration.md)
- [**ADR-004: PostgreSQL Schema, Indexes, and Connection Pool Tuning**](docs/decisions/ADR-004-database-schema-indexes-and-connection-pool.md)
- [**ADR-005: Graceful Shutdown and Worker Lifecycle Management**](docs/decisions/ADR-005-graceful-shutdown-and-worker-lifecycle.md)
