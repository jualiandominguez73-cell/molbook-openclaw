#!/bin/bash
# System cron wrapper for daily-recap-posterboard
# Schedule: 5:00 PM daily (0 17 * * *)

SCRIPT="/Users/steve/clawd/personal-scripts/daily-recap-steve.sh"
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
    "$CLAWDBOT" agent --agent main --message "⚠️ daily-recap produced no output" --deliver --reply-channel telegram --reply-account steve --reply-to 1191367022
fi
