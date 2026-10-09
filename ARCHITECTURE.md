# System Architecture & Technical Specifications

> **Notice**: The comprehensive technical specification and detailed architectural analyses are maintained in the [`docs/`](docs/) directory:
>
> - 📄 **Core Service Specification**: [`docs/core-service-specification.md`](docs/core-service-specification.md) — Complete specification of service components, APIs, schemas, state machines, and concurrency mechanics.
> - 📄 **Database Locking & Scaling Limits**: [`docs/architecture.md`](docs/architecture.md) — Detailed analysis of PostgreSQL locking dynamics, single-item throughput ceilings (~1,500 TPS), and evolutionary scaling paths.
> - 📂 **Architecture Decision Records (ADRs)**: [`docs/decisions/`](docs/decisions/) — Historical rationale and trade-off analysis for all core architectural choices.

---

## Executive Summary

The `indico-test` core service is a high-concurrency inventory reservation microservice built with **Go (Gin)** and **PostgreSQL 15**. It guarantees mathematical **zero over-selling** during flash-sale events while supporting a 5-minute checkout reservation hold.

### Key Architectural Invariants
1. **Concurrency Control**: Pessimistic row-level locking via `SELECT ... FOR UPDATE` inside PostgreSQL transactions. Single-item reservation requests are strictly serialized in the database, preventing race conditions.
2. **Two-Phase Reservation Lifecycle**: Stock is held as `PENDING` for 5 minutes. Physical stock (`inventory.total_stock`) is only decremented upon confirmation (`POST /confirm`), eliminating write amplification and avoiding compensating transactions.
3. **Dual-Layer Expiration**:
   - **Query-Time Filter**: Evaluates `expires_at > NOW()` on every stock calculation, ensuring expired holds immediately free up inventory with zero latency.
   - **Background Sweeper**: Asynchronous Go ticker sweeps and updates expired reservations every 30 seconds.
4. **Resilience & Graceful Shutdown**: Structured signal trapping (`SIGINT`, `SIGTERM`) drains worker routines and in-flight HTTP transactions with a 10-second deadline before closing the database pool cleanly.

For the full specification, consult [`docs/core-service-specification.md`](docs/core-service-specification.md).
