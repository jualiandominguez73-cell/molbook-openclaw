import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveCompactionAgentDir } from "./compact.js";

describe("resolveCompactionAgentDir", () => {
  it("prefers the configured directory for the active agent", () => {
    const cfg = {
      agents: {
        list: [
          { id: "main", agentDir: "/tmp/agent-main" },
          { id: "support", agentDir: "/tmp/agent-support" },
        ],
      },
    } as OpenClawConfig;

    const agentDir = resolveCompactionAgentDir({
      config: cfg,
      sessionKey: "agent:support:main",
    });

    expect(agentDir).toBe("/tmp/agent-support");
  });

  it("respects an explicit agentDir override", () => {
    const cfg = {
      agents: {
        list: [
          { id: "main", agentDir: "/tmp/agent-main" },
          { id: "support", agentDir: "/tmp/agent-support" },
        ],
      },
    } as OpenClawConfig;

    const agentDir = resolveCompactionAgentDir({
      agentDir: "/tmp/custom",
      config: cfg,
      sessionKey: "agent:support:main",
    });

    expect(agentDir).toBe("/tmp/custom");
  });

  it("resolves distinct directories for different agents (#11625)", () => {
    const cfg = {
      agents: {
        list: [
          { id: "main", agentDir: "/data/agents/main" },
          { id: "alice", agentDir: "/data/agents/alice" },
          { id: "bob", agentDir: "/data/agents/bob" },
        ],
      },
    } as OpenClawConfig;

    // Without explicit agentDir, should derive from session key
    const mainDir = resolveCompactionAgentDir({
      config: cfg,
      sessionKey: "agent:main:main",
    });
    const aliceDir = resolveCompactionAgentDir({
      config: cfg,
      sessionKey: "agent:alice:main",
    });
    const bobDir = resolveCompactionAgentDir({
      config: cfg,
      sessionKey: "agent:bob:dm:user123",
    });

    expect(mainDir).toBe("/data/agents/main");
    expect(aliceDir).toBe("/data/agents/alice");
    expect(bobDir).toBe("/data/agents/bob");

    // Ensure they are all distinct
    expect(new Set([mainDir, aliceDir, bobDir]).size).toBe(3);
  });

  it("does not fall back to global dir when session key specifies agent with configured dir", () => {
    const cfg = {
      agents: {
        list: [
          { id: "main", agentDir: "/home/user/.openclaw/agents/main/agent" },
          { id: "work", agentDir: "/home/user/.openclaw/agents/work/agent" },
        ],
      },
    } as OpenClawConfig;

    // Session key for "work" agent should resolve to work's agentDir, not main's
    const workDir = resolveCompactionAgentDir({
      config: cfg,
      sessionKey: "agent:work:main",
    });

    expect(workDir).toBe("/home/user/.openclaw/agents/work/agent");
    expect(workDir).not.toBe("/home/user/.openclaw/agents/main/agent");
  });
});
