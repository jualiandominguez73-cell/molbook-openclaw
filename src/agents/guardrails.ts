import type { AgentMessage, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";

import type { OpenClawConfig } from "../config/config.js";
import type { GrayswanGuardrailConfig, GrayswanStageConfig } from "../config/types.guardrails.js";
import { resolveFetch } from "../infra/fetch.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

export type GuardrailStage =
  | "before_request"
  | "after_response"
  | "before_tool_call"
  | "after_tool_call";

export type GuardrailContext = {
  agentId?: string;
  sessionId: string;
  sessionKey?: string;
  runId: string;
  provider: string;
  modelId: string;
  modelApi?: string | null;
  workspaceDir: string;
  messageProvider?: string;
  messageChannel?: string;
  config?: OpenClawConfig;
};

export type GuardrailPromptInput = {
  prompt: string;
  messages: AgentMessage[];
  systemPrompt?: string;
};

export type GuardrailOutputInput = {
  assistantTexts: string[];
  messages: AgentMessage[];
  lastAssistant?: AssistantMessage;
};

export type GuardrailToolCallInput = {
  toolName: string;
  toolCallId: string;
  params: unknown;
  messages: AgentMessage[];
  systemPrompt?: string;
};

export type GuardrailToolResultInput = {
  toolName: string;
  toolCallId: string;
  params: unknown;
  result: AgentToolResult<unknown>;
  messages: AgentMessage[];
  systemPrompt?: string;
};

export type GuardrailDecisionBase = {
  action: "allow" | "modify" | "block";
  reason?: string;
  response?: string;
};

export type GuardrailPromptDecision = GuardrailDecisionBase & {
  prompt?: string;
  messages?: AgentMessage[];
};

export type GuardrailOutputDecision = GuardrailDecisionBase & {
  assistantTexts?: string[];
};

export type GuardrailToolCallDecision = GuardrailDecisionBase & {
  params?: unknown;
  toolResult?: AgentToolResult<unknown>;
};

export type GuardrailToolResultDecision = GuardrailDecisionBase & {
  toolResult?: AgentToolResult<unknown>;
};

export type Guardrail = {
  id: string;
  priority?: number;
  beforeRequest?: (
    input: GuardrailPromptInput,
    context: GuardrailContext,
  ) => Promise<GuardrailPromptDecision | void> | GuardrailPromptDecision | void;
  afterResponse?: (
    input: GuardrailOutputInput,
    context: GuardrailContext,
  ) => Promise<GuardrailOutputDecision | void> | GuardrailOutputDecision | void;
  beforeToolCall?: (
    input: GuardrailToolCallInput,
    context: GuardrailContext,
  ) => Promise<GuardrailToolCallDecision | void> | GuardrailToolCallDecision | void;
  afterToolCall?: (
    input: GuardrailToolResultInput,
    context: GuardrailContext,
  ) => Promise<GuardrailToolResultDecision | void> | GuardrailToolResultDecision | void;
};

export type GuardrailBlock = {
  stage: GuardrailStage;
  guardrailId: string;
  reason?: string;
  response?: string;
};

export type GuardrailPromptOutcome =
  | { blocked: false; prompt: string; messages: AgentMessage[] }
  | ({ blocked: true } & GuardrailBlock);

export type GuardrailOutputOutcome =
  | { blocked: false; assistantTexts: string[] }
  | ({ blocked: true } & GuardrailBlock);

export type GuardrailToolCallOutcome =
  | { blocked: false; params: unknown }
  | ({ blocked: true } & GuardrailBlock & { toolResult?: AgentToolResult<unknown> });

export type GuardrailToolResultOutcome =
  | { blocked: false; result: AgentToolResult<unknown> }
  | ({ blocked: true } & GuardrailBlock & { toolResult?: AgentToolResult<unknown> });

const REGISTRY: Guardrail[] = [];

export function registerGuardrail(guardrail: Guardrail): void {
  const id = guardrail.id?.trim();
  if (!id) {
    return;
  }
  const next: Guardrail = { ...guardrail, id };
  const existingIndex = REGISTRY.findIndex((entry) => entry.id === id);
  if (existingIndex >= 0) {
    REGISTRY[existingIndex] = next;
    return;
  }
  REGISTRY.push(next);
}

export function listGuardrails(): Guardrail[] {
  return REGISTRY.slice().sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function resetGuardrails(): void {
  REGISTRY.length = 0;
}

export async function applyPromptGuardrails(params: {
  input: GuardrailPromptInput;
  context: GuardrailContext;
}): Promise<GuardrailPromptOutcome> {
  const guardrails = listGuardrails();
  if (guardrails.length === 0) {
    return {
      blocked: false,
      prompt: params.input.prompt,
      messages: params.input.messages,
    };
  }
  let prompt = params.input.prompt;
  let messages = params.input.messages;
  for (const guardrail of guardrails) {
    if (!guardrail.beforeRequest) {
      continue;
    }
    const result = await guardrail.beforeRequest(
      { ...params.input, prompt, messages },
      params.context,
    );
    if (!result) {
      continue;
    }
    if (result.action === "block") {
      return {
        blocked: true,
        stage: "before_request",
        guardrailId: guardrail.id,
        reason: result.reason,
        response: result.response,
      };
    }
    if (result.action === "modify") {
      if (typeof result.prompt === "string") {
        prompt = result.prompt;
      }
      if (Array.isArray(result.messages)) {
        messages = result.messages;
      }
    }
  }
  return { blocked: false, prompt, messages };
}

export async function applyOutputGuardrails(params: {
  input: GuardrailOutputInput;
  context: GuardrailContext;
}): Promise<GuardrailOutputOutcome> {
  const guardrails = listGuardrails();
  if (guardrails.length === 0) {
    return { blocked: false, assistantTexts: params.input.assistantTexts };
  }
  let assistantTexts = params.input.assistantTexts;
  for (const guardrail of guardrails) {
    if (!guardrail.afterResponse) {
      continue;
    }
    const result = await guardrail.afterResponse(
      { ...params.input, assistantTexts },
      params.context,
    );
    if (!result) {
      continue;
    }
    if (result.action === "block") {
      return {
        blocked: true,
        stage: "after_response",
        guardrailId: guardrail.id,
        reason: result.reason,
        response: result.response,
      };
    }
    if (result.action === "modify" && Array.isArray(result.assistantTexts)) {
      assistantTexts = result.assistantTexts;
    }
  }
  return { blocked: false, assistantTexts };
}

export async function applyToolCallGuardrails(params: {
  input: GuardrailToolCallInput;
  context: GuardrailContext;
}): Promise<GuardrailToolCallOutcome> {
  const guardrails = listGuardrails();
  if (guardrails.length === 0) {
    return { blocked: false, params: params.input.params };
  }
  let paramsValue = params.input.params;
  for (const guardrail of guardrails) {
    if (!guardrail.beforeToolCall) {
      continue;
    }
    const result = await guardrail.beforeToolCall(
      { ...params.input, params: paramsValue },
      params.context,
    );
    if (!result) {
      continue;
    }
    if (result.action === "block") {
      return {
        blocked: true,
        stage: "before_tool_call",
        guardrailId: guardrail.id,
        reason: result.reason,
        response: result.response,
        toolResult: result.toolResult,
      };
    }
    if (result.action === "modify" && result.params !== undefined) {
      paramsValue = result.params;
    }
  }
  return { blocked: false, params: paramsValue };
}

export async function applyToolResultGuardrails(params: {
  input: GuardrailToolResultInput;
  context: GuardrailContext;
}): Promise<GuardrailToolResultOutcome> {
  const guardrails = listGuardrails();
  if (guardrails.length === 0) {
    return { blocked: false, result: params.input.result };
  }
  let resultValue = params.input.result;
  for (const guardrail of guardrails) {
    if (!guardrail.afterToolCall) {
      continue;
    }
    const result = await guardrail.afterToolCall(
      { ...params.input, result: resultValue },
      params.context,
    );
    if (!result) {
      continue;
    }
    if (result.action === "block") {
      return {
        blocked: true,
        stage: "after_tool_call",
        guardrailId: guardrail.id,
        reason: result.reason,
        response: result.response,
        toolResult: result.toolResult,
      };
    }
    if (result.action === "modify" && result.toolResult) {
      resultValue = result.toolResult;
    }
  }
  return { blocked: false, result: resultValue };
}

type GrayswanMonitorMessage = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
};

type GrayswanMonitorResponse = {
  violation?: number;
  violated_rules?: unknown[];
  violated_rule_descriptions?: unknown[];
  mutation?: boolean;
  ipi?: boolean;
};

type GrayswanEvaluation = {
  violationScore: number;
  violatedRules: unknown[];
  mutation: boolean;
  ipi: boolean;
};

const GRAYSWAN_DEFAULT_BASE = "https://api.grayswan.ai";
const GRAYSWAN_MONITOR_PATH = "/cygnal/monitor";
const GRAYSWAN_DEFAULT_THRESHOLD = 0.5;
const GRAYSWAN_DEFAULT_TIMEOUT_MS = 30_000;

const grayswanLogger = createSubsystemLogger("guardrails/grayswan");

function resolveGrayswanConfig(context: GuardrailContext): GrayswanGuardrailConfig | undefined {
  const cfg = context.config?.guardrails?.grayswan;
  if (!cfg) {
    return undefined;
  }
  if (cfg.enabled === false) {
    return undefined;
  }
  return cfg;
}

function resolveGrayswanStageConfig(
  cfg: GrayswanGuardrailConfig,
  stage: GuardrailStage,
): GrayswanStageConfig | undefined {
  const stages = cfg.stages;
  if (!stages) {
    return undefined;
  }
  switch (stage) {
    case "before_request":
      return stages.beforeRequest;
    case "before_tool_call":
      return stages.beforeToolCall;
    case "after_tool_call":
      return stages.afterToolCall;
    case "after_response":
      return stages.afterResponse;
    default:
      return undefined;
  }
}

function isStageEnabled(stage: GrayswanStageConfig | undefined): boolean {
  if (!stage) {
    return false;
  }
  return stage.enabled !== false;
}

function resolveGrayswanThreshold(
  cfg: GrayswanGuardrailConfig,
  stage: GrayswanStageConfig | undefined,
): number {
  const value = stage?.violationThreshold ?? cfg.violationThreshold;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  return GRAYSWAN_DEFAULT_THRESHOLD;
}

function resolveGrayswanBlockMode(
  stage: GuardrailStage,
  stageCfg: GrayswanStageConfig | undefined,
): "replace" | "append" {
  if (stageCfg?.blockMode) {
    return stageCfg.blockMode;
  }
  if (stage === "after_tool_call") {
    return "append";
  }
  return "replace";
}

function resolveBlockOnMutation(stage: GuardrailStage, stageCfg: GrayswanStageConfig | undefined) {
  if (typeof stageCfg?.blockOnMutation === "boolean") {
    return stageCfg.blockOnMutation;
  }
  return stage === "after_tool_call";
}

function resolveBlockOnIpi(stage: GuardrailStage, stageCfg: GrayswanStageConfig | undefined) {
  if (typeof stageCfg?.blockOnIpi === "boolean") {
    return stageCfg.blockOnIpi;
  }
  return stage === "after_tool_call";
}

function resolveGrayswanApiKey(cfg: GrayswanGuardrailConfig): string | undefined {
  const key = cfg.apiKey?.trim();
  if (key) {
    return key;
  }
  const env = process.env.GRAYSWAN_API_KEY?.trim();
  return env || undefined;
}

function resolveGrayswanApiBase(cfg: GrayswanGuardrailConfig): string {
  const base =
    cfg.apiBase?.trim() || process.env.GRAYSWAN_API_BASE?.trim() || GRAYSWAN_DEFAULT_BASE;
  return base.replace(/\/+$/, "");
}

function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  const texts = content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const record = item as Record<string, unknown>;
      if (record.type && record.type !== "text") {
        return "";
      }
      return typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean);
  return texts.join("\n");
}

function toGrayswanRole(role: unknown): GrayswanMonitorMessage["role"] | null {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }
  if (role === "toolResult" || role === "tool") {
    return "tool";
  }
  return null;
}

function toGrayswanMessages(messages: AgentMessage[]): GrayswanMonitorMessage[] {
  const converted: GrayswanMonitorMessage[] = [];
  for (const message of messages) {
    const role = toGrayswanRole((message as { role?: unknown }).role);
    if (!role) {
      continue;
    }
    const content = extractTextFromContent((message as { content?: unknown }).content).trim();
    if (!content) {
      continue;
    }
    converted.push({ role, content });
  }
  return converted;
}

function extractToolResultText(result: AgentToolResult<unknown>): string {
  const contentText = extractTextFromContent(result?.content).trim();
  if (contentText) {
    return contentText;
  }
  if (result?.details !== undefined) {
    return safeJsonStringify(result.details) ?? "";
  }
  return safeJsonStringify(result) ?? "";
}

function formatViolatedRules(violatedRules: unknown[]): string {
  const formatted: string[] = [];
  for (const rule of violatedRules) {
    if (rule && typeof rule === "object") {
      const record = rule as Record<string, unknown>;
      const ruleNum = record.rule ?? record.index ?? record.id;
      const ruleName = typeof record.name === "string" ? record.name : "";
      const ruleDesc = typeof record.description === "string" ? record.description : "";
      if (ruleNum && ruleName) {
        if (ruleDesc) {
          formatted.push(`#${ruleNum} ${ruleName}: ${ruleDesc}`);
        } else {
          formatted.push(`#${ruleNum} ${ruleName}`);
        }
      } else if (ruleName) {
        formatted.push(ruleName);
      } else {
        formatted.push(String(rule));
      }
      continue;
    }
    formatted.push(String(rule));
  }
  return formatted.join(", ");
}

function formatGrayswanViolationMessage(params: {
  evaluation: GrayswanEvaluation;
  location: string;
}): string {
  const violationScore = params.evaluation.violationScore;
  const violatedRules = params.evaluation.violatedRules;
  const messageParts = [
    `Sorry I can't help with that. According to the Gray Swan Cygnal Guardrail, ` +
      `the ${params.location} has a violation score of ${violationScore.toFixed(2)}.`,
  ];

  if (violatedRules.length > 0) {
    const formattedRules = formatViolatedRules(violatedRules);
    if (formattedRules) {
      messageParts.push(`It was violating the rule(s): ${formattedRules}.`);
    }
  }

  if (params.evaluation.mutation) {
    messageParts.push("Mutation effort to make the harmful intention disguised was DETECTED.");
  }

  if (params.evaluation.ipi) {
    messageParts.push("Indirect Prompt Injection was DETECTED.");
  }

  return messageParts.join("\n");
}

function summarizeGrayswanReason(evaluation: GrayswanEvaluation): string {
  const parts: string[] = [`violation=${evaluation.violationScore.toFixed(2)}`];
  if (evaluation.mutation) {
    parts.push("mutation=true");
  }
  if (evaluation.ipi) {
    parts.push("ipi=true");
  }
  if (evaluation.violatedRules.length > 0) {
    parts.push(`rules=${formatViolatedRules(evaluation.violatedRules)}`);
  }
  return parts.join("; ");
}

function buildToolCallSummary(input: GuardrailToolCallInput): string {
  const payload = {
    tool: input.toolName,
    toolCallId: input.toolCallId,
    params: input.params,
  };
  return safeJsonStringify(payload) ?? `${input.toolName}`;
}

function buildMonitorPayload(
  messages: GrayswanMonitorMessage[],
  cfg: GrayswanGuardrailConfig,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { messages };
  if (cfg.categories && Object.keys(cfg.categories).length > 0) {
    payload.categories = cfg.categories;
  }
  if (cfg.policyId) {
    payload.policy_id = cfg.policyId;
  }
  if (cfg.reasoningMode) {
    payload.reasoning_mode = cfg.reasoningMode;
  }
  return payload;
}

async function callGrayswanMonitor(params: {
  cfg: GrayswanGuardrailConfig;
  messages: GrayswanMonitorMessage[];
}): Promise<GrayswanMonitorResponse | null> {
  const apiKey = resolveGrayswanApiKey(params.cfg);
  if (!apiKey) {
    grayswanLogger.warn("Gray Swan guardrail enabled but no API key configured.");
    return null;
  }
  const fetchImpl = resolveFetch();
  if (!fetchImpl) {
    grayswanLogger.warn("Gray Swan guardrail cannot run without fetch support.");
    return null;
  }
  const apiBase = resolveGrayswanApiBase(params.cfg);
  const payload = buildMonitorPayload(params.messages, params.cfg);
  const timeoutMs =
    typeof params.cfg.timeoutMs === "number" && params.cfg.timeoutMs > 0
      ? params.cfg.timeoutMs
      : GRAYSWAN_DEFAULT_TIMEOUT_MS;
  const url = `${apiBase}${GRAYSWAN_MONITOR_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "grayswan-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Gray Swan monitor returned ${response.status}`);
    }
    const result = (await response.json()) as GrayswanMonitorResponse;
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    grayswanLogger.warn(`Gray Swan monitor failed: ${message}`);
    if (params.cfg.failOpen === false) {
      throw err;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function evaluateGrayswanResponse(response: GrayswanMonitorResponse): GrayswanEvaluation {
  const violationScore = Number(response.violation ?? 0);
  const violatedRules = Array.isArray(response.violated_rule_descriptions)
    ? response.violated_rule_descriptions
    : Array.isArray(response.violated_rules)
      ? response.violated_rules
      : [];
  return {
    violationScore: Number.isFinite(violationScore) ? violationScore : 0,
    violatedRules,
    mutation: Boolean(response.mutation),
    ipi: Boolean(response.ipi),
  };
}

function shouldBlockByEvaluation(params: {
  evaluation: GrayswanEvaluation;
  threshold: number;
  blockOnMutation: boolean;
  blockOnIpi: boolean;
}): boolean {
  const scoreFlag = params.evaluation.violationScore >= params.threshold;
  const mutationFlag = params.blockOnMutation && params.evaluation.mutation;
  const ipiFlag = params.blockOnIpi && params.evaluation.ipi;
  return scoreFlag || mutationFlag || ipiFlag;
}

function appendWarningToToolResult(
  result: AgentToolResult<unknown>,
  warning: string,
): AgentToolResult<unknown> {
  const content = Array.isArray(result.content) ? [...result.content] : [];
  content.push({ type: "text", text: warning });
  return { ...result, content };
}

function replaceToolResultWithWarning(
  result: AgentToolResult<unknown>,
  warning: string,
): AgentToolResult<unknown> {
  const baseDetails =
    result &&
    typeof result === "object" &&
    "details" in result &&
    (result as { details?: unknown }).details &&
    typeof (result as { details?: unknown }).details === "object"
      ? ((result as { details?: Record<string, unknown> }).details ?? {})
      : undefined;
  const details = baseDetails
    ? { ...baseDetails, guardrailWarning: warning }
    : { guardrailWarning: warning };
  return {
    content: [{ type: "text", text: warning }],
    details,
  };
}

function createGrayswanGuardrail(): Guardrail {
  return {
    id: "grayswan",
    priority: 50,
    beforeRequest: async (input, context) => {
      const cfg = resolveGrayswanConfig(context);
      if (!cfg) {
        return;
      }
      const stageCfg = resolveGrayswanStageConfig(cfg, "before_request");
      if (!isStageEnabled(stageCfg)) {
        return;
      }
      const prompt = input.prompt.trim();
      if (!prompt) {
        return;
      }
      const includeHistory = stageCfg?.includeHistory !== false;
      const messages = includeHistory
        ? [...toGrayswanMessages(input.messages), { role: "user", content: prompt }]
        : [{ role: "user", content: prompt }];
      if (messages.length === 0) {
        return;
      }
      let response: GrayswanMonitorResponse | null = null;
      try {
        response = await callGrayswanMonitor({ cfg, messages });
      } catch (err) {
        return {
          action: "block",
          reason: "grayswan_error",
          response: "Request blocked because Gray Swan guardrail failed.",
        };
      }
      if (!response) {
        return;
      }
      const evaluation = evaluateGrayswanResponse(response);
      const threshold = resolveGrayswanThreshold(cfg, stageCfg);
      const flagged = shouldBlockByEvaluation({
        evaluation,
        threshold,
        blockOnMutation: resolveBlockOnMutation("before_request", stageCfg),
        blockOnIpi: resolveBlockOnIpi("before_request", stageCfg),
      });
      if (!flagged) {
        return;
      }
      if (stageCfg?.mode === "monitor") {
        return;
      }
      const message = formatGrayswanViolationMessage({
        evaluation,
        location: "input query",
      });
      return {
        action: "block",
        reason: summarizeGrayswanReason(evaluation),
        response: message,
      };
    },
    beforeToolCall: async (input, context) => {
      const cfg = resolveGrayswanConfig(context);
      if (!cfg) {
        return;
      }
      const stageCfg = resolveGrayswanStageConfig(cfg, "before_tool_call");
      if (!isStageEnabled(stageCfg)) {
        return;
      }
      const toolSummary = buildToolCallSummary(input);
      const includeHistory = stageCfg?.includeHistory !== false;
      const messages = includeHistory
        ? [...toGrayswanMessages(input.messages), { role: "assistant", content: toolSummary }]
        : [{ role: "assistant", content: toolSummary }];
      if (messages.length === 0) {
        return;
      }
      let response: GrayswanMonitorResponse | null = null;
      try {
        response = await callGrayswanMonitor({ cfg, messages });
      } catch (err) {
        return {
          action: "block",
          reason: "grayswan_error",
          response: "Tool call blocked because Gray Swan guardrail failed.",
        };
      }
      if (!response) {
        return;
      }
      const evaluation = evaluateGrayswanResponse(response);
      const threshold = resolveGrayswanThreshold(cfg, stageCfg);
      const flagged = shouldBlockByEvaluation({
        evaluation,
        threshold,
        blockOnMutation: resolveBlockOnMutation("before_tool_call", stageCfg),
        blockOnIpi: resolveBlockOnIpi("before_tool_call", stageCfg),
      });
      if (!flagged) {
        return;
      }
      if (stageCfg?.mode === "monitor") {
        return;
      }
      const message = formatGrayswanViolationMessage({
        evaluation,
        location: "tool call request",
      });
      return {
        action: "block",
        reason: summarizeGrayswanReason(evaluation),
        response: message,
      };
    },
    afterToolCall: async (input, context) => {
      const cfg = resolveGrayswanConfig(context);
      if (!cfg) {
        return;
      }
      const stageCfg = resolveGrayswanStageConfig(cfg, "after_tool_call");
      if (!isStageEnabled(stageCfg)) {
        return;
      }
      const toolText = extractToolResultText(input.result).trim();
      const includeHistory = stageCfg?.includeHistory !== false;
      const messages = includeHistory
        ? [...toGrayswanMessages(input.messages), { role: "tool", content: toolText }]
        : [{ role: "tool", content: toolText }];
      if (!toolText || messages.length === 0) {
        return;
      }
      let response: GrayswanMonitorResponse | null = null;
      try {
        response = await callGrayswanMonitor({ cfg, messages });
      } catch (err) {
        return {
          action: "block",
          reason: "grayswan_error",
          toolResult: replaceToolResultWithWarning(
            input.result,
            "Tool result blocked because Gray Swan guardrail failed.",
          ),
        };
      }
      if (!response) {
        return;
      }
      const evaluation = evaluateGrayswanResponse(response);
      const threshold = resolveGrayswanThreshold(cfg, stageCfg);
      const flagged = shouldBlockByEvaluation({
        evaluation,
        threshold,
        blockOnMutation: resolveBlockOnMutation("after_tool_call", stageCfg),
        blockOnIpi: resolveBlockOnIpi("after_tool_call", stageCfg),
      });
      if (!flagged) {
        return;
      }
      if (stageCfg?.mode === "monitor") {
        return;
      }
      const message = formatGrayswanViolationMessage({
        evaluation,
        location: "tool response",
      });
      const blockMode = resolveGrayswanBlockMode("after_tool_call", stageCfg);
      return {
        action: "block",
        reason: summarizeGrayswanReason(evaluation),
        toolResult:
          blockMode === "append"
            ? appendWarningToToolResult(input.result, message)
            : replaceToolResultWithWarning(input.result, message),
      };
    },
    afterResponse: async (input, context) => {
      const cfg = resolveGrayswanConfig(context);
      if (!cfg) {
        return;
      }
      const stageCfg = resolveGrayswanStageConfig(cfg, "after_response");
      if (!isStageEnabled(stageCfg)) {
        return;
      }
      const assistantText =
        input.assistantTexts.join("\n").trim() ||
        (input.lastAssistant ? extractTextFromContent(input.lastAssistant.content).trim() : "");
      if (!assistantText) {
        return;
      }
      const includeHistory = stageCfg?.includeHistory !== false;
      const historyMessages = includeHistory ? toGrayswanMessages(input.messages) : [];
      const messages = [...historyMessages, { role: "assistant", content: assistantText }];
      let response: GrayswanMonitorResponse | null = null;
      try {
        response = await callGrayswanMonitor({ cfg, messages });
      } catch (err) {
        return {
          action: "block",
          reason: "grayswan_error",
          response: "Response blocked because Gray Swan guardrail failed.",
        };
      }
      if (!response) {
        return;
      }
      const evaluation = evaluateGrayswanResponse(response);
      const threshold = resolveGrayswanThreshold(cfg, stageCfg);
      const flagged = shouldBlockByEvaluation({
        evaluation,
        threshold,
        blockOnMutation: resolveBlockOnMutation("after_response", stageCfg),
        blockOnIpi: resolveBlockOnIpi("after_response", stageCfg),
      });
      if (!flagged) {
        return;
      }
      if (stageCfg?.mode === "monitor") {
        return;
      }
      const message = formatGrayswanViolationMessage({
        evaluation,
        location: "model response",
      });
      const blockMode = resolveGrayswanBlockMode("after_response", stageCfg);
      if (blockMode === "append") {
        return {
          action: "modify",
          reason: summarizeGrayswanReason(evaluation),
          assistantTexts: [...input.assistantTexts, message],
        };
      }
      return {
        action: "block",
        reason: summarizeGrayswanReason(evaluation),
        response: message,
      };
    },
  };
}

registerGuardrail(createGrayswanGuardrail());
