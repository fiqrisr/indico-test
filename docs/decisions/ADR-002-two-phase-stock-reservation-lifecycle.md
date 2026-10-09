# ADR-002: Two-Phase Stock Reservation Lifecycle

## Status
Accepted

## Date
2026-10-09

## Context
E-commerce flash sales require a temporary holding window (5 minutes) allowing shoppers to complete payment or checkout information before stock is permanently committed. During this window:
1. Reserved stock must be protected from being claimed by other shoppers.
2. If the user completes purchase, the stock must be permanently deducted from inventory.
3. If the user abandons the cart or the timer elapses, the stock must be reclaimed immediately without data corruption.

We need an explicit lifecycle model for stock reservations that separates physical inventory accounting from temporary holding states.

## Decision
We implemented a **Two-Phase Reservation Lifecycle** with three discrete states: `PENDING`, `CONFIRMED`, and `EXPIRED`.

```
                  ┌──────────────────────────────┐
                  │                              │
                  │   POST /reserve (stock > 0)  │
                  │                              │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │                       │
                     │        PENDING        │
                     │  (expires_at = T+5m)  │
                     │                       │
                     └───┬───────────────┬───┘
                         │               │
     POST /confirm       │               │  Ticker Sweep (NOW() >= expires_at)
     (NOW() < expires_at)│               │  OR Lazy Expiration at Confirm
                         ▼               ▼
              ┌──────────────────┐   ┌──────────────────┐
              │                  │   │                  │
              │    CONFIRMED     │   │     EXPIRED      │
              │ (total_stock -Q) │   │ (total_stock unchanged)
              │                  │   │                  │
              └──────────────────┘   └──────────────────┘
```

### Lifecycle Rules
1. **Reservation Phase (`POST /api/v1/inventory/reserve`)**:
   - Creates a reservation record with status `PENDING`, `expires_at = UTC NOW() + 5 minutes`, and assigned `quantity`.
   - **Crucially: Physical inventory (`inventory.total_stock`) is NOT decremented.**
   - Dynamic available stock is computed at query/reserve time as:
     $$\text{available\_stock} = \text{total\_stock} - \sum_{\text{active PENDING}} \text{quantity}$$
   - This prevents unnecessary write churn and avoids compensating transactions.

2. **Confirmation Phase (`POST /api/v1/inventory/confirm`)**:
   - The reservation row is locked via `SELECT ... FOR UPDATE` by `reservation_id`.
   - Verified that `status == 'PENDING'` and `NOW() <= expires_at`.
   - Status transitions atomically to `CONFIRMED`.
   - Physical stock (`inventory.total_stock`) is decremented by `quantity` within the same transaction.
   - Transaction commits.

3. **Expiration Phase**:
   - If an unconfirmed reservation reaches `expires_at`, its status transitions to `EXPIRED`.
   - Because `total_stock` was never decremented, releasing the hold requires **zero updates to the `inventory` table**. The expired quantity immediately falls out of the `SUM()` filter for active pending reservations.

## Alternatives Considered

### 1. Decrement Physical Stock Immediately at Reservation
- **Mechanism**: Execute `UPDATE inventory SET total_stock = total_stock - :qty` upon reservation. When expired, execute a compensating transaction `UPDATE inventory SET total_stock = total_stock + :qty`.
- **Pros**: Available stock is simply `total_stock`.
- **Cons**: Requires two write mutations on `inventory` table per reservation lifecycle (decrement + compensating increment). If the worker crashes, the server restarts, or a compensating transaction fails, physical stock permanently drifts.
- **Reason for Rejection**: High risk of inventory reconciliation discrepancies; unnecessary write amplification on the contended `inventory` table.

### 2. Deleting Expired Records (`DELETE FROM reservations`)
- **Mechanism**: Physically remove expired reservations from the database.
- **Pros**: Keeps table row count smaller.
- **Cons**: Destroys auditability. Customer support and analytics cannot distinguish between failed requests, abandoned carts, or system errors.
- **Reason for Rejection**: Destroys audit trail and historical analytics.

## Consequences

### Positive
- **Auditable State**: Every reservation attempt, confirmation, and expiration remains permanently logged in `reservations` with user, quantity, and timestamps.
- **Resilient Accounting**: Total physical stock in `inventory` represents strictly confirmed, finalized merchandise. It never inflates or deflates on transient shopping cart abandonments.
- **Zero-Compensation Expiration**: Expiration requires no compensating write to the `inventory` row, reducing lock contention on `inventory`.

### Trade-offs & Limitations
- **Query Complexity**: Stock calculation requires aggregating active pending reservations (`SUM(quantity) FILTER (...)`). Mitigated by indexing `reservations(item_id, status, expires_at)`.
