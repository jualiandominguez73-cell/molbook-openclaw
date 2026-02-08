#!/usr/bin/env bash
set -euo pipefail

# OpenClaw visual snapshot helper (Peekaboo)
#
# Usage:
#   bash scripts/openclaw-visual-snapshot.sh ["OpenClaw"]
#
# Output:
#   /tmp/openclaw-visual-snapshot-<timestamp>/
#     permissions.txt
#     menubar.json
#     windows.json
#     frontmost.png
#     ui-map.png

APP_NAME="${1:-OpenClaw}"
TS="$(date +"%Y%m%d-%H%M%S")"
OUT_DIR="/tmp/openclaw-visual-snapshot-${TS}"

mkdir -p "${OUT_DIR}"

echo "[1/6] Checking Peekaboo permissions…"
peekaboo permissions > "${OUT_DIR}/permissions.txt" || true

echo "[2/6] Capturing menubar list…"
peekaboo menubar list --json > "${OUT_DIR}/menubar.json" || true

echo "[3/6] Capturing windows list…"
peekaboo list windows --json > "${OUT_DIR}/windows.json" || true

echo "[4/6] Trying to focus ${APP_NAME} (best-effort)…"
peekaboo window focus --app "${APP_NAME}" 2>/dev/null || true
sleep 0.3

echo "[5/6] Capturing frontmost window screenshot…"
peekaboo image --mode frontmost --retina --path "${OUT_DIR}/frontmost.png" || true

echo "[6/6] Capturing annotated UI map (screen 0)…"
peekaboo see --mode screen --screen-index 0 --annotate --path "${OUT_DIR}/ui-map.png" || true

echo "Done. Artifacts in: ${OUT_DIR}"
