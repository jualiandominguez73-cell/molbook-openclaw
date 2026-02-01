import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";

import type { GuardrailContext } from "../guardrails.js";
import { toToolDefinitions } from "../pi-tool-definition-adapter.js";

// We always pass tools via `customTools` so our policy filtering, sandbox integration,
// and extended toolset remain consistent across providers.
type AnyAgentTool = AgentTool;

type ToolGuardrailOptions = {
  context: GuardrailContext;
  getMessages: () => AgentMessage[];
  systemPrompt?: string;
};

export function splitSdkTools(options: {
  tools: AnyAgentTool[];
  sandboxEnabled: boolean;
  guardrails?: ToolGuardrailOptions;
}): {
  builtInTools: AnyAgentTool[];
  customTools: ReturnType<typeof toToolDefinitions>;
} {
  const { tools } = options;
  return {
    builtInTools: [],
    customTools: toToolDefinitions(tools, { guardrails: options.guardrails }),
  };
}
