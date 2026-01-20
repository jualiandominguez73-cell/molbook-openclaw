#!/bin/bash
# System cron wrapper for daily-weather-steve
# Schedule: 5:55 AM daily (55 5 * * *)

SCRIPT="/Users/steve/clawd/personal-scripts/daily-weather-steve.sh"
# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

CLAWDBOT="/Users/steve/Library/pnpm/clawdbot"

# Run the actual script
OUTPUT=$("$SCRIPT" 2>&1) || true

# Send output via clawdbot agent
if [ -n "$OUTPUT" ]; then
    "$CLAWDBOT" agent --agent main --message "$OUTPUT" --deliver --reply-channel telegram --reply-account steve --reply-to 1191367022
else
    "$CLAWDBOT" agent --agent main --message "⚠️ daily-weather-steve produced no output" --deliver --reply-channel telegram --reply-account steve --reply-to 1191367022
fi
