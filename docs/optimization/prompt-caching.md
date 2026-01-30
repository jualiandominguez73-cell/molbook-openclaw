---
summary: "Provider-specific prompt caching configuration for maximum token savings"
read_when:
  - You want to enable prompt caching
  - You want to understand cache behavior per provider
  - You are optimizing Anthropic/OpenAI/Gemini costs
---
# Prompt Caching

Prompt caching is the **single most impactful optimization**, providing 50-90% cost reduction for cached prompt portions.

## How Prompt Caching Works

When you send a request to an LLM:
1. Provider checks if the prompt prefix matches a cached version
2. If cached: charges reduced rate for cached tokens
3. If not cached: charges full rate + cache write cost

**Key insight**: The system prompt is identical across requests → perfect cache candidate.

## Provider Comparison

### Anthropic Claude

**The most mature caching implementation.**

| Metric | Value |
|--------|-------|
| Cache Read Cost | 10% of base input price |
| Cache Write Cost | 125% of base input price |
| Minimum Cacheable | 1,024 tokens (Claude 3.5), varies by model |
| Default TTL | 5 minutes |
| Extended TTL | 1 hour (with `cache_control` header) |

**How OpenClaw uses it**:
- Automatically adds `cache_control` blocks to system prompt
- Supports extended 1-hour TTL via `cacheControlTtl` config
- Session pruning is cache-aware (matches TTL)

**Configuration**:
```json5
{
  "models": {
    "providers": {
      "anthropic": {
        "cacheControlTtl": "1h"    // Request 1-hour cache
      }
    }
  },
  "agents": {
    "defaults": {
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m"               // Prune when cache expires
      },
      "heartbeat": {
        "enabled": true,
        "interval": "4m"          // Keep cache warm
      }
    }
  }
}
```

**Cost Example**:
- System prompt: 10,000 tokens
- 10 requests without caching: 100,000 input tokens
- 10 requests with caching: 10,000 (first) + 9,000 cached = 19,000 effective tokens
- **Savings: 81%**

### OpenAI GPT-4

**Automatic caching (no configuration needed).**

| Metric | Value |
|--------|-------|
| Cache Read Cost | 50% of base input price |
| Cache Write Cost | 100% of base input price (no penalty) |
| Minimum Cacheable | 1,024 tokens |
| TTL | 5-10 minutes (automatic) |

**Best practices**:
- Static content at the beginning of prompts
- Dynamic content at the end
- Longer prompts benefit more

**How OpenClaw leverages it**:
- System prompt is always first (automatically cached)
- Tool schemas are stable (cached)
- Conversation history is dynamic (after cached prefix)

### Google Gemini

**Two caching modes: Implicit (automatic) and Explicit (manual).**

| Mode | When to Use |
|------|-------------|
| Implicit | Default, automatic for repeated prefixes |
| Explicit | Large context windows, long TTL needs |

**Implicit Caching**:
- Automatic for prompts > 1,024 tokens
- No configuration required
- Cost reduction varies

**Explicit Caching**:
```json5
{
  "models": {
    "providers": {
      "gemini": {
        "cacheMode": "explicit",
        "cacheTtl": "3600"         // 1 hour in seconds
      }
    }
  }
}
```

## Maximizing Cache Efficiency

### 1. Structure Prompts for Caching

```
┌─────────────────────────────────────┐
│  STATIC CONTENT (cached)            │
│  ├── System instructions            │
│  ├── Tool definitions               │
│  ├── Skills metadata                │
│  └── Bootstrap files                │
├─────────────────────────────────────┤
│  DYNAMIC CONTENT (not cached)       │
│  ├── Conversation history           │
│  ├── Current request                │
│  └── Attachments                    │
└─────────────────────────────────────┘
```

### 2. Keep Cache Warm with Heartbeat

The heartbeat feature sends periodic "ping" requests to prevent cache expiration:

```json5
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "enabled": true,
        "interval": "4m"    // Less than 5min TTL
      }
    }
  }
}
```

**Trade-off**: Small token cost to keep cache warm vs. full cache write on expiry.

### 3. Align Pruning with Cache TTL

Session pruning should trigger when cache expires:

```json5
{
  "agents": {
    "defaults": {
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m"              // Match Anthropic default TTL
      }
    }
  }
}
```

**Why**: After cache expires, you'll pay full price anyway. Pruning old tool results at this point reduces the cache write cost for the fresh cache.

### 4. Minimize Cache Misses

Cache misses occur when:
- Prompt prefix changes (e.g., different tools enabled)
- TTL expires without heartbeat
- Session changes (new conversation)

**Mitigation**:
- Use consistent tool policies
- Enable heartbeat for active sessions
- Avoid unnecessary tool policy changes mid-session

## Cache Metrics

### Checking Cache Hit Rate

```bash
# Enable verbose output
export CLAWDBOT_LOG_LEVEL=debug

# Check cache behavior in logs
# Look for:
# - cache_creation_input_tokens (cache writes)
# - cache_read_input_tokens (cache hits)
```

### Interpreting `/status` Output

```
Session tokens (cached): 14,250 total / ctx=32,000
                ^^^^^^
                Shows cached token count
```

### Expected Cache Ratios

| Session State | Expected Cache Hit % |
|---------------|---------------------|
| Consecutive requests (< TTL) | 90-95% |
| After heartbeat | 90-95% |
| After TTL expiry | 0% (first request) |
| After compaction | 60-80% |

## Provider-Specific Notes

### Anthropic

- **Prompt prefix caching**: Exact prefix match required
- **Multi-turn optimization**: Conversation flows get partial caching
- **Tool use**: Tool schemas cache well
- **Images**: Not cached (always count as fresh input)

### OpenAI

- **Automatic**: No action needed
- **Best for**: High-volume, repetitive prompts
- **Limitation**: Less aggressive than Anthropic (50% vs 90% savings)

### Gemini

- **Context caching**: Can cache extremely long contexts (1M+ tokens)
- **Best for**: Large document processing
- **Trade-off**: Higher minimum token count for caching

## Cost Calculation

### Formula

```
Total Cost = (Uncached Input Tokens × Input Rate) 
           + (Cached Tokens × Cache Rate)
           + (Output Tokens × Output Rate)
           + (Cache Write Tokens × Write Rate)  // First request only
```

### Anthropic Example (Claude 3.5 Sonnet)

| Token Type | Rate (per 1M) |
|------------|---------------|
| Input | $3.00 |
| Cache Read | $0.30 (10%) |
| Cache Write | $3.75 (125%) |
| Output | $15.00 |

**10 requests, 10K system prompt, 500 output each**:

Without caching:
```
(10 × 10,000 × $3) + (10 × 500 × $15) = $0.30 + $0.075 = $0.375/1M
```

With caching:
```
First: (10,000 × $3.75) + (500 × $15) = $0.0375 + $0.0075 = $0.045
Remaining: (9 × 10,000 × $0.30) + (9 × 500 × $15) = $0.027 + $0.0675 = $0.0945
Total: $0.045 + $0.0945 = $0.1395

Savings: ($0.375 - $0.1395) / $0.375 = 62.8%
```

## Troubleshooting

### Cache Not Working

1. **Check minimum tokens**: Prompt must exceed provider minimum
2. **Verify prefix stability**: Any change in prompt prefix breaks cache
3. **Check TTL**: Cache may have expired
4. **Review logs**: Look for cache_creation vs cache_read metrics

### High Cache Write Costs

1. **Enable heartbeat**: Prevents TTL expiry
2. **Reduce session changes**: Avoid `/new` frequently
3. **Check tool policy changes**: Changing enabled tools breaks cache

### Inconsistent Savings

1. **Session length**: Short sessions don't benefit as much
2. **Request frequency**: Sporadic requests miss cache
3. **Content variability**: High dynamic content reduces cache ratio
