---
summary: "Context management strategies: pruning, compaction, and context control"
read_when:
  - You want to manage long-running sessions
  - You need to reduce context window usage
  - You are optimizing tool result handling
---
# Context Management

Long-running sessions accumulate tokens from conversation history and tool results. This document covers strategies to manage context growth.

## Context Components

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTEXT WINDOW                           │
│                   (Model Limit: 128K-200K tokens)           │
├─────────────────────────────────────────────────────────────┤
│  SYSTEM PROMPT          ~10-15K tokens (optimizable)        │
├─────────────────────────────────────────────────────────────┤
│  CONVERSATION HISTORY   Grows with each turn                │
│  ├── User Messages                                          │
│  ├── Assistant Messages                                     │
│  ├── Tool Calls                                             │
│  └── Tool Results       ◄── LARGEST GROWTH FACTOR          │
├─────────────────────────────────────────────────────────────┤
│  AVAILABLE SPACE        What's left for current request     │
└─────────────────────────────────────────────────────────────┘
```

## Session Pruning

Session pruning trims **old tool results** to reduce context size. It's applied in-memory before each LLM call (does not modify disk history).

### Pruning Modes

#### Off (Default)
```json5
{
  "agents": {
    "defaults": {
      "contextPruning": { "mode": "off" }
    }
  }
}
```

No pruning - context grows unbounded until compaction.

#### Cache-TTL (Recommended)
```json5
{
  "agents": {
    "defaults": {
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m"              // Match Anthropic cache TTL
      }
    }
  }
}
```

Prunes when cache expires, reducing cache write cost for next request.

### How Pruning Works

1. **Check TTL**: Is last Anthropic call older than `ttl`?
2. **Identify targets**: Find tool results older than `keepLastAssistants` messages
3. **Soft-trim**: Large results get head+tail preserved, middle replaced with `...`
4. **Hard-clear**: Very old results replaced with placeholder

### Pruning Configuration

```json5
{
  "agents": {
    "defaults": {
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m",                         // When to prune
        "keepLastAssistants": 3,             // Protect recent turns
        "softTrimRatio": 0.3,                // Trim at 30% of context
        "hardClearRatio": 0.5,               // Clear at 50% of context
        "minPrunableToolChars": 50000,       // Min size to consider
        "softTrim": {
          "maxChars": 4000,                  // Max chars after trim
          "headChars": 1500,                 // Keep from start
          "tailChars": 1500                  // Keep from end
        },
        "hardClear": {
          "enabled": true,
          "placeholder": "[Old tool result content cleared]"
        },
        "tools": {
          "allow": ["exec", "read"],         // Only prune these
          "deny": ["*image*"]                // Never prune these
        }
      }
    }
  }
}
```

### Pruning vs Caching Synergy

**Why align pruning with cache TTL:**

```
Timeline:
─────────────────────────────────────────────────────────────
0m         Request 1 (cache write: 10K tokens)
           ↓ Cache active
2m         Request 2 (cache read: 10K tokens @ 10% cost)
           ↓ Cache active
4m         Request 3 (cache read: 10K tokens @ 10% cost)
           ↓ Cache EXPIRES at 5m
6m         Request 4 without pruning:
           Cache write: 10K + accumulated tool results (30K) = 40K tokens @ 125%
           
6m         Request 4 WITH pruning:
           Prune old tool results first
           Cache write: 10K + recent results (5K) = 15K tokens @ 125%
           SAVINGS: 62.5% less cache write cost
```

## Compaction

Compaction **summarizes older conversation** into a compact entry, freeing context space while preserving key information.

### Auto-Compaction

Triggers automatically when context nears model limit:

```json5
{
  "agents": {
    "defaults": {
      "compaction": {
        "auto": true,
        "targetRatio": 0.7        // Compact at 70% window usage
      }
    }
  }
}
```

### Manual Compaction

Use `/compact` when sessions feel bloated:

```bash
/compact                           # Basic compaction
/compact Focus on decisions made   # Guided compaction
```

### What Compaction Preserves

- Key decisions and conclusions
- Important code changes discussed
- Open questions and next steps
- User preferences mentioned

### What Compaction Removes

- Verbose tool outputs
- Intermediate debugging steps
- Superseded discussions
- Redundant context

### Compaction vs Pruning

| Aspect | Pruning | Compaction |
|--------|---------|------------|
| Target | Tool results | Full conversation |
| Persistence | In-memory only | Saved to JSONL |
| Trigger | Cache TTL expiry | Context limit |
| Information | Discarded | Summarized |
| Recovery | None | Summary available |

**Use both**: Pruning reduces cache costs, compaction manages long sessions.

## Context Inspection Commands

### Quick Overview
```bash
/status
```
Output:
```
🧠 Context: 45,000 / 128,000 tokens (35%)
🧹 Compactions: 2
📊 Session turns: 24
```

### Detailed Breakdown
```bash
/context list
```
Output:
```
🧠 Context breakdown
System prompt: 15,000 tokens
Bootstrap files: 5,000 tokens
Conversation: 25,000 tokens
Tool results: 15,000 tokens
```

### Per-Item Analysis
```bash
/context detail
```
Output:
```
Top tools by result size:
- exec (turn 5): 8,000 tokens
- read (turn 12): 4,000 tokens
- browser (turn 18): 3,000 tokens
```

## Heartbeat (Cache Warmth)

Heartbeat sends periodic requests to keep cache warm:

```json5
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "enabled": true,
        "interval": "4m"          // Less than 5min TTL
      }
    }
  }
}
```

### Cost-Benefit Analysis

**Without heartbeat** (session goes idle 10 minutes):
- Cache expires at 5m
- Next request: full cache write (125% cost for system prompt)

**With heartbeat** (4m interval):
- Heartbeat at 4m: ~100 tokens (minimal)
- Cache stays warm
- Next request: cache read (10% cost)

**Break-even**: Heartbeat pays for itself if you make >1 request per hour.

## Session Management

### Starting Fresh

```bash
/new                    # New session ID
/reset                  # Clear current session
```

When to use:
- Task is completely different
- Context has become confusing
- Want clean cache baseline

### Session Continuity

Keep the same session when:
- Continuing related work
- Want to preserve context
- Building on previous discussion

## Optimizing Tool Results

### Built-in Truncation

Tools automatically truncate large outputs:

```json5
{
  "tools": {
    "exec": {
      "maxOutputChars": 50000      // Truncate at 50K chars
    },
    "read": {
      "maxChars": 100000           // Truncate at 100K chars
    }
  }
}
```

### Manual Control

Request specific portions:
```
Read lines 100-200 of large-file.ts
```

Instead of:
```
Read large-file.ts  // Entire file
```

### Avoiding Bloat

**Don't**:
```
Run `cat entire-database-dump.sql`
```

**Do**:
```
Run `head -100 database-dump.sql`
Run `grep "CREATE TABLE" database-dump.sql`
```

## Recommended Configuration

### Cost-Optimized (Recommended)

```json5
{
  "agents": {
    "defaults": {
      "prompt": "minimal",
      "compaction": {
        "auto": true,
        "targetRatio": 0.6
      },
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m"
      },
      "heartbeat": {
        "enabled": true,
        "interval": "4m"
      }
    }
  }
}
```

### Long Sessions

```json5
{
  "agents": {
    "defaults": {
      "compaction": {
        "auto": true,
        "targetRatio": 0.5        // Compact earlier
      },
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m",
        "keepLastAssistants": 5   // Keep more recent turns
      }
    }
  }
}
```

### Heavy Tool Usage

```json5
{
  "agents": {
    "defaults": {
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m",
        "softTrim": {
          "maxChars": 2000,       // More aggressive trimming
          "headChars": 800,
          "tailChars": 800
        }
      }
    }
  },
  "tools": {
    "exec": {
      "maxOutputChars": 20000     // Lower output limit
    }
  }
}
```

## Measuring Context Efficiency

### Before Optimization

Track these metrics:
```bash
/status          # Note context %
/context detail  # Note largest contributors
```

### After Optimization

Compare:
- Context usage % at same conversation point
- Cache hit rate (in debug logs)
- Cost per session

### Target Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Context at 10 turns | 80% | 50% |
| Cache hit rate | Variable | >90% |
| Tool results retained | All | Last 3 turns |
