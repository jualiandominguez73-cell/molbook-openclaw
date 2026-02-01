import type { AgentToolResult } from "@mariozechner/pi-agent-core";

export type InterceptorName = "tool.before" | "tool.after";

export type ToolBeforeInput = {
  toolName: string;
  toolCallId: string;
};

export type ToolBeforeOutput = {
  args: Record<string, unknown>;
  block?: boolean;
  blockReason?: string;
};

export type ToolAfterInput = {
  toolName: string;
  toolCallId: string;
  isError: boolean;
};

export type ToolAfterOutput = {
  result: AgentToolResult<unknown>;
};

export type InterceptorInputMap = {
  "tool.before": ToolBeforeInput;
  "tool.after": ToolAfterInput;
};

export type InterceptorOutputMap = {
  "tool.before": ToolBeforeOutput;
  "tool.after": ToolAfterOutput;
};

export type InterceptorHandler<I, O> = (input: Readonly<I>, output: O) => Promise<void> | void;

export type InterceptorRegistration<N extends InterceptorName = InterceptorName> = {
  id: string;
  name: N;
  handler: InterceptorHandler<InterceptorInputMap[N], InterceptorOutputMap[N]>;
  priority?: number;
  toolMatcher?: RegExp;
};
