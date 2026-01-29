/**
 * Local type definitions for interop with the Claude Agent SDK and MCP SDK.
 *
 * These are compatible with the runtime shapes but do not require the packages
 * to be installed at build time (both are optional, lazy-loaded integrations).
 */

// ---------------------------------------------------------------------------
// MCP CallToolResult (from @modelcontextprotocol/sdk/types.js)
// ---------------------------------------------------------------------------

export type McpTextContent = {
  type: "text";
  text: string;
};

export type McpImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type McpResourceContent = {
  type: "resource";
  uri: string;
  text?: string;
  blob?: string;
};

export type McpContentBlock = McpTextContent | McpImageContent | McpResourceContent;

export type McpCallToolResult = {
  content: McpContentBlock[];
  isError?: boolean;
};

// ---------------------------------------------------------------------------
// MCP Server config shapes (passed to SDK query() → options.mcpServers)
// ---------------------------------------------------------------------------

/** In-process MCP server created via createSdkMcpServer() or new McpServer(). */
export type McpSdkServerConfig = {
  type: "sdk";
  name: string;
  /** The McpServer instance — typed as `unknown` to avoid importing the class. */
  instance: unknown;
};

// ---------------------------------------------------------------------------
// Claude Agent SDK query() options (subset we use)
// ---------------------------------------------------------------------------

export type SdkRunnerQueryOptions = {
  /** MCP servers to expose to the agent. */
  mcpServers?: Record<string, McpSdkServerConfig>;
  /** Tool allow list (pattern: "mcp__{server}__{tool}"). */
  allowedTools?: string[];
  /** Tool deny list. */
  disallowedTools?: string[];
  /** Built-in Claude Code tools to enable (or a preset). */
  tools?: string[] | { type: "preset"; preset: string };
  /** Environment variables for the SDK runtime (auth, base URL, timeout). */
  env?: Record<string, string>;
  /** Permission mode. */
  permissionMode?: string;
  /** Working directory. */
  cwd?: string;
  /** System prompt configuration. */
  systemPrompt?: string | { type: "preset"; preset: string };
  /** Max agent turns before stopping. */
  maxTurns?: number;
  /** Model to use. */
  model?: string;
  /** Thinking budget in tokens for extended thinking. */
  budgetTokens?: number;
  /** Additional directories the agent can access. */
  additionalDirectories?: string[];
  /** Session ID to resume (loads conversation history from the session). */
  resume?: string;
  /** When resuming, fork to a new session ID instead of continuing. */
  forkSession?: boolean;
  /** Continue the most recent conversation (mutually exclusive with resume). */
  continue?: boolean;
  /** Where to load Claude Code settings from ("project", etc.). */
  settingSources?: string[];
  /** Include partial message events in the SDK stream. */
  includePartialMessages?: boolean;
  /** Claude Code hook callbacks. */
  hooks?: Record<string, unknown>;
  /** Path to the Claude Code executable to run. */
  pathToClaudeCodeExecutable?: string;
};

// ---------------------------------------------------------------------------
// Claude Agent SDK event shapes (defensive — events are untyped at runtime)
// ---------------------------------------------------------------------------

export type SdkResultEvent = {
  type: "result";
  subtype?: "success" | "error";
  result?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// MCP Server tool registration (shape of McpServer from the SDK)
// ---------------------------------------------------------------------------

/**
 * Extra context passed to tool handlers by the MCP SDK.
 * Contains abort signal, session info, and other runtime context.
 */
export interface McpRequestHandlerExtra {
  signal: AbortSignal;
  sessionId?: string;
  _meta?: Record<string, unknown>;
  requestInfo?: { method: string; params?: unknown };
  [key: string]: unknown;
}

/**
 * Tool handler signature when inputSchema is provided.
 * The SDK calls handler(args, extra) where args is the validated input.
 */
export type McpToolHandler = (
  args: Record<string, unknown>,
  extra: McpRequestHandlerExtra,
) => Promise<McpCallToolResult>;

/**
 * Configuration object for registerTool().
 */
export interface McpToolConfig {
  title?: string;
  description?: string;
  /** Zod-compatible schema with parse/safeParse methods */
  inputSchema?: {
    parse(data: unknown): unknown;
    safeParse(data: unknown): { success: boolean; data?: unknown; error?: unknown };
    safeParseAsync?(data: unknown): Promise<{ success: boolean; data?: unknown; error?: unknown }>;
    _def?: Record<string, unknown>;
  };
  outputSchema?: unknown;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

/**
 * Minimal interface for the McpServer class from `@modelcontextprotocol/sdk`.
 * We use registerTool() which properly handles Zod-compatible inputSchema.
 */
export interface McpServerLike {
  /**
   * Register a tool with explicit configuration.
   * The inputSchema must be Zod-compatible (have parse/safeParse methods)
   * for the MCP SDK to properly validate args and pass them to the handler.
   */
  registerTool(name: string, config: McpToolConfig, handler: McpToolHandler): void;
}

/**
 * Constructor shape for new McpServer({ name, version }).
 */
export type McpServerConstructor = new (opts: { name: string; version: string }) => McpServerLike;
