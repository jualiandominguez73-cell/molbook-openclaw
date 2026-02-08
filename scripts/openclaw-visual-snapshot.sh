#!/usr/bin/env bash
set -euo pipefail

# OpenClaw visual snapshot helper
#
# Purpose:
# - Quick, repeatable capture of a high-signal screenshot + annotated UI map.
# - Intended for debugging “what state is the OpenClaw UI in?”
#
# Outputs (default):
# - /tmp/openclaw-frontmost.png
# - /tmp/openclaw-ui-map.png
#
# Requirements:
# - macOS Screen Recording permission for Terminal (or iTerm) AND Peekaboo.
# - macOS Accessibility permission for Terminal (or iTerm) AND Peekaboo.
#
# Usage:
#   bash scripts/openclaw-visual-snapshot.sh

OUT_FRONTMOST="${OUT_FRONTMOST:-/tmp/openclaw-frontmost.png}"
OUT_UI_MAP="${OUT_UI_MAP:-/tmp/openclaw-ui-map.png}"

if ! command -v peekaboo >/dev/null 2>&1; then
  cat <<'EOF'
peekaboo not found on PATH.

Install (Homebrew):
  brew install steipete/tap/peekaboo

Then re-run:
  bash scripts/openclaw-visual-snapshot.sh
EOF
  exit 1
fi

# Permissions check (non-fatal here; Peekaboo will print actionable errors).
peekaboo permissions || true

echo "Capturing frontmost window -> ${OUT_FRONTMOST}"
peekaboo image --mode frontmost --retina --path "${OUT_FRONTMOST}"

echo "Capturing annotated UI map (screen 0) -> ${OUT_UI_MAP}"
peekaboo see --mode screen --screen-index 0 --annotate --path "${OUT_UI_MAP}"

echo "Done."
