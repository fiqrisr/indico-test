# Architecture & Technical Design

## 1. Architectural Design & Database Locking Strategy

### 1.1 PostgreSQL Schema Design

The database is designed using two main tables (`inventory` and `reservations`). The main focus here is to ensure the stock never goes below zero (preventing over-selling):

- **Database-Level Validation**: I added constraints directly in PostgreSQL, like `CHECK (total_stock >= 0)` on the `inventory` table. This acts as a safety net—even if there's a bug in the application logic, the database will reject any update that causes negative stock.
- **Two-Phase Reservation Flow**: When the `POST /reserve` endpoint is called, the physical stock in `inventory` is **not immediately deducted**. The system only creates a reservation record with a `PENDING` status and a 5-minute expiration time. The physical stock is only reduced when `POST /confirm` is called. The benefit: if the user abandons the cart, I don't have to write extra queries to add the stock back.
- **Indexing**: I added a composite index on the `reservations` table (using `item_id`, `status`, and `expires_at`). This makes the query to calculate currently "booked" items much faster.

### 1.2 Routing Structure & Clean Architecture (Gin)

The Go backend is structured using a standard Layered Architecture so the code is easy to read and maintain:

- **Handler Layer**: Responsible for receiving requests, validating JSON payloads, and returning the correct HTTP responses (200, 400, etc.).
- **Service Layer**: Where all the business logic and stock availability checks live.
- **Repository Layer**: Strictly handles database communication (executing SQL queries and managing transactions).

### 1.3 Database Synchronization & Concurrency (Pessimistic Locking)

To handle the flash sale scenario (where many users request the same item at the exact same time), I chose to use **Pessimistic Locking** (`SELECT ... FOR UPDATE`) inside PostgreSQL transactions.

Why not Optimistic Locking? Because in a flash sale, thousands of requests will fight for the same item. If I use optimistic locking, most of those requests will conflict and have to be retried over and over, which will slow down the server. With Pessimistic Locking, transactions will neatly queue up at the database level, guaranteeing that no over-selling happens.

**How the Reserve flow works:**

1. Start a database transaction.
2. Lock the item's row using `FOR UPDATE`. Any other request for the same item will automatically wait in line.
3. Calculate available stock (total stock - currently PENDING stock).
4. If there's enough stock, insert the record into `reservations` as PENDING.
5. Commit the transaction (which unlocks the row so the next request in line can proceed).

---

## 2. Distributed Scaling & Failure Modes

### 2.1 What happens if the app is scaled to 10 instances?

If this current architecture is deployed across 10 different servers without any changes, several issues will happen:

1. **Connection Pool Exhaustion**: If one server opens 50 connections, 10 servers will demand 500 connections from PostgreSQL. This will overload the database and cause it to drop new requests.
2. **Long Lock Queues**: Even with 10 servers, the queries for a single flash sale item still have to queue up one by one at the database level because of the row-locking. Eventually, API responses might hit a timeout.
3. **Worker Clashes**: Right now, the auto-expiry function runs as a background process in the app. If there are 10 servers, 10 background workers will try to update expired records in the database at the exact same time. This wastes resources and risks causing deadlocks.

### 2.2 Redesigning for a Distributed Setup

If I need to handle a massive load in a distributed way, I would adjust the architecture like this:

- **Use PgBouncer**: Put a connection pooler in front of PostgreSQL so thousands of connections from the Go servers can be multiplexed and managed safely before hitting the database.
- **Separate the Expiry Worker**: The background function that handles expired reservations should be removed from the API servers and moved to a separate dedicated service (like a Kubernetes CronJob) so only one process does the cleanup.
- **Add Redis Caching**: Use Redis to handle the stock-checking endpoint (`GET /stock`), so PostgreSQL doesn't get hammered by constant read requests from the frontend dashboards.

---

## 3. Engineering Trade-offs & AI Transparency

### 3.1 Technical Trade-offs (4–8 Hour Delivery Window)

Given the short time limit, I had to make a few practical compromises:

- **HTTP Polling vs WebSockets**: To show "live" stock updates in React, I used HTTP Polling (refreshing data every few seconds via TanStack Query) instead of building a WebSocket connection. It is much faster to implement, less prone to bugs, and perfectly adequate for the UI's live update requirements.
- **In-App Worker**: For sweeping expired reservations, I placed a goroutine inside the main application (running every minute) because it is much more practical than setting up a completely separate job queue infrastructure for a take-home test.
- **AI-Assisted UI Scaffolding**: I had to rely heavily on AI tools to generate the frontend UI. Building it entirely from scratch manually would have taken too much time. As a result, some values are hardcoded, and the component code might be a bit messy, but it fulfills the core functional requirements.
- **Lack of Observability & Instrumentation**: Due to the strict time constraint, I had to leave out proper observability, logging, and instrumentation (like Prometheus metrics or tracing) for both the backend service and the frontend web app.

### 3.2 AI Transparency & Manual Corrections

During development, I used AI tools (like Codex/Claude/Antigravity) to speed up the process, but there were a few generated suggestions that were flawed and required manual adjustments:

1. **Flawed Concurrency Logic**: The AI initially suggested using Optimistic Locking and deducting the physical stock immediately (`UPDATE inventory SET total_stock = total_stock - qty`). This was a bad idea because if the reservation expires (the user doesn't pay), I would have to write extra logic to return the stock. I rejected this and implemented Pessimistic Locking where physical stock is only deducted upon confirmation.
2. **Incorrect API Response Structure**: The initial JSON response code generated by the AI did not match the specific requirements in the test document (e.g., the `"status"` field was missing and some keys were named incorrectly). I had to manually adjust the Go structs to make sure the JSON format exactly matched the required spec.
3. **Cluttered Frontend UI**: When I asked the AI to initialize the first draft of the React UI, the result was very cluttered, unintuitive, and looked exactly like "AI slop." I had to manually rewrite the component structure and the Tailwind CSS styling from scratch to ensure the dashboard looked clean, professional, and proper.
