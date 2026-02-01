import type {
  AgentMessage,
  AgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-agent-core";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ClientToolDefinition } from "./pi-embedded-runner/run/params.js";
import { logDebug, logError } from "../logger.js";
import { normalizeToolName } from "./tool-policy.js";
import { jsonResult } from "./tools/common.js";
import {
  applyToolCallGuardrails,
  applyToolResultGuardrails,
  type GuardrailContext,
} from "./guardrails.js";

// biome-ignore lint/suspicious/noExplicitAny: TypeBox schema type from pi-agent-core uses a different module instance.
type AnyAgentTool = AgentTool<any, unknown>;

type ToolGuardrailOptions = {
  context: GuardrailContext;
  getMessages: () => AgentMessage[];
  systemPrompt?: string;
};

function describeToolExecutionError(err: unknown): {
  message: string;
  stack?: string;
} {
  if (err instanceof Error) {
    const message = err.message?.trim() ? err.message : String(err);
    return { message, stack: err.stack };
  }
  return { message: String(err) };
}

export function toToolDefinitions(
  tools: AnyAgentTool[],
  options?: { guardrails?: ToolGuardrailOptions },
): ToolDefinition[] {
  return tools.map((tool) => {
    const name = tool.name || "tool";
    const normalizedName = normalizeToolName(name);
    const guardrails = options?.guardrails;
    return {
      name,
      label: tool.label ?? name,
      description: tool.description ?? "",
      // biome-ignore lint/suspicious/noExplicitAny: TypeBox schema from pi-agent-core uses a different module instance.
      parameters: tool.parameters,
      execute: async (
        toolCallId,
        params,
        onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx,
        signal,
      ): Promise<AgentToolResult<unknown>> => {
        // KNOWN: pi-coding-agent `ToolDefinition.execute` has a different signature/order
        // than pi-agent-core `AgentTool.execute`. This adapter keeps our existing tools intact.
        let effectiveParams = params;
        if (guardrails) {
          const toolOutcome = await applyToolCallGuardrails({
            input: {
              toolName: normalizedName,
              toolCallId: String(toolCallId ?? ""),
              params: effectiveParams,
              messages: guardrails.getMessages(),
              systemPrompt: guardrails.systemPrompt,
            },
            context: guardrails.context,
          });
          if (toolOutcome.blocked) {
            return (
              toolOutcome.toolResult ??
              jsonResult({
                status: "blocked",
                tool: normalizedName,
                message: toolOutcome.response ?? "Tool call blocked by guardrail policy.",
                guardrail: toolOutcome.guardrailId,
                reason: toolOutcome.reason,
              })
            );
          }
          effectiveParams = toolOutcome.params;
        }
        try {
          const result = await tool.execute(toolCallId, effectiveParams, signal, onUpdate);
          if (guardrails) {
            const outcome = await applyToolResultGuardrails({
              input: {
                toolName: normalizedName,
                toolCallId: String(toolCallId ?? ""),
                params: effectiveParams,
                result,
                messages: guardrails.getMessages(),
                systemPrompt: guardrails.systemPrompt,
              },
              context: guardrails.context,
            });
            if (outcome.blocked) {
              return (
                outcome.toolResult ??
                jsonResult({
                  status: "blocked",
                  tool: normalizedName,
                  message: outcome.response ?? "Tool result blocked by guardrail policy.",
                  guardrail: outcome.guardrailId,
                  reason: outcome.reason,
                })
              );
            }
            return outcome.result;
          }
          return result;
        } catch (err) {
          if (signal?.aborted) {
            throw err;
          }
          const name =
            err && typeof err === "object" && "name" in err
              ? String((err as { name?: unknown }).name)
              : "";
          if (name === "AbortError") {
            throw err;
          }
          const described = describeToolExecutionError(err);
          if (described.stack && described.stack !== described.message) {
            logDebug(`tools: ${normalizedName} failed stack:\n${described.stack}`);
          }
          logError(`[tools] ${normalizedName} failed: ${described.message}`);
          const errorResult = jsonResult({
            status: "error",
            tool: normalizedName,
            error: described.message,
          });
          if (!guardrails) {
            return errorResult;
          }
          const outcome = await applyToolResultGuardrails({
            input: {
              toolName: normalizedName,
              toolCallId: String(toolCallId ?? ""),
              params: effectiveParams,
              result: errorResult,
              messages: guardrails.getMessages(),
              systemPrompt: guardrails.systemPrompt,
            },
            context: guardrails.context,
          });
          if (outcome.blocked) {
            return (
              outcome.toolResult ??
              jsonResult({
                status: "blocked",
                tool: normalizedName,
                message: outcome.response ?? "Tool result blocked by guardrail policy.",
                guardrail: outcome.guardrailId,
                reason: outcome.reason,
              })
            );
          }
          return outcome.result;
        }
      },
    } satisfies ToolDefinition;
  });
}

// Convert client tools (OpenResponses hosted tools) to ToolDefinition format
// These tools are intercepted to return a "pending" result instead of executing
export function toClientToolDefinitions(
  tools: ClientToolDefinition[],
  onClientToolCall?: (toolName: string, params: Record<string, unknown>) => void,
  options?: { guardrails?: ToolGuardrailOptions },
): ToolDefinition[] {
  return tools.map((tool) => {
    const func = tool.function;
    const normalizedName = normalizeToolName(func.name);
    const guardrails = options?.guardrails;
    return {
      name: func.name,
      label: func.name,
      description: func.description ?? "",
      parameters: func.parameters as any,
      execute: async (
        toolCallId,
        params,
        _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
        _ctx,
        _signal,
      ): Promise<AgentToolResult<unknown>> => {
        let effectiveParams = params;
        if (guardrails) {
          const toolOutcome = await applyToolCallGuardrails({
            input: {
              toolName: normalizedName,
              toolCallId: String(toolCallId ?? ""),
              params: effectiveParams,
              messages: guardrails.getMessages(),
              systemPrompt: guardrails.systemPrompt,
            },
            context: guardrails.context,
          });
          if (toolOutcome.blocked) {
            return (
              toolOutcome.toolResult ??
              jsonResult({
                status: "blocked",
                tool: normalizedName,
                message: toolOutcome.response ?? "Tool call blocked by guardrail policy.",
                guardrail: toolOutcome.guardrailId,
                reason: toolOutcome.reason,
              })
            );
          }
          effectiveParams = toolOutcome.params;
        }
        // Notify handler that a client tool was called
        if (onClientToolCall) {
          onClientToolCall(func.name, effectiveParams as Record<string, unknown>);
        }
        // Return a pending result - the client will execute this tool
        const result = jsonResult({
          status: "pending",
          tool: func.name,
          message: "Tool execution delegated to client",
        });
        if (!guardrails) {
          return result;
        }
        const outcome = await applyToolResultGuardrails({
          input: {
            toolName: normalizedName,
            toolCallId: String(toolCallId ?? ""),
            params: effectiveParams,
            result,
            messages: guardrails.getMessages(),
            systemPrompt: guardrails.systemPrompt,
          },
          context: guardrails.context,
        });
        if (outcome.blocked) {
          return (
            outcome.toolResult ??
            jsonResult({
              status: "blocked",
              tool: normalizedName,
              message: outcome.response ?? "Tool result blocked by guardrail policy.",
              guardrail: outcome.guardrailId,
              reason: outcome.reason,
            })
          );
        }
        return outcome.result;
      },
    } satisfies ToolDefinition;
  });
}
