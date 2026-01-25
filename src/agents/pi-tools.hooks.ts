import type { AgentTool } from "@mariozechner/pi-agent-core";

import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { logWarn } from "../logger.js";

type AnyTool = AgentTool<any, any>;

export function wrapToolWithPluginHooks(
  tool: AnyTool,
  opts?: { agentId?: string; sessionKey?: string },
): AnyTool {
  if (!tool?.execute) return tool;

  const anyTool = tool as AnyTool & { __clawdbotHookWrapped?: boolean };
  if (anyTool.__clawdbotHookWrapped) return tool;
  anyTool.__clawdbotHookWrapped = true;

  const execute = tool.execute.bind(tool);

  tool.execute = async (params: any, ctx: any) => {
    const hookRunner = getGlobalHookRunner();
    if (!hookRunner) return execute(params, ctx);

    const toolCallId =
      (ctx?.toolCallId as string | undefined) ??
      (ctx?.callId as string | undefined) ??
      (ctx?.id as string | undefined);

    const hookCtx = {
      agentId: opts?.agentId ?? ctx?.agentId,
      sessionKey: opts?.sessionKey ?? ctx?.sessionKey,
      toolName: ctx?.toolName ?? tool.name,
      toolCallId,
    };

    try {
      await hookRunner.run("before_tool_call", { params }, hookCtx);
    } catch (e) {
      logWarn(`[hooks] before_tool_call failed: ${String(e)}`);
    }

    const result = await execute(params, ctx);

    try {
      await hookRunner.run("after_tool_call", { params, result }, hookCtx);
    } catch (e) {
      logWarn(`[hooks] after_tool_call failed: ${String(e)}`);
    }

    return result;
  };

  return tool;
}
