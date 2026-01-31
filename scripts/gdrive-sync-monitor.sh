#!/bin/bash

# Monitor and notify when Google Drive sync completes
STATE_FILE="$HOME/.clawdbot-gdrive-sync-state"

check_sync_status() {
    # Check for .tmp files or sync indicators
    tmp_count=$(find "$HOME/Google Drive" -name "*.tmp" -o -name ".tmp.*" 2>/dev/null | wc -l)
    
    # Also check if GoogleDrive process is doing heavy I/O
    gdrive_cpu=$(ps aux | grep "[G]oogle Drive" | awk '{print $3}' | head -1)
    
    if [ "$tmp_count" -gt 0 ] || [ "$(echo "$gdrive_cpu > 10" | bc 2>/dev/null)" = "1" ]; then
        echo "syncing"
    else
        echo "idle"
    fi
}

current_status=$(check_sync_status)

if [ -f "$STATE_FILE" ]; then
    previous_status=$(cat "$STATE_FILE")
else
    previous_status="unknown"
fi

echo "$current_status" > "$STATE_FILE"

# If we transitioned from syncing to idle, notify
if [ "$previous_status" = "syncing" ] && [ "$current_status" = "idle" ]; then
    # Send notification via Clawdbot
    echo "Google Drive sync completed!"
    exit 0
fi

exit 1
