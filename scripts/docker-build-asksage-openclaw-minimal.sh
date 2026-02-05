#!/usr/bin/env bash
set -euo pipefail

echo "=== Building OpenClaw (minimal) in Docker ==="
echo "Note: This is a minimal build that skips canvas bundling"
echo "      Sufficient for testing the Ask Sage CLI integration"
echo ""

# Build OpenClaw in a temporary Docker container
# Minimal build: skip canvas bundling, just compile TypeScript
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

    echo "Building OpenClaw (minimal - skipping canvas bundle)..."
    # Create empty canvas bundle hash if missing
    mkdir -p src/canvas-host/a2ui
    touch src/canvas-host/a2ui/.bundle.hash

    # Run minimal build: just compile TypeScript
    npx tsdown

    # Run post-build scripts
    node --import tsx scripts/copy-hook-metadata.ts || echo "Hook metadata copy skipped"
    node --import tsx scripts/write-build-info.ts || echo "Build info skipped"

    echo "Minimal build complete! dist/ folder created."
  '

echo ""
echo "=== Build Complete ==="
echo "You can now run: bash scripts/test-asksage-simple.sh"