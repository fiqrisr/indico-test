Technical Specification: High-Throughput Inventory Reservation System

1. Project Overview

A microservice-based system designed to handle high-concurrency inventory reservations during flash-sale events. The system ensures data integrity, prevents over-selling, and includes a mini-dashboard for live tracking and reservation management.

2. Tech Stack

Strict constraints apply based on assignment requirements:

Backend: Go (Golang) + Gin HTTP Framework

Database: PostgreSQL (Running via Docker Compose). In-memory or SQLite is strictly prohibited.

Frontend: React + Vite (JS/TS). Other frameworks are not allowed.

3. Database Architecture (PostgreSQL)

3.1. Schema (Proposed)

Table: inventory

item_id (VARCHAR/UUID) - Primary Key

total_stock (INT) - Physical stock available before reservations.

Table: reservations

reservation_id (VARCHAR/UUID) - Primary Key

user_id (VARCHAR)

item_id (VARCHAR) - Foreign Key to inventory

quantity (INT)

status (VARCHAR) - ENUM: 'PENDING', 'CONFIRMED', 'EXPIRED'

expires_at (TIMESTAMP)

created_at (TIMESTAMP)

3.2. Concurrency Strategy

Pessimistic Locking: Use SELECT ... FOR UPDATE inside PostgreSQL transactions during the reservation process to lock the specific item_id row. This prevents race conditions and over-selling when thousands of concurrent requests attempt to reserve the same item.

4. Backend API Specifications (Go + Gin)

4.1. Reserve Stock

Endpoint: POST /api/v1/inventory/reserve

Logic:

Begin Transaction.

Lock item row: SELECT total_stock FROM inventory WHERE item_id = ? FOR UPDATE.

Calculate currently reserved stock (status = 'PENDING' and expires_at > NOW()).

Check if total_stock - current_reserved >= requested_quantity.

If yes, insert into reservations with expires_at = NOW() + 5 minutes.

Commit.

Success Response: Returns reservation_id, item_id, quantity, expires_at.

Error Scenarios: Insufficient stock (409/400), Invalid Input (400), Item Not Found (404).

4.2. Confirm Reservation

Endpoint: POST /api/v1/inventory/confirm

Logic:

Begin Transaction.

Lock reservation row. Check if valid, 'PENDING', and not expired.

Update status to 'CONFIRMED'.

Decrement total_stock in inventory by the reserved quantity.

Commit.

Success Response: Returns reservation_id, confirmed_at.

Error Scenarios: Reservation Expired (400), Not Found (404).

4.3. Check Inventory Status

Endpoint: GET /api/v1/inventory/stock?item_id={item_id}

Logic: Query total_stock and sum of active PENDING reservations to dynamically calculate available_stock.

Success Response: Returns item_id, total_stock, reserved_stock, available_stock.

4.4. Background Tasks & Server

Auto-Expiry: Implement a background Goroutine ticker (e.g., every 30-60 seconds) to sweep and update PENDING reservations past their expires_at to 'EXPIRED'.

Graceful Shutdown: Implement os.Signal handling to ensure srv.Shutdown(ctx) is called, closing DB connections safely.

5. Frontend Specifications (React + Vite)

Live Inventory Tracker: Display Total, Reserved, and Available stock. Implement automated polling (e.g., setInterval or React Query refetchInterval) fetching from GET /api/v1/inventory/stock.

Reservation Form: Input fields for User ID and Quantity.

Confirmation Workflow:

Upon successful reservation, display a live 5-minute countdown timer based on expires_at.

Show "Confirm Purchase" button calling the Confirm endpoint.

Handle UI state gracefully if the timer hits 0: disable the confirm button and notify the user of expiration.

Render backend error states (e.g., toast notification for "Insufficient Stock").

6. Infrastructure & Delivery Requirements

Docker: Provide a docker-compose.yaml to spin up PostgreSQL and the Go API together.

Testing: Ensure backend passes go test -race -v ./....

Git History: Commit incrementally across both frontend and backend.

Documentation: Prepare ARCHITECTURE.md to explain database locking, scaling limits, and AI trade-offs.
