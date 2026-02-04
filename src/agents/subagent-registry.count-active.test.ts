import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/config.js", () => ({
  loadConfig: () => ({}),
}));

vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn().mockResolvedValue({}),
}));

vi.mock("../infra/agent-events.js", () => ({
  onAgentEvent: vi.fn(() => () => {}),
}));

import {
  addSubagentRunForTests,
  countActiveSubagentRuns,
  resetSubagentRegistryForTests,
} from "./subagent-registry.js";

describe("subagent-registry: countActiveSubagentRuns", () => {
  beforeEach(() => {
    resetSubagentRegistryForTests();
  });

  it("returns 0 when no subagent runs exist", () => {
    expect(countActiveSubagentRuns()).toBe(0);
  });

  it("counts runs without endedAt as active", () => {
    addSubagentRunForTests({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:uuid-1",
      requesterSessionKey: "main",
      requesterDisplayKey: "main",
      task: "task 1",
      cleanup: "keep",
      createdAt: Date.now(),
    });
    addSubagentRunForTests({
      runId: "run-2",
      childSessionKey: "agent:main:subagent:uuid-2",
      requesterSessionKey: "main",
      requesterDisplayKey: "main",
      task: "task 2",
      cleanup: "keep",
      createdAt: Date.now(),
    });

    expect(countActiveSubagentRuns()).toBe(2);
  });

  it("excludes runs with endedAt from active count", () => {
    addSubagentRunForTests({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:uuid-1",
      requesterSessionKey: "main",
      requesterDisplayKey: "main",
      task: "task 1",
      cleanup: "keep",
      createdAt: Date.now(),
      endedAt: Date.now(),
    });
    addSubagentRunForTests({
      runId: "run-2",
      childSessionKey: "agent:main:subagent:uuid-2",
      requesterSessionKey: "main",
      requesterDisplayKey: "main",
      task: "task 2",
      cleanup: "keep",
      createdAt: Date.now(),
    });

    expect(countActiveSubagentRuns()).toBe(1);
  });
});
