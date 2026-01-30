import { describe, expect, it, vi } from "vitest";
import type { MoltbotConfig } from "../../config/config.js";
import { createGatewayTool } from "./gateway-tool.js";

// Mock the gateway module
vi.mock("./gateway.js", () => ({
  callGatewayTool: vi.fn().mockImplementation(async (action: string) => {
    if (action === "config.get") {
      return { hash: "mock-hash-123", raw: "mock-config" };
    }
    return { ok: true };
  }),
}));

// Mock the restart module
vi.mock("../../infra/restart.js", () => ({
  scheduleGatewaySigusr1Restart: vi.fn().mockReturnValue({ ok: true }),
}));

// Mock config/session modules used by checkActiveSessions
vi.mock("../../config/io.js", () => ({
  loadConfig: vi.fn().mockReturnValue({ session: {} }),
  resolveConfigSnapshotHash: vi.fn().mockReturnValue("mock-hash"),
}));

vi.mock("../../gateway/session-utils.js", () => ({
  loadCombinedSessionStoreForGateway: vi.fn().mockReturnValue({ storePath: "/tmp", store: {} }),
  listSessionsFromStore: vi.fn().mockReturnValue({ sessions: [] }),
}));

/**
 * Helper to extract the JSON payload from an AgentToolResult.
 * tool.execute() returns { content: [{ type: "text", text: "..." }] }
 */
function parseToolResult(result: unknown): Record<string, unknown> {
  if (typeof result === "string") return JSON.parse(result);
  const content = (result as { content?: Array<{ type: string; text: string }> })?.content;
  if (Array.isArray(content) && content.length > 0 && content[0].text) {
    return JSON.parse(content[0].text);
  }
  throw new Error(`Unexpected tool result shape: ${JSON.stringify(result).slice(0, 200)}`);
}

describe("gateway tool - config.patch path restrictions", () => {
  it("allows all paths when agent has no restrictions (default)", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            // No allowedConfigPaths - unrestricted
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    const patch = JSON.stringify({
      agents: {
        list: [{ model: "gpt-4" }, { identity: { name: "NewName" } }],
      },
    });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    expect(parsed.ok).toBe(true);
  });

  it("allows paths matching agent's allowedConfigPaths", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            allowedConfigPaths: ["agents.*.model", "agents.defaults.model"],
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    const patch = JSON.stringify({
      agents: {
        list: [{ model: "gpt-4" }],
        defaults: { model: "claude-3" },
      },
    });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    expect(parsed.ok).toBe(true);
  });

  it("blocks paths not in agent's allowedConfigPaths", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            allowedConfigPaths: ["agents.*.model"],
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    const patch = JSON.stringify({
      agents: {
        list: [
          {
            model: "gpt-4",
            identity: { name: "Hacked" },
            workspace: "/tmp/evil",
          },
        ],
      },
    });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("config_path_restricted");
    expect(parsed.blockedPaths).toBeDefined();
    expect(parsed.blockedPaths).toContain("agents.list.0.identity.name");
    expect(parsed.blockedPaths).toContain("agents.list.0.workspace");
    expect(parsed.blockedPaths).not.toContain("agents.list.0.model");
  });

  it("works with deep wildcard patterns", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            allowedConfigPaths: ["agents.**.tools.**"],
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    const patch = JSON.stringify({
      agents: {
        list: [
          {
            tools: {
              allow: ["exec", "web_search"],
              exec: { host: "gateway" },
            },
          },
        ],
      },
    });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    expect(parsed.ok).toBe(true);
  });

  it("blocks when deep wildcard doesn't match", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            allowedConfigPaths: ["agents.**.tools.**"],
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    const patch = JSON.stringify({
      agents: {
        list: [
          {
            model: "gpt-4",
            tools: { allow: ["exec"] },
          },
        ],
      },
    });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("config_path_restricted");
    expect(parsed.blockedPaths).toContain("agents.list.0.model");
  });

  it("provides helpful error message with allowed patterns", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            allowedConfigPaths: ["agents.*.model", "agents.defaults.**"],
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    const patch = JSON.stringify({
      agents: {
        list: [{ identity: { name: "BadName" } }],
      },
    });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.message).toContain('agent "atlas"');
    expect(parsed.message).toContain("not authorized");
    expect(parsed.message).toContain("agents.list.0.identity.name");
    expect(parsed.message).toContain("Allowed patterns");
    expect(parsed.message).toContain("agents.*.model");
    expect(parsed.message).toContain("agents.defaults.**");
    expect(parsed.hint).toContain("allowedConfigPaths");
  });

  it("handles invalid JSON gracefully", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            allowedConfigPaths: ["agents.*.*.model"],
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    await expect(
      tool.execute("test-call-id", {
        action: "config.patch",
        raw: "{ invalid json",
        baseHash: "test-hash",
      }),
    ).rejects.toThrow("Invalid JSON");
  });

  it("works with multiple allowed patterns", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            allowedConfigPaths: [
              "agents.*.model",
              "agents.defaults.model",
              "agents.**.tools.allow.*",
            ],
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    const patch = JSON.stringify({
      agents: {
        list: [
          {
            model: "gpt-4",
            tools: { allow: ["exec", "web"] },
          },
        ],
        defaults: { model: "claude-3" },
      },
    });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    expect(parsed.ok).toBe(true);
  });

  it("handles missing agent config gracefully", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "other-agent",
            allowedConfigPaths: ["some.path"],
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:nonexistent:session:test",
      config,
    });

    const patch = JSON.stringify({
      agents: { list: [{ model: "gpt-4" }] },
    });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    // Should allow all when agent config not found (backward compatible)
    expect(parsed.ok).toBe(true);
  });

  it("includes restartWarning in config.patch response", async () => {
    const config: MoltbotConfig = {
      agents: {
        list: [
          {
            id: "atlas",
            // No restrictions
          },
        ],
      },
    } as MoltbotConfig;

    const tool = createGatewayTool({
      agentSessionKey: "agent:atlas:session:test",
      config,
    });

    const patch = JSON.stringify({ messages: { ackReactionScope: "all" } });

    const result = await tool.execute("test-call-id", {
      action: "config.patch",
      raw: patch,
      baseHash: "test-hash",
    });

    const parsed = parseToolResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.restartWarning).toBeDefined();
    expect(parsed.restartWarning).toContain("Gateway restarting");
    expect(parsed.restartWarning).toContain("config patch");
  });
});
