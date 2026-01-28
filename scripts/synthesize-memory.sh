#!/bin/bash
# synthesize-memory.sh — Weekly synthesis of extracted facts
# Runs Sundays to review facts, update summaries, prune stale context
# Uses a better model for synthesis quality

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAWD_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${HOME}/.clawdbot/logs/memory-synthesis.log"
PPL_SCRIPT="$CLAWD_DIR/skills/ppl-gift/scripts/ppl.py"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting weekly memory synthesis"

# Get this week's journal entries with fact-extraction tag
WEEK_START=$(date -v-7d '+%Y-%m-%d' 2>/dev/null || date -d '7 days ago' '+%Y-%m-%d')

log "Reviewing facts since $WEEK_START"

# Fetch recent journal entries
cd "$CLAWD_DIR"
RECENT_JOURNAL=$(uv run "$PPL_SCRIPT" journal-search "fact-extraction" --limit 100 2>/dev/null || echo "")

if [ -z "$RECENT_JOURNAL" ]; then
    log "No recent fact extractions found, skipping synthesis"
    exit 0
fi

# Create synthesis prompt
SYNTHESIS_PROMPT='You are a memory synthesis agent. Review these extracted facts from the past week and:

1. IDENTIFY contradictions or updates (e.g., "Sarah got promoted" supersedes "Sarah is a junior")
2. GROUP related facts by person/topic
3. SUMMARIZE key changes in relationships, projects, and life status
4. FLAG any stale or outdated facts that should be marked historical

Facts from this week:
'"$RECENT_JOURNAL"'

Output a synthesis report in this format:

## Key Updates This Week
- [Summary of major changes]

## People Updates
- [Person]: [Current status summary]

## Superseded Facts
- "[Old fact]" → Now: "[New understanding]"

## Stale Context to Review
- [Any facts that seem outdated or need verification]

Provide actionable synthesis:'

# Run synthesis with a better model (flash for speed/quality balance)
SYNTHESIS=$(echo "$SYNTHESIS_PROMPT" | moltbot agent --model flash --message - --no-stream 2>/dev/null || echo "No synthesis available")

# Save synthesis to journal
if [ -n "$SYNTHESIS" ] && [ "$SYNTHESIS" != "No synthesis available" ]; then
    uv run "$PPL_SCRIPT" journal-add \
        --title "🧠 Weekly Memory Synthesis - $(date '+%Y-%m-%d')" \
        --body "$SYNTHESIS" \
        --tags "memory-synthesis,weekly-review"
    
    log "Synthesis saved to journal"
    
    # Also update MEMORY.md with key insights
    MEMORY_FILE="$CLAWD_DIR/memory.md"
    if [ -f "$MEMORY_FILE" ]; then
        # Extract just the key updates section
        KEY_UPDATES=$(echo "$SYNTHESIS" | sed -n '/## Key Updates/,/##/p' | head -20)
        
        if [ -n "$KEY_UPDATES" ]; then
            # Append to memory file under a dated section
            echo "" >> "$MEMORY_FILE"
            echo "## Weekly Synthesis $(date '+%Y-%m-%d')" >> "$MEMORY_FILE"
            echo "$KEY_UPDATES" >> "$MEMORY_FILE"
            log "Updated MEMORY.md with synthesis"
        fi
    fi
else
    log "Synthesis failed or empty"
fi

log "Weekly synthesis complete"
