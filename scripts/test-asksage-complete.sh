#!/usr/bin/env bash
set -euo pipefail

echo "=== Complete Ask Sage Integration Test ==="
echo "This script will:"
echo "1. Build OpenClaw in Docker (no host dependencies)"
echo "2. Create test Docker image"
echo "3. Run integration tests"
echo ""

# Check API key
if [ -z "${ASKSAGE_API_KEY:-}" ]; then
  echo "Error: ASKSAGE_API_KEY not set"
  echo "Set it with: export ASKSAGE_API_KEY='your-key-here'"
  exit 1
fi

# Step 1: Build OpenClaw if needed
if [ ! -d "dist" ]; then
  echo "Step 1: Building OpenClaw (minimal build for CLI testing)..."
  bash scripts/docker-build-asksage-openclaw-minimal.sh
else
  echo "Step 1: dist/ folder exists, skipping build"
fi

echo ""
echo "Step 2: Running tests..."
bash scripts/test-asksage-simple.sh

echo ""
echo "=== Test Complete ==="