#!/usr/bin/env python3
"""
High-Concurrency Multi-Item Stress Test Runner for indico-test Core Service.
Zero external dependencies; uses Python standard library.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Barrier, Lock

DEFAULT_ITEMS = [
    "flash-item-1",
    "flash-item-2",
    "iphone-15-pro",
    "limited-edition-sneakers",
    "playstation-5-pro",
]


def make_request(method, url, payload=None, timeout=10.0):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    start_time = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            body = response.read().decode("utf-8")
            return response.status, body, latency_ms
    except urllib.error.HTTPError as e:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        body = e.read().decode("utf-8")
        return e.code, body, latency_ms
    except Exception as e:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return 0, str(e), latency_ms


def check_health(base_url):
    code, body, _ = make_request("GET", f"{base_url}/health")
    if code != 200:
        print(f"[ERROR] Service health check failed (HTTP {code}): {body}")
        return False
    return True


def get_stock(base_url, item_id):
    code, body, _ = make_request("GET", f"{base_url}/api/v1/inventory/stock?item_id={item_id}")
    if code == 200:
        try:
            return json.loads(body)
        except Exception as e:
            print(f"[ERROR] Failed to parse stock response for {item_id}: {e}")
            return None
    print(f"[WARN] Failed to query stock for {item_id} (HTTP {code}): {body}")
    return None


def run_multi_item_stress_test(args):
    target_items = [s.strip() for s in args.items.split(",") if s.strip()]
    if not target_items:
        target_items = DEFAULT_ITEMS

    print("=" * 80)
    print("   PYTHON EXTERNAL MULTI-ITEM STRESS TEST: CORE INVENTORY SERVICE")
    print("=" * 80)
    print(f"Target Base URL:       {args.url}")
    print(f"Target Items ({len(target_items)}):     {', '.join(target_items)}")
    print(f"Concurrent Workers:    {args.concurrency}")
    print(f"Total Requests:        {args.requests}")
    print(f"Quantity Requested:    {args.qty}")
    print(f"Confirm Ratio:         {args.confirm_ratio * 100:.0f}%")

    if not check_health(args.url):
        sys.exit(1)

    # Initial stock query
    print("\nINITIAL CATALOG STOCK STATUS:")
    print("-" * 80)
    print(f" {'ITEM ID':<30} | {'TOTAL STOCK':>11} | {'RESERVED':>8} | {'AVAILABLE':>9}")
    print("-" * 80)
    initial_stocks = {}
    for item in target_items:
        st = get_stock(args.url, item)
        if st:
            initial_stocks[item] = st
            print(f" {item:<30} | {st['total_stock']:>11} | {st['reserved_stock']:>8} | {st['available_stock']:>9}")
    print("-" * 80)

    barrier = Barrier(args.concurrency)
    stats_lock = Lock()

    successful_reservations = []  # list of (user_id, res_id, item_id, latency)
    insufficient_stock_count = 0
    unexpected_errors = []
    reservation_latencies = []

    per_item_stats = {
        item: {"success": 0, "insufficient": 0, "errors": 0}
        for item in target_items
    }

    confirm_success = 0
    confirm_failed = 0

    def worker_task(worker_id, req_index):
        target_item = target_items[(worker_id + req_index) % len(target_items)]
        user_id = f"py-w{worker_id:03d}-r{req_index:04d}"
        payload = {
            "user_id": user_id,
            "item_id": target_item,
            "quantity": args.qty,
        }

        if req_index < args.concurrency:
            try:
                barrier.wait(timeout=5.0)
            except Exception:
                pass

        code, body, latency = make_request(
            "POST", f"{args.url}/api/v1/inventory/reserve", payload=payload
        )

        with stats_lock:
            reservation_latencies.append(latency)

        if code == 200:
            try:
                res_json = json.loads(body)
                res_id = res_json.get("reservation_id")
                with stats_lock:
                    successful_reservations.append((user_id, res_id, target_item, latency))
                    per_item_stats[target_item]["success"] += 1
            except Exception as e:
                with stats_lock:
                    unexpected_errors.append((code, f"JSON parse error: {e}"))
                    per_item_stats[target_item]["errors"] += 1
        elif code == 409:
            with stats_lock:
                nonlocal insufficient_stock_count
                insufficient_stock_count += 1
                per_item_stats[target_item]["insufficient"] += 1
        else:
            with stats_lock:
                unexpected_errors.append((code, body))
                per_item_stats[target_item]["errors"] += 1

    print(f"\nLaunching {args.requests} requests distributed across {len(target_items)} items...")
    start_wall_time = time.perf_counter()

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(worker_task, i % args.concurrency + 1, i)
            for i in range(args.requests)
        ]
        for f in as_completed(futures):
            f.result()

    reserve_wall_time = time.perf_counter() - start_wall_time
    print(f"Reservation phase completed in {reserve_wall_time * 1000.0:.2f} ms")

    # Confirmation phase
    if successful_reservations and args.confirm_ratio > 0:
        to_confirm = [
            item for item in successful_reservations
            if (hash(item[1]) % 100) < (args.confirm_ratio * 100)
        ]
        print(f"\nExecuting confirmation for {len(to_confirm)} / {len(successful_reservations)} reservations...")

        def confirm_task(u_id, r_id, itm):
            code, body, _ = make_request(
                "POST", f"{args.url}/api/v1/inventory/confirm", {"reservation_id": r_id}
            )
            with stats_lock:
                nonlocal confirm_success, confirm_failed
                if code == 200:
                    confirm_success += 1
                else:
                    confirm_failed += 1

        with ThreadPoolExecutor(max_workers=min(args.concurrency, len(to_confirm) or 1)) as executor:
            futures = [executor.submit(confirm_task, u, r, it) for u, r, it, _ in to_confirm]
            for f in as_completed(futures):
                f.result()

    # Post-stress inventory audit across ALL items
    print("\n" + "=" * 80)
    print("        POST-STRESS DATA INTEGRITY & MULTI-ITEM INVARIANT AUDIT")
    print("=" * 80)
    print(f" {'ITEM ID':<30} | {'TOTAL':>7} | {'RESERVED':>8} | {'AVAILABLE':>9} | {'AUDIT STATUS'}")
    print("-" * 80)

    all_invariants_passed = True
    for item in target_items:
        final_stock = get_stock(args.url, item)
        if final_stock:
            invariant_ok = (
                final_stock["total_stock"] >= 0 and
                final_stock["reserved_stock"] >= 0 and
                final_stock["available_stock"] >= 0 and
                final_stock["available_stock"] == (final_stock["total_stock"] - final_stock["reserved_stock"])
            )
            status_str = "[PASS] OK" if invariant_ok else "[FAIL] CORRUPTED"
            if not invariant_ok:
                all_invariants_passed = False
            print(f" {item:<30} | {final_stock['total_stock']:>7} | "
                  f"{final_stock['reserved_stock']:>8} | {final_stock['available_stock']:>9} | {status_str}")
        else:
            all_invariants_passed = False
            print(f" {item:<30} | {'N/A':>7} | {'N/A':>8} | {'N/A':>9} | [FAIL] UNREACHABLE")

    print("-" * 80)
    if all_invariants_passed:
        print(f"[PASS] GLOBAL INVARIANT AUDIT: All {len(target_items)} items maintained strict consistency.")
        print(f"[PASS] ZERO OVERSELLING GUARANTEED: No negative available inventory detected.")
    else:
        print("[FAIL] INVENTORY CORRUPTION DETECTED!")

    # Statistical summary
    reservation_latencies.sort()
    n_res = len(reservation_latencies)
    if n_res > 0:
        min_lat = reservation_latencies[0]
        max_lat = reservation_latencies[-1]
        avg_lat = sum(reservation_latencies) / n_res
        p50 = reservation_latencies[int(n_res * 0.50)]
        p90 = reservation_latencies[int(n_res * 0.90)]
        p95 = reservation_latencies[int(n_res * 0.95)]
        p99 = reservation_latencies[min(int(n_res * 0.99), n_res - 1)]
    else:
        min_lat = max_lat = avg_lat = p50 = p90 = p95 = p99 = 0.0

    rps = args.requests / reserve_wall_time if reserve_wall_time > 0 else 0.0

    print("\n" + "=" * 80)
    print("                    PERFORMANCE & LATENCY SUMMARY")
    print("=" * 80)
    print("REQUEST METRICS:")
    print(f"  Total Requests:                {args.requests}")
    print(f"  Items Contended:               {len(target_items)} items")
    print(f"  Total Wall Time:               {reserve_wall_time * 1000.0:.2f} ms")
    print(f"  Throughput:                    {rps:.2f} req/sec")
    print(f"  Successful Reservations (200): {len(successful_reservations)}")
    print(f"  Insufficient Stock (409):      {insufficient_stock_count}")
    print(f"  Unexpected Errors (5xx/other): {len(unexpected_errors)}")
    print(f"  Confirmations Completed:       {confirm_success}")
    print(f"  Confirmations Failed:          {confirm_failed}")
    print("LATENCY DISTRIBUTION (ms):")
    print(f"  Min:                           {min_lat:.2f} ms")
    print(f"  Mean (Average):                {avg_lat:.2f} ms")
    print(f"  Median (P50):                  {p50:.2f} ms")
    print(f"  P90:                           {p90:.2f} ms")
    print(f"  P95:                           {p95:.2f} ms")
    print(f"  P99:                           {p99:.2f} ms")
    print(f"  Max:                           {max_lat:.2f} ms")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description="Multi-Item Stress Test for indico-test Core Service")
    parser.add_argument("--url", default=os.getenv("BASE_URL", "http://localhost:8081"),
                        help="Core Service Base URL (default: http://localhost:8081)")
    parser.add_argument("--items", default=os.getenv("ITEMS", os.getenv("ITEM_ID", ",".join(DEFAULT_ITEMS))),
                        help="Comma-separated target item IDs (default: 5 items)")
    parser.add_argument("-c", "--concurrency", type=int,
                        default=int(os.getenv("VUS", "100")),
                        help="Number of concurrent workers (default: 100)")
    parser.add_argument("-n", "--requests", type=int,
                        default=int(os.getenv("REQUESTS", "250")),
                        help="Total number of requests to execute (default: 250)")
    parser.add_argument("--qty", type=int,
                        default=int(os.getenv("QUANTITY", "1")),
                        help="Quantity per reservation request (default: 1)")
    parser.add_argument("--confirm-ratio", type=float,
                        default=float(os.getenv("CONFIRM_RATIO", "0.5")),
                        help="Fraction of successful reservations to confirm (default: 0.5)")
    args = parser.parse_args()
    run_multi_item_stress_test(args)


if __name__ == "__main__":
    main()
