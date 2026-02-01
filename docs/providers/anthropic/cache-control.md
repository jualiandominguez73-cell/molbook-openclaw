---
summary: "Configure and use Anthropic prompt caching in OpenClaw"
read_when:
  - You want to optimize token usage with prompt caching
  - You need to understand cache TTL settings
  - You want to improve cost efficiency with large payloads
title: "Anthropic Cache Control"
---

# Anthropic Prompt Caching (Cache Control)

Anthropic's prompt caching feature reduces token usage and latency for repeated requests by caching prompt content on their servers. OpenClaw provides built-in support for configuring cache behavior.

## What is Prompt Caching?

When you send the same prompt prefix to Anthropic multiple times, the API caches that content server-side. Subsequent requests with the same prefix are processed faster and consume fewer tokens, significantly reducing costs for:

- Large system prompts
- Document retrieval workflows  
- Repetitive analysis tasks
- Bulk processing operations

**Token savings:** Cached tokens cost 90% less than regular tokens.

## Enable Cache Control in OpenClaw

### Configuration

Use `cacheControlTtl` in the model parameters:

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-5": {
          params: { 
            cacheControlTtl: "5m"  // or "1h", "24h", etc.
          },
        },
      },
    },
  },
}
```

### TTL Options

- `5m` - 5 minutes (minimum)
- `1h` - 1 hour
- `24h` - 1 day
- Custom: Any duration supported by Anthropic

**Default behavior:** If not specified, Anthropic uses their default cache TTL.

## How It Works

1. **First request:** Full prompt is sent and cached at Anthropic
2. **Subsequent requests** (within TTL): Cached content is reused
3. **Cache expiration:** After TTL expires, next request is full price

## Best Practices

### High-Impact Scenarios

✓ **Good candidates for caching:**
- Large system prompts (>1000 tokens)
- Repeated document analysis
- Knowledge base queries
- Batch processing jobs
- Code review workflows

✗ **Poor candidates:**
- One-off conversations
- Highly dynamic prompts
- Real-time applications

### Configuration Tips

- **Set appropriate TTL:** Balance between cache hits and staleness
- **Group related requests:** Maximize cache reuse within TTL window
- **Monitor usage:** Check API logs for cache hit rates
- **Cost analysis:** Calculate savings based on your workload

## Example: Document Analysis

```json5
{
  agents: {
    documentAnalyzer: {
      system: """
        You are a document analysis expert. 
        [Large system prompt and guidelines here - 2000+ tokens]
      """,
      models: {
        "anthropic/claude-opus-4-5": {
          params: { 
            cacheControlTtl: "24h"  // Cache for a full day
          },
        },
      },
    },
  },
}
```

With 24-hour TTL, if you analyze 100 documents in a day:
- First request: Full cost
- Next 99 requests: 90% cost reduction

**Daily savings:** Roughly 90 tokens × 99 = 8,910 cached tokens saved.

## Anthropic Requirements

- **API Key authentication required:** Cache control works with Anthropic API keys, not subscription tokens
- **Model support:** All Claude models support prompt caching
- **Beta flag:** OpenClaw automatically includes Anthropic's `extended-cache-ttl-2025-04-11` beta flag

## Troubleshooting

### Cache hits not occurring

Check:
- Model name matches configuration exactly
- TTL hasn't expired between requests
- Requests have identical prompt prefixes
- API key has sufficient permissions

### Unexpected costs

- Verify cacheControlTtl is set correctly
- Check API logs for cache hit rate
- Ensure batch jobs complete within TTL window

## Advanced Configuration

For detailed provider configuration options and troubleshooting:
- See [Model Providers Configuration](/gateway/configuration)
- Check [Anthropic Provider Documentation](/providers/anthropic)

## Further Reading

- [Anthropic Prompt Caching Guide](https://docs.anthropic.com/en/docs/build-a-bot/manage-conversation-history) (external)
- [Cost Optimization](/concepts/cost-optimization)
