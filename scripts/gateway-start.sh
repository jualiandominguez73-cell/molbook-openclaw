#!/bin/bash

# Gateway startup wrapper
# Cleans stale lock files before starting the gateway
# This is used by PM2 as a pre-startup hook

set -e

LOCK_FILES=(
  "$HOME/.clawdbot/gateway.lock"
  "$HOME/.clawdbot/moltbot.lock"
  "/tmp/moltbot-gateway.lock"
)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning stale lock files..."

for lock_file in "${LOCK_FILES[@]}"; do
  if [ -f "$lock_file" ]; then
    file_age=$(($(date +%s) - $(stat -c%Y "$lock_file" 2>/dev/null || stat -f%m "$lock_file" 2>/dev/null || echo 0)))

    # Clean if older than 5 minutes
    if [ "$file_age" -gt 300 ]; then
      rm -f "$lock_file" 2>/dev/null && echo "  Removed: $lock_file"
    fi
  fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Lock cleanup complete. Starting gateway..."

# Start the actual gateway
cd /root/moltbot
exec node dist/entry.js gateway --port 18789
