# Agent Protocol - State Management & Execution

> Reference from KICKOFF.md when needed
> This document provides detailed state update patterns

## State File: state.json

The `state.json` file tracks execution progress. Update it after EACH card.

### State Structure

```json
{
  "overall_status": "IN_PROGRESS|COMPLETE|FAILED",
  "started_at": "2026-01-02T10:00:00Z",
  "completed_at": null,
  "current_card": "01",
  "agent_session_id": "{auto-generated-id}",
  "cards": {
    "01": {
      "status": "pending|in_progress|completed|failed",
      "title": "Config Schema",
      "started_at": null,
      "completed_at": null,
      "execution_time_seconds": null,
      "error": null
    },
    "02": { ... },
    ...
  },
  "execution_log": [
    {
      "timestamp": "2026-01-02T10:05:00Z",
      "level": "INFO|WARNING|ERROR",
      "message": "Started card 01",
      "card": "01"
    }
  ]
}
```

## State Update Patterns

### Pattern 1: Start Execution (First Run)

When starting fresh, create initial state:

```bash
cat > state.json << 'EOF'
{
  "overall_status": "IN_PROGRESS",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "current_card": "01",
  "agent_session_id": "session_$(date +%s)",
  "cards": {
    "01": { "status": "pending", "title": "Card 01 Title" },
    "02": { "status": "pending", "title": "Card 02 Title" },
    "03": { "status": "pending", "title": "Card 03 Title" },
    // ... additional cards as needed ...
    "NN": { "status": "pending", "title": "Card NN Title" }
  },
  "execution_log": []
}
EOF
```

Add to log:
```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "Execution started", card: null}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 2: Start a Card

Before executing card N, update its status:

```bash
# Update card status to "in_progress"
jq '.cards.{NN}.status = "in_progress" | .cards.{NN}.started_at = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Update current_card pointer
jq '.current_card = "{NN}"' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Add to execution log
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "Card {NN} started", card: "{NN}"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

**Example for card 01:**
```bash
jq '.cards.01.status = "in_progress" | .cards.01.started_at = "2026-01-02T10:05:00Z"' \
   state.json > state.json.tmp && mv state.json.tmp state.json

jq '.current_card = "01"' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

**Pattern X: Complete All Cards (Dynamic)**

When last card is completed:

```bash
# Get the last card number from the cards object
LAST_CARD=$(jq -r '.cards | keys | max' state.json)

# Check if all cards are complete
TOTAL_CARDS=$(jq -r '.cards | length' state.json)
COMPLETED_CARDS=$(jq -r '[.cards | to_entries[] | select(.value.status == "completed")] | length' state.json)

if [ "$TOTAL_CARDS" -eq "$COMPLETED_CARDS" ]; then
  # Update overall status
  jq '.overall_status = "COMPLETE" | .completed_at = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"' \
     state.json > state.json.tmp && mv state.json.tmp state.json

  # Add completion to log
  jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.execution_log += [{timestamp: $now, level: "INFO", message: "All cards completed!", card: null}]' \
     state.json > state.json.tmp && mv state.json.tmp state.json
fi
```

### Pattern 3: Complete a Card

After verifying all acceptance criteria:

```bash
# Calculate execution time
START_TIME=$(jq -r '.cards.{NN}.started_at' state.json)
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Calculate duration in seconds (simplified)
DURATION=300  # 5 minutes - calculate actual if needed

# Update card status to "completed"
jq --arg end "$END_TIME" --argjson dur "$DURATION" \
   '.cards.{NN}.status = "completed" | .cards.{NN}.completed_at = $end | .cards.{NN}.execution_time_seconds = $dur' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Add to execution log
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "Card {NN} completed", card: "{NN}"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

**Example for card 01:**
```bash
jq '.cards.01.status = "completed" | .cards.01.completed_at = "2026-01-02T10:10:00Z" | .cards.01.execution_time_seconds = 300' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 4: Fail a Card

If errors occur:

```bash
# Update card status to "failed"
jq --arg error "Error description here" \
   '.cards.{NN}.status = "failed" | .cards.{NN}.error = $error' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Update overall status
jq '.overall_status = "FAILED"' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Add error to execution log
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.execution_log += [{timestamp: $now, level: "ERROR", message: "Card {NN} failed: $error", card: "{NN}"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 5: Complete All Cards

When last card is completed:

```bash
# Update overall status
jq '.overall_status = "COMPLETE" | .completed_at = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Add completion to log
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "All cards completed!", card: null}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

## Execution Log Format

Each log entry should include:

```typescript
interface LogEntry {
  timestamp: string;  // ISO 8601 format
  level: "INFO" | "WARNING" | "ERROR";
  message: string;    // Clear description
  card: string | null; // Card number or null
}
```

**Log Message Examples:**

```json
{
  "timestamp": "2026-01-02T10:05:00Z",
  "level": "INFO",
  "message": "Card 01 started",
  "card": "01"
}

{
  "timestamp": "2026-01-02T10:10:00Z",
  "level": "INFO",
  "message": "Card 01 completed",
  "card": "01"
}

{
  "timestamp": "2026-01-02T10:15:00Z",
  "level": "ERROR",
  "message": "Card 02 failed: TypeError in detect.ts line 42",
  "card": "02"
}
```

## State Update Commands

### Install JQ (if not available)

```bash
# On Ubuntu/Debian
sudo apt-get install jq

# On macOS
brew install jq

# Check version
jq --version
```

### Helper Script: update-state.sh

Create this script in trello-cards/ directory:

```bash
cat > update-state.sh << 'EOF'
#!/bin/bash
# Update state.json helper script

set -e

ACTION=$1
CARD=$2
MESSAGE=$3

if [ -z "$ACTION" ]; then
  echo "Usage: $0 [start|complete|fail] <card> [message]"
  exit 1
fi

case $ACTION in
  start)
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       '.cards.'$CARD'.status = "in_progress" | .cards.'$CARD'.started_at = $now | .current_card = $CARD' \
       state.json > state.json.tmp && mv state.json.tmp state.json
    
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       '.execution_log += [{timestamp: $now, level: "INFO", message: "Card '"$CARD"' started", card: '"$CARD"'}]' \
       state.json > state.json.tmp && mv state.json.tmp state.json
    ;;
    
  complete)
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       '.cards.'$CARD'.status = "completed" | .cards.'$CARD'.completed_at = $now' \
       state.json > state.json.tmp && mv state.json.tmp state.json
    
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       '.execution_log += [{timestamp: $now, level: "INFO", message: "Card '"$CARD"' completed", card: '"$CARD"'}]' \
       state.json > state.json.tmp && mv state.json.tmp state.json
    ;;
    
  fail)
    if [ -z "$MESSAGE" ]; then
      echo "Error message required for fail action"
      exit 1
    fi
    
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg msg "$MESSAGE" \
       '.cards.'$CARD'.status = "failed" | .cards.'$CARD'.error = $msg | .overall_status = "FAILED"' \
       state.json > state.json.tmp && mv state.json.tmp state.json
    
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg msg "$MESSAGE" \
       '.execution_log += [{timestamp: $now, level: "ERROR", message: "Card '"$CARD"' failed: " + $msg, card: '"$CARD"'}]' \
       state.json > state.json.tmp && mv state.json.tmp state.json
    ;;
    
  *)
    echo "Unknown action: $ACTION"
    exit 1
    ;;
esac

echo "State updated: $ACTION card $CARD"
EOF

chmod +x update-state.sh
```

**Usage:**
```bash
./update-state.sh start 01
./update-state.sh complete 01
./update-state.sh fail 02 "Error message here"
```

## Verification Commands

### Check Current Status

```bash
# Show overall status
echo "Overall: $(jq -r '.overall_status' state.json)"
echo "Current: $(jq -r '.current_card' state.json)"

# Show all card statuses
jq -r '.cards | to_entries[] | "\(.key): \(.value.status)"' state.json

# Show failed cards
jq -r '.cards | to_entries[] | select(.value.status == "failed") | "\(.key): \(.value.error)"' state.json

# Show completed cards count
jq -r '[.cards | to_entries[] | select(.value.status == "completed")] | length' state.json
```

### View Execution Log

```bash
# Show recent log entries
jq -r '.execution_log[-5:] | reverse[] | "[\(.timestamp)] [\(.level)] \(.message)"' state.json

# Show errors only
jq -r '.execution_log[] | select(.level == "ERROR") | "[\(.timestamp)] Card \(.card): \(.message)"' state.json
```

## Completion Verification

### Check if All Cards Are Complete

```bash
TOTAL_CARDS=$(jq -r '.cards | length' state.json)
COMPLETED_CARDS=$(jq -r '[.cards | to_entries[] | select(.value.status == "completed")] | length' state.json)

if [ "$TOTAL_CARDS" -eq "$COMPLETED_CARDS" ]; then
  echo "✅ All $TOTAL_CARDS cards completed!"
  
  # Mark overall as complete
  ./update-state.sh complete {LAST_CARD}
  
  echo "🎉 Implementation complete!"
else
  echo "Progress: $COMPLETED_CARDS/$TOTAL_CARDS cards completed"
fi
```

---

## Troubleshooting

### Error: "jq: command not found"

Install jq:
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Verify
jq --version
```

### Error: "Cannot iterate over null"

State.json is malformed. Recreate it:
```bash
# Backup old file
mv state.json state.json.backup

# Create new state
./update-state.sh init
```

### Error: "Permission denied"

Make script executable:
```bash
chmod +x update-state.sh
```

---

## Auto-Commit Subagent Protocol

**Spawn independent subagent for continuous commits:**

```bash
# Spawn auto-commit daemon as subagent
spawn_auto_commit() {
  nohup ./auto-commit-daemon.sh --feature "{FEATURE_NAME}" --interval 300 &
  echo $! > /tmp/auto-commit-pid
  echo "✅ Auto-commit subagent spawned (PID: $(cat /tmp/auto-commit-pid))"
}

# Call this at start of implementation
spawn_auto_commit

# To stop later:
# ./auto-commit-daemon.sh --stop
```

**What this subagent does:**
- Runs independently in background
- Checks git status every 5 minutes (300s)
- Auto-commits any changes using smart_commit.sh
- **Forceful**: Ensures you never lose work
- **Non-blocking**: Runs parallel to your execution
- **Safe**: Uses --auto flag (no prompts)

**Why this is critical:**
- Prevents large uncommitted changes
- Maintains git history throughout implementation
- Reduces cognitive load (don't think about commits)
- Ensures PR has incremental, logical commits

**Subagent Management:**
```bash
# Check if running
ps aux | grep auto-commit-daemon

# View daemon PID
cat /tmp/auto-commit-daemon.pid

# Stop explicitly
./auto-commit-daemon.sh --stop

# View daemon log (if using nohup)
tail -f nohup.out
```

---

**Protocol Version:** 1.0
**Required Tool:** jq (JSON processor)
**Recommended:** auto-commit-daemon.sh (for forceful git compliance)
