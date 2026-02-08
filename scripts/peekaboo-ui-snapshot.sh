#!/usr/bin/env bash
set -euo pipefail

# OpenClaw UI snapshot bundle (Peekaboo)
#
# Creates a small, consistent artifact bundle under /tmp that helps debug
# “what’s on-screen / what’s focused / what UI elements exist”.
#
# Usage:
#   bash scripts/peekaboo-ui-snapshot.sh
#
# Outputs:
#   /tmp/openclaw-ui-snapshot-YYYYMMDD-HHMMSS/

if ! command -v peekaboo >/dev/null 2>&1; then
  echo "peekaboo not found in PATH. Install it first:" >&2
  echo "  brew install steipete/tap/peekaboo" >&2
  exit 127
fi

ts="$(date +%Y%m%d-%H%M%S)"
out="/tmp/openclaw-ui-snapshot-${ts}"
mkdir -p "$out"

echo "Saving OpenClaw UI snapshot bundle to: $out"

# These probes are useful even when screenshot capture is blocked.
peekaboo --version >"$out/peekaboo-version.txt" 2>&1 || true
peekaboo permissions >"$out/peekaboo-permissions.txt" 2>&1 || true
peekaboo menubar list --json >"$out/menubar.json" 2>&1 || true
peekaboo list windows --json >"$out/windows.json" 2>&1 || true

# Images / UI map. If Screen Recording isn’t granted, these may fail.
peekaboo image --mode screen --screen-index 0 --retina --path "$out/screen.png" \
  >"$out/image-screen.log" 2>&1 || true
peekaboo image --mode frontmost --retina --path "$out/frontmost.png" \
  >"$out/image-frontmost.log" 2>&1 || true
peekaboo see --mode screen --screen-index 0 --annotate --path "$out/ui-map.png" \
  >"$out/see-ui-map.log" 2>&1 || true

cat >"$out/README.txt" <<'EOF'
OpenClaw UI Snapshot Bundle

If screenshots are blank or missing:
- Check peekaboo-permissions.txt
- Ensure macOS Screen Recording + Accessibility are enabled for your terminal
  app (Terminal/iTerm) and Peekaboo (or Peekaboo Bridge), then quit & reopen
  the terminal app and re-run this script.

High-signal artifacts to share:
- frontmost.png (what window was focused)
- ui-map.png (annotated UI element map)
- peekaboo-permissions.txt
EOF

echo "Saved: $out"
