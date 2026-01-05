# SDD Flow

> Transform raw requirements into production-ready specifications with executable Trello cards.

## Quick Start

```bash
# Generate SDD from requirements
./generate-sdd.sh --requirements <file.md>

# Preview without creating files
./generate-sdd.sh --requirements <file.md> --dry-run

# With validation
./generate-sdd.sh --requirements <file.md> --validate
```

## Flow Overview

```
INPUT → CONTEXT → GAPS → OUTPUT
  │        │        │       │
  v        v        v       v
 raw    project   filled   SDD +
 reqs   patterns  gaps    Cards
```

## Phases

| Phase | Description | Details |
|-------|-------------|---------|
| 1 | Input | Collect raw requirements |
| 2 | Context | Analyze project patterns |
| 3 | Gaps | Fill gaps via interview |
| 4 | Output | Generate SDD + cards |

See `FLOW/` for detailed phase documentation.

## Structure

```
sdd_flow/
├── README.md              # This file
├── 00_START_HERE.md       # Entry point
├── FLOW/                  # Phase documentation
│   ├── 01_INPUT.md
│   ├── 02_CONTEXT.md
│   ├── 03_GAPS.md
│   └── 04_OUTPUT.md
├── TEMPLATES/             # SDD document templates
├── TRELLO_TEMPLATES/      # Card templates
├── SYSTEM/                # System documentation
├── prompts/               # Interview prompts
├── examples/              # Sample requirements
└── scripts (*.sh)         # Automation
```

## Output

Generated SDD package:

```
<feature>-sdd/
├── README.md              # Entry point
├── requirements.md        # Functional requirements
├── ui-flow.md            # User journey
├── gaps.md               # Decisions
├── domain-spec.md        # Optional domain spec
├── manual-e2e-test.md    # Test checklist
└── trello-cards/
    ├── KICKOFF.md        # Agent entry point
    ├── BOARD.md          # Card index
    ├── state.json        # Progress tracking
    ├── progress.md       # Visual progress
    └── 01-*.md ... NN-*.md  # Executable cards
```

## Card Count

**Agent decides automatically.** Fight complexity - fewer cards is better.

| Score | Cards | Approach |
|-------|-------|----------|
| < 5 | 1-4 | Minimal, focused |
| 5-10 | 5-8 | Standard |
| 11-20 | 9-14 | Detailed |
| > 20 | Split into phases |

See `CARD_COUNT_GUIDELINES.md` for scoring formula.

## Scripts

| Script | Purpose |
|--------|---------|
| `generate-sdd.sh` | Main SDD generator |
| `validate-sdd.sh` | Quality validation |
| `validate-requirements.sh` | Input validation |
| `code-review.sh` | AI consultation (optional) |
| `gap-interview-tui.sh` | Interactive gap filling |

## Principles

1. **No placeholders** in final outputs
2. **No assumptions** - clarify gaps with user
3. **KISS** - max 4 SP per card
4. **Linear execution** - cards run in order
5. **Self-contained** - each card has full context

## For AI Agents

**Entry point:** `START.md`

```
Read START.md and follow the execution protocol.
```

Or execute generated SDD:
```
Read <feature>-sdd/trello-cards/KICKOFF.md
```
