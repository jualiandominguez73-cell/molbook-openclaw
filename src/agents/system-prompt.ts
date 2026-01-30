import type { ReasoningLevel, ThinkLevel } from "../auto-reply/thinking.js";
import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { listDeliverableMessageChannels } from "../utils/message-channel.js";
import type { ResolvedTimeFormat } from "./date-time.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";
import { buildChunkIndex, buildToolIndex } from "./contextual-rag/index.js";

/**
 * Controls which hardcoded sections are included in the system prompt.
 * - "full": All sections (default, for main agent)
 * - "minimal": Reduced sections (Tooling, Workspace, Runtime) - used for subagents
 * - "none": Just basic identity line, no sections
 * - "rag": RAG-style lazy loading - minimal prompt with on-demand context retrieval
 */
export type PromptMode = "full" | "minimal" | "none" | "rag";

function buildSkillsSection(params: {
  skillsPrompt?: string;
  isMinimal: boolean;
  readToolName: string;
}) {
  if (params.isMinimal) return [];
  const trimmed = params.skillsPrompt?.trim();
  if (!trimmed) return [];
  return [
    "## Skills (mandatory)",
    "Before replying: scan <available_skills> <description> entries.",
    `- If exactly one skill clearly applies: read its SKILL.md at <location> with \`${params.readToolName}\`, then follow it.`,
    "- If multiple could apply: choose the most specific one, then read/follow it.",
    "- If none clearly apply: do not read any SKILL.md.",
    "Constraints: never read more than one skill up front; only read after selecting.",
    trimmed,
    "",
  ];
}

function buildMemorySection(params: { isMinimal: boolean; availableTools: Set<string> }) {
  if (params.isMinimal) return [];
  if (!params.availableTools.has("memory_search") && !params.availableTools.has("memory_get")) {
    return [];
  }
  return [
    "## Memory Recall",
    "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
    "",
  ];
}

function buildUserIdentitySection(ownerLine: string | undefined, isMinimal: boolean) {
  if (!ownerLine || isMinimal) return [];
  return ["## User Identity", ownerLine, ""];
}

function buildTimeSection(params: { userTimezone?: string }) {
  if (!params.userTimezone) return [];
  return ["## Current Date & Time", `Time zone: ${params.userTimezone}`, ""];
}

function buildReplyTagsSection(isMinimal: boolean) {
  if (isMinimal) return [];
  // Optimized: condensed from 6 lines to 2 lines (~60% token reduction)
  return [
    "## Reply Tags",
    "[[reply_to_current]] or [[reply_to:<id>]] for native reply/quote (stripped before send).",
    "",
  ];
}

function buildMessagingSection(params: {
  isMinimal: boolean;
  availableTools: Set<string>;
  messageChannelOptions: string;
  inlineButtonsEnabled: boolean;
  runtimeChannel?: string;
  messageToolHints?: string[];
}) {
  if (params.isMinimal) return [];
  // Optimized: condensed messaging section (~40% token reduction)
  const lines = [
    "## Messaging",
    "Reply → auto-routes to source channel. Cross-session → sessions_send(key, msg). Never use exec/curl for messaging.",
  ];
  if (params.availableTools.has("message")) {
    lines.push(
      `message tool: action=send with to+message (channel: ${params.messageChannelOptions}). After message(send), respond with ONLY: ${SILENT_REPLY_TOKEN}`,
    );
    if (params.inlineButtonsEnabled) {
      lines.push("Buttons: action=send + buttons=[[{text,callback_data}]]");
    }
    if (params.messageToolHints?.length) {
      lines.push(...params.messageToolHints);
    }
  }
  lines.push("");
  return lines;
}

function buildVoiceSection(params: { isMinimal: boolean; ttsHint?: string }) {
  if (params.isMinimal) return [];
  const hint = params.ttsHint?.trim();
  if (!hint) return [];
  return ["## Voice (TTS)", hint, ""];
}

function buildDocsSection(params: { docsPath?: string; isMinimal: boolean; readToolName: string }) {
  const docsPath = params.docsPath?.trim();
  if (!docsPath || params.isMinimal) return [];
  // Optimized: condensed docs section (~50% token reduction)
  return [
    "## Documentation",
    `Docs: ${docsPath} | https://docs.openclaw.ai | Skills: https://clawdhub.com`,
    "Consult docs first for OpenClaw behavior/config. Run `openclaw status` when diagnosing issues.",
    "",
  ];
}

export function buildAgentSystemPrompt(params: {
  workspaceDir: string;
  defaultThinkLevel?: ThinkLevel;
  reasoningLevel?: ReasoningLevel;
  extraSystemPrompt?: string;
  ownerNumbers?: string[];
  reasoningTagHint?: boolean;
  toolNames?: string[];
  toolSummaries?: Record<string, string>;
  modelAliasLines?: string[];
  userTimezone?: string;
  userTime?: string;
  userTimeFormat?: ResolvedTimeFormat;
  contextFiles?: EmbeddedContextFile[];
  skillsPrompt?: string;
  heartbeatPrompt?: string;
  docsPath?: string;
  workspaceNotes?: string[];
  ttsHint?: string;
  /** Controls which hardcoded sections to include. Defaults to "full". */
  promptMode?: PromptMode;
  runtimeInfo?: {
    agentId?: string;
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    defaultModel?: string;
    channel?: string;
    capabilities?: string[];
    repoRoot?: string;
  };
  messageToolHints?: string[];
  sandboxInfo?: {
    enabled: boolean;
    workspaceDir?: string;
    workspaceAccess?: "none" | "ro" | "rw";
    agentWorkspaceMount?: string;
    browserBridgeUrl?: string;
    browserNoVncUrl?: string;
    hostBrowserAllowed?: boolean;
    elevated?: {
      allowed: boolean;
      defaultLevel: "on" | "off" | "ask" | "full";
    };
  };
  /** Reaction guidance for the agent (for Telegram minimal/extensive modes). */
  reactionGuidance?: {
    level: "minimal" | "extensive";
    channel: string;
  };
}) {
  const coreToolSummaries: Record<string, string> = {
    read: "Read file contents",
    write: "Create or overwrite files",
    edit: "Make precise edits to files",
    apply_patch: "Apply multi-file patches",
    grep: "Search file contents for patterns",
    find: "Find files by glob pattern",
    ls: "List directory contents",
    exec: "Run shell commands (pty available for TTY-required CLIs)",
    process: "Manage background exec sessions",
    web_search: "Web search (Brave)",
    web_fetch: "Fetch URL content",
    // Channel docking: add login tools here when a channel needs interactive linking.
    browser: "Control browser",
    canvas: "Canvas present/eval/snapshot",
    nodes: "Node list/notify/camera/screen",
    cron: "Cron/reminders (systemEvent text = reminder content)",
    message: "Send messages/channel actions",
    gateway: "Config/restart/update OpenClaw",
    agents_list: "List agent ids for spawn",
    sessions_list: "List sessions/sub-agents",
    sessions_history: "Get session history",
    sessions_send: "Send to session/sub-agent",
    sessions_spawn: "Spawn sub-agent",
    session_status: "Status card (usage/model/time)",
    image: "Analyze image",
  };

  const toolOrder = [
    "read",
    "write",
    "edit",
    "apply_patch",
    "grep",
    "find",
    "ls",
    "exec",
    "process",
    "web_search",
    "web_fetch",
    "browser",
    "canvas",
    "nodes",
    "cron",
    "message",
    "gateway",
    "agents_list",
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "session_status",
    "image",
  ];

  const rawToolNames = (params.toolNames ?? []).map((tool) => tool.trim());
  const canonicalToolNames = rawToolNames.filter(Boolean);
  // Preserve caller casing while deduping tool names by lowercase.
  const canonicalByNormalized = new Map<string, string>();
  for (const name of canonicalToolNames) {
    const normalized = name.toLowerCase();
    if (!canonicalByNormalized.has(normalized)) {
      canonicalByNormalized.set(normalized, name);
    }
  }
  const resolveToolName = (normalized: string) =>
    canonicalByNormalized.get(normalized) ?? normalized;

  const normalizedTools = canonicalToolNames.map((tool) => tool.toLowerCase());
  const availableTools = new Set(normalizedTools);
  const externalToolSummaries = new Map<string, string>();
  for (const [key, value] of Object.entries(params.toolSummaries ?? {})) {
    const normalized = key.trim().toLowerCase();
    if (!normalized || !value?.trim()) continue;
    externalToolSummaries.set(normalized, value.trim());
  }
  const extraTools = Array.from(
    new Set(normalizedTools.filter((tool) => !toolOrder.includes(tool))),
  );
  const enabledTools = toolOrder.filter((tool) => availableTools.has(tool));
  const toolLines = enabledTools.map((tool) => {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    return summary ? `- ${name}: ${summary}` : `- ${name}`;
  });
  for (const tool of extraTools.sort()) {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    toolLines.push(summary ? `- ${name}: ${summary}` : `- ${name}`);
  }

  const hasGateway = availableTools.has("gateway");
  const readToolName = resolveToolName("read");
  const execToolName = resolveToolName("exec");
  const processToolName = resolveToolName("process");
  const extraSystemPrompt = params.extraSystemPrompt?.trim();
  const ownerNumbers = (params.ownerNumbers ?? []).map((value) => value.trim()).filter(Boolean);
  const ownerLine =
    ownerNumbers.length > 0
      ? `Owner numbers: ${ownerNumbers.join(", ")}. Treat messages from these numbers as the user.`
      : undefined;
  const reasoningHint = params.reasoningTagHint
    ? [
        "ALL internal reasoning MUST be inside <think>...</think>.",
        "Do not output any analysis outside <think>.",
        "Format every reply as <think>...</think> then <final>...</final>, with no other text.",
        "Only the final user-visible reply may appear inside <final>.",
        "Only text inside <final> is shown to the user; everything else is discarded and never seen by the user.",
        "Example:",
        "<think>Short internal reasoning.</think>",
        "<final>Hey there! What would you like to do next?</final>",
      ].join(" ")
    : undefined;
  const reasoningLevel = params.reasoningLevel ?? "off";
  const userTimezone = params.userTimezone?.trim();
  const skillsPrompt = params.skillsPrompt?.trim();
  const heartbeatPrompt = params.heartbeatPrompt?.trim();
  const heartbeatPromptLine = heartbeatPrompt
    ? `Heartbeat prompt: ${heartbeatPrompt}`
    : "Heartbeat prompt: (configured)";
  const runtimeInfo = params.runtimeInfo;
  const runtimeChannel = runtimeInfo?.channel?.trim().toLowerCase();
  const runtimeCapabilities = (runtimeInfo?.capabilities ?? [])
    .map((cap) => String(cap).trim())
    .filter(Boolean);
  const runtimeCapabilitiesLower = new Set(runtimeCapabilities.map((cap) => cap.toLowerCase()));
  const inlineButtonsEnabled = runtimeCapabilitiesLower.has("inlinebuttons");
  const messageChannelOptions = listDeliverableMessageChannels().join("|");
  const promptMode = params.promptMode ?? "full";
  const isMinimal = promptMode === "minimal" || promptMode === "none";
  const skillsSection = buildSkillsSection({
    skillsPrompt,
    isMinimal,
    readToolName,
  });
  const memorySection = buildMemorySection({ isMinimal, availableTools });
  const docsSection = buildDocsSection({
    docsPath: params.docsPath,
    isMinimal,
    readToolName,
  });
  const workspaceNotes = (params.workspaceNotes ?? []).map((note) => note.trim()).filter(Boolean);

  // For "none" mode, return just the basic identity line
  if (promptMode === "none") {
    return "You are a personal assistant running inside OpenClaw.";
  }

  // For "rag" mode, return minimal prompt with lazy-loading via get_context/get_tool_schema
  if (promptMode === "rag") {
    return buildRAGSystemPrompt({
      workspaceDir: params.workspaceDir,
      toolNames: canonicalToolNames,
      userTimezone,
      runtimeInfo,
      contextFiles: params.contextFiles,
    });
  }

  const lines = [
    "You are a personal assistant running inside OpenClaw.",
    "",
    "## Tooling",
    "Tools (case-sensitive, call exactly as listed):",
    toolLines.length > 0
      ? toolLines.join("\n")
      : [
          `Core: grep, find, ls, apply_patch, ${execToolName}, ${processToolName}, browser, canvas, nodes, cron, sessions_*`,
        ].join("\n"),
    "TOOLS.md = user guidance only. Complex tasks → spawn sub-agent.",
    "",
    "## Tool Style",
    "Call tools directly (no narration). Narrate only for: multi-step work, sensitive actions, or user request.",
    "",
    "## CLI Reference",
    "Gateway: openclaw gateway status|start|stop|restart. Run `openclaw help` if unsure.",
    "",
    ...skillsSection,
    ...memorySection,
    // Skip self-update for subagent/none modes
    hasGateway && !isMinimal ? "## Self-Update" : "",
    hasGateway && !isMinimal
      ? "Updates ONLY on explicit user request. Actions: config.get/schema/apply, update.run. Pings last session after restart."
      : "",
        ].join("\n")
      : "",
    hasGateway && !isMinimal ? "" : "",
    "",
    // Skip model aliases for subagent/none modes
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? "## Model Aliases"
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? "Prefer aliases when specifying model overrides; full provider/model is also accepted."
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? params.modelAliasLines.join("\n")
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal ? "" : "",
    "## Workspace",
    `Your working directory is: ${params.workspaceDir}`,
    "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
    ...workspaceNotes,
    "",
    ...docsSection,
    params.sandboxInfo?.enabled ? "## Sandbox" : "",
    params.sandboxInfo?.enabled
      ? [
          "Sandboxed runtime (Docker). Sub-agents stay sandboxed.",
          params.sandboxInfo.workspaceDir ? `Workspace: ${params.sandboxInfo.workspaceDir}` : "",
          params.sandboxInfo.workspaceAccess ? `Access: ${params.sandboxInfo.workspaceAccess}` : "",
          params.sandboxInfo.browserBridgeUrl ? "Browser: enabled" : "",
          params.sandboxInfo.elevated?.allowed
            ? `Elevated: ${params.sandboxInfo.elevated.defaultLevel} (/elevated on|off|ask|full)`
            : "",
        ]
          .filter(Boolean)
          .join(" | ")
      : "",
    params.sandboxInfo?.enabled ? "" : "",
    ...buildUserIdentitySection(ownerLine, isMinimal),
    ...buildTimeSection({
      userTimezone,
    }),
    "## Context Files",
    "User-editable files (AGENTS.md, SOUL.md, etc.) included below.",
    "",
    ...buildReplyTagsSection(isMinimal),
    ...buildMessagingSection({
      isMinimal,
      availableTools,
      messageChannelOptions,
      inlineButtonsEnabled,
      runtimeChannel,
      messageToolHints: params.messageToolHints,
    }),
    ...buildVoiceSection({ isMinimal, ttsHint: params.ttsHint }),
  ];

  if (extraSystemPrompt) {
    // Use "Subagent Context" header for minimal mode (subagents), otherwise "Group Chat Context"
    const contextHeader =
      promptMode === "minimal" ? "## Subagent Context" : "## Group Chat Context";
    lines.push(contextHeader, extraSystemPrompt, "");
  }
  if (params.reactionGuidance) {
    const { level, channel } = params.reactionGuidance;
    // Optimized: condensed reaction guidance (~50% token reduction)
    const guidanceText =
      level === "minimal"
        ? `${channel} reactions: MINIMAL mode. React sparingly (~1 per 5-10 exchanges) for important acks/humor.`
        : `${channel} reactions: EXTENSIVE mode. React freely to acknowledge, express sentiment, confirm understanding.`;
            "Guideline: react whenever it feels natural.",
          ].join("\n");
    lines.push("## Reactions", guidanceText, "");
  }
  if (reasoningHint) {
    lines.push("## Reasoning Format", reasoningHint, "");
  }

  const contextFiles = params.contextFiles ?? [];
  if (contextFiles.length > 0) {
    const hasSoulFile = contextFiles.some((file) => {
      const normalizedPath = file.path.trim().replace(/\\/g, "/");
      const baseName = normalizedPath.split("/").pop() ?? normalizedPath;
      return baseName.toLowerCase() === "soul.md";
    });
    lines.push("# Project Context");
    if (hasSoulFile) {
      lines.push("SOUL.md present → embody its persona/tone.");
    }
    lines.push("");
    for (const file of contextFiles) {
      lines.push(`## ${file.path}`, "", file.content, "");
    }
  }

  // Skip silent replies for subagent/none modes - optimized (~60% token reduction)
  if (!isMinimal) {
    lines.push(
      "## Silent Replies",
      `Nothing to say → respond ONLY: ${SILENT_REPLY_TOKEN} (entire message, no wrapping)`,
      "",
    );
  }

  // Skip heartbeats for subagent/none modes - optimized (~50% token reduction)
  if (!isMinimal) {
    lines.push(
      "## Heartbeats",
      heartbeatPromptLine,
      "On heartbeat poll: reply HEARTBEAT_OK if nothing needs attention; else reply with alert (no HEARTBEAT_OK).",
      "",
    );
  }

  lines.push(
    "## Runtime",
    buildRuntimeLine(runtimeInfo, runtimeChannel, runtimeCapabilities, params.defaultThinkLevel),
    `Reasoning: ${reasoningLevel} (hidden unless on/stream). Toggle /reasoning; /status shows Reasoning when enabled.`,
  );

  return lines.filter(Boolean).join("\n");
}

export function buildRuntimeLine(
  runtimeInfo?: {
    agentId?: string;
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    defaultModel?: string;
    repoRoot?: string;
  },
  runtimeChannel?: string,
  runtimeCapabilities: string[] = [],
  defaultThinkLevel?: ThinkLevel,
): string {
  return `Runtime: ${[
    runtimeInfo?.agentId ? `agent=${runtimeInfo.agentId}` : "",
    runtimeInfo?.host ? `host=${runtimeInfo.host}` : "",
    runtimeInfo?.repoRoot ? `repo=${runtimeInfo.repoRoot}` : "",
    runtimeInfo?.os
      ? `os=${runtimeInfo.os}${runtimeInfo?.arch ? ` (${runtimeInfo.arch})` : ""}`
      : runtimeInfo?.arch
        ? `arch=${runtimeInfo.arch}`
        : "",
    runtimeInfo?.node ? `node=${runtimeInfo.node}` : "",
    runtimeInfo?.model ? `model=${runtimeInfo.model}` : "",
    runtimeInfo?.defaultModel ? `default_model=${runtimeInfo.defaultModel}` : "",
    runtimeChannel ? `channel=${runtimeChannel}` : "",
    runtimeChannel
      ? `capabilities=${runtimeCapabilities.length > 0 ? runtimeCapabilities.join(",") : "none"}`
      : "",
    `thinking=${defaultThinkLevel ?? "off"}`,
  ]
    .filter(Boolean)
    .join(" | ")}`;
}
/**
 * Build a RAG-style system prompt with minimal initial tokens.
 *
 * Instead of ~17,000 tokens upfront, this sends ~2,000 tokens
 * with indexes of available context that can be loaded on-demand
 * via get_context() and get_tool_schema() tools.
 *
 * Token savings: ~88% reduction in initial prompt size!
 */
export function buildRAGSystemPrompt(params: {
  workspaceDir: string;
  toolNames: string[];
  userTimezone?: string;
  runtimeInfo?: {
    agentId?: string;
    host?: string;
    os?: string;
    model?: string;
    channel?: string;
  };
  contextFiles?: EmbeddedContextFile[];
}): string {
  const tools = params.toolNames.map((name) => ({ name }));
  const toolIndex = buildToolIndex(tools);
  const chunkIndex = buildChunkIndex();

  // Build compact bootstrap summary (not full content)
  const bootstrapSummary =
    params.contextFiles && params.contextFiles.length > 0
      ? `Project files: ${params.contextFiles.map((f) => f.path).join(", ")} (use read() for content)`
      : "";

  const runtimeLine = params.runtimeInfo
    ? `Runtime: ${[
        params.runtimeInfo.agentId ? `agent=${params.runtimeInfo.agentId}` : "",
        params.runtimeInfo.host ? `host=${params.runtimeInfo.host}` : "",
        params.runtimeInfo.os ? `os=${params.runtimeInfo.os}` : "",
        params.runtimeInfo.model ? `model=${params.runtimeInfo.model}` : "",
        params.runtimeInfo.channel ? `channel=${params.runtimeInfo.channel}` : "",
      ]
        .filter(Boolean)
        .join(" | ")}`
    : "";

  const lines = [
    "You are OpenClaw, a personal AI assistant.",
    "",
    "## Workspace",
    `Directory: ${params.workspaceDir}`,
    params.userTimezone ? `Timezone: ${params.userTimezone}` : "",
    bootstrapSummary,
    "",
    "## Tools",
    toolIndex,
    "",
    "## Context (On-Demand)",
    chunkIndex,
    "",
    "## Quick Rules",
    "- Tool names are case-sensitive",
    "- Silent reply: __SILENT__ alone (nothing else)",
    "- Heartbeat ack: HEARTBEAT_OK",
    "- Use get_context(topic) for detailed instructions",
    "- Use get_tool_schema(name) for tool parameters",
    "",
    runtimeLine,
  ];

  return lines.filter(Boolean).join("\n");
}