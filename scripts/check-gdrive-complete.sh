#!/bin/bash

# One-shot check: Is Google Drive currently syncing?
# Exit 0 if syncing just completed, exit 1 if still syncing, exit 2 if idle

STATE_FILE="$HOME/.gdrive-sync-state"

check_sync() {
    # Count temporary files
    tmp_count=$(find "$HOME/Google Drive" -name "*.tmp" -o -name ".tmp.*" 2>/dev/null | wc -l)
    
    if [ "$tmp_count" -gt 0 ]; then
        echo "syncing"
    else  
        echo "idle"
    fi
}

current=$(check_sync)
previous=$(cat "$STATE_FILE" 2>/dev/null || echo "idle")

# Save current state
echo "$current" > "$STATE_FILE"

# Check if sync just completed
if [ "$previous" = "syncing" ] && [ "$current" = "idle" ]; then
    echo "✅ Sync complete!"
    exit 0
elif [ "$current" = "syncing" ]; then
    echo "⏳ Still syncing..."
    exit 1
else
    echo "💤 Idle (not syncing)"
    exit 2
fi
