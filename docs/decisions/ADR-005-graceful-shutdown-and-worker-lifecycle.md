# ADR-005: Graceful Shutdown and Worker Lifecycle Management

## Status
Accepted

## Date
2026-10-09

## Context
In a flash-sale inventory service, an abrupt process termination (e.g., container redeployment, auto-scaling down, or SIGTERM signal) risks:
1. Severing in-flight HTTP transactions mid-commit, causing client connection resets (502/504 at load balancer).
2. Abandoning background worker sweeps mid-execution, leaving database connections in an indeterminate state.
3. Leaking connection pool sockets without clean TCP connection closure.

We must define a deterministic shutdown orchestration pattern that permits in-flight reservations to finish cleanly while refusing new inbound requests.

## Decision
We implemented a **Structured Graceful Shutdown Pipeline** coordinated by Go channels, contexts, and synchronization primitives:

```
               OS Signal (SIGINT / SIGTERM)
                            │
                            ▼
               Receive signal on `quit` chan
                            │
                            ├────────────────────────────────┐
                            ▼                                ▼
                 expiryWorker.Stop()                  cancel() Worker Context
                 - Close stopCh                       - Abort idle tickers
                 - Wait wg.Wait()
                            │
                            ▼
                 srv.Shutdown(10s Context)
                 - Close listener (reject new conn)
                 - Wait for in-flight HTTP requests
                            │
                            ▼
                 db.Close() (deferred)
                 - Drain connection pool cleanly
                            │
                            ▼
                 Process Exit (Code 0)
```

### Implementation Details
1. **Signal Notification**:
   ```go
   quit := make(chan os.Signal, 1)
   signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
   <-quit
   ```

2. **Background Worker Termination**:
   - `expiryWorker.Stop()` closes an internal `stopCh chan struct{}`.
   - The worker goroutine exits cleanly on `case <-w.stopCh:` and executes `defer w.wg.Done()`.
   - `w.wg.Wait()` blocks until the worker goroutine has completed any active database sweep.

3. **HTTP Server Drain**:
   - `srv.Shutdown(shutdownCtx)` with a 10-second timeout halts acceptance of new connections while giving existing active requests up to 10 seconds to finish.
   - If in-flight requests complete before 10 seconds, `Shutdown` returns immediately.

4. **Database Connection Teardown**:
   - `defer db.Close()` ensures all active database connections in the `pgx` pool are closed and sockets drained before binary exit.

## Consequences

### Positive
- Zero aborted in-flight transactions during normal rolling redeployments.
- Predictable and orderly resource cleanup.
- Docker and Kubernetes readiness: Responds appropriately to `SIGTERM` within standard container grace periods.

### Trade-offs & Limitations
- Shutdown may take up to 10 seconds if long-running HTTP transactions are active when the signal is received.
