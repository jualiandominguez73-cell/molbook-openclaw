#!/usr/bin/env bash
set -euo pipefail

echo "=== Building OpenClaw in Docker (no host dependencies needed) ==="
echo ""

# Build OpenClaw in a temporary Docker container
# This way you don't need pnpm or Node.js on your host machine
docker run --rm \
  -v "$(pwd)":/app \
  -w /app \
  node:22-alpine \
  sh -c '
    echo "Installing build tools..."
    apk add --no-cache bash git
    npm install -g pnpm@10.23.0

    echo "Installing dependencies..."
    pnpm install --frozen-lockfile --ignore-scripts

    echo "Building OpenClaw..."
    pnpm build

    echo "Build complete! dist/ folder created."
  '

echo ""
echo "=== Build Complete ==="
echo "You can now run: bash scripts/test-asksage-simple.sh"