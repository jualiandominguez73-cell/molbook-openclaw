/**
 * Shared types and utilities for Zhipu Web Search plugin.
 */

export type ZhipuEngine = "search_std" | "search_pro" | "search_pro_sogou" | "search_pro_quark";
export type ZhipuContentSize = "medium" | "high";
export type ZhipuMode = "api" | "mcp";

export interface ZhipuSearchToolOptions {
  apiKey?: string;
  engine?: ZhipuEngine;
  contentSize?: ZhipuContentSize;
  mode?: ZhipuMode;
  logger?: PluginLogger;
}

export interface PluginLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  published?: string;
  media?: string;
  source?: string;
}

/**
 * Wrap external content to prevent prompt injection.
 * Matches the pattern used by core web_search.
 */
export function wrapExternal(text: string, source = "Zhipu Search"): string {
  return `<<<EXTERNAL_UNTRUSTED_CONTENT>>>\nSource: ${source}\n---\n${text}\n<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>`;
}

export function jsonResult(details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }],
    details,
  };
}
