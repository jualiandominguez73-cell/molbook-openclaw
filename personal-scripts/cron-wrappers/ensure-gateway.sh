#!/bin/bash
# Ensure gateway is running before sending notifications

CLAWDBOT="/Users/steve/Library/pnpm/clawdbot"

ensure_gateway() {
    # Check if gateway is reachable
    if ! lsof -i :18789 >/dev/null 2>&1; then
        echo "Gateway not running, starting daemon..."
        "$CLAWDBOT" daemon start >/dev/null 2>&1
        sleep 5
    fi
}
