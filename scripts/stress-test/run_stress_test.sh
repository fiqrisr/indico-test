#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Unified Multi-Item Stress Test Runner for indico-test Core Service
# Supports:
#   1. Native k6 (k6 run scripts/stress-test/k6_stress_test.js)
#   2. Docker k6 (docker run --rm -i --net=host grafana/k6 run -)
#   3. Python 3  (python3 scripts/stress-test/stress_test.py)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Default parameters
BASE_URL="${BASE_URL:-http://localhost:8081}"
ITEMS="${ITEMS:-${ITEM_ID:-flash-item-1,flash-item-2,iphone-15-pro,limited-edition-sneakers,playstation-5-pro}}"
VUS="${VUS:-100}"
DURATION="${DURATION:-10s}"
QUANTITY="${QUANTITY:-1}"
CONFIRM_PERCENT="${CONFIRM_PERCENT:-50}"
TOOL="${TOOL:-auto}"
RESET_STOCK="${RESET_STOCK:-false}"
INITIAL_STOCK="${INITIAL_STOCK:-50}"

# Help message
usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  -u, --url <URL>           Base URL for Core API (default: http://localhost:8081)
  -i, --items <LIST>        Comma-separated list of target item IDs (at least 5 default)
                            (default: flash-item-1,flash-item-2,iphone-15-pro,limited-edition-sneakers,playstation-5-pro)
  -v, --vus <COUNT>         Concurrent Virtual Users (default: 100)
  -d, --duration <TIME>     Test duration, e.g. 10s, 30s, 1m (default: 10s)
  -q, --quantity <N>        Quantity requested per reservation (default: 1)
  -c, --confirm <PERCENT>   Percentage of successful reservations to confirm (0-100, default: 50)
  -t, --tool <TOOL>         Load testing tool: k6 | docker-k6 | python | auto (default: auto)
  -r, --reset-stock         Reset all target item stocks in DB before running (default: false)
  -s, --stock <N>           Stock amount per item when resetting (default: 50)
  -h, --help                Show this help message

Examples:
  # Multi-item stress test across 5 default items
  ./scripts/stress-test/run_stress_test.sh --vus 100 --duration 10s

  # Reset 5 items to 50 stock each and run k6
  ./scripts/stress-test/run_stress_test.sh --reset-stock --stock 50 --vus 100

  # Custom list of items
  ./scripts/stress-test/run_stress_test.sh --items "flash-item-1,flash-item-2,nintendo-switch-oled,rtx-5090-oc,macbook-pro-m4"

  # Standalone Python runner
  ./scripts/stress-test/run_stress_test.sh --tool python --vus 50
EOF
    exit 0
}

# Parse command line flags
while [[ $# -gt 0 ]]; do
    case "$1" in
        -u|--url) BASE_URL="$2"; shift 2 ;;
        -i|--items|--item) ITEMS="$2"; shift 2 ;;
        -v|--vus) VUS="$2"; shift 2 ;;
        -d|--duration) DURATION="$2"; shift 2 ;;
        -q|--quantity) QUANTITY="$2"; shift 2 ;;
        -c|--confirm) CONFIRM_PERCENT="$2"; shift 2 ;;
        -t|--tool) TOOL="$2"; shift 2 ;;
        -r|--reset-stock) RESET_STOCK=true; shift ;;
        -s|--stock) INITIAL_STOCK="$2"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "[ERROR] Unknown option: $1" >&2; usage ;;
    esac
done

echo "================================================================================"
echo "    INDICO CORE SERVICE MULTI-ITEM STRESS TEST ORCHESTRATOR                     "
echo "================================================================================"
echo "Core Base URL:       ${BASE_URL}"
echo "Target Items:        ${ITEMS}"
echo "Concurrent VUs:      ${VUS}"
echo "Test Duration:       ${DURATION}"
echo "Requested Quantity:  ${QUANTITY}"
echo "Confirmation Ratio:  ${CONFIRM_PERCENT}%"
echo "Selected Tool:       ${TOOL}"
echo "--------------------------------------------------------------------------------"

# 1. Health check
echo "[1/4] Verifying Core API availability..."
if ! curl -s -f -m 3 "${BASE_URL}/health" >/dev/null 2>&1; then
    echo "[ERROR] Core service is not responding at ${BASE_URL}/health!"
    echo ""
    echo "To start the service:"
    echo "  1. Using Docker Compose:"
    echo "       docker compose up -d postgres core"
    echo "  2. Or locally from core directory:"
    echo "       cd core && go run ./cmd/api/main.go"
    echo ""
    exit 1
fi
echo "      -> Core service is healthy."

# 2. Optional: Reset database stock for all target items
if [ "${RESET_STOCK}" = "true" ]; then
    echo "[2/4] Resetting target items to ${INITIAL_STOCK} stock each..."
    if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q 'indico-test-postgres'; then
        IFS=',' read -ra ITEM_ARRAY <<< "${ITEMS}"
        for itm in "${ITEM_ARRAY[@]}"; do
            trimmed_itm="$(echo "${itm}" | xargs)"
            if [ -n "${trimmed_itm}" ]; then
                docker exec -i indico-test-postgres psql -U postgres -d indico_test_db -c \
                    "INSERT INTO inventory (item_id, total_stock) VALUES ('${trimmed_itm}', ${INITIAL_STOCK}) ON CONFLICT (item_id) DO UPDATE SET total_stock = ${INITIAL_STOCK}; DELETE FROM reservations WHERE item_id = '${trimmed_itm}';" >/dev/null
                echo "      -> Reset '${trimmed_itm}' to ${INITIAL_STOCK} units."
            fi
        done
        echo "      -> All target items reset successfully in PostgreSQL."
    else
        echo "      -> [WARN] Postgres docker container not found, skipping direct DB reset."
    fi
else
    echo "[2/4] Skipping stock reset (use --reset-stock to re-seed items)."
fi

# 3. Determine which tool to run
if [ "${TOOL}" = "auto" ]; then
    if command -v k6 >/dev/null 2>&1; then
        TOOL="k6"
    elif command -v docker >/dev/null 2>&1; then
        TOOL="docker-k6"
    elif command -v python3 >/dev/null 2>&1; then
        TOOL="python"
    else
        echo "[ERROR] Neither k6, docker, nor python3 was found on PATH." >&2
        exit 1
    fi
fi

echo "[3/4] Ready to execute using tool: ${TOOL}"
echo "[4/4] Executing multi-item stress test..."
echo "================================================================================"

case "${TOOL}" in
    k6)
        echo "Running native k6 binary across catalog items..."
        export BASE_URL ITEMS VUS DURATION QUANTITY CONFIRM_PERCENT
        k6 run "${SCRIPT_DIR}/k6_stress_test.js"
        ;;
    docker-k6)
        echo "Running k6 via Docker container (grafana/k6) across catalog items..."
        docker run --rm -i \
            --net=host \
            -e BASE_URL="${BASE_URL}" \
            -e ITEMS="${ITEMS}" \
            -e VUS="${VUS}" \
            -e DURATION="${DURATION}" \
            -e QUANTITY="${QUANTITY}" \
            -e CONFIRM_PERCENT="${CONFIRM_PERCENT}" \
            grafana/k6 run - < "${SCRIPT_DIR}/k6_stress_test.js"
        ;;
    python)
        echo "Running Python 3 standalone multi-item stress tester..."
        TOTAL_REQS=$(( VUS * 5 ))
        python3 "${SCRIPT_DIR}/stress_test.py" \
            --url "${BASE_URL}" \
            --items "${ITEMS}" \
            --concurrency "${VUS}" \
            --requests "${TOTAL_REQS}" \
            --qty "${QUANTITY}" \
            --confirm-ratio "$(awk "BEGIN {print ${CONFIRM_PERCENT}/100}")"
        ;;
    *)
        echo "[ERROR] Unknown tool '${TOOL}'. Supported: k6, docker-k6, python, auto" >&2
        exit 1
        ;;
esac

echo ""
echo "================================================================================"
echo "MULTI-ITEM STRESS TEST COMPLETED SUCCESSFULLY."
echo "================================================================================"
