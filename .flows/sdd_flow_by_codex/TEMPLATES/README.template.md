# {FEATURE_NAME} - SDD Requirements

> Status: {STATUS} | All gaps filled

## Overview

This folder contains Spec-Driven Development (SDD) documentation for the {FEATURE_NAME} feature.

## Documents

| File | Description | Status |
|------|-------------|--------|
| [requirements.md](./requirements.md) | Functional requirements | {STATUS} |
| [ui-flow.md](./ui-flow.md) | User interaction flow | {STATUS} |
| [keyword-detection.md](./keyword-detection.md) | Keyword matching spec | {STATUS} |
| [gaps.md](./gaps.md) | Open questions & gaps | {STATUS} |

## Pipeline Summary

```
User Input → Detection → Acknowledgment → Confirmation → Execute → Delivery
     ↓           ↓            ↓               ↓            ↓            ↓
  [Channel]  [Patterns]   [Message]     [Button]     [CLI/API]  [Format]
```

## Quick Reference

| Aspect | Decision |
|--------|----------|
| **Channel** | {CHANNEL} |
| **Detection** | {DETECTION_METHOD} |
| **Required Fields** | {REQUIRED_FIELDS} |
| **Execution** | {EXECUTION_METHOD} |
| **Delivery** | {DELIVERY_FORMAT} |
| **Config** | {CONFIG_LOCATION} |

## Development Notes

- [ ] Dry-run enabled by default during implementation
- [ ] Follow existing patterns from {SIMILAR_FEATURE}
- [ ] Location: {IMPLEMENTATION_PATH}

## Implementation

See [trello-cards/BOARD.md](./trello-cards/BOARD.md) for:
- {CARD_COUNT} executable cards ({TOTAL_SP} SP total)
- Linear execution order
- Machine-friendly instructions
- Max 4 SP per card
