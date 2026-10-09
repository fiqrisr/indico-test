# ADR-001: Concurrency Control via Pessimistic Row-Level Locking

## Status
Accepted

## Date
2026-10-09

## Context
The inventory system is designed to handle flash-sale events where thousands of concurrent shoppers attempt to reserve a scarce quantity of items simultaneously (e.g., 100 items contended for by 5,000 concurrent requests). Under such intense concurrency:
- Race conditions can cause over-selling (negative inventory balance).
- Multiple transactions reading stock balance concurrently may compute obsolete available quantities.
- The assignment specifies strict tech stack constraints: **Go (Gin) + PostgreSQL**. In-memory data stores (such as Redis) and SQLite are strictly prohibited.

We must select a concurrency control strategy within PostgreSQL that guarantees strict zero over-selling, maintains transactional ACID invariants, and delivers predictable behavior under extreme write contention.

## Decision
We implemented **Pessimistic Row-Level Locking** using PostgreSQL's `SELECT ... FOR UPDATE` within database transactions (`*sql.Tx`).

In the stock reservation flow:
1. A transaction begins (`BEGIN`).
2. The specific item row in the `inventory` table is locked immediately:
   ```sql
   SELECT item_id, total_stock, created_at, updated_at 
   FROM inventory 
   WHERE item_id = $1 
   FOR UPDATE;
   ```
3. With the row-level lock held, the transaction queries active pending reservations:
   ```sql
   SELECT COALESCE(SUM(quantity), 0)
   FROM reservations
   WHERE item_id = $1 
     AND status = 'PENDING' 
     AND expires_at > NOW();
   ```
4. The service computes available stock: `available = total_stock - active_reserved`. If `available < requested_quantity`, the transaction rolls back and returns `ErrInsufficientStock` (HTTP 409 Conflict).
5. If stock is available, a new reservation is inserted with `status = 'PENDING'` and `expires_at = NOW() + 5 minutes`.
6. The transaction commits (`COMMIT`), releasing the row-level lock for the next queued request.

## Alternatives Considered

### 1. Optimistic Concurrency Control (OCC) with Versioning / CAS
- **Mechanism**: Include a `version` column. Execute `UPDATE inventory SET total_stock = total_stock - :qty, version = version + 1 WHERE item_id = :id AND version = :expected_version`.
- **Pros**: Zero locking overhead under low contention; high read concurrency.
- **Cons**: Under flash-sale conditions with thousands of concurrent requests targeting the same item, OCC causes catastrophic retry storms. Nearly all parallel transactions fail on version conflict and must abort or retry, wasting CPU, database connection slots, and network bandwidth.
- **Reason for Rejection**: OCC performs poorly under high write contention for identical rows.

### 2. Distributed Locks / In-Memory Token Bucket (Redis / Redlock)
- **Mechanism**: Store stock count in Redis and decrement using Lua scripts, or use Redlock.
- **Pros**: Extreme throughput (100,000+ operations/sec) in memory.
- **Cons**: Strictly prohibited by the project specification ("In-memory or SQLite is strictly prohibited"). Furthermore, introduces dual-system split-brain risks, cache-database reconciliation latency, and dual-phase failure modes.
- **Reason for Rejection**: Violates explicit technical constraints and introduces architectural complexity.

### 3. Atomic Decrement with Database Check Constraints (`total_stock >= 0`)
- **Mechanism**: Directly execute `UPDATE inventory SET total_stock = total_stock - :qty WHERE item_id = :id AND total_stock >= :qty`.
- **Pros**: Compact single SQL statement.
- **Cons**: Does not support the required two-phase reservation model where stock is temporarily reserved for 5 minutes during checkout before confirmation. Immediate decrement would require compensating increments upon expiration, risking data drift if compensation fails.
- **Reason for Rejection**: Incompatible with the 5-minute reservation hold requirement.

## Consequences

### Positive
- **Guaranteed Consistency**: Zero possibility of over-selling. PostgreSQL's serialization of row locks guarantees single-writer order per item.
- **Predictable Failure**: In-flight requests queue cleanly behind the lock; once available stock drops below the requested quantity, subsequent requests fail immediately with 409 Conflict without modifying data.
- **ACID Reliability**: All operations (inventory check + reservation insert) are bounded within a single database transaction.
- **Deadlock Immunity**: Reservation transactions acquire a lock on only a single item row (`inventory` table) in a consistent order before inserting into `reservations`. No circular wait conditions exist.

### Trade-offs & Limitations
- **Single-Item Serialization Limit**: Throughput for any single `item_id` is bounded by the round-trip latency of the lock-and-commit cycle. On modern hardware and SSD-backed PostgreSQL, this yields approximately 1,000 to 2,500 operations per second per specific item.
- **Connection Contention**: Extended transaction durations can hold connections in the pool. Mitigated by keeping transactions micro-scoped (no external I/O or network calls inside the transaction boundary).
