import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

import type { CliBackendConfig } from "../../config/types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("agent/cli-streaming");

export type CliStreamEvent = {
  type: string;
  [key: string]: unknown;
};

type CliUsage = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
};

export type CliStreamResult = {
  text: string;
  sessionId?: string;
  usage?: CliUsage;
  events: CliStreamEvent[];
};

export type CliStreamParams = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs: number;
  eventTypes?: string[];
  backend: CliBackendConfig;
  onEvent: (event: CliStreamEvent) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pickSessionId(
  parsed: Record<string, unknown>,
  backend: CliBackendConfig,
): string | undefined {
  const fields = backend.sessionIdFields ?? [
    "session_id",
    "sessionId",
    "conversation_id",
    "conversationId",
  ];
  for (const field of fields) {
    const value = parsed[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function toUsage(raw: Record<string, unknown>, backend?: CliBackendConfig): CliUsage | undefined {
  const pick = (key: string) =>
    typeof raw[key] === "number" && raw[key] > 0 ? (raw[key] as number) : undefined;

  const pickFirst = (keys: string[] | undefined, fallback: string[]): number | undefined => {
    const ordered = keys && keys.length > 0 ? keys : fallback;
    for (const key of ordered) {
      const value = pick(key);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const fields = backend?.usageFields;
  const input = pickFirst(fields?.input, ["input_tokens", "inputTokens"]);
  const output = pickFirst(fields?.output, ["output_tokens", "outputTokens"]);
  const cacheRead = pickFirst(fields?.cacheRead, [
    "cache_read_input_tokens",
    "cached_input_tokens",
    "cacheRead",
  ]);
  const cacheWrite = pickFirst(fields?.cacheWrite, [
    "cache_creation_input_tokens",
    "cache_write_input_tokens",
    "cacheWrite",
  ]);
  const total = pickFirst(fields?.total, ["total_tokens", "total"]);

  if (!input && !output && !cacheRead && !cacheWrite && !total) return undefined;
  return { input, output, cacheRead, cacheWrite, total };
}

/** Check if an event type matches the filter (supports prefix matching with *). */
function matchesEventType(eventType: string, filters: string[]): boolean {
  for (const filter of filters) {
    if (filter === eventType) return true;
    // Support prefix matching (e.g., "item" matches "item.created", "item.completed")
    if (eventType.startsWith(`${filter}.`)) return true;
  }
  return false;
}

/**
 * Run a CLI with streaming NDJSON output, parsing events line-by-line.
 * Follows the iMessage RPC client pattern for readline-based JSON parsing.
 */
export async function runCliWithStreaming(params: CliStreamParams): Promise<CliStreamResult> {
  const { command, args, cwd, env, input, timeoutMs, eventTypes, backend, onEvent } = params;

  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams | null = null;
    let reader: Interface | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let resolved = false;

    const events: CliStreamEvent[] = [];
    const textParts: string[] = [];
    let sessionId: string | undefined;
    let usage: CliUsage | undefined;
    let stderrBuffer = "";

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      reader?.close();
      reader = null;
    };

    const fail = (err: Error) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      if (child && !child.killed) {
        child.kill("SIGTERM");
      }
      reject(err);
    };

    const succeed = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({
        text: textParts.join("").trim(),
        sessionId,
        usage,
        events,
      });
    };

    // Timeout handling
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        fail(new Error(`CLI streaming timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    try {
      child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd,
        env,
      });
    } catch (err) {
      fail(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    reader = createInterface({ input: child.stdout });

    reader.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Log raw line (truncated for readability)
      log.info(
        `cli stream: raw line: ${trimmed.slice(0, 300)}${trimmed.length > 300 ? "..." : ""}`,
      );

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Not valid JSON, skip
        log.debug(`cli stream: skipping non-JSON line: ${trimmed.slice(0, 100)}`);
        return;
      }

      if (!isRecord(parsed)) {
        log.debug(`cli stream: parsed value is not a record, skipping`);
        return;
      }

      // Always try to extract session ID and usage from any parsed object
      if (!sessionId) {
        sessionId = pickSessionId(parsed, backend);
        if (sessionId) {
          log.info(`cli stream: extracted sessionId=${sessionId}`);
        }
      }
      if (isRecord(parsed.usage)) {
        const newUsage = toUsage(parsed.usage, backend);
        if (newUsage) {
          usage = newUsage;
          log.info(`cli stream: extracted usage input=${usage.input} output=${usage.output}`);
        }
      }

      const eventType = typeof parsed.type === "string" ? parsed.type : "";
      log.info(`cli stream: eventType="${eventType}"`);

      if (!eventType) {
        // Non-typed event (e.g., final result object) - already extracted session/usage above
        log.debug(`cli stream: no event type, skipping event creation`);
        return;
      }

      const event: CliStreamEvent = { type: eventType, ...parsed };
      events.push(event);
      log.info(`cli stream: created event #${events.length} type="${eventType}"`);

      // Filter events by type if specified
      const shouldEmit =
        !eventTypes || eventTypes.length === 0 || matchesEventType(eventType, eventTypes);
      log.info(
        `cli stream: shouldEmit=${shouldEmit} (filters=${JSON.stringify(eventTypes ?? [])})`,
      );

      // Handle Claude CLI event types
      if (eventType === "text" || eventType === "content_block_delta") {
        // Claude CLI text streaming
        const text = typeof parsed.text === "string" ? parsed.text : "";
        if (text) {
          textParts.push(text);
          log.info(
            `cli stream: accumulated text chunk (${text.length} chars): "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`,
          );
        }
      } else if (eventType === "assistant" || eventType === "message") {
        // Claude CLI assistant message (may contain full text)
        const message = isRecord(parsed.message) ? parsed.message : parsed;
        const content = message.content;
        if (typeof content === "string") {
          textParts.push(content);
          log.info(`cli stream: accumulated assistant content (${content.length} chars)`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (isRecord(block) && typeof block.text === "string") {
              textParts.push(block.text);
              log.info(`cli stream: accumulated content block (${block.text.length} chars)`);
            }
          }
        }
      } else if (eventType === "result") {
        // Claude CLI final result event - usage already extracted above
        const result = isRecord(parsed.result) ? parsed.result : parsed;
        if (typeof result.text === "string") {
          textParts.push(result.text);
          log.info(`cli stream: accumulated result text (${result.text.length} chars)`);
        }
      }

      // Handle Codex CLI event types
      if (eventType.startsWith("item.")) {
        const item = isRecord(parsed.item) ? parsed.item : null;
        if (item && typeof item.text === "string") {
          const itemType = typeof item.type === "string" ? item.type.toLowerCase() : "";
          if (!itemType || itemType.includes("message")) {
            textParts.push(item.text);
            log.info(`cli stream: accumulated item text (${item.text.length} chars)`);
          }
        }
      } else if (eventType === "turn.completed" || eventType === "thread.completed") {
        if (isRecord(parsed.usage)) {
          usage = toUsage(parsed.usage, backend) ?? usage;
        }
        // Extract thread_id as session ID for Codex
        if (!sessionId && typeof parsed.thread_id === "string") {
          sessionId = parsed.thread_id.trim();
          log.info(`cli stream: extracted thread_id as sessionId=${sessionId}`);
        }
      }

      // Emit the event if it passes the filter
      if (shouldEmit) {
        log.info(`cli stream: emitting event type="${eventType}" to onEvent callback`);
        try {
          onEvent(event);
          log.info(`cli stream: onEvent callback completed for type="${eventType}"`);
        } catch (err) {
          log.info(
            `cli stream: onEvent error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else {
        log.info(`cli stream: skipping emit for type="${eventType}" (filtered out)`);
      }
    });

    child.stderr?.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
    });

    child.on("error", (err) => {
      fail(err);
    });

    child.on("close", (code, signal) => {
      if (code !== 0 && code !== null) {
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        const errMsg = stderrBuffer.trim() || `CLI exited with ${reason}`;
        fail(new Error(errMsg));
        return;
      }
      succeed();
    });

    // Write stdin if provided
    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    } else if (child.stdin) {
      child.stdin.end();
    }
  });
}

/**
 * Map a Claude CLI stream event to Clawdbot agent event data.
 * Returns null for events that should not be emitted.
 */
export function mapClaudeStreamEvent(
  event: CliStreamEvent,
): { stream: string; data: Record<string, unknown> } | null {
  switch (event.type) {
    case "tool_use": {
      const toolName = typeof event.name === "string" ? event.name : "unknown";
      const toolId = typeof event.id === "string" ? event.id : undefined;
      return {
        stream: "tool",
        data: {
          phase: "start",
          name: toolName,
          id: toolId,
          input: event.input,
        },
      };
    }
    case "tool_result": {
      const toolId = typeof event.tool_use_id === "string" ? event.tool_use_id : undefined;
      return {
        stream: "tool",
        data: {
          phase: "end",
          id: toolId,
          output: event.content,
          isError: event.is_error === true,
        },
      };
    }
    case "text":
    case "content_block_delta": {
      const text = typeof event.text === "string" ? event.text : "";
      if (!text) return null;
      return {
        stream: "assistant",
        data: { text, delta: true },
      };
    }
    case "assistant":
    case "message": {
      // Full assistant message - typically we prefer deltas, but include for completeness
      return null; // Text is accumulated separately
    }
    case "result": {
      // Final result - don't emit as event, handled for sessionId/usage extraction
      return null;
    }
    default:
      return null;
  }
}

/**
 * Map a Codex CLI stream event to Clawdbot agent event data.
 * Returns null for events that should not be emitted.
 */
export function mapCodexStreamEvent(
  event: CliStreamEvent,
): { stream: string; data: Record<string, unknown> } | null {
  const eventType = event.type;

  if (eventType === "item.created" || eventType === "item.started") {
    const item = isRecord(event.item) ? event.item : null;
    if (item && typeof item.type === "string" && item.type === "function_call") {
      return {
        stream: "tool",
        data: {
          phase: "start",
          name: item.name,
          id: item.id,
          input: item.arguments,
        },
      };
    }
  }

  if (eventType === "item.completed") {
    const item = isRecord(event.item) ? event.item : null;
    if (item) {
      if (typeof item.type === "string" && item.type === "function_call_output") {
        return {
          stream: "tool",
          data: {
            phase: "end",
            id: item.call_id,
            output: item.output,
          },
        };
      }
      if (
        typeof item.type === "string" &&
        item.type === "message" &&
        typeof item.text === "string"
      ) {
        return {
          stream: "assistant",
          data: { text: item.text },
        };
      }
    }
  }

  if (eventType === "turn.completed" || eventType === "thread.completed") {
    // Lifecycle event, don't emit as assistant event
    return null;
  }

  return null;
}

/**
 * Map a generic CLI stream event to Clawdbot agent event data.
 * Dispatches to the appropriate mapper based on detected CLI format.
 */
export function mapCliStreamEvent(
  event: CliStreamEvent,
  backendId: string,
): { stream: string; data: Record<string, unknown> } | null {
  log.info(`cli stream: mapCliStreamEvent called for type="${event.type}" backend="${backendId}"`);

  // Detect format from event types
  let result: { stream: string; data: Record<string, unknown> } | null;
  if (
    backendId.includes("codex") ||
    event.type.startsWith("item.") ||
    event.type.startsWith("turn.") ||
    event.type.startsWith("thread.")
  ) {
    log.info(`cli stream: using Codex mapper`);
    result = mapCodexStreamEvent(event);
  } else {
    log.info(`cli stream: using Claude mapper`);
    result = mapClaudeStreamEvent(event);
  }

  if (result) {
    log.info(
      `cli stream: mapped to stream="${result.stream}" data=${JSON.stringify(result.data).slice(0, 200)}`,
    );
  } else {
    log.info(`cli stream: mapper returned null for type="${event.type}"`);
  }

  return result;
}
