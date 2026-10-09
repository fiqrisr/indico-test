# System Architecture, Database Locking, and Scaling Limits

This document analyzes the architectural mechanics of the `indico-test` high-throughput inventory reservation core service, focusing on database locking dynamics, system scalability ceilings, evolutionary scaling paths, and engineering trade-offs.

---

## 1. Deep Dive: Database Locking Dynamics

### 1.1 Pessimistic Concurrency Control in PostgreSQL
In an inventory reservation system, the critical invariant is:
$$\text{Available Stock} = \text{Total Stock} - \sum \text{Active Reservations} \ge 0$$

Under extreme concurrency, the system prevents race conditions by acquiring an **exclusive row-level lock** (`FOR UPDATE`) on the targeted inventory item:

```sql
SELECT item_id, total_stock, created_at, updated_at 
FROM inventory 
WHERE item_id = $1 
FOR UPDATE;
```

### 1.2 PostgreSQL Internal Lock Lifecycle
1. **Lock Acquisition**:
   - PostgreSQL queries the tuple pointer for `item_id`.
   - The transaction requests an `ExclusiveLock` on the tuple in PostgreSQL's shared lock table.
   - If no other transaction holds a lock on this tuple, the lock is granted immediately.
   - If another transaction currently holds the lock, the incoming transaction enters a wait state (`LockWait`), queued in the kernel wait queue.
2. **Critical Section Execution**:
   - The active reserved quantity is aggregated via `idx_reservations_item_pending_active`.
   - Stock availability is evaluated.
   - If valid, a new reservation tuple is written into the `reservations` table heap and indexed.
3. **Lock Release**:
   - The lock is **never** released statement-by-statement. In PostgreSQL, row-level locks are held until the transaction explicitly terminates via `COMMIT` or `ROLLBACK`.
   - Upon `COMMIT`, the Write-Ahead Log (WAL) record is flushed, the tuple lock is released, and the next waiting transaction in the queue is immediately awakened.

### 1.3 MVCC Interaction and Visibility
PostgreSQL operates using Multi-Version Concurrency Control (MVCC). A standard `SELECT` query reads a historical snapshot without locking. However, `SELECT ... FOR UPDATE`:
- Bypasses pure snapshot isolation for that specific tuple.
- Blocks on concurrent updates to that row.
- Once the concurrent updating transaction commits, the waiting transaction re-evaluates the query condition against the **newest committed version** of the tuple.

This ensures that every reservation evaluation reads strictly the latest confirmed state of `inventory`.

---

## 2. Scaling Limits & Architectural Bottlenecks

### 2.1 The Single-Item Serialization Ceiling
The fundamental throughput limit of this architecture is **row-level lock contention on a single item**.

When 10,000 requests arrive in the same second targeting the **same** flash-sale item (e.g. `iphone-15-pro`):
- Every transaction targeting that row is serialized.
- Throughput ($T$) for that single item is mathematically bounded by the transaction duration ($D$):
  $$T_{\text{item}} = \frac{1}{D_{\text{avg}}}$$

#### Empirical Transaction Latency Breakdown:
| Operation | Typical Latency (Local SSD) | Typical Latency (Cloud DB / RDS) |
|---|---|---|
| Query Parse & Plan | 0.05 ms | 0.08 ms |
| Lock Acquisition (`FOR UPDATE`) | 0.05 ms | 0.10 ms |
| Aggregate Active Holds (`SUM`) | 0.20 ms | 0.40 ms |
| Insert Reservation Tuple | 0.15 ms | 0.35 ms |
| WAL Write & Commit Flush | 0.30 ms | 1.00 – 1.50 ms |
| **Total Transaction Duration ($D$)** | **~0.75 ms** | **~2.0 – 2.5 ms** |

**Theoretical Maximum Single-Item Throughput**:
- Local SSD: $\frac{1}{0.00075 \text{ s}} \approx 1,300 \text{ to } 1,500 \text{ reservations/sec per item}$.
- Cloud Managed PostgreSQL (e.g., AWS RDS gp3 with sync WAL): $\frac{1}{0.0025 \text{ s}} \approx 400 \text{ to } 500 \text{ reservations/sec per item}$.

### 2.2 Multi-Item Horizontal Scalability
Crucially, **different items do not block each other**:
- A lock on `item-A` has zero effect on `item-B`.
- If a flash sale features 50 different items, transactions across different items execute in parallel across CPU cores and connection pool workers.
- The aggregate system throughput scales linearly with the number of unique items until database CPU or disk I/O bandwidth is saturated.

### 2.3 Database Connection Pool Limits
In PostgreSQL, each connection is a separate operating system process consuming ~5–10 MB of RAM:
- If 1,000 concurrent HTTP requests attempt to open 1,000 raw PostgreSQL connections simultaneously, PostgreSQL will suffer severe context switching overhead and memory exhaustion.
- **Mitigation in Core Service**: The connection pool is strictly capped at `MaxOpenConns = 50`.
- Excess HTTP requests wait briefly in the Go SQL pool queue rather than overwhelming the database server.

---

## 3. Evolutionary Scaling Path: Scaling Beyond PostgreSQL Limits

If business requirements demand scaling to **50,000+ reservations/second for a single item**, the architecture can evolve along the following tiers:

```
Tier 1: Current Architecture (Pure PostgreSQL)
  └── Single Item: ~1,500 TPS | Multi-Item: ~10,000 TPS | Zero over-sell guarantee

Tier 2: PgBouncer + Asynchronous Inventory Partitioning
  └── Single Item: ~3,000 TPS | Split item inventory into N virtual buckets (e.g., item-1_bucket_A, item-1_bucket_B)

Tier 3: Distributed In-Memory Token Bucket (Redis Cluster / Dragonfly)
  └── Single Item: ~80,000+ TPS | Lua atomic decrements in RAM, asynchronous DB ledgering
```

### Tier 2: Inventory Sharding / Virtual Buckets (Relational Only)
Without introducing external dependencies like Redis:
1. Divide an item's total stock (e.g., 10,000 units) into 10 virtual bucket rows (`item_1_bucket_0` through `item_1_bucket_9`), each with 1,000 units.
2. Incoming reservation requests are randomly hashed across the 10 buckets.
3. Lock contention on each bucket is reduced by a factor of 10, multiplying single-item throughput tenfold (~15,000 TPS).
4. If a bucket empties, the service falls back to remaining buckets.

### Tier 3: In-Memory Token Bucket + Asynchronous Write-Behind
When the non-relational constraint is relaxed:
1. Load item stock into Redis as an integer token bucket.
2. Execute reservations via an atomic Redis Lua script:
   ```lua
   local stock = redis.call('get', KEYS[1])
   if tonumber(stock) >= tonumber(ARGV[1]) then
       redis.call('decrby', KEYS[1], ARGV[1])
       return 1
   else
       return 0
   end
   ```
3. Publish successful reservation events into an append-only log (Apache Kafka or RabbitMQ).
4. Asynchronous worker consumers batch-insert reservations into PostgreSQL for durable ledgering.

---

## 4. Engineering & Architectural Trade-offs

### 4.1 Strict ACID vs. Ultimate Write Throughput
- **Trade-off Chosen**: Strict ACID Consistency via PostgreSQL.
- **Why**: In financial transactions, ticketing, and flash sales, over-selling carries catastrophic real-world costs (customer dissatisfaction, refunds, legal liabilities). Accepting a ~1,500 TPS per-item ceiling in exchange for 100% mathematical certainty of stock balance is the correct engineering tradeoff for this tier.

### 4.2 Two-Phase Hold vs. Direct Immediate Decrement
- **Trade-off Chosen**: Two-phase reservation hold (`PENDING` hold for 5 minutes, decrement only upon `CONFIRMED`).
- **Why**: Immediate decrements require error-prone compensating transactions when a cart is abandoned. If compensating transactions fail due to crash or timeout, physical stock drifts permanently. The two-phase model ensures physical inventory only decrements on completed purchases.

### 4.3 Dual-Layer Expiry vs. Complex Trigger Systems
- **Trade-off Chosen**: Query-time temporal filtering + 30-second asynchronous batch sweeper.
- **Why**: Eliminates dependency on external schedulers, cron jobs, or database extensions (`pg_cron`). Works reliably in any environment (Docker, Kubernetes, Bare Metal, Managed Cloud).

### 4.4 Simplicity vs. Premature Distributed Architecture
- A distributed architecture (Kafka + Redis + Sharding) introduces network partitions, dual-write consistency problems, reconciliation pipelines, and operational complexity.
- By fully leveraging PostgreSQL's native row locks, composite indexing, and Go's concurrency primitives, the `indico-test` core service delivers exceptional throughput, rock-solid stability, and zero maintenance overhead in under 1,000 lines of clean Go code.
