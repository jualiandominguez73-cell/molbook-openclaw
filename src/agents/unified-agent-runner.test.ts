import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { MoltbotConfig } from "../config/config.js";
import type { AgentRuntime, AgentRuntimeResult } from "./agent-runtime.js";

// Mock run functions - defined separately to avoid unbound-method lint errors
const mockPiRun = vi.fn();
const mockCcsdkRun = vi.fn();

// Mock dependencies
const mockPiRuntime: AgentRuntime = {
  kind: "pi",
  displayName: "Pi Agent",
  run: mockPiRun,
};

const mockCcsdkRuntime: AgentRuntime = {
  kind: "ccsdk",
  displayName: "Claude Code SDK",
  run: mockCcsdkRun,
};

vi.mock("./main-agent-runtime-factory.js", () => ({
  createAgentRuntime: vi.fn(),
  resolveAgentRuntimeKind: vi.fn(() => "pi"),
}));

vi.mock("./agent-scope.js", () => ({
  resolveAgentModelFallbacksOverride: vi.fn(),
}));

vi.mock("./model-selection.js", () => ({
  buildModelAliasIndex: vi.fn(() => new Map()),
  modelKey: vi.fn((provider: string, model: string) => `${provider}/${model}`),
  parseModelRef: vi.fn((raw: string, defaultProvider: string) => {
    const [provider, model] = raw.includes("/") ? raw.split("/") : [defaultProvider, raw];
    return { provider, model };
  }),
  resolveConfiguredModelRef: vi.fn(() => ({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  })),
  resolveModelRefFromString: vi.fn(
    ({ raw, defaultProvider }: { raw: string; defaultProvider: string }) => {
      const [provider, model] = raw.includes("/") ? raw.split("/") : [defaultProvider, raw];
      return { ref: { provider, model } };
    },
  ),
}));

vi.mock("./auth-profiles.js", () => ({
  ensureAuthProfileStore: vi.fn(() => ({
    profiles: {},
    cooldowns: {},
  })),
  isProfileInCooldown: vi.fn(() => false),
  resolveAuthProfileOrder: vi.fn(() => []),
}));

vi.mock("./failover-error.js", () => ({
  coerceToFailoverError: vi.fn((err) => err),
  describeFailoverError: vi.fn((err) => ({
    message: err instanceof Error ? err.message : String(err),
    reason: "rate_limit",
    status: 429,
  })),
  isFailoverError: vi.fn((err) => err?.name === "FailoverError"),
  isTimeoutError: vi.fn(() => false),
}));

vi.mock("../config/sessions.js", () => ({
  resolveAgentIdFromSessionKey: vi.fn(() => "test-agent"),
}));

vi.mock("../utils/provider-utils.js", () => ({
  isReasoningTagProvider: vi.fn(() => false),
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("./defaults.js", () => ({
  DEFAULT_MODEL: "claude-sonnet-4-20250514",
  DEFAULT_PROVIDER: "anthropic",
}));

import { runAgentWithUnifiedFailover } from "./unified-agent-runner.js";
import type { UnifiedAgentRunParams } from "./unified-agent-runner.js";
import { createAgentRuntime, resolveAgentRuntimeKind } from "./main-agent-runtime-factory.js";
import { isProfileInCooldown, resolveAuthProfileOrder } from "./auth-profiles.js";
import { coerceToFailoverError, isFailoverError } from "./failover-error.js";

describe("unified-agent-runner", () => {
  const baseParams: UnifiedAgentRunParams = {
    sessionId: "test-session-123",
    sessionKey: "agent:test-agent:session",
    sessionFile: "/tmp/test-session.jsonl",
    workspaceDir: "/tmp/workspace",
    prompt: "Hello, world!",
    timeoutMs: 5000,
    runId: "run-123",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    config: {} as MoltbotConfig,
  };

  const successResult: AgentRuntimeResult = {
    payloads: [{ text: "Hello back!" }],
    meta: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAgentRuntime).mockResolvedValue(mockPiRuntime);
    mockPiRun.mockResolvedValue(successResult);
    mockCcsdkRun.mockResolvedValue(successResult);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("runtime selection", () => {
    it("attempts primary runtime first", async () => {
      vi.mocked(resolveAgentRuntimeKind).mockReturnValue("pi");
      vi.mocked(createAgentRuntime).mockResolvedValue(mockPiRuntime);

      const result = await runAgentWithUnifiedFailover(baseParams);

      expect(result.runtime).toBe("pi");
      expect(mockPiRun).toHaveBeenCalled();
    });

    it("uses ccsdk as primary when configured", async () => {
      vi.mocked(resolveAgentRuntimeKind).mockReturnValue("ccsdk");
      vi.mocked(createAgentRuntime).mockImplementation(async (_config, _agentId, forceKind) => {
        if (forceKind === "ccsdk") return mockCcsdkRuntime;
        return mockPiRuntime;
      });

      const result = await runAgentWithUnifiedFailover(baseParams);

      expect(result.runtime).toBe("ccsdk");
      expect(mockCcsdkRun).toHaveBeenCalled();
    });
  });

  describe("failover behavior", () => {
    it("fails over to secondary runtime when primary fails", async () => {
      const failoverError = Object.assign(new Error("Rate limit exceeded"), {
        name: "FailoverError",
      });
      vi.mocked(isFailoverError).mockReturnValue(true);
      vi.mocked(coerceToFailoverError).mockReturnValue(failoverError as any);

      vi.mocked(resolveAgentRuntimeKind).mockReturnValue("ccsdk");
      vi.mocked(createAgentRuntime).mockImplementation(async (_config, _agentId, forceKind) => {
        if (forceKind === "ccsdk") {
          return {
            ...mockCcsdkRuntime,
            run: vi.fn().mockRejectedValue(failoverError),
          };
        }
        return mockPiRuntime;
      });

      const result = await runAgentWithUnifiedFailover(baseParams);

      // Should have failed over to Pi after CCSDK failed
      expect(result.runtime).toBe("pi");
      expect(result.attempts.length).toBeGreaterThan(0);
      expect(result.attempts[0].runtime).toBe("ccsdk");
    });

    it("tries all model candidates before switching runtime", async () => {
      const failoverError = Object.assign(new Error("Model unavailable"), {
        name: "FailoverError",
      });
      vi.mocked(isFailoverError).mockReturnValue(true);
      vi.mocked(coerceToFailoverError).mockReturnValue(failoverError as any);

      // First runtime always fails
      const failingRuntime: AgentRuntime = {
        kind: "ccsdk",
        displayName: "Claude Code SDK",
        run: vi.fn().mockRejectedValue(failoverError),
      };

      vi.mocked(resolveAgentRuntimeKind).mockReturnValue("ccsdk");
      vi.mocked(createAgentRuntime).mockImplementation(async (_config, _agentId, forceKind) => {
        if (forceKind === "ccsdk") return failingRuntime;
        return mockPiRuntime;
      });

      const paramsWithFallbacks: UnifiedAgentRunParams = {
        ...baseParams,
        fallbacksOverride: ["anthropic/claude-haiku-3-5"],
      };

      const result = await runAgentWithUnifiedFailover(paramsWithFallbacks);

      // Should eventually succeed with Pi runtime
      expect(result.runtime).toBe("pi");
      // Should have attempted multiple models on CCSDK first
      const ccsdkAttempts = result.attempts.filter((a) => a.runtime === "ccsdk");
      expect(ccsdkAttempts.length).toBeGreaterThanOrEqual(1);
    });

    it("throws when all runtimes and models fail", async () => {
      const failoverError = Object.assign(new Error("All failed"), { name: "FailoverError" });
      vi.mocked(isFailoverError).mockReturnValue(true);
      vi.mocked(coerceToFailoverError).mockReturnValue(failoverError as any);

      vi.mocked(createAgentRuntime).mockResolvedValue({
        ...mockPiRuntime,
        run: vi.fn().mockRejectedValue(failoverError),
      });

      await expect(runAgentWithUnifiedFailover(baseParams)).rejects.toThrow();
    });
  });

  describe("callbacks", () => {
    it("calls onModelSelected before each attempt", async () => {
      const onModelSelected = vi.fn();

      await runAgentWithUnifiedFailover({
        ...baseParams,
        onModelSelected,
      });

      expect(onModelSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: "pi",
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          attempt: 1,
        }),
      );
    });

    it("calls onError on failure with error details", async () => {
      const failoverError = Object.assign(new Error("Rate limit"), { name: "FailoverError" });
      vi.mocked(isFailoverError).mockReturnValue(true);
      vi.mocked(coerceToFailoverError).mockReturnValue(failoverError as any);

      const onError = vi.fn();
      let attemptCount = 0;

      vi.mocked(createAgentRuntime).mockResolvedValue({
        ...mockPiRuntime,
        run: vi.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount === 1) throw failoverError;
          return successResult;
        }),
      });

      // Need a fallback to try again
      await runAgentWithUnifiedFailover({
        ...baseParams,
        fallbacksOverride: ["anthropic/claude-haiku-3-5"],
        onError,
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: "pi",
          provider: "anthropic",
          error: failoverError,
          attempt: 1,
        }),
      );
    });

    it("does not break when onModelSelected throws", async () => {
      const onModelSelected = vi.fn().mockRejectedValue(new Error("Callback error"));

      // Should not throw even if callback fails
      const result = await runAgentWithUnifiedFailover({
        ...baseParams,
        onModelSelected,
      });

      expect(result.result).toBeDefined();
    });
  });

  describe("auth profile handling", () => {
    it("skips providers when all profiles are in cooldown", async () => {
      // anthropic has profiles but all are in cooldown; openai has no profiles (no cooldown check)
      vi.mocked(resolveAuthProfileOrder).mockImplementation(({ provider }) =>
        provider === "anthropic" ? ["profile-1", "profile-2"] : [],
      );
      vi.mocked(isProfileInCooldown).mockReturnValue(true); // All anthropic profiles in cooldown

      vi.mocked(createAgentRuntime).mockResolvedValue(mockPiRuntime);

      // First candidate (anthropic) will be skipped due to cooldown, fallback (openai) will succeed
      const result = await runAgentWithUnifiedFailover({
        ...baseParams,
        fallbacksOverride: ["openai/gpt-4o"],
      });

      // Should record attempt as skipped due to cooldown
      const cooldownAttempt = result.attempts.find((a) => a.reason === "rate_limit");
      expect(cooldownAttempt).toBeDefined();
      expect(cooldownAttempt?.provider).toBe("anthropic");
      // Final result should be from the fallback provider
      expect(result.provider).toBe("openai");
    });

    it("proceeds when at least one profile is available", async () => {
      vi.mocked(resolveAuthProfileOrder).mockReturnValue(["profile-1", "profile-2"]);
      vi.mocked(isProfileInCooldown).mockImplementation(
        (_, profileId) => profileId === "profile-1",
      );

      const result = await runAgentWithUnifiedFailover(baseParams);

      expect(result.result).toBeDefined();
    });
  });

  describe("abort handling", () => {
    it("rethrows AbortError immediately", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";

      mockPiRun.mockRejectedValue(abortError);

      await expect(runAgentWithUnifiedFailover(baseParams)).rejects.toThrow("Aborted");
    });

    it("does not rethrow timeout errors as abort", async () => {
      const timeoutError = Object.assign(new Error("Timeout"), { name: "FailoverError" });
      vi.mocked(isFailoverError).mockReturnValue(true);
      vi.mocked(coerceToFailoverError).mockReturnValue(timeoutError as any);

      let attemptCount = 0;
      vi.mocked(createAgentRuntime).mockResolvedValue({
        ...mockPiRuntime,
        run: vi.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount === 1) throw timeoutError;
          return successResult;
        }),
      });

      // Should not throw, should failover
      const result = await runAgentWithUnifiedFailover({
        ...baseParams,
        fallbacksOverride: ["anthropic/claude-haiku-3-5"],
      });

      expect(result.result).toBeDefined();
    });
  });

  describe("result structure", () => {
    it("returns complete result with runtime, provider, model, and attempts", async () => {
      const result = await runAgentWithUnifiedFailover(baseParams);

      expect(result.result).toBeDefined();
      expect(result.runtime).toBe("pi");
      expect(result.provider).toBe("anthropic");
      expect(result.model).toBe("claude-sonnet-4-20250514");
      expect(Array.isArray(result.attempts)).toBe(true);
    });

    it("records all failed attempts in attempts array", async () => {
      const failoverError = Object.assign(new Error("Failed"), { name: "FailoverError" });
      vi.mocked(isFailoverError).mockReturnValue(true);
      vi.mocked(coerceToFailoverError).mockReturnValue(failoverError as any);

      let attemptCount = 0;
      vi.mocked(createAgentRuntime).mockResolvedValue({
        ...mockPiRuntime,
        run: vi.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 2) throw failoverError;
          return successResult;
        }),
      });

      const result = await runAgentWithUnifiedFailover({
        ...baseParams,
        fallbacksOverride: ["anthropic/claude-haiku-3-5"],
      });

      // First attempt should be recorded as failed
      expect(result.attempts.length).toBeGreaterThan(0);
      expect(result.attempts[0].error).toBeDefined();
    });
  });
});
