# {FEATURE_NAME} - Keyword Detection Spec

> Status: DRAFT | Last updated: {DATE}

## Purpose

Define exact patterns that trigger the {FEATURE_NAME} pipeline.

## Detection Strategy

**Approach:** Hardcoded pattern matching (no ML/fuzzy matching in v1)

## Patterns (FINAL LIST)

**Total: {N} patterns** - Case-{SENSITIVITY} {MATCH_TYPE} match

### Group 1: Russian

| # | Pattern | Example |
|---|---------|---------|
| 1 | `pattern1` | "Example message" |
| 2 | `pattern2` | "Example message" |

### Group 2: English

| # | Pattern | Example |
|---|---------|---------|
| 3 | `pattern3` | "Example message" |
| 4 | `pattern4` | "Example message" |

## Matching Rules (CONFIRMED)

- [x] Case-{SENSITIVITY}: `{method}` before matching
- [x] {MATCH_TYPE} match: pattern {location} in message
- [x] Word boundaries: {BOUNDARY_RULE}

## Implementation Code

```typescript
// File: src/{FEATURE}/detect.ts

const PATTERNS = [
  'pattern1',
  'pattern2',
  'pattern3',
  'pattern4',
];

export function detect{Feature}(message: string): boolean {
  const normalized = message.toLowerCase();
  return PATTERNS.some(pattern => normalized.includes(pattern));
}

export function extract{Feature}Params(message: string): {param1: string} {
  // Extract parameters from message
  return {param1: 'value'};
}
```

## Edge Cases

| Input | Expected | Reason |
|-------|----------|--------|
| "PATTERN" | {result} | reason |
| "prefixpattern" | {result} | reason |
| "patternxyz" | {result} | reason |

## Performance

- Detection SLA: {TIME}ms
- Runs on every {SCOPE}
- No regex, no ML - simple string operations
