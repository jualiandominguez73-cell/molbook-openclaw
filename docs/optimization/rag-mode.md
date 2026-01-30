---
summary: "RAG-style lazy loading for 85%+ token reduction"
read_when:
  - You want maximum token optimization
  - You want to understand the RAG approach
  - You are configuring prompt mode "rag"
---
# RAG Mode: On-Demand Context Loading

The RAG (Retrieval-Augmented Generation) mode provides the **most aggressive token optimization** by loading context only when needed.

## How It Works

### Traditional Approach (Current)
```
System Prompt: 17,000 tokens
├── Tool Schemas:      8,000 tokens (all tools, full schemas)
├── Instructions:      3,500 tokens (all rules, examples)
├── Bootstrap Files:   5,000 tokens (AGENTS.md, SOUL.md, etc.)
└── Runtime:            500 tokens

→ Model receives everything upfront
→ Uses maybe 5-10% of it
```

### RAG Approach (New)
```
System Prompt: ~2,000 tokens
├── Tool Index:        500 tokens (names only, grouped)
├── Context Index:     200 tokens (topic list)
├── Core Rules:        300 tokens (essentials only)
├── Runtime:           200 tokens
└── Bootstrap Summary: 300 tokens (file names, not content)

+ get_context tool    → loads instructions on-demand
+ get_tool_schema tool → loads tool parameters on-demand

→ Model requests what it needs
→ Pays only for what it uses
```

## Token Savings

| Scenario | Traditional | RAG Mode | Savings |
|----------|-------------|----------|---------|
| Simple Q&A | 17,000 | 2,000 | **88%** |
| File editing | 17,000 | 3,500 | **79%** |
| Complex task | 17,000 | 6,000 | **65%** |
| Uses everything | 17,000 | 17,000 | 0% |

**Average savings: 75-85%**

## Usage

### Enable RAG Mode

```bash
# Command line
openclaw agent --prompt rag

# Or in config
```

```json5
// ~/.config/openclaw/config.json
{
  "agents": {
    "defaults": {
      "prompt": "rag"
    }
  }
}
```

## New Tools

### get_context

Retrieves detailed instructions for a topic.

```typescript
// Model calls this when it needs guidance
get_context({ query: "messaging telegram" })

// Returns:
// ## Messaging Basics
// - Reply in current session → automatically routes to the source channel
// - Cross-session messaging → use sessions_send(sessionKey, message)
// ...
```

**Available topics:**
- `messaging` - Sending messages, channels, sessions
- `messaging_buttons` - Inline buttons, interactive messages
- `reply_tags` - Reply/quote to specific messages
- `silent_replies` - When to stay silent
- `tool_call_style` - Narration vs direct calls
- `heartbeat` - Heartbeat poll responses
- `cli_reference` - OpenClaw CLI commands
- `self_update` - Updating configuration
- `sandbox` - Sandboxed environment rules
- `workspace_files` - Bootstrap files available
- `documentation` - Where to find docs
- `tools_overview` - Available tool categories
- `subagents` - Spawning sub-agents
- `memory_recall` - Using memory tools

### get_tool_schema

Retrieves detailed parameters for a tool.

```typescript
// Model calls this before using a complex tool
get_tool_schema({ tool_name: "browser" })

// Returns:
// ## browser
// Control web browser...
// 
// ### Parameters
// ```json
// {
//   "type": "object",
//   "properties": {
//     "action": { "type": "string", "enum": [...] },
//     ...
//   }
// }
// ```
```

## What the Model Sees

### Initial System Prompt (~2,000 tokens)

```
You are OpenClaw, a personal AI assistant.

## Workspace
Directory: /Users/me/project
Timezone: America/Sao_Paulo
Project files: AGENTS.md, SOUL.md (use read() for content)

## Tools
Tools (use get_tool_schema for parameters):
- Files: read, write, edit, grep, find, ls
- Exec: exec, process
- Web: web_search, web_fetch, browser
- Comms: message, sessions_send, sessions_spawn
- System: cron, gateway, nodes

## Context (On-Demand)
Available context topics (use get_context to load):
- messaging: messaging_basics, messaging_buttons, reply_tags
- behavior: silent_replies, tool_call_style, heartbeat
- system: cli_reference, self_update, sandbox
- workspace: workspace_files, documentation
- tools: tools_overview, subagents, memory_recall

## Quick Rules
- Tool names are case-sensitive
- Silent reply: __SILENT__ alone (nothing else)
- Heartbeat ack: HEARTBEAT_OK
- Use get_context(topic) for detailed instructions
- Use get_tool_schema(name) for tool parameters

Runtime: agent=default | host=mypc | os=darwin | model=claude-3-5-sonnet
```

## Flow Example

```
┌─────────────────────────────────────────────────────────────┐
│  User: "Send a message to John on Telegram"                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Model: I need to send a message. Let me check how...       │
│  → get_context("messaging telegram")                        │
│  Cost: +150 tokens                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  System returns: Messaging instructions (500 tokens)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Model: Now I need the message tool schema...               │
│  → get_tool_schema("message")                               │
│  Cost: +100 tokens                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  System returns: Message tool schema (400 tokens)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Model: Got it! Sending...                                  │
│  → message({ channel: "telegram", to: "John", ... })        │
└─────────────────────────────────────────────────────────────┘

Total tokens used: 2,000 (initial) + 150 + 500 + 100 + 400 = 3,150
vs Traditional: 17,000 tokens

SAVINGS: 81%
```

## When to Use RAG Mode

### ✅ Recommended for:
- Simple tasks (Q&A, quick edits)
- Cost-sensitive environments
- High-volume usage
- Models with good instruction following

### ⚠️ Consider alternatives for:
- Complex multi-step tasks (may need many lookups)
- Tasks requiring full context upfront
- When latency from extra tool calls matters

## Combining with Other Optimizations

RAG mode stacks with other optimizations:

```json5
{
  "agents": {
    "defaults": {
      "prompt": "rag",                    // RAG mode
      "bootstrapMaxChars": 5000,          // Reduced bootstrap
      "contextPruning": {
        "mode": "cache-ttl",              // Cache-aware pruning
        "ttl": "5m"
      },
      "heartbeat": {
        "enabled": true,                  // Keep cache warm
        "interval": "4m"
      }
    }
  }
}
```

**Combined savings: 85-95%**

## Technical Details

### Context Chunks

Instructions are stored as searchable chunks in `src/agents/contextual-rag/chunks.ts`:

```typescript
interface ContextChunk {
  id: string;           // Unique identifier
  summary: string;      // Short description for index
  content: string;      // Full content (loaded on-demand)
  keywords: string[];   // For search matching
  category: string;     // Grouping
  priority: number;     // Search ranking
}
```

### Tool Schema Registry

Tool schemas are registered at runtime in `src/agents/contextual-rag/tools.ts`:

```typescript
// When tools are created, schemas are registered
registerToolSchemas(tools);

// Model can retrieve them on-demand
get_tool_schema({ tool_name: "browser" });
```

### Adding New Context Chunks

To add new instruction chunks, edit `src/agents/contextual-rag/chunks.ts`:

```typescript
{
  id: "my_new_topic",
  summary: "Brief description",
  category: "behavior",
  priority: 5,
  keywords: ["keyword1", "keyword2"],
  content: `## My New Topic
Detailed instructions here...`,
}
```

## Metrics & Monitoring

Check RAG mode effectiveness:

```bash
# View context breakdown
/context detail

# Check cache hits
/status

# Monitor usage
/usage tokens
```

## Conclusion

RAG mode achieves **85%+ token reduction** by:
1. Sending only indexes upfront (not full content)
2. Loading detailed instructions on-demand
3. Loading tool schemas only when needed
4. Keeping bootstrap as references (not injected content)

This is the recommended mode for cost-conscious deployments while maintaining full functionality.
