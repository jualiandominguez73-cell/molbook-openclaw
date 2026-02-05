/**
 * OpenClaw-specific Executor Integration
 *
 * Bridges OpenClaw's message sources and channels to ajs-clawbot's trust levels.
 */

import type {
  TrustLevel,
  ExecutionContext,
  ExecutionResult,
  RateLimiterOptions,
} from "ajs-clawbot";
import { SafeExecutor } from "ajs-clawbot";
import { loadSafeExecutorConfig, type SafeExecutorConfig } from "./config.js";

/**
 * Message source information from OpenClaw
 */
export type MessageSource = {
  provider: "discord" | "telegram" | "whatsapp" | "slack" | "line" | "web" | "cli";
  channelType: "dm" | "group" | "public";
  userId?: string;
  channelId?: string;
  isOwner?: boolean;
  isTrusted?: boolean;
};

/**
 * Options for creating an OpenClaw executor
 */
export interface OpenClawExecutorOptions {
  /** Workspace root directory (overrides config.workdir) */
  workspaceRoot?: string;

  /** LLM predict function */
  llmPredict?: (prompt: string, options?: unknown) => Promise<string>;

  /** Allowed hosts for fetch capability */
  allowedHosts?: string[];

  /** Bot's own user IDs (for self-message rejection) */
  selfIds?: string[];

  /** Use strict rate limiting (for public channels) */
  strictRateLimiting?: boolean;

  /** Callback when execution completes */
  onExecute?: (skill: string, result: ExecutionResult) => void;

  /** Callback when rate limited */
  onRateLimited?: (context: ExecutionContext, reason: string, retryAfterMs?: number) => void;

  /** Custom config (otherwise loads from ~/.openclaw/safe-executor.json) */
  config?: SafeExecutorConfig;
}

/**
 * Result of createOpenClawExecutor when enabled
 */
export type OpenClawExecutorResult = {
  enabled: true;
  executor: SafeExecutor;
  execute: (
    skillPath: string,
    args: Record<string, unknown>,
    source: MessageSource,
  ) => Promise<ExecutionResult>;
};

/**
 * Result of createOpenClawExecutor when disabled
 */
export type OpenClawExecutorDisabled = {
  enabled: false;
  executor: null;
  execute: null;
};

/**
 * Map OpenClaw message source to ajs-clawbot trust level
 */
export function getTrustLevelFromSource(source: MessageSource): TrustLevel {
  // CLI is always the local owner
  if (source.provider === "cli") {
    return "full";
  }

  // Owner flag from OpenClaw's user system
  if (source.isOwner) {
    return "full";
  }

  // Trusted users (explicitly configured in OpenClaw)
  if (source.isTrusted) {
    return "shell";
  }

  // DMs get write access (can create files, etc.)
  if (source.channelType === "dm") {
    return "write";
  }

  // Group chats get LLM access but no filesystem write
  if (source.channelType === "group") {
    return "llm";
  }

  // Public channels get minimal access
  return "network";
}

/**
 * Map trust level to execution context source
 */
function trustLevelToSource(trust: TrustLevel): "main" | "dm" | "group" | "public" {
  switch (trust) {
    case "full":
    case "shell":
      return "main";
    case "write":
      return "dm";
    case "llm":
    case "read":
      return "group";
    default:
      return "public";
  }
}

/**
 * Create an OpenClaw-integrated executor
 *
 * Returns { enabled: false, executor: null, execute: null } if config.enabled is false.
 * This allows callers to check and fall back to default behavior.
 */
export function createOpenClawExecutor(
  options: OpenClawExecutorOptions = {},
): OpenClawExecutorResult | OpenClawExecutorDisabled {
  const config = options.config ?? loadSafeExecutorConfig();

  // Respect the enabled flag - return no-op if disabled
  if (!config.enabled) {
    return { enabled: false, executor: null, execute: null };
  }

  const selfIds = options.selfIds ?? config.selfIds ?? [];
  const workdir = options.workspaceRoot ?? config.workdir;
  const rateLimitConfig = config.rateLimiting ?? {};

  // Build rate limiter options from config, with strictRateLimiting as multiplier
  const baseMaxRequests = rateLimitConfig.maxRequestsPerMinute ?? 10;
  const baseMaxConcurrent = rateLimitConfig.maxConcurrent ?? 2;
  const cooldownMs = rateLimitConfig.cooldownMs ?? 30000;

  const rateLimiterOptions: RateLimiterOptions = {
    selfIds,
    perRequester: options.strictRateLimiting
      ? {
          maxRequests: Math.max(1, Math.floor(baseMaxRequests / 2)),
          windowMs: 60000,
          maxConcurrent: 1,
        }
      : { maxRequests: baseMaxRequests * 2, windowMs: 60000, maxConcurrent: baseMaxConcurrent * 2 },
    global: options.strictRateLimiting
      ? { maxRequests: baseMaxRequests * 5, windowMs: 60000, maxConcurrent: baseMaxConcurrent * 3 }
      : {
          maxRequests: baseMaxRequests * 20,
          windowMs: 60000,
          maxConcurrent: baseMaxConcurrent * 10,
        },
    cooldownMs: options.strictRateLimiting ? cooldownMs * 2 : cooldownMs,
  };

  const executor = new SafeExecutor({
    selfIds,
    rateLimiter: rateLimiterOptions,
    onRateLimited: options.onRateLimited,
  });

  async function execute(
    skillPath: string,
    args: Record<string, unknown>,
    source: MessageSource,
  ): Promise<ExecutionResult> {
    const trustLevel = getTrustLevelFromSource(source);

    const context: ExecutionContext = {
      source: trustLevelToSource(trustLevel),
      userId: source.userId,
      channelId: source.channelId,
      workdir,
      allowedHosts: options.allowedHosts ?? config.allowedHosts ?? [],
      llmPredict: options.llmPredict,
    };

    const result = await executor.execute(skillPath, args, context);

    options.onExecute?.(skillPath, result);

    return result;
  }

  return { enabled: true, executor, execute };
}
