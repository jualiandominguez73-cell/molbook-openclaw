# SDD Flow - AI Agent Entry Point

> Read this file and execute the phases below to generate SDD documentation.

## Core Principle

```
┌─────────────────────────────────────────────────────────┐
│  FIGHT COMPLEXITY. MAINTAINABILITY IS THE GOAL.        │
│                                                         │
│  • Fewer cards = less overhead = easier to maintain    │
│  • Simple solutions > clever solutions                 │
│  • Each card must justify its existence                │
│  • If in doubt, simplify                               │
└─────────────────────────────────────────────────────────┘
```

## Mission

Transform raw requirements into production-ready SDD with executable Trello cards.

## Execution Protocol

```
PHASE 1 → PHASE 2 → PHASE 3 → PHASE 4
   │         │         │         │
 INPUT    CONTEXT    GAPS     OUTPUT
```

### Phase 1: Input
**Read:** `FLOW/01_INPUT.md`

1. Get raw requirements from user
2. Validate required information exists
3. Document in `raw-requirements.md`

### Phase 2: Context
**Read:** `FLOW/02_CONTEXT.md`

1. Analyze project structure (README, src/, docs/)
2. Identify existing patterns and conventions
3. Document in `project-context.md`

### Phase 3: Gaps
**Read:** `FLOW/03_GAPS.md`

1. Identify unknowns and ambiguities
2. Ask user gap-filling questions
3. Document decisions in `gaps.md`
4. **DO NOT PROCEED until all gaps filled**

### Phase 4: Output
**Read:** `FLOW/04_OUTPUT.md`

Generate SDD package:
```
<feature>-sdd/
├── README.md
├── requirements.md
├── ui-flow.md
├── gaps.md
├── manual-e2e-test.md
└── trello-cards/
    ├── KICKOFF.md
    ├── BOARD.md
    ├── state.json
    ├── progress.md
    └── 01-*.md ... NN-*.md
```

## Complexity Assessment (Agent Decides)

**You (the agent) determine complexity and card count.** Do not ask user.

### Assessment Formula

Count these factors from requirements:

| Factor | Points |
|--------|--------|
| New database table | +2 each |
| New API endpoint | +1 each |
| External integration | +4 each |
| New UI component | +2 each |
| Real-time features | +3 |
| Uses existing patterns only | -3 |
| Config-only change | -4 |
| Single file change | -3 |

### Score → Cards

| Score | Cards | SP Total |
|-------|-------|----------|
| < 5 | 1-4 | 4-10 |
| 5-10 | 5-8 | 10-20 |
| 11-20 | 9-14 | 20-35 |
| 21-30 | 15-22 | 35-50 |
| > 30 | Split into phases |

### Card Rules

- **Max 4 SP per card** (if bigger, split it)
- **Prefer fewer cards** with clear scope
- **Each card must be independently testable**
- **Fight the urge to over-engineer**

## Templates

| Type | Location |
|------|----------|
| SDD docs | `TEMPLATES/*.template.md` |
| Trello cards | `TRELLO_TEMPLATES/*.template.md` |

## Rules

1. **Stop only** for gap-filling questions
2. **No placeholders** in final outputs
3. **No assumptions** - ask user to clarify
4. **Agent decides** card count (not user)
5. **Max 4 SP** per card
6. **Fight complexity** - simpler is better

## Start Now

1. Ask user for raw requirements
2. Read `FLOW/01_INPUT.md`
3. Execute phases in order
4. Assess complexity yourself in Phase 4
