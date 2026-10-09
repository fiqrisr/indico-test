# System Documentation Index

This directory contains the comprehensive technical specifications, architectural analyses, and decision records for the `indico-test` high-throughput inventory reservation service.

---

## Documentation Structure

```
docs/
├── README.md                                 # Documentation directory index (this file)
├── core-service-specification.md             # Primary specification: components, APIs, flows, state machines
├── frontend-specification.md                 # Web dashboard specification: React 19, Vite 8, Tailwind v4
├── architecture.md                           # System architecture, database locking, and scaling limits
└── decisions/                                # Architecture Decision Records (ADRs)
    ├── ADR-001-concurrency-control-pessimistic-locking.md
    ├── ADR-002-two-phase-stock-reservation-lifecycle.md
    ├── ADR-003-dual-layer-reservation-expiration.md
    ├── ADR-004-database-schema-indexes-and-connection-pool.md
    └── ADR-005-graceful-shutdown-and-worker-lifecycle.md
```

---

## Documents Overview

### 1. [Core Service Specification](core-service-specification.md)
The authoritative technical specification of the Go core service.
- **Section 1**: Executive Summary & Project Implementation Status
- **Section 2**: Layered Clean Architecture (Domain, Handler, Service, Repository, Worker)
- **Section 3**: Relational Database Schema, Invariants, and Composite Index Design
- **Section 4**: Concurrency Model & Step-by-Step Row-Level Locking Sequence
- **Section 5**: Reservation State Machine & Stock Accounting Formulas
- **Section 6**: Dual-Layer Expiry Architecture (Real-Time Temporal Filtering + Batch Sweeper)
- **Section 7**: REST API Contract Specification (Request/Response Schemas, Error Matrix)
- **Section 8**: Configuration, Environment Variables, and Connection Pool Settings
- **Section 9**: Verification Results (Unit, Handler, Worker, and Concurrency Tests)
- **Section 10**: Architecture Decision Records Summary

### 2. [Web Application Specification](frontend-specification.md)
The technical specification of the high-throughput inventory reservation web dashboard (`web/`).
- **Section 1**: Objective & Architectural Modular Domains
- **Section 2**: Tech Stack (React 19, Vite 8, Tailwind CSS v4, TanStack Query v5)
- **Section 3**: Capability Map & Directory Layout
- **Section 4**: API Contracts, Polling Intervals, and Real-Time State Invalidation
- **Section 5**: Form Engineering (TanStack Form + React Hook Form implementations)
- **Section 6**: Development & Production Build Commands
- **Section 7**: Testing & Verification Strategy

### 3. [System Architecture, Database Locking, and Scaling Limits](architecture.md)
In-depth technical analysis of database locking mechanics and scaling boundaries.
- **Section 1**: PostgreSQL Row-Level Lock Lifecycle, Critical Sections, and MVCC Visibility
- **Section 2**: Bottleneck Analysis: Single-Item Serialization Ceiling (~1,500 TPS per row) vs Multi-Item Horizontal Scalability
- **Section 3**: Evolutionary Scaling Pathways (Inventory Partitioning & Distributed Token Buckets)
- **Section 4**: Engineering Trade-offs (ACID vs Throughput, Two-Phase Holds, Simplicity vs Distributed Systems)

### 4. [Architecture Decision Records (ADRs)](decisions/)
- **[ADR-001: Concurrency Control via Pessimistic Row-Level Locking](decisions/ADR-001-concurrency-control-pessimistic-locking.md)**
- **[ADR-002: Two-Phase Stock Reservation Lifecycle](decisions/ADR-002-two-phase-stock-reservation-lifecycle.md)**
- **[ADR-003: Dual-Layer Reservation Expiration Strategy](decisions/ADR-003-dual-layer-reservation-expiration.md)**
- **[ADR-004: PostgreSQL Schema, Indexes, and Connection Pool Tuning](decisions/ADR-004-database-schema-indexes-and-connection-pool.md)**
- **[ADR-005: Graceful Shutdown and Worker Lifecycle Management](decisions/ADR-005-graceful-shutdown-and-worker-lifecycle.md)**
