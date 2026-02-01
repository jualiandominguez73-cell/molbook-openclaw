import type { AnyAgentTool } from "./tools/common.js";

/**
 * Tool categories for lazy loading optimization.
 * Reduces token usage by only sending relevant tools based on message context.
 */
export enum TOOL_CATEGORIES {
  /** Core file and shell operations - always active */
  CORE = "core",
  /** Web search, fetch, browser operations */
  WEB = "web",
  /** Messaging channels and scheduling */
  CHANNELS = "channels",
  /** Session and agent management */
  SESSIONS = "sessions",
  /** Infrastructure: gateway, nodes, canvas */
  INFRA = "infra",
  /** Image/vision analysis */
  VISION = "vision",
  /** Unknown/plugin tools - always included */
  UNKNOWN = "unknown",
}

export type ToolCategory = TOOL_CATEGORIES;

/**
 * Tool to category mapping
 */
const TOOL_CATEGORY_MAP: Record<string, TOOL_CATEGORIES> = {
  // Core tools - always available
  read: TOOL_CATEGORIES.CORE,
  write: TOOL_CATEGORIES.CORE,
  edit: TOOL_CATEGORIES.CORE,
  apply_patch: TOOL_CATEGORIES.CORE,
  grep: TOOL_CATEGORIES.CORE,
  find: TOOL_CATEGORIES.CORE,
  ls: TOOL_CATEGORIES.CORE,
  exec: TOOL_CATEGORIES.CORE,
  process: TOOL_CATEGORIES.CORE,

  // Web tools
  web_search: TOOL_CATEGORIES.WEB,
  web_fetch: TOOL_CATEGORIES.WEB,
  browser: TOOL_CATEGORIES.WEB,

  // Channel tools
  message: TOOL_CATEGORIES.CHANNELS,
  cron: TOOL_CATEGORIES.CHANNELS,
  tts: TOOL_CATEGORIES.CHANNELS,

  // Session tools
  sessions_list: TOOL_CATEGORIES.SESSIONS,
  sessions_history: TOOL_CATEGORIES.SESSIONS,
  sessions_send: TOOL_CATEGORIES.SESSIONS,
  sessions_spawn: TOOL_CATEGORIES.SESSIONS,
  session_status: TOOL_CATEGORIES.SESSIONS,
  agents_list: TOOL_CATEGORIES.SESSIONS,

  // Infra tools
  gateway: TOOL_CATEGORIES.INFRA,
  nodes: TOOL_CATEGORIES.INFRA,
  canvas: TOOL_CATEGORIES.INFRA,

  // Vision tools
  image: TOOL_CATEGORIES.VISION,
};

/**
 * Keywords that trigger each category
 */
const CATEGORY_KEYWORDS: Record<TOOL_CATEGORIES, string[]> = {
  [TOOL_CATEGORIES.CORE]: [], // Always included
  [TOOL_CATEGORIES.WEB]: [
    "search",
    "google",
    "website",
    "http",
    "https",
    "url",
    "browse",
    "browser",
    "web",
    "internet",
    "site",
    "page",
    "scrape",
    "fetch",
    "download",
    "online",
  ],
  [TOOL_CATEGORIES.CHANNELS]: [
    "telegram",
    "discord",
    "slack",
    "whatsapp",
    "signal",
    "imessage",
    "message",
    "send",
    "notify",
    "channel",
    "remind",
    "schedule",
    "cron",
    "voice",
    "audio",
  ],
  [TOOL_CATEGORIES.SESSIONS]: [
    "session",
    "sessions",
    "agent",
    "agents",
    "spawn",
    "subagent",
    "history",
    "context",
  ],
  [TOOL_CATEGORIES.INFRA]: [
    "gateway",
    "restart",
    "config",
    "node",
    "nodes",
    "camera",
    "screen",
    "canvas",
    "infrastructure",
  ],
  [TOOL_CATEGORIES.VISION]: [
    "image",
    "picture",
    "photo",
    "analyze image",
    "vision",
    "see",
    "look",
    "visual",
  ],
  [TOOL_CATEGORIES.UNKNOWN]: [], // Plugin tools - always included
};

/**
 * Get the category for a tool by name.
 * Returns UNKNOWN for unrecognized/plugin tools.
 * Normalizes names to lowercase for case-insensitive matching.
 */
export function categorizeTool(toolName: string): TOOL_CATEGORIES {
  // Normalize tool names to lowercase for case-insensitive matching
  // Handles namespaced tools like "tools.memory_search" or "bash"
  const normalizedName = toolName.toLowerCase();

  // Try exact match first
  if (TOOL_CATEGORY_MAP[normalizedName]) {
    return TOOL_CATEGORY_MAP[normalizedName];
  }

  // Try matching without namespace (e.g., "tools.read" -> "read")
  const withoutNamespace = normalizedName.split(".").pop() ?? normalizedName;
  return TOOL_CATEGORY_MAP[withoutNamespace] ?? TOOL_CATEGORIES.UNKNOWN;
}

/**
 * Detect which tool categories are needed based on message content.
 * Always includes CORE category.
 */
export function detectToolCategoriesFromMessage(message: string): TOOL_CATEGORIES[] {
  const normalizedMessage = " " + message.toLowerCase() + " ";
  const categories: Set<TOOL_CATEGORIES> = new Set([TOOL_CATEGORIES.CORE]);

  // Check each category's keywords using word boundaries to avoid false positives
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === TOOL_CATEGORIES.CORE || category === TOOL_CATEGORIES.UNKNOWN) {
      continue;
    }

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      // Use word boundary matching: space + keyword + space/punctuation
      // This prevents "web" matching "webhook" or "message" matching "messaging"
      if (
        normalizedMessage.includes(" " + lowerKeyword + " ") ||
        normalizedMessage.includes(" " + lowerKeyword + ".") ||
        normalizedMessage.includes(" " + lowerKeyword + ",") ||
        normalizedMessage.includes(" " + lowerKeyword + "!") ||
        normalizedMessage.includes(" " + lowerKeyword + "?")
      ) {
        categories.add(category as TOOL_CATEGORIES);
        break; // Found a match for this category, move to next
      }
    }
  }

  return Array.from(categories);
}

/**
 * Filter tools to only include those from specified categories.
 * Unknown/plugin tools are always included.
 */
export function filterToolsByCategories(
  tools: AnyAgentTool[],
  categories: TOOL_CATEGORIES[],
): AnyAgentTool[] {
  const categorySet = new Set(categories);

  return tools.filter((tool) => {
    const toolCategory = categorizeTool(tool.name);

    // Always include unknown/plugin tools
    if (toolCategory === TOOL_CATEGORIES.UNKNOWN) {
      return true;
    }

    return categorySet.has(toolCategory);
  });
}

/**
 * Filter tool names to only include those from specified categories.
 * Unknown/plugin tools are always included.
 */
export function filterToolNamesByCategories(
  toolNames: string[],
  categories: TOOL_CATEGORIES[],
): string[] {
  const categorySet = new Set(categories);

  return toolNames.filter((name) => {
    const toolCategory = categorizeTool(name);

    // Always include unknown/plugin tools
    if (toolCategory === TOOL_CATEGORIES.UNKNOWN) {
      return true;
    }

    return categorySet.has(toolCategory);
  });
}

/**
 * Get recommended categories for a message.
 * Convenience function that combines detection and returns array.
 */
export function getRecommendedCategoriesForMessage(message: string): TOOL_CATEGORIES[] {
  return detectToolCategoriesFromMessage(message);
}

/**
 * Estimate token savings from filtering.
 * Rough estimate: ~300 tokens per tool (schema + description)
 */
export function estimateTokenSavings(
  totalTools: number,
  filteredTools: number,
): { saved: number; percent: number } {
  const tokensPerTool = 300;
  const savedTools = totalTools - filteredTools;
  const saved = savedTools * tokensPerTool;
  const percent = totalTools > 0 ? (savedTools / totalTools) * 100 : 0;

  return { saved, percent };
}
