import type { ReasoningLevel, ThinkLevel } from "../auto-reply/thinking.js";
import type { ResolvedTimeFormat } from "./date-time.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";
import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { listDeliverableMessageChannels } from "../utils/message-channel.js";

/**
 * Controls which hardcoded sections are included in the system prompt.
 * - "full": All sections (default, for main agent)
 * - "minimal": Reduced sections (Tooling, Safety, Workspace, Sandbox, Runtime) - used for subagents
 * - "none": Just basic identity line, no sections
 */
export type PromptMode = "full" | "minimal" | "none";

function buildSkillsSection(params: {
  skillsPrompt?: string;
  isMinimal: boolean;
  readToolName: string;
}) {
  if (params.isMinimal) {
    return [];
  }
  const trimmed = params.skillsPrompt?.trim();
  if (!trimmed) {
    return [];
  }
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
  if (params.isMinimal) {
    return [];
  }
  if (!params.availableTools.has("memory_search") && !params.availableTools.has("memory_get")) {
    return [];
  }
  return [
    "## Memory Recall",
    "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
    "",
  ];
}

function buildDocsSection(params: { docsPath?: string; isMinimal: boolean; readToolName: string }) {
  if (params.isMinimal) {
    return [];
  }
  const trimmed = params.docsPath?.trim();
  if (!trimmed) {
    return [];
  }
  return [
    "## Documentation",
    `If you need to reference internal docs: use \`${params.readToolName}\` on files under ${trimmed}.`,
    "",
  ];
}

function buildSandboxSection(params: { enabled: boolean; isMinimal: boolean }) {
  if (params.isMinimal || !params.enabled) {
    return [];
  }
  return [
    "## Sandbox",
    "You are running in a sandboxed environment. File system and network access may be restricted.",
    "",
  ];
}

function buildRuntimeSection(params: {
  isMinimal: boolean;
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
  };
  defaultThinkLevel?: string;
}) {
  if (params.isMinimal) {
    return [];
  }
  const runtimeInfo = params.runtimeInfo;
  const defaultThinkLevel = params.defaultThinkLevel ?? "off";
  const runtimeChannel = runtimeInfo?.channel?.trim().toLowerCase();
  const runtimeCapabilities = (runtimeInfo?.capabilities ?? [])
    .map((cap) => String(cap).trim())
    .filter(Boolean);

  return [
    "## Runtime",
    `Runtime: agent=${runtimeInfo?.agentId ?? "unknown"} | host=${runtimeInfo?.host ?? "unknown"} | os=${runtimeInfo?.os ?? "unknown"} | arch=${runtimeInfo?.arch ?? "unknown"} | node=${runtimeInfo?.node ?? "unknown"} | model=${runtimeInfo?.model ?? "unknown"} | default_model=${runtimeInfo?.defaultModel ?? "unknown"} | channel=${runtimeChannel ?? "unknown"} | capabilities=${runtimeCapabilities.length > 0 ? runtimeCapabilities.join(",") : "none"} | thinking=${defaultThinkLevel}`,
    "",
  ];
}

function buildReplyTagsSection(isMinimal: boolean) {
  if (isMinimal) {
    return [];
  }
  return [
    "## Reply Tags",
    "To request a native reply/quote on supported surfaces, include one tag in your reply:",
    "- [[reply_to_current]] replies to the triggering message.",
    "- [[reply_to:<id>]] replies to a specific message id when you have it.",
    "Whitespace inside the tag is allowed (e.g. [[ reply_to_current ]] / [[ reply_to: 123 ]]).",
    "Tags are stripped before sending; support depends on the current channel config.",
    '❌ Wrong: "Here\'s help... NO_REPLY"',
    '❌ Wrong: "NO_REPLY"',
    "✅ Right: NO_REPLY",
    "",
  ];
}

function buildMessagingSection(params: {
  isMinimal: boolean;
  availableTools: Set<string>;
  messageChannelOptions: string;
  runtimeChannel?: string;
  inlineButtonsEnabled: boolean;
  messageToolHints?: string[];
}) {
  const lines: string[] = [];

  if (!params.isMinimal) {
    lines.push(
      "## Messaging",
      "Use the `message` tool to send replies. Choose the appropriate channel for your response.",
      `Available channels: ${params.messageChannelOptions}`,
    );

    if (params.runtimeChannel) {
      lines.push(`Current channel: ${params.runtimeChannel}`);
    }

    if (params.inlineButtonsEnabled) {
      lines.push(
        "Inline buttons are enabled. You can use the `buttons` parameter in the `message` tool to provide interactive options.",
      );
    }

    if (params.messageToolHints && params.messageToolHints.length > 0) {
      lines.push("Hints:", ...params.messageToolHints.map((hint) => `- ${hint}`));
    }

    lines.push("");
  }

  return lines;
}

function buildVoiceSection(params: { isMinimal: boolean; ttsHint?: string }) {
  if (params.isMinimal) {
    return [];
  }
  const lines: string[] = [];

  if (params.ttsHint) {
    lines.push("## Voice", params.ttsHint, "");
  }

  return lines;
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
    web_search: "Search the web (Brave API)",
    web_fetch: "Fetch and extract readable content from a URL",
    browser: "Control web browser",
    canvas: "Present/eval/snapshot the Canvas",
    nodes: "List/describe/notify/camera/screen on paired nodes",
    cron: "Manage cron jobs and wake events (use for reminders; when scheduling a reminder, write the systemEvent text as something that will read like a reminder when it fires, and mention that it is a reminder depending on the time gap between setting and firing; include recent context in reminder text if appropriate)",
    message: "Send messages and channel actions",
    gateway: "Restart, apply config, or run updates on the running OpenClaw process",
    agents_list: "List agent ids allowed for sessions_spawn",
    sessions_list: "List other sessions (incl. sub-agents) with filters/last",
    sessions_history: "Fetch history for another session/sub-agent",
    sessions_send: "Send a message to another session/sub-agent",
    sessions_spawn: "Spawn a sub-agent session",
    session_status:
      "Show a /status-equivalent status card (usage + time + Reasoning/Verbose/Elevated); use for model-use questions (📊 session_status); optional per-session model override",
    image: "Analyze an image with the configured image model",
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
    "sessions_spawn",
    "session_status",
    "image",
  ];

  const rawToolNames = (params.toolNames ?? []).map((tool) => tool.trim());
  const canonicalToolNames = rawToolNames.filter(Boolean);
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
    if (!normalized || !value?.trim()) {
      continue;
    }
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
  for (const tool of extraTools.toSorted()) {
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
  const sandboxSection = buildSandboxSection({
    enabled: params.sandboxInfo?.enabled ?? false,
    isMinimal,
  });
  const runtimeSection = buildRuntimeSection({
    runtimeInfo,
    isMinimal,
    defaultThinkLevel: params.defaultThinkLevel,
  });
  const replyTagsSection = buildReplyTagsSection(isMinimal);
  const messagingSection = buildMessagingSection({
    isMinimal,
    availableTools,
    messageChannelOptions,
    runtimeChannel,
    inlineButtonsEnabled,
    messageToolHints: params.messageToolHints,
  });
  const voiceSection = buildVoiceSection({ isMinimal, ttsHint: params.ttsHint });

  const promptLines: string[] = [
    "You are an AI assistant running inside OpenClaw.",
    "",
    "## Tools",
    "You have access to the following tools:",
    ...toolLines,
    ...(hasGateway
      ? ["", "Use the `gateway` tool to restart, apply config, or run updates on OpenClaw."]
      : []),
    "",
    "## Safety",
    "- Do not send secrets/credentials via messaging tools.",
    "- When handling private data, prefer `read`/`write`/`edit` in the agent workspace.",
    "- You may be running in a sandbox. Respect sandbox restrictions.",
    "",
    ...skillsSection,
    ...memorySection,
    ...docsSection,
    ...sandboxSection,
    ...replyTagsSection,
    ...messagingSection,
    ...voiceSection,
    ...runtimeSection,
    ...(params.workspaceNotes ?? []),
    ...(ownerLine ? ["## User Identity", ownerLine, ""] : []),
    ...(reasoningHint ? ["## Reasoning", reasoningHint, ""] : []),
    ...(reasoningLevel !== "off" ? [`Reasoning: ${reasoningLevel}`, ""] : []),
    "## Time",
    ...(userTimezone ? [`User timezone: ${userTimezone}`] : []),
    ...(params.userTime ? [`Current time: ${params.userTime}`] : []),
    ...(params.userTimeFormat ? [`Time format: ${params.userTimeFormat}`] : []),
    "",
    "## Silent Replies",
    "When you have nothing to say, respond with ONLY: NO_REPLY",
    "⚠️ Rules:",
    "- It must be your ENTIRE message — nothing else",
    '- Never append it to an actual response (never include "NO_REPLY" in real replies)',
    "- Never wrap it in markdown or code blocks",
    '❌ Wrong: "Here\'s help... NO_REPLY"',
    '❌ Wrong: "NO_REPLY"',
    "✅ Right: NO_REPLY",
    "",
    "## Heartbeats",
    `Heartbeat prompt: ${heartbeatPromptLine}`,
    "If you receive a heartbeat poll (a user message matching the heartbeat prompt above), and there is nothing that needs attention, reply exactly:",
    "HEARTBEAT_OK",
    'OpenClaw treats a leading/trailing "HEARTBEAT_OK" as a heartbeat ack (and may discard it).',
    'If something needs attention, do NOT include "HEARTBEAT_OK"; reply with the alert text instead.',
    "",
    ...(extraSystemPrompt ? ["## Extra System Prompt", extraSystemPrompt, ""] : []),
    ...(params.contextFiles?.length
      ? [
          "## Project Context",
          "The following project context files have been loaded:",
          "",
          ...params.contextFiles.map((file) => `### ${file.path}\n${file.content}`),
          "",
        ]
      : []),
    `Runtime: agent=${runtimeInfo?.agentId ?? "unknown"} | host=${runtimeInfo?.host ?? "unknown"} | os=${runtimeInfo?.os ?? "unknown"} | arch=${runtimeInfo?.arch ?? "unknown"} | node=${runtimeInfo?.node ?? "unknown"} | model=${runtimeInfo?.model ?? "unknown"} | default_model=${runtimeInfo?.defaultModel ?? "unknown"} | channel=${runtimeChannel ?? "unknown"} | capabilities=${runtimeCapabilities.length > 0 ? runtimeCapabilities.join(",") : "none"} | thinking=${params.defaultThinkLevel ?? "off"}`,
  ];

  return promptLines.filter(Boolean).join("\n");
}
