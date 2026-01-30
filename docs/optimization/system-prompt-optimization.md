---
summary: "Techniques to reduce system prompt size for lower token consumption"
read_when:
  - You want to reduce the base token cost of every request
  - You are optimizing system prompt size
  - You want to understand prompt modes
---
# System Prompt Optimization

The system prompt is sent with **every single request**. Even with caching, a smaller system prompt means:
- Lower cache write costs
- Faster cache hits
- More room for conversation history

## System Prompt Anatomy

OpenClaw's system prompt includes these sections:

| Section | Typical Size | Cacheable | Reducible |
|---------|--------------|-----------|-----------|
| Core Instructions | ~500 tokens | ✅ | Limited |
| Tool Definitions | ~1,000 tokens | ✅ | ✅ |
| Tool Schemas | ~8,000 tokens | ✅ | ✅ |
| Skills List | ~500 tokens | ✅ | ✅ |
| Bootstrap Files | ~5,000 tokens | ✅ | ✅ |
| Runtime Metadata | ~200 tokens | ❌ | Limited |

**Total**: ~15,000 tokens (full mode)

## Prompt Modes

OpenClaw supports three prompt modes:

### Full Mode (Default)
```bash
openclaw agent --prompt full
```
- All tools, skills, and bootstrap files
- Best for: Complex tasks, unfamiliar codebases
- Size: ~15,000 tokens

### Minimal Mode
```bash
openclaw agent --prompt minimal
```
- Essential tools only
- Reduced skill descriptions
- Truncated bootstrap files
- Best for: Simple tasks, familiar codebases
- Size: ~6,000 tokens (60% reduction)

### None Mode
```bash
openclaw agent --prompt none
```
- Bare minimum system prompt
- No tools, skills, or bootstrap
- Best for: Simple Q&A, no tool use needed
- Size: ~500 tokens (97% reduction)

## Reducing Bootstrap File Size

Bootstrap files are injected into the system prompt:
- `AGENTS.md` - Repository guidelines
- `SOUL.md` - Agent personality
- `TOOLS.md` - Available tools and skills
- `IDENTITY.md` - Agent identity
- `USER.md` - User preferences
- `HEARTBEAT.md` - Periodic notes
- `BOOTSTRAP.md` - Additional context

### Current Defaults

```json5
{
  "agents": {
    "defaults": {
      "bootstrapMaxChars": 20000,     // Max chars per file
      "bootstrapMaxTotalChars": 50000 // Max total bootstrap
    }
  }
}
```

### Optimization Strategies

#### 1. Reduce `bootstrapMaxChars`

```json5
{
  "agents": {
    "defaults": {
      "bootstrapMaxChars": 10000    // 50% reduction
    }
  }
}
```

**Trade-off**: Less context, but model may miss important guidelines.

#### 2. Optimize Bootstrap File Content

**Before** (verbose AGENTS.md):
```markdown
## Commit & Pull Request Guidelines
- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit` so staging stays scoped.
- Follow concise, action-oriented commit messages (e.g., `CLI: add verbose flag to send`).
- Group related changes; avoid bundling unrelated refactors.
- Changelog workflow: keep latest released version at top (no `Unreleased`); after publishing, bump version and start a new top section.
- PRs should summarize scope, note testing performed, and mention any user-facing changes or new flags.
```

**After** (concise):
```markdown
## Commits & PRs
- Use `scripts/committer "<msg>" <file...>` for commits
- Concise messages: `CLI: add verbose flag`
- Group related changes; changelog at top
```

**Savings**: 60% reduction in that section

#### 3. Split Context Across Files

Instead of one large AGENTS.md:
```
AGENTS.md          # Core guidelines only (~2000 chars)
AGENTS-DEPLOY.md   # Deployment (read on demand)
AGENTS-TESTING.md  # Testing (read on demand)
AGENTS-STYLE.md    # Code style (read on demand)
```

Model can `read_file` the specific section when needed.

#### 4. Use Skills Instead of Bootstrap

Move specialized knowledge to skills:
```yaml
# ~/.config/openclaw/skills/deployment.yaml
name: deployment
description: "Deployment procedures for OpenClaw"
read: |
  ## Deployment Guidelines
  ...
```

Skills are listed in the prompt but content is loaded on-demand.

## Tool Optimization

### Disable Unused Tools

```json5
{
  "tools": {
    "disabled": [
      "browser",      // If not needed: saves ~2,500 tokens
      "image_gen",    // If not needed: saves ~500 tokens
      "voice"         // If not needed: saves ~300 tokens
    ]
  }
}
```

### Reduce Tool Schema Verbosity

Tool schemas contribute significantly to system prompt size:

| Tool | Schema Size (chars) | Schema Size (tokens) |
|------|---------------------|---------------------|
| browser | ~9,800 | ~2,450 |
| exec | ~6,200 | ~1,550 |
| read | ~2,400 | ~600 |
| edit | ~3,600 | ~900 |

**Strategy**: Disable tools you don't use for specific tasks.

```bash
# For simple Q&A, disable all tools
openclaw agent --prompt minimal --tools none

# For code review, only enable read
openclaw agent --tools read,grep_search
```

## Skills Optimization

### Current Behavior

Skills are listed in the system prompt with descriptions:
```
Skills list (system prompt text): 2,184 chars (~546 tok) (12 skills)
```

### On-Demand Loading

Skills use a `read` approach - the full content is only loaded when the model needs it:

```yaml
# Skill definition
name: database-guide
description: "PostgreSQL optimization tips"  # In prompt
read: |
  Full content here...                        # Loaded on demand
```

### Optimization: Fewer Skills

```json5
{
  "skills": {
    "disabled": [
      "skill-name-1",
      "skill-name-2"
    ]
  }
}
```

Each disabled skill saves ~50-100 tokens from the skill list.

## Runtime Metadata Reduction

The system prompt includes runtime info:
```
Runtime: host=mycomputer OS=darwin model=claude-3-5-sonnet thinking=none
```

This is minimal (~50 tokens) and cannot be reduced significantly.

## Practical Configurations

### Maximum Savings (Simple Tasks)

```json5
{
  "agents": {
    "defaults": {
      "prompt": "minimal",
      "bootstrapMaxChars": 5000,
      "bootstrapMaxTotalChars": 15000
    }
  },
  "tools": {
    "disabled": ["browser", "image_gen", "voice"]
  }
}
```

**Expected savings**: 70% reduction in system prompt size

### Balanced (Daily Work)

```json5
{
  "agents": {
    "defaults": {
      "prompt": "minimal",
      "bootstrapMaxChars": 10000
    }
  }
}
```

**Expected savings**: 50% reduction

### Full Context (Complex Tasks)

```json5
{
  "agents": {
    "defaults": {
      "prompt": "full",
      "bootstrapMaxChars": 20000
    }
  }
}
```

Use when you need maximum context.

## Measuring Impact

### Before Optimization

```bash
/context detail
```

Example output:
```
System prompt (run): 62,000 chars (~15,500 tok)
├── Tool schemas: 31,988 chars (~7,997 tok)
├── Skills list: 2,184 chars (~546 tok)
└── Bootstrap: 23,901 chars (~5,976 tok)
```

### After Optimization

```bash
# With minimal mode + reduced bootstrap
System prompt (run): 24,000 chars (~6,000 tok)
├── Tool schemas: 12,000 chars (~3,000 tok)
├── Skills list: 1,200 chars (~300 tok)
└── Bootstrap: 8,000 chars (~2,000 tok)
```

**Savings**: 61% reduction in system prompt tokens

## Best Practices Summary

1. **Start with `--prompt minimal`** for most tasks
2. **Reduce bootstrap files** - be concise, not verbose
3. **Disable unused tools** - each tool adds schema overhead
4. **Use skills sparingly** - they add to the skill list
5. **Split large context files** - model can read on demand
6. **Monitor with `/context detail`** - track your progress
