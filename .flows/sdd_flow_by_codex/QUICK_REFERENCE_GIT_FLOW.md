# Git Flow Quick Reference - SDD Flow

## 🚀 TL;DR - Quick Start

```bash
# 1. Generate SDD with git workflow
./generate-sdd.sh --requirements my-feature.md --git-workflow

# 2. Start auto-commit daemon (MANDATORY)
cd my-feature-sdd/trello-cards
nohup ../../auto-commit-daemon.sh --feature "my-feature" &

# 3. Execute cards 01 -> 02 -> ... -> NN

# 4. After final card: Create PR (MANDATORY)
./smart_commit.sh --feature "my-feature"
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
gh pr create --title "feat: my-feature" --body "Implementation complete"
```

## 📜 Auto-Commit Daemon Commands

```bash
# Start daemon (5-min interval, recommended)
nohup ./auto-commit-daemon.sh --feature "feature-name" &

# Start daemon (custom interval)
nohup ./auto-commit-daemon.sh --feature "feature-name" --interval 600 &

# Check if running
ps aux | grep auto-commit-daemon

# Stop daemon
./auto-commit-daemon.sh --stop

# Dry run (test without committing)
./auto-commit-daemon.sh --feature "feature-name" --dry-run
```

## 🎯 PR Creation Commands

```bash
# After completing final card:

# Check git status
git status

# Commit any remaining changes
./smart_commit.sh --feature "feature-name"

# Push branch
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"

# Create PR (requires GitHub CLI: brew install gh)
gh pr create \
  --title "feat: feature-name implementation" \
  --body "Complete implementation

- Feature: feature-name
- Cards completed: X
- Status: Ready for review" \
  --base main
```

## ⚠️ Forceful Rules

1. **MUST start auto-commit daemon** before first card
2. **MUST create PR** after final card
3. **DO NOT** mark complete without PR
4. **FAILURE TO CREATE PR = INCOMPLETE**
5. Each card **MUST** check git status

## 🔧 Troubleshooting

### Daemon not running?
```bash
./auto-commit-daemon.sh --stop
nohup ./auto-commit-daemon.sh --feature "feature-name" &
```

### PR creation fails?
```bash
# Install GitHub CLI
brew install gh  # macOS
sudo apt install gh  # Ubuntu

# Authenticate
gh auth login

# Retry PR creation
gh pr create --title "feat: feature-name" --body "..."
```

### Conflicts during execution?
```bash
# Daemon handles commits automatically
# If manual needed:
./smart_commit.sh --feature "feature-name"
```

## 📋 Checklist

**Before starting:**
- [ ] Generated SDD with `--git-workflow`
- [ ] Started auto-commit daemon
- [ ] Checked daemon is running

**After each card:**
- [ ] Verified git status clean
- [ ] Updated state.json
- [ ] Moved to next card

**After final card:**
- [ ] All changes committed
- [ ] Branch pushed to remote
- [ ] PR created on GitHub
- [ ] PR has proper description
- [ ] Implementation marked complete

---

**REMEMBER: Git flow is MANDATORY and enforced throughout SDD Flow.**