/**
 * Contextual RAG System - Instruction Chunks
 *
 * Instead of loading ALL instructions into the system prompt,
 * we store them as searchable chunks that can be loaded on-demand.
 *
 * This reduces initial token consumption by ~90% while maintaining
 * full functionality - the model simply requests what it needs.
 */

export interface ContextChunk {
  /** Unique identifier for the chunk */
  id: string;
  /** Short summary for the index (shown in system prompt) */
  summary: string;
  /** Full content (loaded on demand) */
  content: string;
  /** Keywords for search matching */
  keywords: string[];
  /** Category for grouping */
  category: "tools" | "messaging" | "behavior" | "system" | "workspace";
  /** Priority: higher = more likely to be needed */
  priority: number;
}

/**
 * Instruction chunks - these replace verbose system prompt sections.
 * Each chunk is ~100-500 tokens but only loaded when needed.
 */
export const INSTRUCTION_CHUNKS: ContextChunk[] = [
  // ============ MESSAGING ============
  {
    id: "messaging_basics",
    summary: "Send messages across channels/sessions",
    category: "messaging",
    priority: 8,
    keywords: ["message", "send", "channel", "session", "telegram", "slack", "discord", "signal", "whatsapp"],
    content: `## Messaging Basics
- Reply in current session → automatically routes to the source channel
- Cross-session messaging → use sessions_send(sessionKey, message)
- Never use exec/curl for messaging; OpenClaw handles routing internally
- For proactive sends or channel actions, use the \`message\` tool with action=send
- If multiple channels configured, specify \`channel\` parameter`,
  },
  {
    id: "messaging_buttons",
    summary: "Inline buttons and interactive messages",
    category: "messaging",
    priority: 4,
    keywords: ["button", "inline", "callback", "interactive", "poll"],
    content: `## Inline Buttons
- Use \`message\` tool with action=send and buttons parameter
- Format: buttons=[[{text: "Label", callback_data: "action"}]]
- callback_data routes back as a user message
- Not all channels support buttons; check channel capabilities`,
  },
  {
    id: "reply_tags",
    summary: "Reply/quote to specific messages",
    category: "messaging",
    priority: 3,
    keywords: ["reply", "quote", "reply_to", "thread"],
    content: `## Reply Tags
To request a native reply/quote on supported surfaces:
- [[reply_to_current]] - replies to the triggering message
- [[reply_to:<id>]] - replies to a specific message id
Tags are stripped before sending; support depends on channel config.`,
  },

  // ============ BEHAVIOR ============
  {
    id: "silent_replies",
    summary: "When to stay silent",
    category: "behavior",
    priority: 7,
    keywords: ["silent", "nothing", "empty", "quiet", "__silent__"],
    content: `## Silent Replies
When you have nothing meaningful to say, respond with ONLY:
__SILENT__

Rules:
- Must be your ENTIRE message, nothing else
- Never append to an actual response
- Never wrap in markdown or code blocks`,
  },
  {
    id: "tool_call_style",
    summary: "When to narrate vs just call tools",
    category: "behavior",
    priority: 5,
    keywords: ["narrate", "explain", "verbose", "tool", "call"],
    content: `## Tool Call Style
Default: call tools directly without narration for routine tasks.

Narrate only when helpful:
- Multi-step complex work
- Sensitive actions (deletions, system changes)
- When user explicitly asks for explanation

Keep narration brief and value-dense.`,
  },
  {
    id: "heartbeat",
    summary: "Responding to heartbeat polls",
    category: "behavior",
    priority: 6,
    keywords: ["heartbeat", "poll", "ping", "heartbeat_ok"],
    content: `## Heartbeats
If you receive a heartbeat poll (matches the configured heartbeat prompt):
- If nothing needs attention: reply exactly HEARTBEAT_OK
- If something needs attention: reply with alert text (no HEARTBEAT_OK)

OpenClaw treats leading/trailing "HEARTBEAT_OK" as an ack and may discard it.`,
  },

  // ============ SYSTEM ============
  {
    id: "cli_reference",
    summary: "OpenClaw CLI commands",
    category: "system",
    priority: 4,
    keywords: ["cli", "command", "openclaw", "gateway", "start", "stop", "restart"],
    content: `## OpenClaw CLI Reference
OpenClaw is controlled via subcommands. Do not invent commands.

Gateway management:
- openclaw gateway status
- openclaw gateway start
- openclaw gateway stop
- openclaw gateway restart

If unsure, ask user to run \`openclaw help\` and paste output.`,
  },
  {
    id: "self_update",
    summary: "Updating OpenClaw configuration/code",
    category: "system",
    priority: 3,
    keywords: ["update", "config", "upgrade", "restart", "apply"],
    content: `## Self-Update
Updates are ONLY allowed when user explicitly asks.

Actions via gateway tool:
- config.get - get current config
- config.schema - get config schema
- config.apply - validate + write config, then restart
- update.run - update deps/git, then restart

Never run config.apply or update.run without explicit user request.`,
  },
  {
    id: "sandbox",
    summary: "Sandboxed environment rules",
    category: "system",
    priority: 5,
    keywords: ["sandbox", "docker", "container", "elevated", "restricted"],
    content: `## Sandbox Mode
When running sandboxed (tools execute in Docker):
- Some tools may be unavailable due to policy
- Sub-agents stay sandboxed (no elevated/host access)
- For outside-sandbox operations, ask user first
- Elevated exec may be available: check /elevated status
- User can toggle with /elevated on|off|ask|full`,
  },

  // ============ WORKSPACE ============
  {
    id: "workspace_files",
    summary: "Bootstrap/context files available",
    category: "workspace",
    priority: 6,
    keywords: ["agents.md", "soul.md", "tools.md", "bootstrap", "context", "workspace"],
    content: `## Workspace Files
These files may exist in the workspace and contain project-specific guidance:
- AGENTS.md - Repository guidelines (how to work in this repo)
- SOUL.md - Agent personality/tone (embody this if present)
- TOOLS.md - External tool usage guidance
- IDENTITY.md - Agent identity
- USER.md - User preferences
- MEMORY.md - Persistent memory/notes

Use read() to access them when relevant to the task.`,
  },
  {
    id: "documentation",
    summary: "Where to find OpenClaw docs",
    category: "workspace",
    priority: 3,
    keywords: ["docs", "documentation", "help", "reference", "guide"],
    content: `## Documentation
- Local docs: check for docs/ folder in workspace
- Online: https://docs.openclaw.ai
- Source: https://github.com/openclaw/openclaw
- Community: https://discord.com/invite/clawd
- Skills: https://clawdhub.com

For OpenClaw behavior/config questions, check docs first.`,
  },

  // ============ TOOLS ============
  {
    id: "tools_overview",
    summary: "Available tool categories",
    category: "tools",
    priority: 9,
    keywords: ["tool", "available", "list", "what", "can"],
    content: `## Tool Categories
File Operations: read, write, edit, grep, find, ls
Execution: exec (shell commands), process (background management)
Web: web_search, web_fetch, browser
Communication: message, sessions_send, sessions_spawn
System: cron, gateway, nodes
Media: image, canvas

Tool names are case-sensitive. Call exactly as listed.
Use get_tool_schema(name) for detailed parameters.`,
  },
  {
    id: "subagents",
    summary: "Spawning and managing sub-agents",
    category: "tools",
    priority: 5,
    keywords: ["subagent", "spawn", "agent", "parallel", "delegate"],
    content: `## Sub-Agents
For complex or long-running tasks, spawn a sub-agent:
- sessions_spawn - create a new sub-agent session
- sessions_send - send messages to sub-agent
- sessions_list - list active sessions
- sessions_history - get sub-agent history

Sub-agent will ping you when done. You can check on it anytime.`,
  },
  {
    id: "memory_recall",
    summary: "Searching and using memory",
    category: "tools",
    priority: 4,
    keywords: ["memory", "recall", "remember", "search", "history", "past"],
    content: `## Memory Recall
Before answering about prior work, decisions, dates, people, preferences, or todos:
1. Run memory_search on MEMORY.md + memory/*.md
2. Use memory_get to pull only needed lines
3. If low confidence after search, say you checked

Memory tools: memory_search, memory_get, memory_write`,
  },
];

/**
 * Search chunks by query string.
 * Returns matching chunks sorted by relevance.
 */
export function searchChunks(query: string): ContextChunk[] {
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  const scored = INSTRUCTION_CHUNKS.map((chunk) => {
    let score = 0;

    // Exact id match
    if (chunk.id === queryLower) score += 100;

    // Keyword matches
    for (const keyword of chunk.keywords) {
      if (queryLower.includes(keyword)) score += 10;
      if (keyword.includes(queryLower)) score += 5;
      for (const word of queryWords) {
        if (keyword.includes(word)) score += 3;
      }
    }

    // Summary match
    if (chunk.summary.toLowerCase().includes(queryLower)) score += 8;

    // Category match
    if (chunk.category === queryLower) score += 15;

    // Content contains query
    if (chunk.content.toLowerCase().includes(queryLower)) score += 2;

    // Priority boost
    score += chunk.priority;

    return { chunk, score };
  });

  return scored
    .filter((item) => item.score > 5) // Minimum relevance threshold
    .sort((a, b) => b.score - a.score)
    .map((item) => item.chunk);
}

/**
 * Get chunk by exact ID.
 */
export function getChunkById(id: string): ContextChunk | undefined {
  return INSTRUCTION_CHUNKS.find((chunk) => chunk.id === id);
}

/**
 * Get all chunks in a category.
 */
export function getChunksByCategory(category: ContextChunk["category"]): ContextChunk[] {
  return INSTRUCTION_CHUNKS.filter((chunk) => chunk.category === category).sort(
    (a, b) => b.priority - a.priority,
  );
}

/**
 * Build a compact index of available topics for the system prompt.
 * This replaces ~3000 tokens of instructions with ~200 tokens of index.
 */
export function buildChunkIndex(): string {
  const byCategory = new Map<string, ContextChunk[]>();

  for (const chunk of INSTRUCTION_CHUNKS) {
    const list = byCategory.get(chunk.category) ?? [];
    list.push(chunk);
    byCategory.set(chunk.category, list);
  }

  const lines: string[] = ["Available context topics (use get_context to load):"];

  for (const [category, chunks] of byCategory) {
    const topics = chunks
      .sort((a, b) => b.priority - a.priority)
      .map((c) => c.id)
      .join(", ");
    lines.push(`- ${category}: ${topics}`);
  }

  return lines.join("\n");
}
