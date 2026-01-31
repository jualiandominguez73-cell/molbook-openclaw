#!/bin/bash

# Google Drive sync monitor
# Checks if Google Drive Desktop is currently syncing

STATE_FILE="$HOME/.clawdbot-gdrive-sync-state"

# Check Google Drive status using AppleScript
check_sync_status() {
    # Try to get status from Google Drive app
    status=$(osascript -e 'tell application "System Events"
        if exists process "Google Drive" then
            tell process "Google Drive"
                try
                    set statusText to description of menu bar item 1 of menu bar 1
                    return statusText
                end try
            end tell
        end if
    end tell' 2>/dev/null)
    
    # Alternative: Check for .tmp files in Google Drive folder
    if [ -z "$status" ]; then
        tmp_count=$(find "$HOME/Google Drive" -name "*.tmp" -o -name ".tmp.*" 2>/dev/null | wc -l)
        if [ "$tmp_count" -gt 0 ]; then
            echo "syncing"
        else
            echo "idle"
        fi
    else
        echo "$status"
    fi
}

current_status=$(check_sync_status)

# Read previous state
if [ -f "$STATE_FILE" ]; then
    previous_status=$(cat "$STATE_FILE")
else
    previous_status="unknown"
fi

# Save current state
echo "$current_status" > "$STATE_FILE"

# Detect sync completion
if [[ "$previous_status" =~ [Ss]ync ]] && [[ ! "$current_status" =~ [Ss]ync ]]; then
    echo "SYNC_COMPLETE"
    exit 0
elif [[ "$current_status" =~ [Ss]ync ]]; then
    echo "SYNCING"
    exit 1
else
    echo "IDLE"
    exit 2
fi
