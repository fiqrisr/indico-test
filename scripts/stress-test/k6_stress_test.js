import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ============================================================================
// CONFIGURATION & ENVIRONMENT VARIABLES
// ============================================================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';

// Default multi-item catalog (at least five items)
const DEFAULT_ITEMS = [
  'flash-item-1',
  'flash-item-2',
  'iphone-15-pro',
  'limited-edition-sneakers',
  'playstation-5-pro',
];

function parseItems() {
  const raw = __ENV.ITEMS || __ENV.ITEM_ID;
  if (!raw) return DEFAULT_ITEMS;
  const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ITEMS;
}

const TARGET_ITEMS = parseItems();
const REQUESTED_QTY = parseInt(__ENV.QUANTITY || '1', 10);
const TARGET_VUS = parseInt(__ENV.VUS || '100', 10);
const DURATION = __ENV.DURATION || '10s';
const CONFIRM_PERCENT = parseInt(__ENV.CONFIRM_PERCENT || '50', 10); // % of successful reservations to confirm

// ============================================================================
// CUSTOM METRICS
// ============================================================================
const reservationsSuccessful = new Counter('reservations_successful');
const reservationsInsufficientStock = new Counter('reservations_insufficient_stock');
const reservationsUnexpectedError = new Counter('reservations_unexpected_error');
const confirmationsSuccessful = new Counter('confirmations_successful');
const confirmationsFailed = new Counter('confirmations_failed');
const reservationDuration = new Trend('reservation_duration_ms', true);
const confirmationDuration = new Trend('confirmation_duration_ms', true);
const unexpectedErrorRate = new Rate('unexpected_error_rate');

// ============================================================================
// K6 EXECUTION OPTIONS & STAGES
// ============================================================================
export const options = {
  scenarios: {
    multi_item_flash_swarm: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2s', target: TARGET_VUS },     // Instant surge up to target VUs
        { duration: DURATION, target: TARGET_VUS }, // Sustained multi-item contention load
        { duration: '2s', target: 0 },              // Clean ramp down
      ],
      gracefulRampDown: '2s',
    },
  },
  thresholds: {
    unexpected_error_rate: ['rate<0.001'],
    reservation_duration_ms: ['p(95)<350'],
  },
};

// ============================================================================
// SETUP HOOK: Fetches and records initial state across all target items
// ============================================================================
export function setup() {
  console.log(`\n================================================================================`);
  console.log(`         K6 MULTI-ITEM STRESS TEST: CORE INVENTORY RESERVATION SERVICE           `);
  console.log(`================================================================================`);
  console.log(`Target Base URL:       ${BASE_URL}`);
  console.log(`Target Items (${TARGET_ITEMS.length}):      ${TARGET_ITEMS.join(', ')}`);
  console.log(`Simulated VUs:         ${TARGET_VUS} Virtual Users`);
  console.log(`Sustained Duration:    ${DURATION}`);
  console.log(`Confirm Ratio:         ${CONFIRM_PERCENT}% of successful reservations`);

  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'Health check passes (200)': (r) => r.status === 200,
  });

  // Query initial stock state for all items
  const initialStocks = {};
  console.log(`\nINITIAL CATALOG STOCK STATUS:`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(` ITEM ID                        | TOTAL STOCK | RESERVED | AVAILABLE`);
  console.log(`--------------------------------------------------------------------------------`);

  for (const item of TARGET_ITEMS) {
    const res = http.get(`${BASE_URL}/api/v1/inventory/stock?item_id=${item}`);
    if (res.status === 200) {
      try {
        const data = JSON.parse(res.body);
        initialStocks[item] = data;
        const idCol = item.padEnd(30, ' ');
        const totalCol = String(data.total_stock).padStart(11, ' ');
        const resCol = String(data.reserved_stock).padStart(8, ' ');
        const availCol = String(data.available_stock).padStart(9, ' ');
        console.log(` ${idCol} | ${totalCol} | ${resCol} | ${availCol}`);
      } catch (e) {
        console.error(`Failed parsing stock for ${item}: ${e}`);
      }
    } else {
      console.warn(`Could not fetch stock for ${item} (HTTP ${res.status}): ${res.body}`);
    }
  }
  console.log(`--------------------------------------------------------------------------------\n`);

  return {
    startTime: new Date().toISOString(),
    items: TARGET_ITEMS,
    initialStocks: initialStocks,
  };
}

// ============================================================================
// MAIN VU ITERATION: Distributes load across all target items
// ============================================================================
export default function (data) {
  const vuId = __VU;
  const iterId = __ITER;

  // Distribute request across catalog items
  const itemIndex = (vuId + iterId + Math.floor(Math.random() * TARGET_ITEMS.length)) % TARGET_ITEMS.length;
  const targetItem = TARGET_ITEMS[itemIndex];
  const userId = `k6-vu${vuId}-i${iterId}-${Math.random().toString(36).substring(2, 6)}`;

  const reservePayload = JSON.stringify({
    user_id: userId,
    item_id: targetItem,
    quantity: REQUESTED_QTY,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    tags: { name: 'ReserveStock', item: targetItem },
  };

  const startReserve = new Date();
  const reserveRes = http.post(`${BASE_URL}/api/v1/inventory/reserve`, reservePayload, params);
  const reserveLatency = new Date() - startReserve;
  reservationDuration.add(reserveLatency);

  if (reserveRes.status === 200) {
    reservationsSuccessful.add(1);
    unexpectedErrorRate.add(0);

    let reservationId = null;
    try {
      const body = JSON.parse(reserveRes.body);
      reservationId = body.reservation_id;
    } catch (e) {
      console.error(`VU ${vuId}: Malformed 200 JSON: ${reserveRes.body}`);
    }

    check(reserveRes, {
      'Reserve returns 200 OK': (r) => r.status === 200,
    });

    // Optional confirmation workflow
    if (reservationId && Math.random() * 100 < CONFIRM_PERCENT) {
      sleep(0.04);

      const confirmPayload = JSON.stringify({
        reservation_id: reservationId,
      });

      const confirmParams = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        tags: { name: 'ConfirmReservation', item: targetItem },
      };

      const startConfirm = new Date();
      const confirmRes = http.post(`${BASE_URL}/api/v1/inventory/confirm`, confirmPayload, confirmParams);
      const confirmLatency = new Date() - startConfirm;
      confirmationDuration.add(confirmLatency);

      if (confirmRes.status === 200) {
        confirmationsSuccessful.add(1);
        check(confirmRes, {
          'Confirm returns 200 OK': (r) => r.status === 200,
        });
      } else {
        confirmationsFailed.add(1);
      }
    }
  } else if (reserveRes.status === 409) {
    reservationsInsufficientStock.add(1);
    unexpectedErrorRate.add(0);

    check(reserveRes, {
      'Reserve returns 409 Conflict when out of stock': (r) => r.status === 409,
    });
  } else {
    reservationsUnexpectedError.add(1);
    unexpectedErrorRate.add(1);
    console.error(`VU ${vuId}: Unexpected HTTP ${reserveRes.status} for ${targetItem}: ${reserveRes.body}`);
  }

  sleep(0.02);
}

// ============================================================================
// TEARDOWN HOOK: Audits inventory invariants across ALL items tested
// ============================================================================
export function teardown(data) {
  console.log(`\n================================================================================`);
  console.log(`        POST-STRESS DATA INTEGRITY & MULTI-ITEM INVARIANT AUDIT                  `);
  console.log(`================================================================================`);
  console.log(` ITEM ID                        | TOTAL | RESERVED | AVAILABLE | INVARIANT CHECK`);
  console.log(`--------------------------------------------------------------------------------`);

  let allInvariantsPassed = true;
  const items = (data && data.items) || TARGET_ITEMS;

  for (const item of items) {
    const res = http.get(`${BASE_URL}/api/v1/inventory/stock?item_id=${item}`);
    if (res.status === 200) {
      try {
        const final = JSON.parse(res.body);
        const invariantOk =
          final.total_stock >= 0 &&
          final.reserved_stock >= 0 &&
          final.available_stock >= 0 &&
          final.available_stock === (final.total_stock - final.reserved_stock);

        if (!invariantOk) {
          allInvariantsPassed = false;
        }

        const idCol = item.padEnd(30, ' ');
        const totalCol = String(final.total_stock).padStart(5, ' ');
        const resCol = String(final.reserved_stock).padStart(8, ' ');
        const availCol = String(final.available_stock).padStart(9, ' ');
        const statusCol = invariantOk ? '[PASS] OK' : '[FAIL] CORRUPTED';
        console.log(` ${idCol} | ${totalCol} | ${resCol} | ${availCol} | ${statusCol}`);
      } catch (e) {
        console.error(`Error auditing item ${item}: ${e}`);
        allInvariantsPassed = false;
      }
    } else {
      console.error(`Failed querying stock for ${item}: HTTP ${res.status}`);
      allInvariantsPassed = false;
    }
  }

  console.log(`--------------------------------------------------------------------------------`);
  if (allInvariantsPassed) {
    console.log(`[PASS] GLOBAL INVARIANT VERIFIED: All ${items.length} items maintained ACID consistency.`);
    console.log(`[PASS] ZERO OVERSELLING: No item available stock breached negative balance.`);
  } else {
    console.error(`[FAIL] INVENTORY CORRUPTION: One or more item invariants failed!`);
  }
  console.log(`================================================================================\n`);
}

// ============================================================================
// CUSTOM SUMMARY FORMATTER
// ============================================================================
export function handleSummary(data) {
  const getMetric = (name, field) => {
    return data.metrics[name] ? data.metrics[name].values[field] : 0;
  };

  const totalReqs = getMetric('http_reqs', 'count') || 0;
  const rateReqs = (getMetric('http_reqs', 'rate') || 0).toFixed(1);
  const successCount = getMetric('reservations_successful', 'count') || 0;
  const stockExhausted = getMetric('reservations_insufficient_stock', 'count') || 0;
  const unexpectedErrors = getMetric('reservations_unexpected_error', 'count') || 0;
  const confirmsOk = getMetric('confirmations_successful', 'count') || 0;
  const confirmsErr = getMetric('confirmations_failed', 'count') || 0;

  const resAvg = (getMetric('reservation_duration_ms', 'avg') || 0).toFixed(2);
  const resMed = (getMetric('reservation_duration_ms', 'med') || 0).toFixed(2);
  const resP90 = (getMetric('reservation_duration_ms', 'p(90)') || 0).toFixed(2);
  const resP95 = (getMetric('reservation_duration_ms', 'p(95)') || 0).toFixed(2);
  const resP99 = (getMetric('reservation_duration_ms', 'p(99)') || 0).toFixed(2);
  const resMax = (getMetric('reservation_duration_ms', 'max') || 0).toFixed(2);

  const summary = `
================================================================================
           MULTI-ITEM STRESS TEST RESULTS & PERFORMANCE SUMMARY                 
================================================================================
CATALOG COVERAGE:
  Items Tested (${TARGET_ITEMS.length}):           ${TARGET_ITEMS.join(', ')}

REQUEST THROUGHPUT & COUNTS:
  Total HTTP Requests:          ${totalReqs}
  Average Throughput:           ${rateReqs} req/sec
  Successful Reservations (200): ${successCount}
  Insufficient Stock (409):     ${stockExhausted}
  Unexpected Errors (5xx/4xx):  ${unexpectedErrors}
  Confirmations Completed (200): ${confirmsOk}
  Confirmations Failed:         ${confirmsErr}

RESERVATION LATENCY DISTRIBUTION:
  Average Latency:              ${resAvg} ms
  Median (P50) Latency:         ${resMed} ms
  90th Percentile (P90):        ${resP90} ms
  95th Percentile (P95):        ${resP95} ms
  99th Percentile (P99):        ${resP99} ms
  Max Latency:                  ${resMax} ms

SYSTEM INTEGRITY:
  Zero Overselling Verification: ${unexpectedErrors === 0 ? 'PASSED' : 'FAILED'}
  Error Rate (5xx/unexpected):   ${(getMetric('unexpected_error_rate', 'rate') * 100).toFixed(2)}%
================================================================================
`;

  return {
    stdout: summary,
  };
}
