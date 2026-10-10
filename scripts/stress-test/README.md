# Core Service Multi-Item Stress & Load Testing Suite

High-concurrency load testing suite for the **indico-test Core Service** inventory reservation engine. Evaluates row-level pessimistic locking (`SELECT ... FOR UPDATE`), transaction isolation, error handling, and zero overselling guarantees across **multiple items simultaneously** (at least five items in parallel) under flash-sale traffic spikes.

This suite is decoupled from the Go codebase and uses external, industry-standard load-testing tooling.

---

## Tooling Options

| Tool | Engine | Description | Zero-Dependency? |
|---|---|---|---|
| **k6** (Recommended) | Grafana k6 (Go/JS) | Industry-standard distributed load tester with multi-item metrics, thresholds, and latency percentiles. | Requires `k6` CLI |
| **Docker k6** | `grafana/k6:latest` | Containerized k6 execution; runs anywhere Docker is installed. | Requires Docker |
| **Python 3** | Python standard library | Multi-threaded barrier stress tester using standard `urllib` & `concurrent.futures`. | Zero external packages |

---

## Multi-Item Testing Architecture

The suite targets **at least five distinct items** in parallel:
1. `flash-item-1`
2. `flash-item-2`
3. `iphone-15-pro`
4. `limited-edition-sneakers`
5. `playstation-5-pro`

### Concurrency Characteristics:
- **Parallel Row Contention**: Concurrent transactions competing for *different* items execute concurrently without blocking each other.
- **Row-Level Serialization**: Multiple concurrent transactions contending for the *same* item row serialize cleanly via PostgreSQL's `SELECT ... FOR UPDATE`.
- **Global Invariant Audit**: Initial and final stock states are tracked for every item individually to verify that no item experiences negative stock or overselling.

---

## Quick Start

### 1. Ensure Core Service is Running

```bash
# Start PostgreSQL & Core API via Docker Compose
docker compose up -d postgres core
```

Verify service is ready:
```bash
curl http://localhost:8081/health
# {"status":"ok"}
```

---

### 2. Run Multi-Item Stress Test via Orchestrator

The `run_stress_test.sh` script automatically detects available tools (`k6` -> `docker` -> `python3`) and executes the test:

```bash
# Default multi-item run (100 VUs, 10s duration across 5 default items)
./scripts/stress-test/run_stress_test.sh

# Reset all 5 target items to 50 stock each before running
./scripts/stress-test/run_stress_test.sh --reset-stock --stock 50 --vus 100 --duration 10s

# Custom list of items (5+ items)
./scripts/stress-test/run_stress_test.sh --items "flash-item-1,flash-item-2,iphone-15-pro,limited-edition-sneakers,playstation-5-pro,rtx-5090-oc"

# Force specific tool
./scripts/stress-test/run_stress_test.sh --tool k6 --vus 150
./scripts/stress-test/run_stress_test.sh --tool docker-k6 --vus 100
./scripts/stress-test/run_stress_test.sh --tool python --vus 50
```

---

### 3. Direct Execution by Tool

#### Option A: Native k6

```bash
# Run with multi-item catalog via environment variables
BASE_URL=http://localhost:8081 \
ITEMS="flash-item-1,flash-item-2,iphone-15-pro,limited-edition-sneakers,playstation-5-pro" \
VUS=100 DURATION=10s \
k6 run scripts/stress-test/k6_stress_test.js
```

#### Option B: Docker k6

```bash
docker run --rm -i \
  --net=host \
  -e BASE_URL=http://localhost:8081 \
  -e ITEMS="flash-item-1,flash-item-2,iphone-15-pro,limited-edition-sneakers,playstation-5-pro" \
  -e VUS=100 \
  -e DURATION=10s \
  grafana/k6 run - < scripts/stress-test/k6_stress_test.js
```

#### Option C: Python 3 Standalone

```bash
# 100 concurrent threads, 500 total requests across 5 items
python3 scripts/stress-test/stress_test.py \
  --url http://localhost:8081 \
  --items "flash-item-1,flash-item-2,iphone-15-pro,limited-edition-sneakers,playstation-5-pro" \
  -c 100 -n 500
```

---

## What the Stress Test Measures

1. **Multi-Item Throughput**: Aggregated requests per second (RPS) sustained across multiple database rows.
2. **Row-Level Lock Isolation**: Proves that locks on item $A$ do not block reads/writes on item $B$.
3. **Graceful Exhaustion (409 Conflict)**: When an individual item's stock drops to 0, subsequent requests targeting that specific item are rejected with HTTP 409 Conflict without affecting other items.
4. **Latency Percentiles**: Measures Min, Median (P50), P90, P95, P99, and Max response times.
5. **Two-Phase Lifecycle**: Verifies successful reservations can be confirmed (`POST /api/v1/inventory/confirm`) and decrements physical inventory correctly per item.
6. **Per-Item Data Integrity Audit**:
   - For every item $i$: $\text{Total Stock}_i == \text{Reserved Stock}_i + \text{Available Stock}_i$
   - For every item $i$: $\text{Available Stock}_i \ge 0$ (impossibility of overselling)
   - Zero internal server errors (5xx) across the entire multi-item run.
