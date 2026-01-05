# Card Count Decision Guidelines

> **WHO DECIDES:** The AI agent determines card count automatically. Do not ask user.
> **CORE PRINCIPLE:** Fight complexity. Maintainability is the goal. Fewer is better.

```
┌─────────────────────────────────────────────────────────┐
│  LESS IS MORE                                           │
│                                                         │
│  3 well-scoped cards > 12 fragmented cards             │
│  Each card must justify its existence                  │
│  If you can merge two cards, do it                     │
└─────────────────────────────────────────────────────────┘
```

## Decision Framework

### When to Create FEWER Cards (1-7 cards)

**Characteristics:**
- Simple feature with 1-2 core flows
- Mostly configuration or integration work
- Small scope, well-understood domain
- Single developer can implement in 1-2 days

**Examples:**
- Adding a simple notification trigger
- Creating a basic report export
- Adding a new field to existing form
- Simple webhook integration

**Benefits:**
- Less overhead
- Faster execution
- Easier to track progress
- Reduced documentation burden

---

### When to Create MODERATE Cards (8-15 cards)

**Characteristics:**
- Medium complexity feature
- 2-4 core user flows
- Mix of frontend and backend work
- Requires 3-7 days of implementation
- Some unknowns or new patterns needed

**Examples:**
- Auto-archive conversations feature
- Basic search with filters
- User profile enhancements
- Simple workflow automation

**Benefits:**
- Good balance of granularity and overhead
- Manageable work units (1-4 SP each)
- Clear dependency chain
- Standard approach for most features

---

### When to Create MORE Cards (16-30 cards)

**Characteristics:**
- Complex feature with multiple subsystems
- 5+ core user flows
- Introduces new architecture patterns
- Requires 1-3 weeks of implementation
- Multiple integration points
- Significant risk areas

**Examples:**
- Multi-tenant permission system
- Advanced analytics dashboard
- Complex workflow engine
- Integration with external services

**Benefits:**
- Smaller cards = easier review
- Better parallelization possible
- Detailed progress tracking
- Risk distributed across cards

---

### When to Create MANY Cards (31-50+ cards)

**Characteristics:**
- Highly complex, system-level feature
- Multiple teams may be involved
- 3+ weeks of implementation
- Major architectural changes
- Significant technical debt implications
- Requires phased rollout

**Examples:**
- Complete exam assessment system
- Multi-channel notification platform
- Advanced AI integration
- Full-featured CMS

**Benefits:**
- Maximum granularity
- Can assign to multiple developers
- Detailed risk management
- Clear phased approach

**Warning:** Consider splitting into multiple features if you exceed 50 cards.

---

## Decision Checklist

Use this to determine appropriate card count:

### Complexity Factors (Add points)

| Factor | Points |
|--------|--------|
| New database tables (per table) | +2 |
| New API endpoints (per endpoint) | +1 |
| New user roles/permissions | +3 |
| Integration with external service | +4 |
| New UI components (per complex component) | +2 |
| New architecture pattern | +5 |
| Real-time features (websockets, etc.) | +3 |
| Bulk data processing | +3 |
| Payment/processing workflows | +4 |
| Multi-language support | +2 |

### Simplicity Factors (Subtract points)

| Factor | Points |
|--------|--------|
| Uses existing patterns exclusively | -3 |
| Single user role affected | -2 |
| No database changes | -3 |
| Frontend-only change | -2 |
| Configuration-only change | -4 |

### Calculate Total

**Total Score → Card Count:**
- **< 5 points:** 1-5 cards (very simple)
- **5-10 points:** 6-10 cards (simple)
- **11-20 points:** 11-15 cards (moderate) - **MOST COMMON**
- **21-30 points:** 16-25 cards (complex)
- **31-40 points:** 26-35 cards (very complex)
- **> 40 points:** 36-50 cards or split feature

---

## KISS Principle Reminder

**Each card must be:**
- **1-4 Story Points** (if >4 SP, split the card)
- **Independently testable**
- **Clear acceptance criteria**
- **Single responsibility**

**If a card feels too big, it probably is. Split it!**

---

## Examples

### Example 1: Simple Slack Notification (3 cards)
```
01: Add slack webhook config (1 SP)
02: Create notification service (2 SP)
03: Integrate with existing events (2 SP)
```

### Example 2: Auto-Archive Feature (12 cards)
```
01: Config schema (2 SP)
02: Detection module (3 SP)
03: Detection tests (2 SP)
04: Telegram hook (3 SP)
05: Acknowledgment (2 SP)
06: Button handler (3 SP)
07: Archive executor (3 SP)
08: Result parser (2 SP)
09: Result delivery (2 SP)
10: Wire pipeline (3 SP)
11: Error handling (3 SP)
12: E2E test (2 SP)
```

### Example 3: Exam System (22 cards)
```
01: Database schema (3 SP)
02: Question CRUD API (4 SP)
03: Question bank UI (3 SP)
04: Exam creation (4 SP)
05: Exam scheduling (3 SP)
06: Student exam list (2 SP)
07: Exam taking interface (4 SP)
08: Auto-grading engine (4 SP)
09: Manual grading UI (3 SP)
10: Results calculation (3 SP)
11: Results display (2 SP)
12: Export functionality (2 SP)
13: Notifications (2 SP)
14: Anti-cheating measures (3 SP)
15: Analytics dashboard (4 SP)
16: Retake logic (2 SP)
17: Question randomization (2 SP)
18: Rich text editor (3 SP)
19: File uploads (2 SP)
20: Mobile responsiveness (2 SP)
21: Error handling (3 SP)
22: E2E test suite (3 SP)
```

---

## Final Decision Rule

**Trust your judgment. If you think you need more cards, create them. If you think 12 is too many for your simple feature, use fewer.**

**Remember:** These are guidelines, not rules. The goal is maintainable, executable cards that make sense for YOUR feature.

---

**Document Author:** SDD Flow System  
**Last Updated:** 2026-01-04  
**Version:** 2.0 (Flexible Card Count)