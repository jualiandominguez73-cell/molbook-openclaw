# {FEATURE_NAME} - Trello Board

> Scrum Master: AI Agent | Sprint: Linear Execution
> Story Point Cap: 4 SP per card | Principle: KISS

## Execution Order

```
┌────────────────────────────────────────────────────────┐
│                     EXECUTION PIPELINE                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│  SPRINT 1: Foundation (Config + Core)                  │
│  ┌─────┐   ┌─────┐   ┌─────┐                          │
│  │ 01  │ → │ 02  │ → │ 03  │                          │
│  │ XSP │   │ XSP │   │ XSP │                          │
│  └─────┘   └─────┘   └─────┘                          │
│  Config    Module    Tests                             │
│                                                        │
│  SPRINT 2: Integration                                 │
│  ┌─────┐   ┌─────┐   ┌─────┐                          │
│  │ 04  │ → │ 05  │ → │ 06  │                          │
│  │ XSP │   │ XSP │   │ XSP │                          │
│  └─────┘   └─────┘   └─────┘                          │
│  Hook      Ack       Button                            │
│                                                        │
│  SPRINT 3: Execution Engine                            │
│  ┌─────┐   ┌─────┐   ┌─────┐                          │
│  │ 07  │ → │ 08  │ → │ 09  │                          │
│  │ XSP │   │ XSP │   │ XSP │                          │
│  └─────┘   └─────┘   └─────┘                          │
│  Executor  Parser    Deliver                           │
│                                                        │
│  SPRINT 4: Integration & Polish                        │
│  ┌─────┐   ┌─────┐   ┌─────┐                          │
│  │ 10  │ → │ 11  │ → │ 12  │                          │
│  │ XSP │   │ XSP │   │ XSP │                          │
│  └─────┘   └─────┘   └─────┘                          │
│  Wire      Errors    E2E                               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Card Index

| Card | Title | SP | Depends On | Status |
|------|-------|----|-----------:|--------|
<!-- 
  CARD_ENTRIES_WILL_BE_GENERATED_HERE
  Example format (replace with actual cards):
  | [01](./01-{FEATURE}-xxx.md) | Card 1 Title | 2 | - | TODO |
  | [02](./02-{FEATURE}-yyy.md) | Card 2 Title | 3 | 01 | TODO |
  | [NN](./NN-{FEATURE}-zzz.md) | Card N Title | 2 | XX | TODO |
-->

## Sprint Summary

<!-- SPRINT_BREAKDOWN_WILL_BE_GENERATED_BASED_ON_CARDS -->

**Total Story Points: <CALCULATED_TOTAL>

---

## ⚡ Auto-Commit Daemon (MANDATORY)

**Activate before starting cards:**
```bash
nohup ./auto-commit-daemon.sh --feature "{FEATURE_NAME}" &
```

**This ensures:**
- ✅ Changes committed every 5 minutes automatically
- ✅ Never lose work
- ✅ Incremental commit history
- ✅ Zero cognitive overhead

---

## 🎯 Final PR Creation (CARD {CARD_COUNT})

**After completing final card, execute:**
```bash
# 1. Verify all committed
git status

# 2. Push branch
./smart_commit.sh --feature "{FEATURE_NAME}"
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"

# 3. Create Pull Request (MANDATORY)
gh pr create \
  --title "feat: {FEATURE_NAME} implementation" \
  --body "Complete implementation of {FEATURE_NAME}\n\n- Cards: {CARD_COUNT}\n- Status: Ready\n\nSee trello-cards/KICKOFF.md for details"
```

**⚠️ DO NOT MARK COMPLETE WITHOUT PR ⚠️**
