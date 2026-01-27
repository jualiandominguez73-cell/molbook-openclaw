import type { StreamFn } from "@mariozechner/pi-agent-core";
import type {
  Api,
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Model,
  TextContent,
  ToolCall,
} from "@mariozechner/pi-ai";
import crypto from "node:crypto";

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agent/ollama-tool-call-fixer");

const TOOL_CALL_TAG_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
const JSON_FENCED_RE = /```json\s*([\s\S]*?)\s*```/g;

function extractToolCallsFromText(
  text: string,
  toolNames: Set<string>,
): Array<{ name: string; arguments: Record<string, unknown> }> | null {
  const candidates: string[] = [];

  for (const m of text.matchAll(TOOL_CALL_TAG_RE)) {
    candidates.push(m[1]);
  }

  if (candidates.length === 0) {
    for (const m of text.matchAll(JSON_FENCED_RE)) {
      candidates.push(m[1]);
    }
  }

  if (candidates.length === 0) {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      candidates.push(trimmed);
    }
  }

  if (candidates.length === 0) return null;

  const results: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  for (const raw of candidates) {
    try {
      const parsed: unknown = JSON.parse(raw.trim());
      const items = Array.isArray(parsed) ? (parsed as unknown[]) : [parsed];
      for (const item of items) {
        if (
          item &&
          typeof item === "object" &&
          "name" in item &&
          typeof (item as { name: unknown }).name === "string" &&
          toolNames.has((item as { name: string }).name)
        ) {
          const obj = item as { name: string; arguments?: unknown };
          results.push({
            name: obj.name,
            arguments:
              obj.arguments && typeof obj.arguments === "object"
                ? (obj.arguments as Record<string, unknown>)
                : {},
          });
        }
      }
    } catch {
      // Not valid JSON — skip
    }
  }

  return results.length > 0 ? results : null;
}

function makeToolCallId(): string {
  return `ollama_tc_${crypto.randomBytes(8).toString("hex")}`;
}

function isOllamaProvider(model: Model<Api> | undefined | null): boolean {
  const m = model as { provider?: string } | undefined | null;
  return m?.provider === "ollama";
}

/** Max consecutive turns where the same tool set is called before we stop converting. */
const MAX_REPEAT_TURNS = 3;

export type OllamaToolCallFixer = {
  wrapStreamFn: (streamFn: StreamFn) => StreamFn;
};

/**
 * Creates a streamFn wrapper that detects tool-call JSON emitted as plain
 * text by Ollama models and re-emits them as proper toolcall_* events.
 *
 * Includes loop prevention: if the model calls the same tool(s) for
 * {@link MAX_REPEAT_TURNS} consecutive turns, conversion is skipped so
 * the raw text passes through instead of feeding an infinite tool loop.
 */
export function createOllamaToolCallFixer(): OllamaToolCallFixer {
  const wrapStreamFn = (inner: StreamFn): StreamFn => {
    // Cross-turn state for loop detection.
    let lastToolKey = "";
    let repeatCount = 0;

    const wrapped: StreamFn = (model, context, options) => {
      if (!isOllamaProvider(model as Model<Api>)) {
        return inner(model, context, options);
      }

      const toolNames = new Set((context.tools ?? []).map((t) => t.name));
      if (toolNames.size === 0) {
        return inner(model, context, options);
      }

      const rawStream = inner(model, context, options);

      // Dynamic import from the internal path where the class is a real value export.
      return (async () => {
        const { AssistantMessageEventStream: StreamClass } =
          await import("@mariozechner/pi-ai/dist/utils/event-stream.js");
        const innerStream: AssistantMessageEventStream =
          rawStream instanceof Promise ? await rawStream : rawStream;

        const buffered: AssistantMessageEvent[] = [];
        for await (const event of innerStream) {
          buffered.push(event);
        }

        const result = await innerStream.result();

        const textBlocks = result.content.filter((b): b is TextContent => b.type === "text");
        const fullText = textBlocks.map((b) => b.text).join("");
        const extracted = extractToolCallsFromText(fullText, toolNames);

        const outerStream = new StreamClass() as AssistantMessageEventStream;

        if (!extracted || extracted.length === 0) {
          // Model produced plain text — reset loop counter.
          lastToolKey = "";
          repeatCount = 0;
          for (const event of buffered) {
            outerStream.push(event);
          }
          return outerStream;
        }

        // Loop detection: build a stable key from sorted tool names.
        const toolKey = extracted
          .map((tc) => tc.name)
          .sort()
          .join(",");

        if (toolKey === lastToolKey) {
          repeatCount++;
        } else {
          lastToolKey = toolKey;
          repeatCount = 1;
        }

        if (repeatCount > MAX_REPEAT_TURNS) {
          log.warn("loop detected, skipping tool-call conversion", {
            toolKey,
            repeatCount,
            threshold: MAX_REPEAT_TURNS,
          });
          // Pass through original text so the user sees raw model output.
          for (const event of buffered) {
            outerStream.push(event);
          }
          return outerStream;
        }

        log.info("detected tool calls in text content, converting", {
          provider: (model as { provider?: string }).provider,
          model: (model as { id?: string }).id,
          toolCalls: extracted.map((tc) => tc.name),
          repeatCount,
        });

        const fixedToolCalls: ToolCall[] = extracted.map((tc) => ({
          type: "toolCall" as const,
          id: makeToolCallId(),
          name: tc.name,
          arguments: tc.arguments,
        }));

        const fixedResult: AssistantMessage = {
          ...result,
          content: fixedToolCalls,
          stopReason: "toolUse",
        };

        outerStream.push({ type: "start", partial: fixedResult });

        for (let i = 0; i < fixedToolCalls.length; i++) {
          const tc = fixedToolCalls[i];
          const partial: AssistantMessage = {
            ...fixedResult,
            content: fixedToolCalls.slice(0, i + 1),
          };
          outerStream.push({ type: "toolcall_start", contentIndex: i, partial });
          outerStream.push({
            type: "toolcall_delta",
            contentIndex: i,
            delta: JSON.stringify(tc.arguments),
            partial,
          });
          outerStream.push({
            type: "toolcall_end",
            contentIndex: i,
            toolCall: tc,
            partial,
          });
        }

        outerStream.push({
          type: "done",
          reason: "toolUse",
          message: fixedResult,
        });

        return outerStream;
      })();
    };
    return wrapped;
  };

  return { wrapStreamFn };
}
