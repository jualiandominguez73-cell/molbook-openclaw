import { describe, expect, it } from "vitest";
import type { ToolAfterOutput, ToolBeforeOutput } from "./types.js";
import { createInterceptorRegistry } from "./registry.js";
import { trigger } from "./trigger.js";

describe("trigger", () => {
  it("returns output unchanged for empty registry", async () => {
    const registry = createInterceptorRegistry();
    const output: ToolBeforeOutput = { args: { cmd: "ls" } };
    const result = await trigger(
      registry,
      "tool.before",
      { toolName: "exec", toolCallId: "c1" },
      output,
    );
    expect(result).toBe(output);
    expect(result.args).toEqual({ cmd: "ls" });
  });

  it("tool.before handler can mutate args", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "prefix",
      name: "tool.before",
      handler: (_input, output) => {
        output.args = { ...output.args, injected: true };
      },
    });
    const result = await trigger(
      registry,
      "tool.before",
      { toolName: "exec", toolCallId: "c1" },
      { args: { cmd: "ls" } },
    );
    expect(result.args).toEqual({ cmd: "ls", injected: true });
  });

  it("tool.before handler can set block", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "blocker",
      name: "tool.before",
      handler: (_input, output) => {
        output.block = true;
        output.blockReason = "denied";
      },
    });
    const result = await trigger(
      registry,
      "tool.before",
      { toolName: "exec", toolCallId: "c1" },
      { args: {} },
    );
    expect(result.block).toBe(true);
    expect(result.blockReason).toBe("denied");
  });

  it("tool.after handler can mutate result", async () => {
    const registry = createInterceptorRegistry();
    const originalResult = { details: { status: "ok" }, output: "hello" };
    registry.add({
      id: "mutator",
      name: "tool.after",
      handler: (_input, output) => {
        output.result = { ...output.result, output: "modified" } as typeof output.result;
      },
    });
    const result = await trigger(
      registry,
      "tool.after",
      { toolName: "exec", toolCallId: "c1", isError: false },
      { result: originalResult } as ToolAfterOutput,
    );
    expect(result.result).toHaveProperty("output", "modified");
  });

  it("runs handlers sequentially in priority order", async () => {
    const registry = createInterceptorRegistry();
    const order: string[] = [];
    registry.add({
      id: "low",
      name: "tool.before",
      priority: 0,
      handler: () => {
        order.push("low");
      },
    });
    registry.add({
      id: "high",
      name: "tool.before",
      priority: 10,
      handler: () => {
        order.push("high");
      },
    });
    await trigger(registry, "tool.before", { toolName: "exec", toolCallId: "c1" }, { args: {} });
    expect(order).toEqual(["high", "low"]);
  });

  it("toolMatcher filters handlers", async () => {
    const registry = createInterceptorRegistry();
    const called: string[] = [];
    registry.add({
      id: "exec-only",
      name: "tool.before",
      toolMatcher: /^exec$/,
      handler: () => {
        called.push("exec-only");
      },
    });
    registry.add({
      id: "all",
      name: "tool.before",
      handler: () => {
        called.push("all");
      },
    });

    await trigger(registry, "tool.before", { toolName: "read", toolCallId: "c1" }, { args: {} });
    expect(called).toEqual(["all"]);

    called.length = 0;
    await trigger(registry, "tool.before", { toolName: "exec", toolCallId: "c2" }, { args: {} });
    expect(called).toEqual(["exec-only", "all"]);
  });

  it("supports async handlers", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "async",
      name: "tool.before",
      handler: async (_input, output) => {
        await new Promise((r) => setTimeout(r, 1));
        output.args = { delayed: true };
      },
    });
    const result = await trigger(
      registry,
      "tool.before",
      { toolName: "exec", toolCallId: "c1" },
      { args: {} },
    );
    expect(result.args).toEqual({ delayed: true });
  });
});
