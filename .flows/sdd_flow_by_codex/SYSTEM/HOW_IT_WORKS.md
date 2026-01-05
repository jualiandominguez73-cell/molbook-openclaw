# SDD Flow - System Overview

## 🎯 Purpose

SDD Flow is an **AI Agent Friendly system** that transforms raw, incomplete requirements into production-ready Spec-Driven Development (SDD) documentation with executable Trello cards.

## 🔄 System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      SDD FLOW PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │  Raw Input   │  ← User provides vague requirements         │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────┐                                           │
│  │ Project Analysis │  ← Read code + wiki for patterns        │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │ Gap Identification│ ← Find unknowns, conflicts, ambiguities│
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │ AI Consultation  │ ← Kimi + Claude collective decisions    │
│  │ (code-review.sh) │ ← Achieve 95%+ confidence per gap       │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  User Interview  │ ← Ask gap-filling questions             │
│  │  (fill blanks)   │ ← Document ALL answers                  │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  SDD Generation  │ ← Create structured docs (6 files)      │
│  │                  │ ← requirements.md                         │
│  │                  │ ← ui-flow.md                              │
│  │                  │ ← gaps.md (ALL filled)                   │
│  │                  │ ← keyword-detection.md (if needed)       │
│  │                  │ ← manual-e2e-test.md                     │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  Trello Cards    │ ← 12-15 executable cards                │
│  │  Generation      │ ← Max 4 SP per card (KISS)              │
│  │                  │ ← Full context + code snippets          │
│  │                  │ ← Linear execution (01 → 12)            │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  Code Review     │ ← Verify 95%+ confidence                │
│  │  & Verification  │ ← Check completeness, consistency       │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  README.md       │ ← Kickoff with pipeline diagram         │
│  │  (Entry Point)   │ ← Status: ✅ READY FOR IMPLEMENTATION  │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  Handoff         │ ← trello-cards/KICKOFF.md ready         │
│  │                  │ ← AI agent can execute non-stop         │
│  └──────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🎮 How to Run

### Method 1: Direct Execution (AI Agent)

```bash
cd .
cat README.md  # Read entry point
# Follow Phase 1 → 2 → 3 → 4 → 5
```

AI Agent follows the protocol step-by-step, consulting Kimi/Claude as needed.

### Method 2: User-Guided

```bash
cd .

# Check prerequisites
./code-review.sh --check-install

# Start gap interview (interactive)
echo "Starting gap analysis..."
# Agent asks questions, documents answers

# Generate SDD
./generate-sdd.sh --output ./my-feature-sdd

# Review
./code-review.sh --phase review --sdd-output ./my-feature-sdd
```

## 🧠 Key Principles

### 1. Confidence-Driven Decisions

**Rule:** Every gap decision must achieve 95%+ confidence

- Use `code-review.sh` for collective AI consultation
- If confidence < 95%, ask follow-up questions
- Document confidence levels in gaps.md
- Never guess - always verify

### 2. Pattern Alignment

**Rule:** All decisions must align with existing project patterns

- Read existing code before making decisions
- Follow naming conventions
- Reuse existing patterns (error handling, config, logging)
- Document pattern sources in gaps.md

### 3. Executable Specifications

**Rule:** Every Trello card must be immediately executable

- Include exact file paths
- Provide complete code snippets
- Add copy-paste commands
- Reference specific line numbers
- No "TODO" or "figure out later"

### 4. KISS Principle (Keep It Simple)

**Rule:** Maximum 4 Story Points per card

- Break down complex features
- Each card does ONE thing
- Linear execution (no branches)
- Clear acceptance criteria

### 5. Self-Contained

**Rule:** No external dependencies for execution

- All context in card files
- No "ask user for clarification"
- No "check external documentation"
- All decisions pre-made in gaps.md

## 📊 Confidence Tracking

### Gap Confidence Matrix

```markdown
| Gap ID | Question | Kimi | Claude | Avg | Status |
|--------|----------|------:|--------:|----:|--------|
| GAP-01 | Detection case-sensitive? | 96% | 98% | 97% | ✅ |
| GAP-02 | Max execution timeout? | 89% | 94% | 92% | 🔄 |
| GAP-03 | Error retry attempts? | 97% | 95% | 96% | ✅ |

Rule: Only proceed when ALL gaps ≥95%
```

### When to Consult AIs

Consult Kimi + Claude for:
- Architectural decisions
- Pattern selection
- Trade-off analysis (performance vs complexity)
- Error handling strategies
- Test coverage requirements
- Security considerations
- Any decision with <95% confidence

### When NOT to Consult AIs

Don't consult for:
- Trivial formatting (use existing patterns)
- File naming (follow project conventions)
- Code style (use linter)
- Obvious decisions (documented in requirements)

## 📁 Output Structure

```
generated-sdd/
├── README.md                      # Entry point, pipeline, quick ref
├── requirements.md                # Functional requirements (200+ lines)
├── ui-flow.md                     # User journey + message templates
├── keyword-detection.md           # If feature has triggers/keywords
├── gaps.md                        # ALL gaps filled, confidence levels
├── manual-e2e-test.md             # Test checklist
└── trello-cards/
    ├── BOARD.md                   # Pipeline visualization
    ├── KICKOFF.md                 # AI agent kickoff instructions
    ├── AGENT_PROTOCOL.md          # State update patterns
    ├── 01-card-name.md            # Story Points: 2
    ├── 02-card-name.md            # Story Points: 3
    ├── ... (12-15 cards total)
    └── 12-e2e-test.md             # Final verification
```

## 🎓 Example: Deep Research SDD

**Reference:** `docs/sdd/deep-research/ (example reference)`

This is the **gold standard** for SDD output:

- ✅ 209 lines of detailed requirements
- ✅ 160 lines of UI flow with templates
- ✅ 126 lines of keyword detection spec
- ✅ 48 lines of gaps (ALL filled)
- ✅ 12 executable cards (30 SP total)
- ✅ 95%+ confidence on ALL gaps
- ✅ Follows ALL principles above

New SDDs should match this quality and structure.

## 🚀 Execution Timeline

### Simple Feature (15-20 SP)

| Phase | Duration | Activities |
|-------|----------|-----------|
| 1: Project Analysis | 15 min | Read code, wiki, existing SDDs |
| 2: Gap Interview | 20-30 min | 5-8 gaps, consult AIs |
| 3: SDD Generation | 20 min | Create 6 docs + templates |
| 4: Trello Cards | 25 min | 12 cards, code snippets |
| 5: Code Review | 10 min | Verification, fixes |
| **TOTAL** | **90-100 min** | **Complete SDD ready** |

### Complex Feature (30-40 SP)

| Phase | Duration | Activities |
|-------|----------|-----------|
| 1: Project Analysis | 25 min | Deep pattern analysis |
| 2: Gap Interview | 45-60 min | 10-15 gaps, multiple rounds |
| 3: SDD Generation | 35 min | Create 8-10 docs |
| 4: Trello Cards | 45 min | 18-20 cards |
| 5: Code Review | 15 min | Verification, fixes |
| **TOTAL** | **165-180 min** | **Complete SDD ready** |

## ⚠️ Common Pitfalls

### Pitfall 1: Skipping Project Analysis

❌ **Don't:** Start with raw requirements only
✅ **Do:** Analyze existing patterns first

**Why:** Ensures consistency with existing codebase

### Pitfall 2: Low Confidence Decisions

❌ **Don't:** Proceed with <95% confidence
✅ **Do:** Ask follow-up questions, consult AIs

**Why:** Prevents implementation issues later

### Pitfall 3: Non-Executable Cards

❌ **Don't:** Write "TODO: figure out"
✅ **Do:** Provide exact code, paths, commands

**Why:** AI agent can execute non-stop

### Pitfall 4: Missing Edge Cases

❌ **Don't:** Focus only on happy path
✅ **Do:** Include error handling, timeouts, retries

**Why:** Production-ready specifications

### Pitfall 5: Duplicate Patterns

❌ **Don't:** Create new patterns when existing ones work
✅ **Do:** Reuse existing config, error handling, logging

**Why:** Codebase consistency, less cognitive load

## 🔧 Troubleshooting

### Problem: Kimi/Claude not installed

```bash
# Check installation
./code-review.sh --check-install

# Install Kimi CLI
npm install -g @kimi-ai/cli
kimi config set-api-key YOUR_KEY

# Install Claude CLI
npm install -g @anthropic-ai/claude-cli
claude config set-api-key YOUR_KEY

# Re-check
./code-review.sh --check-install
```

### Problem: Low confidence on critical decision

1. Document both AI responses
2. Identify sources of disagreement
3. Gather more context
4. Ask more specific question
5. Get user decision if AIs can't agree
6. Document final decision + rationale

### Problem: Project analysis incomplete

1. List missing files
2. Continue with available patterns
3. Add note: "Limited analysis due to missing X"
4. Make conservative assumptions
5. Flag for user review

### Problem: Too many gaps (>15)

1. Feature may be too complex
2. Break into smaller features
3. Create Phase 1 SDD (MVP)
4. Create Phase 2 SDD (enhancements)
5. Each SDD should have ≤15 gaps

## 📚 Reference Materials

- **README.md** - Entry point and execution protocol
- **INTERVIEW_PROTOCOL.md** - How to conduct gap interviews
- **PROJECT_ANALYSIS.md** - How to analyze existing codebase
- **OUTPUT_SPEC.md** - Specification for generated files
- **code-review.sh** - Kimi/Claude integration script

## 🎓 Learning Path

### Level 1: Basic Flow
- Read README.md entry point
- Follow phases 1-5 for simple feature

### Level 2: Advanced Techniques
- Read all SYSTEM docs
- Practice gap interview techniques
- Master code-review.sh usage

### Level 3: Customization
- Modify templates for project needs
- Create custom card patterns
- Optimize for specific tech stack

---

**System Version:** 1.0
**Last Updated:** 2026-01-02
**Maintainer:** AI Agent
