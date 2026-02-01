#!/bin/bash
# Proper gateway restart script - avoids pkill/nohup lock issues
# Usage: ~/scripts/restart-gateway.sh [--background]

set -e
cd /home/liam

echo "Stopping existing gateway..."
pnpm moltbot gateway stop 2>/dev/null || true

# Wait for lock to be released
sleep 2

if [[ "$1" == "--background" ]]; then
  echo "Starting gateway in background..."
  nohup pnpm moltbot gateway run --bind loopback --port 18789 --force > /tmp/moltbot-gateway.log 2>&1 &
  sleep 3
  pnpm moltbot gateway status
else
  echo "Starting gateway (foreground, Ctrl+C to stop)..."
  pnpm moltbot gateway run --bind loopback --port 18789 --force
fi
