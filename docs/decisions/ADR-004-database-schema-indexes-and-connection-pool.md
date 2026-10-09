# ADR-004: PostgreSQL Schema, Indexes, and Connection Pool Tuning

## Status
Accepted

## Date
2026-10-09

## Context
A high-throughput flash sale subjects PostgreSQL to sudden spikes of concurrent read and write operations. Without disciplined schema constraints, targeted indexing, and connection pool sizing:
1. Aggregate queries (`SUM(quantity)`) can trigger sequential table scans, increasing transaction durations and causing lock convoy effects.
2. Unbounded or improperly tuned database connection pools can exhaust PostgreSQL `max_connections`, leading to memory exhaustion or `pq: remaining connection slots are reserved for non-replication superuser connections` errors.
3. Lack of database-level invariants can permit subtle bugs in application code to introduce negative stock.

## Decision

### 1. Database Schema & Hard Constraints
We enforced invariants directly in PostgreSQL using `CHECK` constraints:
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

Key schema protections:
- `total_stock >= 0`: Impossibility of negative physical inventory even in the event of an application logic anomaly.
- `quantity > 0`: Prevents zero-quantity or negative-quantity reservations.
- `status IN ('PENDING', 'CONFIRMED', 'EXPIRED')`: Rigid state machine validation at storage level.
- `TIMESTAMP WITH TIME ZONE`: Eliminates daylight savings and time-zone ambiguity.

### 2. High-Performance Indexing Strategy
Two targeted B-tree indexes were introduced:

1. **`idx_reservations_item_pending_active`**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_reservations_item_pending_active 
   ON reservations(item_id, status, expires_at);
   ```
   **Purpose**: Optimizes the hot-path query `WHERE item_id = $1 AND status = 'PENDING' AND expires_at > NOW()`. PostgreSQL can perform an Index-Only or Index Scan filtering exclusively the relevant subset of reservations.

2. **`idx_reservations_expiry_sweep`**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_reservations_expiry_sweep 
   ON reservations(status, expires_at);
   ```
   **Purpose**: Optimizes the background ticker query `WHERE status = 'PENDING' AND expires_at <= NOW()`. Allows the sweeper to quickly identify expired reservations without scanning non-pending or active records.

### 3. Connection Pool Configuration
Using the high-performance `pgx/v5` driver:
```go
db.SetMaxOpenConns(50)
db.SetMaxIdleConns(25)
db.SetConnMaxLifetime(15 * time.Minute)
db.SetConnMaxIdleTime(5 * time.Minute)
```

**Sizing Rationale**:
- `MaxOpenConns = 50`: Matches PostgreSQL standard default limits (`max_connections = 100`) while reserving ample headroom for administration, migrations, and other services.
- `MaxIdleConns = 25`: Retains warm connections ready for flash-sale burst arrivals, eliminating TCP handshake and authentication overhead during sudden traffic spikes.
- `ConnMaxLifetime = 15m` / `ConnMaxIdleTime = 5m`: Prunes stale connections and recycles TCP sockets cleanly to avoid memory leaks.

## Alternatives Considered

### 1. ORM (e.g., GORM, Ent)
- **Cons**: Adds reflection overhead, hides raw SQL transaction semantics (`SELECT FOR UPDATE`), and obscures index usage and connection pool behavior.
- **Reason for Rejection**: Standard library `database/sql` paired with `pgx/v5` offers maximum throughput, zero hidden abstractions, and explicit transaction control.

### 2. Partial Indexes (`WHERE status = 'PENDING'`)
- **Pros**: Slightly smaller index footprint.
- **Cons**: While partial indexing is effective, the composite index `(item_id, status, expires_at)` already achieves single-digit millisecond performance for the active item set. For this deployment stage, standard B-tree composite indexing was selected for simplicity and broad compatibility.

## Consequences

### Positive
- Strict defense-in-depth: Even if a software bug bypasses application checks, PostgreSQL rejects invalid stock or status mutations.
- Fast query execution under concurrent load, verified by `core/test/integration_test.go`.
- Predictable database connection behavior without starvation or socket exhaustion.
