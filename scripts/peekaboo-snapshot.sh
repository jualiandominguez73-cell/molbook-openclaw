#!/usr/bin/env bash
set -euo pipefail

# peekaboo-snapshot.sh
#
# Purpose: capture one high-signal screenshot + an annotated UI map for debugging.
# Output files are written to /tmp by default to avoid accidental commits.
#
# Usage:
#   scripts/peekaboo-snapshot.sh
#   OUT_DIR=/tmp/openclaw-visuals scripts/peekaboo-snapshot.sh
#
# Requirements:
#   - macOS
#   - peekaboo CLI installed
#   - Screen Recording + Accessibility permissions granted for the terminal app

OUT_DIR="${OUT_DIR:-/tmp/openclaw-visuals}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT_DIR"

FRONTMOST_PNG="$OUT_DIR/openclaw-frontmost-${TS}.png"
SCREEN_PNG="$OUT_DIR/openclaw-screen0-${TS}.png"
UIMAP_PNG="$OUT_DIR/openclaw-uimap-screen0-${TS}.png"

printf '== Peekaboo permissions ==\n'
peekaboo permissions || true

printf '\n== Capturing screenshots ==\n'
# Frontmost window (best when OpenClaw Control UI is focused)
peekaboo image --mode frontmost --retina --path "$FRONTMOST_PNG" || true

# Whole screen (fallback if frontmost capture fails)
peekaboo image --mode screen --screen-index 0 --retina --path "$SCREEN_PNG" || true

printf '\n== Generating UI map ==\n'
peekaboo see --mode screen --screen-index 0 --annotate --path "$UIMAP_PNG" || true

printf '\n== Output ==\n'
printf 'Frontmost: %s\n' "$FRONTMOST_PNG"
printf 'Screen0:    %s\n' "$SCREEN_PNG"
printf 'UI map:     %s\n' "$UIMAP_PNG"
