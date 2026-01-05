# Card {NN}: {FEATURE_NAME} - {CARD_TITLE}

| Field | Value |
|-------|-------|
| **ID** | {PROJ}-{NN} |
| **Story Points** | {SP} |
| **Depends On** | {DEPENDS_ON} |
| **Sprint** | {SPRINT} |

## User Story

> As a {ROLE}, I want {ACTION} so that {BENEFIT}.

## Context

Read before starting:
- [requirements.md#section](../requirements.md) - Specific requirement
- [ui-flow.md#section](../ui-flow.md) - UI context
- [Existing pattern](./path/to/similar/feature)

## Instructions

### Step 1: {Action}

```bash
# Exact commands to run
cat {FILE_PATH} | head -50
```

### Step 2: Create/Modify File

```bash
# Edit file: {FILE_PATH}
```

```typescript
// {DESCRIPTION_OF_CODE}
{CODE_SNIPPET}
```

### Step 3: Verification

```bash
# Verify changes
grep -A 5 "{PATTERN}" {FILE_PATH}
```

### Step 4: Test

```bash
# Run tests
{TEST_COMMAND}
```

## Acceptance Criteria

- [ ] {CRITERION_1}
- [ ] {CRITERION_2}
- [ ] {CRITERION_3}
- [ ] Type checking passes: `pnpm type-check`
- [ ] No lint errors: `pnpm lint`
- [ ] Git status clean (changes committed via auto-daemon or manual)

## Next Steps

After completing this card:
1. Check git status (ensure auto-commit ran or commit manually)
   ```bash
   git status
   # If changes present: ./smart_commit.sh --feature "{FEATURE_NAME}"
   ```
2. Update state.json: set card {NN} to "completed"
3. Read next card: [{NN+1}-{TITLE}](./{NN+1}-{FEATURE}-xxx.md)
4. Continue execution

⚠️ **Important**: Auto-commit daemon should have caught changes, but verify before proceeding.
