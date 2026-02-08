#!/usr/bin/env bash
set -euo pipefail

# OpenClaw UI snapshot bundle (Peekaboo)
#
# Purpose: collect a small, consistent set of artifacts to debug OpenClaw UI state.
# Requirements:
#   - macOS
#   - peekaboo installed and permitted (Screen Recording + Accessibility)
#
# Usage:
#   ./scripts/openclaw-ui-snapshot.sh
#
# Output:
#   Prints the output folder path (default: /tmp/openclaw-ui-snapshot-YYYYmmdd-HHMMSS)

ts="$(date +%Y%m%d-%H%M%S)"
out="/tmp/openclaw-ui-snapshot-$ts"
mkdir -p "$out"

# Capture permission + discovery info (best-effort; don't abort if these fail).
peekaboo permissions > "$out/peekaboo-permissions.txt" 2>&1 || true
peekaboo menubar list --json > "$out/menubar.json" 2>&1 || true
peekaboo list windows --json > "$out/windows.json" 2>&1 || true

# Capture images (these should succeed once Screen Recording is granted).
peekaboo image --mode screen --screen-index 0 --retina --path "$out/screen.png"
peekaboo image --mode frontmost --retina --path "$out/frontmost.png"
peekaboo see --mode screen --screen-index 0 --annotate --path "$out/ui-map.png"

echo "$out"
