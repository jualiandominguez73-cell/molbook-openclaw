#!/bin/bash
# System cron wrapper for daily-verse
# Schedule: 6:05 AM daily (5 6 * * *)

# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

CLAWDBOT="/Users/steve/Library/pnpm/clawdbot"

# Run the verse script
OUTPUT=$(python3 /Users/steve/clawd/skills/bible/votd.py --download /tmp/votd.jpg 2>&1) || true

# Send the verse text and image via agent
if [ -n "$OUTPUT" ]; then
    if [ -f /tmp/votd.jpg ]; then
        "$CLAWDBOT" agent --agent main --message "$OUTPUT

MEDIA:/tmp/votd.jpg" --deliver --reply-channel telegram --reply-account steve --reply-to 1191367022
    else
        "$CLAWDBOT" agent --agent main --message "$OUTPUT" --deliver --reply-channel telegram --reply-account steve --reply-to 1191367022
    fi
fi
