#!/bin/bash

# Google Drive Sync Completion Monitor
# Run this script to get notified when Google Drive finishes syncing

STATE_FILE="$HOME/.gdrive-sync-state"
SLACK_WEBHOOK_URL="${CLAWDBOT_GDRIVE_SLACK_WEBHOOK:-}"

echo "🔍 Monitoring Google Drive sync status..."
echo "Press Ctrl+C to stop"

check_sync_status() {
    # Check for temporary sync files
    tmp_count=$(find "$HOME/Google Drive" -name "*.tmp" -o -name ".tmp.*" 2>/dev/null | wc -l)
    
    # Check Google Drive process CPU usage
    gdrive_cpu=$(ps aux | grep "[G]oogle Drive" | awk '{print $3}' | head -1)
    
    if [ "$tmp_count" -gt 0 ] || [ ! -z "$gdrive_cpu" ] && (( $(echo "$gdrive_cpu > 5.0" | bc -l 2>/dev/null || echo 0) )); then
        echo "syncing"
    else
        echo "idle"
    fi
}

# Read previous state or initialize
if [ -f "$STATE_FILE" ]; then
    previous_status=$(cat "$STATE_FILE")
else
    previous_status=$(check_sync_status)
    echo "$previous_status" > "$STATE_FILE"
    echo "📊 Initial status: $previous_status"
fi

while true; do
    current_status=$(check_sync_status)
    
    # Sync completion detected
    if [ "$previous_status" = "syncing" ] && [ "$current_status" = "idle" ]; then
        echo "✅ Google Drive sync completed!"
        
        # Send notification (you'll need to implement this based on your setup)
        osascript -e 'display notification "Your files are up to date" with title "Google Drive Sync Complete" sound name "Glass"'
        
        # Optionally post to Slack (requires setup)
        # curl -X POST -H 'Content-type: application/json' --data '{"text":"✅ Google Drive sync completed!"}' "$SLACK_WEBHOOK_URL"
        
        echo "🎉 Notification sent!"
        exit 0
    elif [ "$previous_status" != "$current_status" ]; then
        echo "📊 Status changed: $previous_status → $current_status"
    fi
    
    echo "$current_status" > "$STATE_FILE"
    previous_status="$current_status"
    
    sleep 30
done
