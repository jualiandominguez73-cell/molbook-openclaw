# Project Analysis Guide

## 🎯 Purpose

Understand existing project patterns, conventions, and architecture to ensure SDD aligns with codebase and leverages existing solutions.

## 📊 Analysis Scope

### Must-Read Files

Always analyze these if they exist:

1. **Project Configuration**
   - `package.json` - Dependencies, scripts, project type
   - `tsconfig.json` - TypeScript configuration
   - `vitest.config.ts` - Test configuration
   - `.env.example` - Environment variables

2. **Documentation**
   - `README.md` - Project overview
   - `AGENTS.md` - AI agent instructions
   - `CLAUDE.md` - Claude-specific instructions
   - `.qoder/repowiki/en/content (if exists)/**/*.md` - Project wiki

3. **Core Architecture**
   - `src/config/config.ts` - Configuration patterns
   - `src/main.ts` or `src/index.ts` - Entry points
   - `src/types/` - Type definitions

4. **Similar Features**
   - `docs/sdd/**/` - Existing SDD folders
   - Other messaging integrations (Telegram, Discord)
   - Other feature implementations

5. **Testing**
   - `src/**/*.test.ts` - Unit test patterns
   - `e2e/` - E2E test patterns
   - `__tests__/` - Test utilities

---

## 🔍 Analysis Process

### Step 1: File Structure Mapping (5 minutes)

```bash
# Map directory structure
tree -L 3 -I 'node_modules|dist|build' src/

# Find key files
find src/ -name "*.ts" -type f | head -20
find src/ -name "*.md" -type f
find docs/ -name "*.md" -type f 2>/dev/null

# Check for SDD folders
find docs/sdd/ -type d 2>/dev/null
```

**Document structure in project-analysis.md:**

```markdown
## Project Structure

```
src/
├── config/          # Configuration
├── telegram/        # Telegram integration
├── discord/         # Discord integration
├── skills/          # Skills system
├── deep-research/   # Similar feature
└── utils/           # Utilities

special/            # Special files
├── docs/sdd/       # Existing SDDs
└── .qoder/repowiki/en/content (if exists) # Documentation
```
```

### Step 2: Configuration Pattern Analysis (10 minutes)

**Read:** `src/config/config.ts`

**Look for:**

1. **Schema Definition**
   ```typescript
   // Look for Zod schemas
   const featureSchema = z.object({
     enabled: z.boolean().default(true),
     dryRun: z.boolean().default(false),
     path: z.string().default('default/path'),
   }).optional();
   ```

2. **Env Variable Handling**
   ```typescript
   // Look for env overrides
   enabled: process.env.FEATURE_ENABLED === 'true',
   dryRun: process.env.FEATURE_DRY_RUN !== 'false',
   ```

3. **Default Values**
   ```typescript
   // Note all default values
   defaultValue: z.string().default('default')
   ```

**Document in project-analysis.md:**

```markdown
## Configuration Patterns

### Schema Structure

Features use Zod schemas with structure:
```typescript
{
  enabled: boolean (default: true)
  dryRun: boolean (default: false)
  pathSetting: string (default: 'path/value')
  optionalSetting?: type
}
```

### Env Variable Pattern

```typescript
enabled: process.env.FEATURE_ENABLED === 'true'
dryRun: process.env.FEATURE_DRY_RUN !== 'false'
```

- Booleans use string comparison
- Defaults are sensible for production
- Override with explicit env vars
```

### Step 3: Message Handling Analysis (15 minutes)

**Read:** `src/telegram/bot.ts` and/or `src/discord/bot.ts`

**Look for:**

1. **Message Processing Flow**
   ```typescript
   // Find message handlers
   bot.on('message', (ctx) => { ... })
   bot.on('callback_query', (ctx) => { ... })
   ```

2. **Pattern Matching**
   ```typescript
   // Look for keyword/pattern detection
   if (message.text.includes('keyword')) { ... }
   if (/pattern/i.test(message.text)) { ... }
   ```

3. **Acknowledgment Messages**
   ```typescript
   // Look for response patterns
   await ctx.reply('✅ Message', { parse_mode: 'Markdown' })
   ```

4. **Button/Keyboard Patterns**
   ```typescript
   // Look for inline keyboards
   const keyboard = new InlineKeyboard()
     .text('Button', 'callback:data')
   ```

5. **Error Handling**
   ```typescript
   // Look for try/catch patterns
   try {
     await something()
   } catch (error) {
     await ctx.reply('❌ Error')
     console.error('[feature]', error)
   }
   ```

**Document in project-analysis.md:**

```markdown
## Message Handling Patterns

### Processing Flow

1. Receive message
2. Check if user allowed (routing.allowFrom)
3. Detect intent (keywords/patterns)
4. Send acknowledgment
5. Process request
6. Send result or error

### Pattern Matching

- Case-insensitive for bot mentions
- Substring matching for skills
- Regex for complex patterns

Example:
```typescript
const normalized = message.toLowerCase()
if (normalized.includes('keyword')) {
  // Trigger action
}
```

### Response Format

Success: "✅ Result"
Error: "❌ Error: message"
Processing: "⏳ Processing..."

All use Markdown parse_mode with fallback.

### Button Patterns

Inline keyboard buttons with emoji:
- Primary action: "🚀 Action"
- Retry: "🔄 Retry"
- Cancel: "❌ Cancel"

Callback data: "feature:action:data"
```

### Step 4: Similar Feature Analysis (15 minutes)

**Find and analyze similar features:**

```bash
# Find existing SDDs
ls -la docs/sdd/

# Deep dive into most similar one
cat docs/sdd/[similar-feature]/requirements.md
cat docs/sdd/[similar-feature]/ui-flow.md
cat docs/sdd/[similar-feature]/gaps.md

# Read a Trello card
head -50 docs/sdd/[similar-feature]/trello-cards/01-*.md
```

**Document in project-analysis.md:**

```markdown
## Similar Features Analysis

### Deep Research Feature

**Purpose:** Execute deep research via CLI

**Patterns Used:**
- Telegram integration for user requests
- Keyword detection (20 patterns)
- Inline button confirmation
- CLI execution wrapper
- Result delivery with summary

**Structure:**
- Config: deepResearch section in clawdis.json
- Detection: src/deep-research/detect.ts
- Execution: src/deep-research/executor.ts
- Messages: src/deep-research/messages.ts

**Key Decisions:**
- Telegram only for v1
- Dry-run mode by default
- Case-insensitive matching
- 1 round Q&A max
- No button expiration

**Card Structure:**
01: Config schema (2 SP)
02: Detection module (3 SP)
03: Detection tests (2 SP)
04: Telegram hook (3 SP)
05: Acknowledgment (2 SP)
06: Inline button (3 SP)
07: Executor (3 SP)
08: Result parser (2 SP)
09: Result delivery (2 SP)
10: Wire pipeline (3 SP)
11: Error handling (3 SP)
12: E2E test (2 SP)
```

### Step 5: Testing Pattern Analysis (10 minutes)

**Look for test patterns:**

```bash
# Find test files
find src/ -name "*.test.ts" -type f | head -5
find src/ -name "*.spec.ts" -type f | head -5

# Read example test
cat src/deep-research/detect.test.ts
```

**Look for:**

1. **Test Structure**
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { function } from './module'
   
   describe('feature', () => {
     it('should do X', () => {
       expect(result).toBe(expected)
     })
   })
   ```

2. **Mock Patterns**
   ```typescript
   // Look for mocking
   vi.mock('./dependency')
   const mockFn = vi.fn()
   ```

3. **Test Data**
   ```typescript
   // Look for fixtures
   const testCases = [
     { input: 'test', expected: true },
     { input: 'invalid', expected: false },
   ]
   ```

**Document in project-analysis.md:**

```markdown
## Testing Patterns

### Unit Tests

Framework: Vitest

Structure:
```typescript
describe('module', () => {
  describe('function', () => {
    it('should handle case', () => {
      const result = function(input)
      expect(result).toBe(expected)
    })
  })
})
```

### Test Data

Inline test data for simple cases:
```typescript
const testCases = [
  { input: 'valid', expected: true },
  { input: 'invalid', expected: false },
]

testCases.forEach(({ input, expected }) => {
  it(\`should return \${expected} for \${input}\`, () => {
    expect(validate(input)).toBe(expected)
  })
})
```

Fixture files for complex data:
```typescript
import fixture from './fixtures/complex.json'
```

### Mocking

Mock dependencies:
```typescript
vi.mock('./external-api')

it('should call API', async () => {
  const mockApi = vi.fn().mockResolvedValue({ data })
  await functionUsingApi(mockApi)
  expect(mockApi).toHaveBeenCalled()
})
```
```

---

## 📋 Analysis Documentation Template

```markdown
# Project Analysis - [Feature Name]

**Date:** YYYY-MM-DD
**Analyst:** AI Agent

## Overview

Brief description of feature and how it fits into project.

## Project Structure

```
[Tree output from Step 1]
```

## Configuration Patterns

[From Step 2 - schema, env, defaults]

## Message Handling Patterns

[From Step 3 - flow, matching, responses, buttons, errors]

## Similar Features

[From Step 4 - analyze 1-2 similar features in detail]

## Testing Patterns

[From Step 5 - test structure, data, mocking]

## Key Patterns Summary

| Pattern | Location | Usage | For New Feature |
|---------|----------|-------|----------------|
| Config schema | src/config/config.ts | Zod + env | ✅ Use same |
| Message handling | src/telegram/bot.ts | Detection → Ack → Process | ✅ Follow |
| Error handling | src/telegram/bot.ts | Retry + user message | ✅ Reuse |
| Buttons | grammy lib | InlineKeyboard | ✅ Use same |
| Tests | *.test.ts | Vitest structure | ✅ Follow |

## Recommendations

1. **Configuration:** Use deepResearch section in clawdis.json
2. **Detection:** Follow keyword pattern from deep-research
3. **Messages:** Reuse acknowledgment/result templates
4. **Errors:** Use existing retry patterns
5. **Tests:** Write unit tests for each module

## Open Questions (Pre-Gap Analysis)

- Do we need Discord support or Telegram only?
- Should detection run on every message or specific users?
- What CLI tool will be used?
- What result format is expected?

## References

- Config: src/config/config.ts:1-100
- Telegram: src/telegram/bot.ts:1-50
- Similar: docs/sdd/deep-research/
```

---

## ⚡ Quick Analysis Commands

### Get Project Overview

```bash
# Project stats
find src/ -name "*.ts" | wc -l
find src/ -name "*.test.ts" | wc -l
find src/ -type d | wc -l

# Line counts
find src/ -name "*.ts" -exec wc -l {} + | tail -1

# Dependencies
cat package.json | grep -A 20 '"dependencies"' | head -25
```

### Find Similar Code

```bash
# Search for patterns
grep -r "keyword detection" src/ --include="*.ts"
grep -r "InlineKeyboard" src/ --include="*.ts"
grep -r "config\." src/ --include="*.ts" | head -10

# Find message handling
grep -r "bot\.on" src/ --include="*.ts"
grep -r "ctx\.reply" src/ --include="*.ts" | head -5
```

### Extract Patterns

```bash
# Config pattern
grep -A 10 "z\.object" src/config/config.ts | head -20

# Error handling pattern
grep -B 5 -A 10 "catch.*error" src/telegram/bot.ts | head -30

# Button pattern
grep -B 5 -A 10 "InlineKeyboard" src/telegram/bot.ts | head -30
```

---

## 🎯 Key Insights to Extract

### Configuration

- ✅ Schema structure (Zod, Joi, etc.)
- ✅ Env variable naming conventions
- ✅ Default value patterns
- ✅ Optional vs required fields

### Messaging

- ✅ Detection patterns (keywords, regex, etc.)
- ✅ Acknowledgment message format
- ✅ Button/keyboard patterns
- ✅ Error message format
- ✅ Response templates

### Error Handling

- ✅ Try/catch patterns
- ✅ Retry mechanisms (exponential backoff)
- ✅ User-friendly error messages
- ✅ Logging patterns

### Testing

- ✅ Test framework (Vitest, Jest, etc.)
- ✅ Test structure (describe/it)
- ✅ Mock patterns
- ✅ Fixture usage

### Execution

- ✅ Script execution patterns
- ✅ CLI wrapper patterns
- ✅ Async/await patterns
- ✅ Timeout handling

---

## ⚠️ Analysis Pitfalls to Avoid

### ❌ Premature Assumptions

**Don't:** Assume patterns without evidence
**Do:** Find 2-3 examples before concluding

**Example:**
- ❌ "Probably uses environment variables"
- ✅ "Found 5 features using env vars from config.ts:10, 25, 40, 55, 70"

### ❌ Over-Analysis

**Don't:** Spend too much time on obvious patterns
**Do:** Focus on unique or complex patterns

**Example:**
- ❌ Spending 30 minutes analyzing basic imports
- ✅ Spending time on error handling patterns

### ❌ Ignoring Context

**Don't:** Look at patterns in isolation
**Do:** Understand WHY patterns exist

**Example:**
- ❌ "Uses retry with backoff"
- ✅ "Uses retry with backoff for Telegram 429 errors (rate limits)"

### ❌ Not Documenting Sources

**Don't:** Write "Follows existing patterns" without specifics
**Do:** Link to exact lines: `src/telegram/bot.ts:42`

---

## ✅ Analysis Completion Checklist

- [ ] Read package.json, tsconfig.json
- [ ] Read README.md, AGENTS.md
- [ ] Analyzed src/config/config.ts
- [ ] Analyzed message handling (bot.ts)
- [ ] Studied 1-2 similar features in detail
- [ ] Understood test patterns
- [ ] Documented structure, patterns, recommendations
- [ ] Included specific code references (file:line)
- [ ] Identified open questions for gap analysis
- [ ] Analysis file saved as project-analysis.md

---

**Time Estimate:** 45-60 minutes for thorough analysis
**Output:** project-analysis.md (200-400 lines)
**Confidence:** Should enable informed gap decisions
