/**
 * RAG Tools - On-demand context and tool schema retrieval
 *
 * These tools allow the model to request instructions and tool schemas
 * only when needed, reducing initial token consumption dramatically.
 */

import { Type } from "@sinclair/typebox";
import { searchChunks, getChunkById, buildChunkIndex, type ContextChunk } from "./chunks.js";

/**
 * Get Context Tool
 *
 * Allows the model to retrieve detailed instructions on-demand.
 * Replaces ~3000 tokens of static instructions with ~200 token index.
 */
export const getContextToolSchema = Type.Object({
  query: Type.String({
    description:
      "Topic or keyword to search for (e.g., 'messaging', 'silent', 'heartbeat', 'sandbox')",
  }),
});

export interface GetContextParams {
  query: string;
}

export function executeGetContext(params: GetContextParams): string {
  const { query } = params;

  if (!query?.trim()) {
    return `No query provided. ${buildChunkIndex()}`;
  }

  const matches = searchChunks(query);

  if (matches.length === 0) {
    return `No instructions found for "${query}".\n\n${buildChunkIndex()}`;
  }

  // Return top 3 most relevant chunks
  const topMatches = matches.slice(0, 3);
  const result = topMatches.map((chunk) => chunk.content).join("\n\n---\n\n");

  return result;
}

export function createGetContextTool() {
  return {
    name: "get_context",
    description:
      "Retrieve detailed instructions for a topic. Use before complex tasks or when unsure about OpenClaw behavior.",
    parameters: getContextToolSchema,
    execute: async (params: GetContextParams) => executeGetContext(params),
  };
}

/**
 * Tool Schema Storage
 *
 * Stores full tool schemas that can be retrieved on-demand.
 * This is populated when tools are created.
 */
const toolSchemaRegistry = new Map<string, unknown>();
const toolSummaryRegistry = new Map<string, string>();

export function registerToolSchema(name: string, schema: unknown, summary?: string) {
  toolSchemaRegistry.set(name.toLowerCase(), schema);
  if (summary) {
    toolSummaryRegistry.set(name.toLowerCase(), summary);
  }
}

export function registerToolSchemas(tools: Array<{ name: string; parameters?: unknown; description?: string }>) {
  for (const tool of tools) {
    registerToolSchema(tool.name, tool.parameters, tool.description);
  }
}

export function clearToolSchemaRegistry() {
  toolSchemaRegistry.clear();
  toolSummaryRegistry.clear();
}

/**
 * Get Tool Schema Tool
 *
 * Allows the model to retrieve detailed tool parameters on-demand.
 * Replaces ~8000 tokens of tool schemas with ~500 token index.
 */
export const getToolSchemaToolSchema = Type.Object({
  tool_name: Type.String({
    description: "Name of the tool to get schema for (e.g., 'browser', 'exec', 'message')",
  }),
});

export interface GetToolSchemaParams {
  tool_name: string;
}

export function executeGetToolSchema(params: GetToolSchemaParams): string {
  const { tool_name } = params;
  const normalized = tool_name?.trim().toLowerCase();

  if (!normalized) {
    const available = Array.from(toolSchemaRegistry.keys()).sort().join(", ");
    return `No tool name provided. Available tools: ${available}`;
  }

  const schema = toolSchemaRegistry.get(normalized);

  if (!schema) {
    const available = Array.from(toolSchemaRegistry.keys()).sort().join(", ");
    return `Tool "${tool_name}" not found. Available tools: ${available}`;
  }

  const summary = toolSummaryRegistry.get(normalized);
  const schemaJson = JSON.stringify(schema, null, 2);

  return [
    `## ${tool_name}`,
    summary ? `${summary}\n` : "",
    "### Parameters",
    "```json",
    schemaJson,
    "```",
  ]
    .filter(Boolean)
    .join("\n");
}

export function createGetToolSchemaTool() {
  return {
    name: "get_tool_schema",
    description:
      "Get detailed parameter schema for a tool. Use before calling complex tools like browser, message, or exec.",
    parameters: getToolSchemaToolSchema,
    execute: async (params: GetToolSchemaParams) => executeGetToolSchema(params),
  };
}

/**
 * Build a compact tool index for the system prompt.
 * Lists tool names + short summaries instead of full schemas.
 */
export function buildToolIndex(tools: Array<{ name: string; description?: string }>): string {
  if (tools.length === 0) return "No tools available.";

  const lines = ["Tools (use get_tool_schema for parameters):"];

  // Group by category based on name patterns
  const categories: Record<string, string[]> = {
    files: [],
    exec: [],
    web: [],
    comms: [],
    system: [],
    other: [],
  };

  for (const tool of tools) {
    const name = tool.name.toLowerCase();
    const entry = tool.name;

    if (["read", "write", "edit", "grep", "find", "ls", "apply_patch"].includes(name)) {
      categories.files.push(entry);
    } else if (["exec", "process"].includes(name)) {
      categories.exec.push(entry);
    } else if (["web_search", "web_fetch", "browser"].includes(name)) {
      categories.web.push(entry);
    } else if (["message", "sessions_send", "sessions_spawn", "sessions_list", "sessions_history"].includes(name)) {
      categories.comms.push(entry);
    } else if (["cron", "gateway", "nodes", "agents_list", "session_status"].includes(name)) {
      categories.system.push(entry);
    } else {
      categories.other.push(entry);
    }
  }

  if (categories.files.length) lines.push(`- Files: ${categories.files.join(", ")}`);
  if (categories.exec.length) lines.push(`- Exec: ${categories.exec.join(", ")}`);
  if (categories.web.length) lines.push(`- Web: ${categories.web.join(", ")}`);
  if (categories.comms.length) lines.push(`- Comms: ${categories.comms.join(", ")}`);
  if (categories.system.length) lines.push(`- System: ${categories.system.join(", ")}`);
  if (categories.other.length) lines.push(`- Other: ${categories.other.join(", ")}`);

  return lines.join("\n");
}

/**
 * Export index builder for system prompt
 */
export { buildChunkIndex };
