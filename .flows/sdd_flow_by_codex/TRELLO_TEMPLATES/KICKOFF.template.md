# {FEATURE_NAME} Implementation - AI Agent Kickoff

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🤖 AI AGENT INSTRUCTION                                                    ║
║                                                                              ║
║   Execute ALL {CARD_COUNT} cards below in LINEAR order.                      ║
║   Update state.json after EACH card.                                         ║
║   Do NOT stop until all cards are "completed".                               ║
║                                                                              ║
║   START NOW. First action: Read state.json, find first pending card.         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

> **ENTRY POINT**: This is the ONLY file you need. Everything is linked from here.
> This file is SELF-CONTAINED. Do not ask for clarification - all info is here.

## Mission

Implement the {FEATURE_NAME} feature by executing {CARD_COUNT} Trello cards in linear order.
Track progress in `state.json`. Update after each step. Never skip cards.

**DRY-RUN MODE IS ON** - no API costs during development.

## Protocol

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT EXECUTION LOOP                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. READ state.json → Find current card (status = "pending")            │
│  2. UPDATE state.json → Set card to "in_progress"                       │
│  3. READ card file → Execute all instructions                           │
│  4. VERIFY → Check all acceptance criteria                              │
│  5. UPDATE state.json → Set card to "completed" or "failed"             │
│  6. UPDATE progress.md → Render progress bar                            │
│  7. LOOP → Go to step 1 until all cards completed                       │
│                                                                         │
│  ON ERROR: Set card to "failed", add error message, STOP for help        │
│  ON COMPLETE: Set overall status to "COMPLETE", celebrate 🎉            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose | Agent Action |
|------|---------|--------------|
| [BOARD.md](./BOARD.md) | Card overview and pipeline | Read once at start |
| [state.json](./state.json) | Progress tracking | Read+write each card |
| [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) | State update patterns | Reference when needed |
| [01-*.md](./01-{FEATURE}-xxx.md) | First card | **Execute** |
| [02-*.md](./02-{FEATURE}-xxx.md) | Second card | **Execute** |
| ... | ... | ... |
| [{CARD_COUNT}-*.md](./{CARD_COUNT}-{FEATURE}-xxx.md) | Last card | **Execute** |

## Getting Started

```bash
cd trello-cards
ls -la
```

**First action:** Read [BOARD.md](./BOARD.md) to understand card sequence.

**Second action:** Read [state.json](./state.json) to find current card.

**Then:** Execute cards in order: 01 → 02 → 03 → ... → {CARD_COUNT}

## Completion Criteria

- [ ] All cards in state.json show "completed"
- [ ] No errors in execution log
- [ ] Manual E2E test passes (see card {CARD_COUNT})
- [ ] Ready for production with `DRY_RUN=false`

## Troubleshooting

### If a command fails:

1. **Read the error message**
2. **Check file exists:** `ls -la path/to/file`
3. **Check syntax:** `cat file | head -20`
4. **Check dependencies:** Previous cards complete?
5. **Document error** in state.json
6. **Get help** if stuck >10 minutes

### If state.json is missing:

```bash
cat > state.json << 'EOF'
{
  "overall_status": "IN_PROGRESS",
  "started_at": "{DATE}T{TIME}Z",
  "current_card": "01",
  "cards": {
    "01": { "status": "pending", "started_at": null, "completed_at": null },
    "02": { "status": "pending", "started_at": null, "completed_at": null },
    ...
    "{CARD_COUNT}": { "status": "pending", "started_at": null, "completed_at": null }
  },
  "execution_log": []
}
EOF
```

## Success Definition

This implementation is **SUCCESSFUL** when:

1. ✅ All {CARD_COUNT} cards completed
2. ✅ {FEATURE_NAME} triggers on correct keywords
3. ✅ Acknowledgment messages show properly
4. ✅ Execution completes successfully
5. ✅ Results delivered in correct format
6. ✅ Error handling works with retry
7. ✅ Manual E2E test passes
8. ✅ Code review shows no issues
9. ✅ DRY_RUN can be set to false safely

---

## 🎯 Git Flow Enforcement - MANDATORY

**You MUST follow git flow and create a Pull Request. This is NOT optional.**

### Phase 1: Auto-Commit Setup (Start Immediately)

Before executing cards, start the auto-commit daemon:

```bash
# Start background auto-commit subagent (checks every 5 minutes)
nohup ./auto-commit-daemon.sh --feature "{FEATURE_NAME}" &

# Or start with custom interval (e.g., 10 minutes)
nohup ./auto-commit-daemon.sh --feature "{FEATURE_NAME}" --interval 600 &

# Check daemon status
ps aux | grep auto-commit-daemon

# Stop daemon when done
./auto-commit-daemon.sh --stop
```

**What it does:**
- Spawns independent subagent that monitors for changes
- Auto-commits every 5 minutes (or custom interval) using smart_commit.sh
- Runs parallel to your work - never blocks execution
- **Forceful**: If you forget to commit, daemon does it for you

### Phase 2: Final Git Flow Steps (After Final Card)

**After completing card {CARD_COUNT}, you MUST execute these commands:**

```bash
# 1. Ensure all changes are committed (daemon likely did this)
git status

# 2. If any remaining changes, commit manually
./smart_commit.sh --feature "{FEATURE_NAME}"

# 3. Verify branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "On branch: $CURRENT_BRANCH"

# 4. Push branch to remote
GIT_PUSH_FORCEFUL=$(cat << 'EOFPUSH'
set -e
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Pushing branch: $CURRENT_BRANCH"
git push -u origin "$CURRENT_BRANCH"
echo "✅ Branch pushed successfully"
EOFPUSH
)
echo "$GIT_PUSH_FORCEFUL" | bash

# 5. Create Pull Request (FORCEFUL - DO NOT SKIP)
PR_COMMAND=$(cat << 'EOFPR'
set -e
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B | head -1)
echo "Creating PR for branch: $CURRENT_BRANCH"
echo "Title: $COMMIT_MSG"

# GitHub CLI PR creation
if command -v gh &> /dev/null; then
    gh pr create \
        --title "$COMMIT_MSG" \
        --body "Automated PR from SDD Flow implementation\\n\\n- Feature: {FEATURE_NAME}\\n- Cards completed: {CARD_COUNT}\\n- Status: Ready for review" \
        --base main
    echo "✅ Pull Request created successfully"
    echo "🌐 Visit: $(gh pr view --json url -q .url)"
else
    echo "⚠️  GitHub CLI not installed. Install it and run:"
    echo "gh pr create --title \"$COMMIT_MSG\" --body \"Implementation complete\""
    exit 1
fi
EOFPR
)
echo "$PR_COMMAND" | bash

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎉 FINAL MANDATORY STEP COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo "✅ All code committed via git"
echo "✅ Branch pushed to remote"
echo "✅ Pull Request created"
echo ""
echo "🚨 FAILURE TO CREATE PR = INCOMPLETE IMPLEMENTATION 🚨"
echo "═══════════════════════════════════════════════════════════"
```

### Phase 3: PR Requirements (Before Marking Complete)

**Your PR MUST include:**

```bash
# Verify PR was created
PR verification:
- [ ] PR exists on GitHub
- [ ] Base branch is 'main' or 'master'
- [ ] Title follows format: "feat: {FEATURE_NAME} implementation"
- [ ] Description includes:
  - Feature summary
  - Cards completed: {CARD_COUNT}
  - Link to trello-cards/KICKOFF.md
  - Test results
```

**DO NOT mark implementation complete until PR is created.**

---

**NOW BEGIN.** First card: [01-{FEATURE}-xxx.md](./01-{FEATURE}-config.md)
