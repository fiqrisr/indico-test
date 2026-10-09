# Specification: High-Throughput Flash-Sale Web Application

## 1. Objective

Deliver a high-reliability, real-time web dashboard for the High-Throughput Inventory Reservation System.
The application connects to the Go + Gin core microservice and PostgreSQL database to provide:
1. **Live Inventory Tracking**: Real-time polling and visualization of `total_stock`, `reserved_stock`, and `available_stock`.
2. **High-Concurrency Reservation Submission**: Robust form submission using `@tanstack/react-form` with reactive field-level validation and instantaneous error feedback.
3. **Dual-Phase Hold & Confirmation Workflow**: Dynamic 5-minute countdown timer calculated against the backend's `expires_at` timestamp with automatic expiration handling, button lockout, and confirmation execution.
4. **Resilient Feedback & Error Handling**: Toast and inline alerts handling concurrency conflicts (HTTP 409 Insufficient Stock), expiration events (HTTP 400), and network degradations.

The web application must follow a strict **modular architecture** where business domains (`inventory`, `reservation`, `layout`) encapsulate their own API hooks, components, and types. Every file is strictly named in **`kebab-case`**.

---

## 2. Tech Stack & Dependencies

- **Runtime & Package Manager**: Node.js v22+, `pnpm` v9+
- **Framework & Bundler**: React 19, Vite 8 (TypeScript)
- **State Management & Data Fetching**: `@tanstack/react-query` v5
- **Form Management**: `@tanstack/react-form` (High-performance reactive form state & field validation)
- **UI Framework & Styling**:
  - Tailwind CSS v4 (integrated via `@tailwindcss/vite` and CSS-first `@theme` tokens)
  - Shadcn UI (using Radix Primitives & Lucide React)
  - `sonner` for rich toasts
- **Utilities**: `clsx`, `tailwind-merge`, `date-fns`

---

## 3. Capability Map & Module Architecture

```
web/
├── src/
│   ├── assets/
│   ├── components/
│   │   └── ui/                           # Required Shadcn UI primitives (kebab-case)
│   │       ├── alert.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       ├── sonner.tsx
│   │       └── tabs.tsx
│   ├── lib/                              # Shared infrastructure
│   │   ├── api-client.ts                 # Typed fetch client with error normalization
│   │   ├── query-client.ts               # TanStack Query client configuration
│   │   └── utils.ts                      # Tailwind merge & styling helpers
│   ├── modules/
│   │   ├── inventory/                    # Domain Module: Stock tracking & items
│   │   │   ├── api/
│   │   │   │   └── inventory-api.ts      # GET /api/v1/inventory/stock query
│   │   │   ├── components/
│   │   │   │   ├── inventory-tracker.tsx # Live stock metrics card with visual gauges
│   │   │   │   ├── item-selector.tsx     # Item selection dropdown / quick-picks
│   │   │   │   └── stock-badge.tsx       # Stock status indicator (Available/Low/Sold Out)
│   │   │   ├── hooks/
│   │   │   │   └── use-inventory-stock.ts
│   │   │   └── types/
│   │   │       └── inventory-types.ts
│   │   ├── reservation/                  # Domain Module: Two-phase reservation & confirm
│   │   │   ├── api/
│   │   │   │   └── reservation-api.ts    # POST /reserve and POST /confirm mutations
│   │   │   ├── components/
│   │   │   │   ├── countdown-timer.tsx   # Precision 5-minute countdown timer with progress
│   │   │   │   ├── reservation-form-tanstack.tsx # TanStack Form implementation
│   │   │   │   ├── reservation-panel.tsx         # Unified container with reservation form and audit trail
│   │   │   │   └── confirmation-card.tsx         # Active hold card with confirm button
│   │   │   ├── hooks/
│   │   │   │   ├── use-countdown.ts              # Drift-resistant interval countdown hook
│   │   │   │   ├── use-reserve-stock.ts          # Reservation mutation with cache invalidation
│   │   │   │   └── use-confirm-reservation.ts    # Confirm mutation with cache invalidation
│   │   │   └── types/
│   │   │       └── reservation-types.ts
│   │   └── layout/                       # App frame & navigation
│   │       ├── components/
│   │       │   ├── app-header.tsx        # System status, flash sale banner
│   │       │   └── app-shell.tsx         # Main layout grid and responsive container
│   │       └── hooks/
│   │           └── use-service-health.ts # GET /health connectivity checker
│   ├── app.tsx                           # Application root composition
│   ├── main.tsx                          # App bootstrapping & provider hierarchy
│   └── index.css                         # Tailwind CSS v4 design tokens (@import "tailwindcss", @theme)
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts                        # Vite 8 configuration with @tailwindcss/vite plugin
```

---

## 4. API Contracts & State Synchronization

### 4.1. Endpoints Integrated

| Operation | Endpoint | Method | Payload / Query | Response Model |
| :--- | :--- | :--- | :--- | :--- |
| **Check Stock** | `/api/v1/inventory/stock` | `GET` | `?item_id={itemId}` | `{ item_id, total_stock, reserved_stock, available_stock }` |
| **Reserve Stock** | `/api/v1/inventory/reserve` | `POST` | `{ user_id, item_id, quantity }` | `{ reservation_id, item_id, quantity, expires_at }` |
| **Confirm Hold** | `/api/v1/inventory/confirm` | `POST` | `{ reservation_id }` | `{ reservation_id, confirmed_at }` |
| **Health Check** | `/health` | `GET` | — | `{ status: "ok" }` |

### 4.2. Polling & Invalidation Strategy
- **Automated Polling**: `GET /api/v1/inventory/stock` runs with `refetchInterval: 2500ms` when tab is active.
- **Optimistic Invalidation**:
  - On `reserveStock` success: immediately invalidate the current item's stock query so `reserved_stock` jumps and `available_stock` decrements.
  - On `confirmReservation` success: invalidate stock query so `total_stock` and `reserved_stock` decrement.
  - On reservation expiration: invalidate stock query to reflect returned inventory.

### 4.3. Countdown Timer Invariants
- Backend assigns `expires_at = NOW() + 5 minutes`.
- Client parses ISO 8601 `expires_at` into UTC timestamp.
- Countdown remaining milliseconds = `Math.max(0, new Date(expires_at).getTime() - Date.now())`.
- When remaining reaches `0`:
  - `status` transitions to `EXPIRED`.
  - The "Confirm Purchase" button is permanently disabled with destructive badge.
  - A toast notifies the user: `"Reservation Expired: Inventory hold released"`.
  - Triggers a stock refetch.

---

## 5. Form Engineering (TanStack React Form)

The reservation submission uses `@tanstack/react-form` for zero-re-render reactive field state, deep TypeScript safety, and field-level validation:
1. **`reservation-form-tanstack.tsx`**: Uses `@tanstack/react-form` (`useForm`) with reactive field validation handlers on `onChange`.
2. **Validation Rules**:
   - `user_id`: required, trimmed string (min 2 characters).
   - `quantity`: positive integer >= 1, capped at available stock.
3. **State Integration**: Disables submission during active mutations or when available stock is 0; integrates with Sonner toasts for conflict and success feedback.
---

## 6. Commands

```bash
# Navigate to web workspace
cd web

# Development server (proxies API requests to backend :8081 or :8080)
pnpm run dev

# Production build & TypeScript check (Vite 8 + Tailwind CSS v4)
pnpm run build

# Code linting
pnpm run lint

# Preview build
pnpm run preview
```

---

## 7. Testing & Verification Strategy

- **Static Type Safety & Build**: `pnpm run build` (`tsc -b && vite build`) under Vite 8 and Tailwind CSS v4 with zero errors.
- **Component Unit Verification**: Verify field validation, error triggers, and countdown timer calculations.
- **Runtime Smoke Test**: Run Vite 8 dev server, execute health check, mock or test live against backend API:
  - Stock polling updates.
  - Reservation creation, countdown timer tick, expiration lockout.
  - Confirmation submission.
  - Concurrency conflict (409) presentation.

---

## 8. Boundaries

- **Always**:
  - Name every file in `kebab-case`.
  - Handle backend errors (400, 404, 409, 500) gracefully with toast notifications.
  - Ensure responsive UI (mobile, tablet, desktop).
- **Never**:
  - Hardcode backend URLs without configurable environment fallbacks (`VITE_API_BASE_URL`).
  - Introduce global mutable state outside React Query / component state.
  - Allow purchase confirmation once the timer has hit 0.
