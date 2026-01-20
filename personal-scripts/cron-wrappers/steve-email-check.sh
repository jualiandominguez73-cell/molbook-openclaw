#!/bin/bash
# System cron wrapper for steve-email-check
# Schedule: hourly (0 * * * *)

SCRIPT="/Users/steve/clawd/personal-scripts/check-email-steve.sh"
# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

CLAWDBOT="/Users/steve/Library/pnpm/clawdbot"

# Run the actual script
OUTPUT=$("$SCRIPT" 2>&1) || true

# Only notify if there's meaningful output (skip empty/no-mail responses)
if [ -n "$OUTPUT" ] && ! echo "$OUTPUT" | grep -qi "no new\|no unread\|empty"; then
    "$CLAWDBOT" agent --agent main --message "$OUTPUT" --deliver --reply-channel telegram --reply-account steve --reply-to 1191367022
fi
