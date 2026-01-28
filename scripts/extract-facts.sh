#!/bin/bash
# extract-facts.sh — Extract durable facts from recent conversations
# Runs on a schedule to build compounding memory in ppl.gift
# Uses cheap model (GLM/minimax) for extraction (~$0.001/run)

set -euo pipefail

# Source environment (for API keys in cron context)
[ -f ~/.zshenv ] && source ~/.zshenv 2>/dev/null || true
[ -f ~/.config/clawdbot/env ] && source ~/.config/clawdbot/env 2>/dev/null || true

# Fallback: get from 1Password if not set
if [ -z "${OPENAI_API_KEY:-}" ]; then
    OPENAI_API_KEY=$(op read "op://Personal/OpenAI API Key/credential" 2>/dev/null || echo "")
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo "ERROR: OPENAI_API_KEY not found" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAWD_DIR="$(dirname "$SCRIPT_DIR")"
STATE_FILE="$CLAWD_DIR/memory/.fact-extraction-state.json"
LOG_FILE="${HOME}/.clawdbot/logs/fact-extraction.log"
PPL_SCRIPT="$CLAWD_DIR/skills/ppl-gift/scripts/ppl.py"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Initialize state file if it doesn't exist
if [ ! -f "$STATE_FILE" ]; then
    echo '{"lastExtractedTimestamp": 0, "extractionCount": 0}' > "$STATE_FILE"
fi

LAST_EXTRACTED=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['lastExtractedTimestamp'])")
NOW=$(date +%s)

log "Starting fact extraction (last run: $LAST_EXTRACTED)"

# Get recent session transcripts (last 30 mins if we have state, otherwise last hour)
LOOKBACK_SECONDS=3600
if [ "$LAST_EXTRACTED" -gt 0 ]; then
    LOOKBACK_SECONDS=$((NOW - LAST_EXTRACTED + 300))  # Add 5 min buffer
fi

# Find transcripts modified since last extraction
TRANSCRIPTS_DIR="${HOME}/.clawdbot/agents/main/sessions"
if [ ! -d "$TRANSCRIPTS_DIR" ]; then
    log "No transcripts directory found, skipping"
    exit 0
fi

# Get recent transcript content (limited to avoid huge prompts)
RECENT_CONTENT=$(find "$TRANSCRIPTS_DIR" -name "*.jsonl" -mmin -60 -exec tail -100 {} \; 2>/dev/null | head -500 || true)

if [ -z "$RECENT_CONTENT" ]; then
    log "No recent conversation content found, skipping"
    exit 0
fi

# Create extraction prompt
EXTRACT_PROMPT='You are a fact extraction agent. Extract DURABLE facts from the conversation below.

Rules:
1. Only extract facts that will be true for weeks/months (not temporary things)
2. Focus on: relationships, status changes, milestones, preferences, decisions
3. Skip: casual chat, temporary plans, routine tasks
4. For each fact, identify if it relates to a PERSON (name them) or is GENERAL

Output JSON array:
[
  {"type": "person", "name": "Sarah", "fact": "Changed jobs, now works at NewCo", "category": "status"},
  {"type": "general", "fact": "Prefers morning meetings before 10am", "category": "preference"}
]

Categories: relationship, milestone, status, preference, decision, project

If no durable facts found, output: []

CONVERSATION:
'"$RECENT_CONTENT"'

Extract durable facts (JSON only):'

# Call OpenAI for cheap, fast extraction (gpt-4o-mini ~$0.15/1M tokens)
# Write prompt to temp file to avoid escaping issues
PROMPT_FILE=$(mktemp)
echo "$EXTRACT_PROMPT" > "$PROMPT_FILE"

EXTRACTED=$(python3 -c "
import json, sys, urllib.request

with open('$PROMPT_FILE', 'r') as f:
    prompt = f.read()

data = json.dumps({
    'model': 'gpt-4o-mini',
    'messages': [{'role': 'user', 'content': prompt}],
    'max_tokens': 1000,
    'temperature': 0.3
}).encode()

req = urllib.request.Request(
    'https://api.openai.com/v1/chat/completions',
    data=data,
    headers={
        'Authorization': 'Bearer $OPENAI_API_KEY',
        'Content-Type': 'application/json'
    }
)

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
        print(result['choices'][0]['message']['content'])
except Exception as e:
    print('[]')
" 2>/dev/null || echo "[]")

rm -f "$PROMPT_FILE"

# Parse and validate JSON
FACTS=$(echo "$EXTRACTED" | python3 -c "
import sys, json, re

text = sys.stdin.read()
# Try to find JSON array in response
match = re.search(r'\[.*\]', text, re.DOTALL)
if match:
    try:
        facts = json.loads(match.group())
        print(json.dumps(facts))
    except:
        print('[]')
else:
    print('[]')
" 2>/dev/null || echo "[]")

FACT_COUNT=$(echo "$FACTS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")

log "Extracted $FACT_COUNT durable facts"

if [ "$FACT_COUNT" -eq 0 ]; then
    # Update state even if no facts
    python3 -c "
import json
state = json.load(open('$STATE_FILE'))
state['lastExtractedTimestamp'] = $NOW
json.dump(state, open('$STATE_FILE', 'w'))
"
    exit 0
fi

# Process each fact
PPL_DIR="$CLAWD_DIR/skills/ppl-gift"

echo "$FACTS" | python3 -c "
import sys, json, subprocess, os

facts = json.load(sys.stdin)
ppl_dir = '$PPL_DIR'
ppl_script = '$PPL_SCRIPT'

def run_ppl(*args):
    '''Run ppl.py with uv from the skill directory'''
    cmd = ['uv', 'run', 'python', ppl_script] + list(args)
    return subprocess.run(cmd, capture_output=True, text=True, cwd=ppl_dir)

for fact in facts:
    fact_type = fact.get('type', 'general')
    fact_text = fact.get('fact', '')
    category = fact.get('category', 'note')
    
    if not fact_text:
        continue
    
    if fact_type == 'person':
        name = fact.get('name', 'Unknown')
        # Search for contact in ppl.gift
        result = run_ppl('search', name)
        
        if 'Found 0' in result.stdout or result.returncode != 0:
            # No contact found, add to journal instead
            run_ppl('journal-add',
                '--title', f'📝 {category.upper()}: {name}',
                '--body', fact_text,
                '--tags', f'fact-extraction,{category},{name.lower().replace(\" \", \"-\")}'
            )
            print(f'  → Journal: {name} - {fact_text[:50]}...')
        else:
            # Extract contact ID and add note
            import re
            match = re.search(r'│\s*(\d+)\s*│', result.stdout)
            if match:
                contact_id = match.group(1)
                run_ppl('add-note', contact_id,
                    '--title', f'📝 {category.upper()}',
                    '--body', fact_text
                )
                print(f'  → Note on {name}: {fact_text[:50]}...')
            else:
                # Fallback to journal
                run_ppl('journal-add',
                    '--title', f'📝 {category.upper()}: {name}',
                    '--body', fact_text,
                    '--tags', f'fact-extraction,{category}'
                )
                print(f'  → Journal: {name} - {fact_text[:50]}...')
    else:
        # General fact goes to journal
        run_ppl('journal-add',
            '--title', f'💡 {category.upper()}',
            '--body', fact_text,
            '--tags', f'fact-extraction,{category}'
        )
        print(f'  → Journal: {fact_text[:50]}...')
"

# Update state
python3 -c "
import json
state = json.load(open('$STATE_FILE'))
state['lastExtractedTimestamp'] = $NOW
state['extractionCount'] = state.get('extractionCount', 0) + 1
json.dump(state, open('$STATE_FILE', 'w'))
"

log "Fact extraction complete"
