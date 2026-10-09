# ADR-003: Dual-Layer Reservation Expiration Strategy

## Status
Accepted

## Date
2026-10-09

## Context
When a user reserves stock, a 5-minute holding lease is granted (`expires_at = NOW() + 5 minutes`). If the reservation is not confirmed within that window, the reserved quantity must be released so other customers can purchase it.

In high-concurrency systems, relying exclusively on background asynchronous worker sweeps creates an undesirable **expiration latency window**:
- If a ticker runs every 30 or 60 seconds, an expired reservation might remain in `PENDING` status for up to 30 or 60 seconds after its lease expires.
- If queries calculate available stock based purely on `status = 'PENDING'`, customers might see "Out of Stock" even though thousands of expired holds should have freed up inventory.
- Conversely, relying solely on on-demand queries leaves `status = 'PENDING'` records un-transitioned in the database indefinitely, degrading index scan efficiency over time.

## Decision
We implemented a **Dual-Layer Expiration Architecture**:
1. **Layer 1: Real-Time Temporal Filtering (Query & Mutation Time)**
2. **Layer 2: Asynchronous Batch Sweeper (`ExpiryWorker` Goroutine Ticker)**

### Layer 1: Real-Time Temporal Filtering
At the database and service layer, all operations dynamically evaluate expiration against the database clock (`NOW()` / `CURRENT_TIMESTAMP`):

1. **Stock Query & Reservation Allocation**:
   The active reserved stock query strictly ignores expired records, regardless of whether the background worker has updated their status yet:
   ```sql
   SELECT COALESCE(SUM(quantity), 0)
   FROM reservations
   WHERE item_id = $1 
     AND status = 'PENDING' 
     AND expires_at > NOW();
   ```
   **Effect**: The exact second `expires_at` passes, the held stock is immediately available to new shoppers with zero latency.

2. **Lazy State Transition on Confirmation (`POST /confirm`)**:
   When a user attempts to confirm a reservation:
   ```go
   now := time.Now().UTC()
   if now.After(res.ExpiresAt) {
       _ = s.repo.UpdateReservationStatus(ctx, tx, res.ReservationID, domain.ReservationStatusExpired)
       _ = tx.Commit()
       return nil, domain.ErrReservationExpired
   }
   ```
   **Effect**: Even if the background worker hasn't run yet, an expired confirmation is immediately transitioned to `EXPIRED` in the database, committed, and rejected with HTTP 400.

### Layer 2: Asynchronous Batch Sweeper
A dedicated background worker (`ExpiryWorker`) runs on a configurable ticker (default: 30 seconds):
```go
ticker := time.NewTicker(w.interval)
// on each tick:
affected, err := w.repo.ExpireOldPendingReservations(ctx)
```
Executing a set-based SQL update:
```sql
UPDATE reservations
SET status = 'EXPIRED'
WHERE status = 'PENDING' 
  AND expires_at <= NOW();
```
**Effect**: Asynchronously cleans up stale `PENDING` statuses in bulk, keeping the active index `(item_id, status, expires_at)` compact and preventing unbounded growth of un-transitioned pending records.

## Alternatives Considered

### 1. Pure Background Polling (Single Layer)
- **Mechanism**: Available stock query checks `WHERE status = 'PENDING'`. Only the background worker changes status.
- **Cons**: High latency. If the worker runs every 60s, inventory is locked for up to 60s past expiry. If the worker is delayed by load, stock is starved.
- **Reason for Rejection**: Poor flash-sale shopper experience; artificially depressed conversion rates.

### 2. Database Triggers / `pg_cron`
- **Mechanism**: Use PostgreSQL events, `pg_cron`, or triggers.
- **Cons**: Requires additional database extensions or elevated PostgreSQL superuser privileges; complicates Docker container deployment, CI/CD, and local testing.
- **Reason for Rejection**: Unnecessary operational overhead and cloud-provider portability constraints.

### 3. Redis TTL Keyspace Notifications
- **Mechanism**: Set key with TTL in Redis; listen for expiry events via Redis Pub/Sub.
- **Cons**: Redis is explicitly prohibited by assignment constraints. Furthermore, Redis keyspace notifications are not guaranteed to be delivered on time and are dropped during network partitions.
- **Reason for Rejection**: Prohibited by tech stack rules; at-most-once delivery semantics.

## Consequences

### Positive
- **Instantaneous Availability**: Stock is available for re-reservation the exact millisecond `expires_at` elapses.
- **Clean Database State**: Expired rows do not linger as `PENDING` indefinitely; the batch worker updates thousands of records in a single set-based query.
- **Robustness Against Worker Failure**: Even if the background worker crashes or stalls, the core reservation and checkout engine continues to operate correctly because Layer 1 guards against stale reservations.

### Trade-offs & Limitations
- **Background Worker Resource Usage**: Periodic ticker performs write queries against PostgreSQL. Mitigated by indexing `idx_reservations_expiry_sweep(status, expires_at)` to ensure only expired rows are scanned.
