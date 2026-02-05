/**
 * Core types for the Agent Execution Layer.
 *
 * The Execution Layer provides a unified orchestration architecture that replaces
 * scattered entry points with a single, layered execution stack. Every agent run
 * flows through the same pipeline with consistent runtime selection, execution,
 * normalization, event emission, and state persistence.
 *
 * @see docs/design/plans/opus/01-agent-execution-layer.md
 */

import type { ImageContent } from "@mariozechner/pi-ai";
import type { ReplyPayload } from "../auto-reply/types.js";
import type { OpenClawConfig } from "../config/config.js";

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

/**
 * Canonical event kinds emitted during execution.
 * These map to plugin hooks and diagnostic streams.
 */
export type ExecutionEventKind =
  | "lifecycle.start"
  | "lifecycle.end"
  | "lifecycle.error"
  | "tool.start"
  | "tool.end"
  | "assistant.partial"
  | "assistant.complete"
  | "compaction.start"
  | "compaction.end"
  | "hook.triggered";

/**
 * Canonical event schema for all lifecycle, tool, and hook events.
 * Emitted through the EventRouter to hooks, logs, UI, and diagnostics.
 */
export interface ExecutionEvent {
  /** Event kind identifier. */
  kind: ExecutionEventKind;
  /** Unix timestamp (ms) when event was emitted. */
  timestamp: number;
  /** Unique run identifier for correlation. */
  runId: string;
  /** Event-specific payload data. */
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Callback Types
// ---------------------------------------------------------------------------

/**
 * Callback invoked with partial text during streaming.
 */
export type OnPartialReplyCallback = (text: string) => void | Promise<void>;

/**
 * Callback invoked when a tool execution starts.
 */
export type OnToolStartCallback = (name: string, id: string) => void | Promise<void>;

/**
 * Callback invoked when a tool execution completes.
 */
export type OnToolEndCallback = (name: string, id: string, result: unknown) => void | Promise<void>;

/**
 * Callback invoked for each execution event.
 */
export type OnExecutionEventCallback = (event: ExecutionEvent) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Message Context (from inbound message)
// ---------------------------------------------------------------------------

/**
 * Context about the inbound message that triggered execution.
 * Primarily used for auto-reply and channel-specific behavior.
 */
export interface MessageContext {
  /** Messaging channel identifier (e.g., "telegram", "discord", "web"). */
  channel?: string;
  /** Provider identifier within the channel. */
  provider?: string;
  /** Sender user id. */
  senderId?: string | null;
  /** Sender display name. */
  senderName?: string | null;
  /** Sender username/handle. */
  senderUsername?: string | null;
  /** Sender phone number (E.164 format). */
  senderE164?: string | null;
  /** Group/chat id if in a group context. */
  groupId?: string | null;
  /** Group channel label (e.g., #general). */
  groupChannel?: string | null;
  /** Group space label (e.g., guild/team id). */
  groupSpace?: string | null;
  /** Thread id for threaded conversations. */
  threadId?: string | number;
  /** Message id to reply to. */
  replyToId?: string;
  /** Account id for multi-account channels. */
  accountId?: string;
}

// ---------------------------------------------------------------------------
// Execution Request
// ---------------------------------------------------------------------------

/**
 * The single input type that all entry points build.
 * Entry points (CLI, auto-reply, cron, extensions) construct this
 * and pass it to ExecutionKernel.execute().
 */
export interface ExecutionRequest {
  // --- Identity ---

  /** Agent identifier. */
  agentId: string;
  /** Session identifier (unique per conversation). */
  sessionId: string;
  /** Session key for session store lookups. */
  sessionKey?: string;
  /** Unique run identifier (generated if not provided). */
  runId?: string;

  // --- Context ---

  /** Working directory for the agent. */
  workspaceDir: string;
  /** Agent directory (for per-agent config/auth). */
  agentDir?: string;
  /** Configuration (resolved if not provided). */
  config?: OpenClawConfig;
  /** Inbound message context (for auto-reply, channels). */
  messageContext?: MessageContext;

  // --- Runtime hints ---

  /** Explicit runtime kind override ("pi" | "claude" | "cli"). */
  runtimeKind?: "pi" | "claude" | "cli";
  /** Parent session key for subagent runtime inheritance. */
  spawnedBy?: string | null;

  // --- Turn input ---

  /** User prompt to send to the agent. */
  prompt: string;
  /** Optional inbound images (multimodal input). */
  images?: ImageContent[];
  /** Additional system prompt to inject. */
  extraSystemPrompt?: string;

  // --- Constraints ---

  /** Timeout for the entire execution (ms). */
  timeoutMs?: number;
  /** Maximum tokens for the response. */
  maxTokens?: number;

  // --- Callbacks (optional, for streaming) ---

  /** Called with partial text during streaming. */
  onPartialReply?: OnPartialReplyCallback;
  /** Called when a tool execution starts. */
  onToolStart?: OnToolStartCallback;
  /** Called when a tool execution completes. */
  onToolEnd?: OnToolEndCallback;
  /** Called for each execution event. */
  onEvent?: OnExecutionEventCallback;
}

// ---------------------------------------------------------------------------
// Usage Metrics
// ---------------------------------------------------------------------------

/**
 * Token usage and cost metrics from a single execution.
 */
export interface UsageMetrics {
  /** Input tokens consumed. */
  inputTokens: number;
  /** Output tokens generated. */
  outputTokens: number;
  /** Tokens read from cache. */
  cacheReadTokens?: number;
  /** Tokens written to cache. */
  cacheWriteTokens?: number;
  /** Total execution duration (ms). */
  durationMs: number;
  /** Estimated cost (USD). */
  costUsd?: number;
}

// ---------------------------------------------------------------------------
// Tool Call Summary
// ---------------------------------------------------------------------------

/**
 * Summary of a tool call made during execution.
 */
export interface ToolCallSummary {
  /** Tool name. */
  name: string;
  /** Unique tool call id. */
  id: string;
  /** Tool input parameters. */
  input?: Record<string, unknown>;
  /** Whether the tool succeeded. */
  success: boolean;
  /** Error message if failed. */
  error?: string;
  /** Execution duration (ms). */
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Execution Error
// ---------------------------------------------------------------------------

/**
 * Error classification for execution failures.
 */
export type ExecutionErrorKind =
  | "validation_failed"
  | "runtime_unavailable"
  | "runtime_error"
  | "timeout"
  | "aborted"
  | "quota_exceeded"
  | "tool_error"
  | "state_persist_failed"
  | "unknown";

/**
 * Structured error from execution failures.
 */
export interface ExecutionError {
  /** Error kind for categorization. */
  kind: ExecutionErrorKind;
  /** Human-readable error message. */
  message: string;
  /** Original error (if available). */
  cause?: unknown;
  /** Whether the error is retryable. */
  retryable?: boolean;
}

// ---------------------------------------------------------------------------
// Turn Outcome (internal result from TurnExecutor)
// ---------------------------------------------------------------------------

/**
 * Result from a single turn execution (internal to the layer).
 * Produced by TurnExecutor, consumed by ExecutionKernel.
 */
export interface TurnOutcome {
  /** Final reply text after normalization. */
  reply: string;
  /** Structured reply payloads (text, media, etc.). */
  payloads: ReplyPayload[];
  /** Tool calls made during the turn. */
  toolCalls: ToolCallSummary[];
  /** Token usage metrics. */
  usage: UsageMetrics;
  /** Whether a fallback model was used. */
  fallbackUsed: boolean;
  /** Whether the agent sent via messaging tool. */
  didSendViaMessagingTool: boolean;
}

// ---------------------------------------------------------------------------
// Runtime Context (from RuntimeResolver)
// ---------------------------------------------------------------------------

/**
 * Tool policy for runtime execution.
 */
export interface ToolPolicy {
  /** Whether tools are enabled at all. */
  enabled: boolean;
  /** Allowed tool names (undefined = all allowed). */
  allowList?: string[];
  /** Denied tool names. */
  denyList?: string[];
  /** Whether elevated/sudo tools are allowed. */
  allowElevated?: boolean;
}

/**
 * Sandbox context for tool execution.
 */
export interface SandboxContext {
  /** Sandbox type (e.g., "docker", "nix", "none"). */
  type: string;
  /** Container/environment identifier. */
  containerId?: string;
  /** Mounted working directory. */
  workDir?: string;
}

/**
 * Runtime capabilities metadata.
 */
export interface RuntimeCapabilities {
  /** Whether the runtime supports tool use. */
  supportsTools: boolean;
  /** Whether the runtime supports streaming. */
  supportsStreaming: boolean;
  /** Whether the runtime supports image input. */
  supportsImages: boolean;
  /** Whether the runtime supports extended thinking. */
  supportsThinking: boolean;
}

/**
 * Resolved runtime context for execution.
 * Produced by RuntimeResolver, consumed by TurnExecutor.
 */
export interface RuntimeContext {
  /** Runtime kind identifier. */
  kind: "pi" | "claude" | "cli";
  /** Provider name (e.g., "anthropic", "z.ai", "openai"). */
  provider: string;
  /** Model identifier. */
  model: string;
  /** Tool policy for this execution. */
  toolPolicy: ToolPolicy;
  /** Sandbox context (if tools enabled and sandboxing configured). */
  sandbox: SandboxContext | null;
  /** Runtime capabilities. */
  capabilities: RuntimeCapabilities;
}

// ---------------------------------------------------------------------------
// Execution Result
// ---------------------------------------------------------------------------

/**
 * Runtime information included in the result.
 */
export interface ExecutionRuntimeInfo {
  /** Runtime kind used. */
  kind: "pi" | "claude" | "cli";
  /** Provider used. */
  provider?: string;
  /** Model used. */
  model?: string;
  /** Whether a fallback was used (e.g., model unavailable). */
  fallbackUsed: boolean;
}

/**
 * The single output type that all entry points receive.
 * Returned by ExecutionKernel.execute().
 */
export interface ExecutionResult {
  // --- Status ---

  /** Whether execution completed successfully. */
  success: boolean;
  /** Whether execution was aborted. */
  aborted: boolean;
  /** Structured error if execution failed. */
  error?: ExecutionError;

  // --- Output ---

  /** Final reply text. */
  reply: string;
  /** Structured reply payloads (for multi-part replies, media, etc.). */
  payloads: ReplyPayload[];

  // --- Runtime info ---

  /** Information about the runtime used. */
  runtime: ExecutionRuntimeInfo;

  // --- Usage ---

  /** Token usage and timing metrics. */
  usage: UsageMetrics;

  // --- Events ---

  /** All events emitted during execution. */
  events: ExecutionEvent[];

  // --- Tool activity ---

  /** Summary of tool calls made. */
  toolCalls: ToolCallSummary[];
  /** Whether the agent sent via messaging tool. */
  didSendViaMessagingTool: boolean;
}

// ---------------------------------------------------------------------------
// Event Router Types
// ---------------------------------------------------------------------------

/**
 * Listener function for execution events.
 */
export type EventListener = (event: ExecutionEvent) => void | Promise<void>;

/**
 * Unsubscribe function returned by event subscription.
 */
export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// Execution Config (feature flags)
// ---------------------------------------------------------------------------

/**
 * Per-entry-point feature flags for gradual migration.
 * Each entry point can be migrated independently with its own flag.
 */
export interface ExecutionEntryPointFlags {
  /** Enable for CLI agent command (src/commands/agent.ts). */
  cli?: boolean;
  /** Enable for auto-reply runner (src/auto-reply/reply/agent-runner-execution.ts). */
  autoReply?: boolean;
  /** Enable for followup runner (src/auto-reply/reply/followup-runner.ts). */
  followup?: boolean;
  /** Enable for cron runner (src/cron/isolated-agent/run.ts). */
  cron?: boolean;
  /** Enable for hybrid planner (src/agents/hybrid-planner.ts). */
  hybridPlanner?: boolean;
}

/**
 * Execution layer configuration.
 * Added to OpenClawConfig.execution.
 */
export interface ExecutionConfig {
  /**
   * Per-entry-point feature flags for gradual migration.
   * Each flag controls whether that entry point uses the new ExecutionKernel.
   * Default: all false (use legacy paths).
   */
  useNewLayer?: ExecutionEntryPointFlags;

  /**
   * Global kill switch to disable new layer for all entry points.
   * When false, all entry points use legacy paths regardless of per-entry flags.
   * Default: true (per-entry flags are respected).
   */
  enabled?: boolean;
}
