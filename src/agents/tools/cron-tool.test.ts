import { beforeEach, describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn();
vi.mock("../../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

import { createCronTool } from "./cron-tool.js";

describe("cron tool", () => {
  beforeEach(() => {
    callGatewayMock.mockReset();
    callGatewayMock.mockResolvedValue({ ok: true });
  });

  it.each([
    [
      "update",
      // Flattened schema: patch fields are at the top level
      { action: "update", id: "job-1", name: "new-name" },
      { id: "job-1", patch: { name: "new-name" } },
    ],
    ["remove", { action: "remove", id: "job-1" }, { id: "job-1" }],
    ["run", { action: "run", id: "job-1" }, { id: "job-1" }],
    ["runs", { action: "runs", id: "job-1" }, { id: "job-1" }],
  ])("%s sends id to gateway", async (action, args, expectedParams) => {
    const tool = createCronTool();
    await tool.execute("call1", args);

    expect(callGatewayMock).toHaveBeenCalledTimes(1);
    const call = callGatewayMock.mock.calls[0]?.[0] as {
      method?: string;
      params?: unknown;
    };
    expect(call.method).toBe(`cron.${action}`);
    expect(call.params).toEqual(expectedParams);
  });

  it("normalizes cron.add job payloads", async () => {
    const tool = createCronTool();
    // Flattened schema: job fields are at the top level with prefixes
    await tool.execute("call2", {
      action: "add",
      name: "wake-up",
      scheduleKind: "at",
      scheduleAtMs: 123,
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payloadKind: "systemEvent",
      payloadText: "hello",
    });

    expect(callGatewayMock).toHaveBeenCalledTimes(1);
    const call = callGatewayMock.mock.calls[0]?.[0] as {
      method?: string;
      params?: unknown;
    };
    expect(call.method).toBe("cron.add");
    expect(call.params).toEqual({
      name: "wake-up",
      schedule: { kind: "at", atMs: 123 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
    });
  });

  it("handles agentTurn payload with optional fields", async () => {
    const tool = createCronTool();
    await tool.execute("call3", {
      action: "add",
      name: "daily-check",
      scheduleKind: "cron",
      scheduleCronExpr: "0 9 * * *",
      scheduleTz: "Europe/Vienna",
      sessionTarget: "main",
      wakeMode: "now",
      payloadKind: "agentTurn",
      payloadMessage: "Good morning!",
      payloadChannel: "telegram",
      payloadDeliver: true,
    });

    expect(callGatewayMock).toHaveBeenCalledTimes(1);
    const call = callGatewayMock.mock.calls[0]?.[0] as {
      method?: string;
      params?: unknown;
    };
    expect(call.method).toBe("cron.add");
    expect(call.params).toEqual({
      name: "daily-check",
      schedule: { kind: "cron", expr: "0 9 * * *", tz: "Europe/Vienna" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message: "Good morning!",
        channel: "telegram",
        deliver: true,
      },
    });
  });
});
