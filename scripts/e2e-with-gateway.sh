#!/usr/bin/env bash
# Start a test gateway and run E2E tests against it
# Usage: ./scripts/e2e-with-gateway.sh [port] [test-pattern]

set -euo pipefail

TEST_PORT="${1:-8081}"
TEST_PATTERN="${2:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "E2E Test Runner"
echo "  Port: $TEST_PORT"
echo "  Pattern: ${TEST_PATTERN:-all tests}"
echo ""

# Create isolated config directory
CONFIG_DIR=$(mktemp -d)
trap 'rm -rf "$CONFIG_DIR"' EXIT

# Create test config
cat > "$CONFIG_DIR/clawdbot.json" << EOF
{
  "gateway": {
    "port": $TEST_PORT
  }
}
EOF

echo "Starting test gateway on port $TEST_PORT..."

# Start gateway in background
CLAWDBOT_CONFIG_PATH="$CONFIG_DIR/clawdbot.json" \
  pnpm --dir "$REPO_ROOT" clawdbot gateway --port "$TEST_PORT" &
GATEWAY_PID=$!

# Ensure cleanup on exit
# shellcheck disable=SC2329
cleanup() {
  echo ""
  echo "Stopping gateway (PID: $GATEWAY_PID)..."
  kill "$GATEWAY_PID" 2>/dev/null || true
  wait "$GATEWAY_PID" 2>/dev/null || true
  rm -rf "$CONFIG_DIR"
}
trap cleanup EXIT

# Wait for gateway to be ready
echo "Waiting for gateway to be ready..."
for i in {1..30}; do
  if curl -s "http://localhost:$TEST_PORT/health" >/dev/null 2>&1; then
    echo "Gateway is ready!"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Error: Gateway failed to start within 30 seconds"
    exit 1
  fi
  sleep 1
done

echo ""
echo "Running E2E tests..."
echo ""

# Run tests
if [[ -n "$TEST_PATTERN" ]]; then
  CLAWDBOT_GATEWAY_PORT=$TEST_PORT pnpm --dir "$REPO_ROOT" test:e2e -- --grep "$TEST_PATTERN"
else
  CLAWDBOT_GATEWAY_PORT=$TEST_PORT pnpm --dir "$REPO_ROOT" test:e2e
fi

TEST_EXIT=$?

echo ""
if [[ $TEST_EXIT -eq 0 ]]; then
  echo "E2E tests passed!"
else
  echo "E2E tests failed (exit code: $TEST_EXIT)"
fi

exit $TEST_EXIT
