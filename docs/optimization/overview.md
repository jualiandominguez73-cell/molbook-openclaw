---
summary: "Complete overview of token optimization strategies for OpenClaw"
read_when:
  - You want to understand all token optimization options
  - You need to reduce LLM costs
  - You are configuring OpenClaw for cost efficiency
---
# Token Optimization Overview

This document provides a comprehensive overview of strategies to reduce LLM token consumption in OpenClaw by **50% or more**.

## The Token Problem

LLM API costs are directly proportional to tokens consumed:
- **Input tokens**: Everything sent to the model (system prompt, conversation history, tool results)
- **Output tokens**: Model responses (typically 2-4x more expensive per token)
- **Cache tokens**: Reusable prompt portions (significantly cheaper when cached)

## Strategy Summary

### 1. Prompt Caching (Highest Impact: 50-90% savings)

Modern LLM providers offer prompt caching that dramatically reduces costs for repeated prompt prefixes.

| Provider | Cache Read Cost | Cache Write Cost | Min Tokens | TTL |
|----------|-----------------|------------------|------------|-----|
| Anthropic | 10% of base | 125% of base | 1,024 | 5min (default), 1hr (extended) |
| OpenAI | 50% of base | 100% of base | 1,024 | Automatic |
| Gemini | Variable | Variable | 1,024-4,096 | Configurable |

**Key insight**: The system prompt is sent with every request. Caching it provides massive savings.

### 2. System Prompt Optimization (40-60% savings)

OpenClaw's system prompt includes:
- Tool definitions and schemas (~8,000 tokens for full toolset)
- Skills list (~500+ tokens)
- Bootstrap files (AGENTS.md, SOUL.md, etc.)
- Runtime metadata

**Reduction strategies**:
- Use `--prompt minimal` mode
- Trim bootstrap files
- Load skills on-demand instead of upfront
- Disable unused tools

### 3. Context Pruning (20-40% savings)

Long sessions accumulate:
- Tool results (can be massive)
- Conversation history
- Attachments and transcripts

**Pruning modes**:
- `cache-ttl`: Prune old tool results when cache expires
- Manual `/compact`: Summarize conversation history

### 4. Intelligent Request Patterns (10-30% savings)

- Batch related queries
- Use specific, focused prompts
- Avoid redundant context
- Leverage conversation continuity

## Token Flow in OpenClaw

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTEXT WINDOW                           │
├─────────────────────────────────────────────────────────────┤
│  SYSTEM PROMPT (OpenClaw-built)                             │
│  ├── Tool Definitions & Schemas    (~8,000 tok) ◄── CACHE  │
│  ├── Skills List                   (~500 tok)   ◄── CACHE  │
│  ├── Bootstrap Files               (~5,000 tok) ◄── CACHE  │
│  └── Runtime Metadata              (~200 tok)              │
├─────────────────────────────────────────────────────────────┤
│  CONVERSATION HISTORY                                       │
│  ├── User Messages                                         │
│  ├── Assistant Messages                                    │
│  └── Tool Calls & Results          ◄── PRUNE THESE        │
├─────────────────────────────────────────────────────────────┤
│  CURRENT REQUEST                                           │
│  └── User Message + Attachments                            │
└─────────────────────────────────────────────────────────────┘
```

## Optimization Priority Matrix

| Priority | Strategy | Effort | Impact | Risk |
|----------|----------|--------|--------|------|
| 🔴 Critical | Enable Prompt Caching | Low | 50-90% | None |
| 🟠 High | Use Minimal Prompt Mode | Low | 40-60% | Minor |
| 🟠 High | Configure Cache-TTL Pruning | Low | 20-40% | None |
| 🟡 Medium | Optimize Bootstrap Files | Medium | 10-30% | Low |
| 🟡 Medium | Enable Heartbeat | Low | 10-20% | None |
| 🟢 Low | Tool Schema Reduction | High | 5-15% | Medium |

## Quick Configuration

### Optimal Cost Configuration

```json5
// ~/.config/openclaw/config.json
{
  "agents": {
    "defaults": {
      "prompt": "minimal",                    // Smaller system prompt
      "bootstrapMaxChars": 10000,             // Limit bootstrap size (default: 20000)
      "compaction": {
        "auto": true,                         // Auto-compact when needed
        "targetRatio": 0.6                    // Compact at 60% window usage
      },
      "contextPruning": {
        "mode": "cache-ttl",                  // Enable cache-aware pruning
        "ttl": "5m"                           // Match Anthropic cache TTL
      },
      "heartbeat": {
        "enabled": true,
        "interval": "4m"                      // Keep cache warm (< 5min TTL)
      }
    }
  },
  "models": {
    "providers": {
      "anthropic": {
        "cacheControlTtl": "1h"               // Extended TTL if available
      }
    }
  }
}
```

### Command-Line Flags

```bash
# Use minimal prompt mode
openclaw agent --prompt minimal

# Check current token usage
openclaw status --usage

# View context breakdown
/context detail

# Manual compaction
/compact

# Check usage stats
/usage
```

## Monitoring Token Usage

### Real-Time Monitoring

```bash
# Enable per-reply usage footer
/usage tokens

# Check session status
/status
```

### Usage Commands

| Command | Purpose |
|---------|---------|
| `/status` | Quick context window overview |
| `/context list` | Breakdown of injected files |
| `/context detail` | Detailed per-item token counts |
| `/usage` | Session token consumption |
| `/usage tokens` | Per-reply token footer |

## Expected Results

With full optimization stack enabled:

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| Single request | 15,000 tokens | 3,000 tokens | 80% |
| Long session (10 turns) | 150,000 tokens | 45,000 tokens | 70% |
| Heavy tool usage | 200,000 tokens | 60,000 tokens | 70% |

## Next Steps

1. Read [Prompt Caching](prompt-caching.md) for provider-specific setup
2. Read [System Prompt Optimization](system-prompt-optimization.md) for prompt reduction
3. Read [Context Management](context-management.md) for session optimization
4. Follow [Implementation Checklist](implementation-checklist.md) for step-by-step setup
