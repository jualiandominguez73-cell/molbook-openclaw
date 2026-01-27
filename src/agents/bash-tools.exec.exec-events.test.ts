import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { HooksExecConfig } from "../config/types.hooks.js";
import { withTempHome } from "../config/test-helpers.js";
import type { ExecApprovalsResolved } from "../infra/exec-approvals.js";
import type { ExecEventPayload } from "../infra/exec-events.js";

vi.mock("../infra/exec-approvals.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../infra/exec-approvals.js")>();
  const approvals: ExecApprovalsResolved = {
    path: "/tmp/exec-approvals.json",
    socketPath: "/tmp/exec-approvals.sock",
    token: "token",
    defaults: {
      security: "full",
      ask: "off",
      askFallback: "full",
      autoAllowSkills: false,
    },
    agent: {
      security: "full",
      ask: "off",
      askFallback: "full",
      autoAllowSkills: false,
    },
    allowlist: [],
    file: {
      version: 1,
      socket: { path: "/tmp/exec-approvals.sock", token: "token" },
      defaults: {
        security: "full",
        ask: "off",
        askFallback: "full",
        autoAllowSkills: false,
      },
      agents: {},
    },
  };
  return { ...mod, resolveExecApprovals: () => approvals };
});

type ExecEventsDeps = {
  execEvents: typeof import("../infra/exec-events.js");
  execContext: typeof import("../infra/exec-events-context.js");
  bashExec: typeof import("./bash-tools.exec.js");
  registry: typeof import("./bash-process-registry.js");
};

async function withExecEventsConfig(
  exec: HooksExecConfig,
  run: (deps: ExecEventsDeps) => Promise<void>,
) {
  await withTempHome(async (home) => {
    const prevConfigPath = process.env.CLAWDBOT_CONFIG_PATH;
    const configPath = path.join(home, ".clawdbot", "moltbot.json");
    process.env.CLAWDBOT_CONFIG_PATH = configPath;
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          hooks: { exec },
        },
        null,
        2,
      ),
      "utf8",
    );

    vi.resetModules();
    const execEvents = await import("../infra/exec-events.js");
    const execContext = await import("../infra/exec-events-context.js");
    const bashExec = await import("./bash-tools.exec.js");
    const registry = await import("./bash-process-registry.js");
    execEvents.resetExecEventsForTest();

    try {
      await run({ execEvents, execContext, bashExec, registry });
    } finally {
      registry.resetProcessRegistryForTests();
      execEvents.resetExecEventsForTest();
      if (prevConfigPath === undefined) delete process.env.CLAWDBOT_CONFIG_PATH;
      else process.env.CLAWDBOT_CONFIG_PATH = prevConfigPath;
      vi.resetModules();
    }
  });
}

describe("exec events emission", () => {
  it("emits events for whitelisted commands", async () => {
    const events: ExecEventPayload[] = [];
    await withExecEventsConfig(
      {
        emitEvents: true,
        commandWhitelist: ["node"],
        outputThrottleMs: 10,
        outputMaxChunkBytes: 4096,
      },
      async ({ execEvents, execContext, bashExec }) => {
        const unsubscribe = execEvents.onExecEvent((evt) => events.push(evt));
        const tool = bashExec.createExecTool({
          allowBackground: false,
          host: "gateway",
          security: "full",
          ask: "off",
        });
        const script =
          "console.log('out-1'); console.error('err-1'); setTimeout(() => console.log('out-2'), 25)";
        const command = `node -e "${script}"`;

        const result = await execContext.runWithExecEventContext(
          {
            runId: "run-exec-events",
            sessionKey: "main",
          },
          () => tool.execute("tool-call", { command }),
        );
        unsubscribe();

        expect(result.details.status).toBe("completed");
        const eventNames = events.map((evt) => evt.event);
        expect(eventNames).toContain("exec.started");
        expect(eventNames).toContain("exec.completed");
        expect(eventNames.some((evt) => evt === "exec.output")).toBe(true);

        const completed = events.find((evt) => evt.event === "exec.completed");
        expect(completed?.context?.runId).toBe("run-exec-events");
        expect(completed?.context?.sessionKey).toBe("main");
      },
    );
  });

  it("stays silent for non-whitelisted commands", async () => {
    const events: ExecEventPayload[] = [];
    await withExecEventsConfig(
      {
        emitEvents: true,
        commandWhitelist: ["node"],
        outputThrottleMs: 10,
        outputMaxChunkBytes: 4096,
      },
      async ({ execEvents, execContext, bashExec }) => {
        const unsubscribe = execEvents.onExecEvent((evt) => events.push(evt));
        const tool = bashExec.createExecTool({
          allowBackground: false,
          host: "gateway",
          security: "full",
          ask: "off",
        });

        const result = await execContext.runWithExecEventContext(
          {
            runId: "run-exec-events-muted",
            sessionKey: "main",
          },
          () => tool.execute("tool-call", { command: "echo hi" }),
        );
        unsubscribe();

        expect(result.details.status).toBe("completed");
        expect(events).toHaveLength(0);
      },
    );
  });
});
