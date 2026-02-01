/**
 * Smart Router Tests
 * 
 * Run: pnpm test src/agents/smart-router.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SmartRouter } from "./smart-router.js";
import { UsageTracker } from "./usage-tracker.js";
import { DEFAULT_CONFIG, type RoutingConfig } from "./routing-config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("SmartRouter", () => {
  let router: SmartRouter;
  let usageTracker: UsageTracker;
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for usage stats
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-router-test-"));
    usageTracker = new UsageTracker({ configDir: testDir });
    router = new SmartRouter({ usageTracker });
  });

  afterEach(() => {
    // Cleanup temp directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("Prefix Overrides", () => {
    it("should route !flash prefix to flash-lite model", async () => {
      const result = await router.route("!flash hello world");
      expect(result.model).toBe("google/gemini-2.0-flash-lite");
      expect(result.source).toBe("prefix:!flash");
      expect(result.cleanQuery).toBe("hello world");
    });

    it("should route flash: prefix to flash-lite model", async () => {
      const result = await router.route("flash: test query");
      expect(result.model).toBe("google/gemini-2.0-flash-lite");
      expect(result.source).toBe("prefix:flash:");
    });

    it("should route !sonnet prefix to sonnet model", async () => {
      const result = await router.route("!sonnet complex task");
      expect(result.model).toBe("anthropic/claude-sonnet-4-5");
      expect(result.source).toBe("prefix:!sonnet");
    });

    it("should route sonnet: prefix to sonnet model", async () => {
      const result = await router.route("sonnet: another task");
      expect(result.model).toBe("anthropic/claude-sonnet-4-5");
    });

    it("should route !opus prefix to opus model", async () => {
      const result = await router.route("!opus important task");
      expect(result.model).toBe("anthropic/claude-opus-4-5");
    });

    it("should route !haiku prefix to haiku model", async () => {
      const result = await router.route("!haiku quick task");
      expect(result.model).toBe("anthropic/claude-haiku-4-5");
    });

    it("should route !research prefix to perplexity model", async () => {
      const result = await router.route("!research latest news");
      expect(result.model).toBe("perplexity/sonar-pro");
    });

    it("should route research: prefix to perplexity model", async () => {
      const result = await router.route("research: what happened today");
      expect(result.model).toBe("perplexity/sonar-pro");
    });

    it("should strip prefix from cleanQuery", async () => {
      const result = await router.route("!flash  hello world");
      expect(result.cleanQuery).toBe("hello world");
    });

    it("should handle colon after prefix", async () => {
      const result = await router.route("flash: : test");
      expect(result.cleanQuery).toBe("test");
    });
  });

  describe("Trivial Rules (Direct Answers)", () => {
    it("should detect thanks! as trivial", async () => {
      const result = await router.route("thanks!");
      expect(result.tier).toBe("TIER0_TRIVIAL");
      expect(result.directAnswer).toBe("You're welcome!");
    });

    it("should detect thank you as trivial", async () => {
      const result = await router.route("thank you");
      expect(result.directAnswer).toBe("You're welcome!");
    });

    it("should detect ok as trivial", async () => {
      const result = await router.route("ok");
      expect(result.tier).toBe("TIER0_TRIVIAL");
      expect(result.directAnswer).toBe("👍");
    });

    it("should detect sure as trivial", async () => {
      const result = await router.route("sure");
      expect(result.directAnswer).toBe("👍");
    });

    it("should detect hi as trivial greeting", async () => {
      const result = await router.route("hi");
      expect(result.directAnswer).toBe("Hey! 👋");
    });

    it("should detect hello! as trivial greeting", async () => {
      const result = await router.route("hello!");
      expect(result.directAnswer).toBe("Hey! 👋");
    });

    it("should be case insensitive", async () => {
      const result = await router.route("THANKS!");
      expect(result.directAnswer).toBe("You're welcome!");
    });

    it("should handle whitespace padding", async () => {
      const result = await router.route("  thanks!  ");
      expect(result.tier).toBe("TIER0_TRIVIAL");
    });
  });

  describe("Skip Rules", () => {
    it("should skip /status command", async () => {
      const result = await router.route("/status");
      expect(result.skip).toBe(true);
      expect(result.source).toContain("rule:slash-commands");
    });

    it("should skip /help command", async () => {
      const result = await router.route("/help");
      expect(result.skip).toBe(true);
    });

    it("should skip any slash command", async () => {
      const result = await router.route("/anything");
      expect(result.skip).toBe(true);
    });
  });

  describe("Length Rules", () => {
    it("should route very short queries (<=3 chars) to TIER0", async () => {
      const result = await router.route("hi");
      expect(result.tier).toBe("TIER0_TRIVIAL");
    });

    it("should route long queries (>=500 chars) to TIER3", async () => {
      const longQuery = "a".repeat(600);
      const result = await router.route(longQuery);
      expect(result.tier).toBe("TIER3_COMPLEX");
    });

    it("should route very long queries (>=2000 chars) to TIER4", async () => {
      const veryLongQuery = "a".repeat(2100);
      const result = await router.route(veryLongQuery);
      expect(result.tier).toBe("TIER4_CRITICAL");
    });
  });

  describe("Category Detection", () => {
    it("should detect react as frontend category", async () => {
      const result = await router.route("help me build a react component");
      expect(result.category).toBe("frontend");
      expect(result.tier).toBe("TIER2_STANDARD");
    });

    it("should detect css as frontend category", async () => {
      const result = await router.route("fix this css layout issue");
      expect(result.category).toBe("frontend");
    });

    it("should detect vue as frontend category", async () => {
      const result = await router.route("create a vue component");
      expect(result.category).toBe("frontend");
    });

    it("should detect api as backend category", async () => {
      const result = await router.route("build an api endpoint");
      expect(result.category).toBe("backend");
      expect(result.tier).toBe("TIER3_COMPLEX");
    });

    it("should detect database as backend category", async () => {
      const result = await router.route("connect to the database");
      expect(result.category).toBe("backend");
    });

    it("should detect debug as debugging category", async () => {
      const result = await router.route("debug this error in my code");
      expect(result.category).toBe("debugging");
      expect(result.tier).toBe("TIER3_COMPLEX");
    });

    it("should detect bug as debugging category", async () => {
      const result = await router.route("fix this bug please");
      expect(result.category).toBe("debugging");
    });

    it("should detect crashing as debugging category", async () => {
      const result = await router.route("the app keeps crashing");
      expect(result.category).toBe("debugging");
    });

    it("should detect write poem as creative category", async () => {
      const result = await router.route("write a poem about love");
      expect(result.category).toBe("creative");
      expect(result.tier).toBe("TIER4_CRITICAL");
    });

    it("should detect draft letter as creative category", async () => {
      const result = await router.route("draft a letter to my boss");
      expect(result.category).toBe("creative");
    });

    it("should detect implement as coding category", async () => {
      const result = await router.route("implement a sorting algorithm");
      expect(result.category).toBe("coding");
      expect(result.tier).toBe("TIER3_COMPLEX");
    });

    it("should detect refactor as coding category", async () => {
      const result = await router.route("refactor this function");
      expect(result.category).toBe("coding");
    });

    it("should detect latest as research category", async () => {
      const result = await router.route("what's the latest news on AI");
      expect(result.category).toBe("research");
      expect(result.tier).toBe("TIER_RESEARCH");
    });

    it("should detect today as research category", async () => {
      const result = await router.route("what happened today in tech");
      expect(result.category).toBe("research");
    });

    it("should detect translate as simple category", async () => {
      const result = await router.route("translate this to Spanish");
      expect(result.category).toBe("simple");
      expect(result.tier).toBe("TIER1_ROUTINE");
    });

    it("should detect time as simple category", async () => {
      const result = await router.route("what time is it in Tokyo");
      expect(result.category).toBe("simple");
    });

    it("should detect architecture keywords", async () => {
      const result = await router.route("design a microservice architecture");
      expect(result.category).toBe("architecture");
      expect(result.tier).toBe("TIER4_CRITICAL");
    });

    it("should use word boundary matching (no false positives)", async () => {
      // "build" contains "ui" but should not match "ui" pattern
      const result = await router.route("build something");
      expect(result.category).not.toBe("frontend");
    });
  });

  describe("Quota / Fallback", () => {
    it("should fallback when model is at limit", async () => {
      // Set opus at limit (50)
      const customConfig: Partial<RoutingConfig> = {
        ...DEFAULT_CONFIG,
        usageLimits: {
          ...DEFAULT_CONFIG.usageLimits,
          "anthropic/claude-opus-4-5": { dailyLimit: 50 },
        },
      };
      
      // Simulate 50 uses
      for (let i = 0; i < 50; i++) {
        usageTracker.increment("anthropic/claude-opus-4-5");
      }

      const quotaRouter = new SmartRouter({ config: customConfig, usageTracker });
      const result = await quotaRouter.route("write a beautiful poem");
      
      // Should fallback to sonnet
      expect(result.model).toBe("anthropic/claude-sonnet-4-5");
      expect(result.tier).toBe("TIER4_CRITICAL");
    });

    it("should cascade fallback when multiple models at limit", async () => {
      // Set opus and sonnet at limit
      for (let i = 0; i < 50; i++) {
        usageTracker.increment("anthropic/claude-opus-4-5");
      }
      for (let i = 0; i < 200; i++) {
        usageTracker.increment("anthropic/claude-sonnet-4-5");
      }

      const result = await router.route("write a beautiful poem");
      
      // Should fallback to flash
      expect(result.model).toBe("google/gemini-2.5-flash");
    });
  });

  describe("LLM Router Fallback", () => {
    it("should use LLM router when no rules match", async () => {
      const mockLLMRouter = async (query: string) => ({
        tier: "TIER2_STANDARD" as const,
        ack: "Processing...",
      });

      const llmRouter = new SmartRouter({ 
        usageTracker,
        llmRouter: mockLLMRouter,
      });

      const result = await llmRouter.route("explain quantum entanglement");
      expect(result.source).toBe("llm");
      expect(result.ack).toBe("Processing...");
    });

    it("should handle LLM router errors gracefully", async () => {
      const failingLLMRouter = async () => {
        throw new Error("API error");
      };

      const llmRouter = new SmartRouter({
        usageTracker,
        llmRouter: failingLLMRouter,
      });

      const result = await llmRouter.route("explain quantum entanglement");
      expect(result.source).toBe("default:no-match");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty input", async () => {
      const result = await router.route("");
      expect(result.error).toBe("Empty query provided");
    });

    it("should handle whitespace-only input", async () => {
      const result = await router.route("   ");
      expect(result.error).toBe("Empty query provided");
    });

    it("should handle unicode input", async () => {
      const result = await router.route("Hello! 你好! 🎉");
      expect(result).toBeDefined();
      expect(result.tier).toBeDefined();
    });

    it("should be case insensitive for greetings", async () => {
      const result = await router.route("Hey");
      expect(result.directAnswer).toBe("Hey! 👋");
    });
  });

  describe("Ack Messages", () => {
    it("should have ack for TIER3", async () => {
      const result = await router.route("build an api endpoint");
      expect(result.ack).toBe("Working on it...");
    });

    it("should have ack for TIER4", async () => {
      const result = await router.route("write a story");
      expect(result.ack).toBe("Let me think about this...");
    });

    it("should have ack for TIER1", async () => {
      const result = await router.route("translate hello");
      expect(result.ack).toBe("One sec...");
    });

    it("should have no ack for TIER0 (direct answer)", async () => {
      const result = await router.route("thanks!");
      expect(result.ack).toBeNull();
    });
  });

  describe("Usage Tracking", () => {
    it("should increment usage", () => {
      const count = router.incrementUsage("test/model");
      expect(count).toBe(1);
      
      const count2 = router.incrementUsage("test/model");
      expect(count2).toBe(2);
    });

    it("should get usage", () => {
      router.incrementUsage("test/model");
      router.incrementUsage("test/model");
      
      expect(router.getUsage("test/model")).toBe(2);
    });

    it("should return 0 for unused models", () => {
      expect(router.getUsage("unused/model")).toBe(0);
    });
  });

  describe("Helper Methods", () => {
    it("should cleanup prompt by removing prefix", () => {
      expect(router.cleanupPrompt("!flash hello")).toBe("hello");
      expect(router.cleanupPrompt("sonnet: test")).toBe("test");
      expect(router.cleanupPrompt("no prefix")).toBe("no prefix");
    });

    it("should check edit-in-place support", () => {
      expect(router.supportsEditInPlace("telegram")).toBe(true);
      expect(router.supportsEditInPlace("discord")).toBe(true);
      expect(router.supportsEditInPlace("slack")).toBe(true);
      expect(router.supportsEditInPlace("imessage")).toBe(false);
      expect(router.supportsEditInPlace("whatsapp")).toBe(false);
    });
  });
});

describe("UsageTracker", () => {
  let tracker: UsageTracker;
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-tracker-test-"));
    tracker = new UsageTracker({ configDir: testDir });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should track usage across increments", () => {
    tracker.increment("model/a");
    tracker.increment("model/a");
    tracker.increment("model/b");
    
    expect(tracker.getUsage("model/a")).toBe(2);
    expect(tracker.getUsage("model/b")).toBe(1);
  });

  it("should reset usage", () => {
    tracker.increment("model/a");
    tracker.reset();
    
    expect(tracker.getUsage("model/a")).toBe(0);
  });

  it("should check limits", () => {
    tracker.increment("model/a");
    tracker.increment("model/a");
    
    expect(tracker.isAtLimit("model/a", 2)).toBe(true);
    expect(tracker.isAtLimit("model/a", 3)).toBe(false);
  });

  it("should persist to file", () => {
    tracker.increment("model/a");
    
    // Create new tracker pointing to same file
    const tracker2 = new UsageTracker({ configDir: testDir });
    expect(tracker2.getUsage("model/a")).toBe(1);
  });
});
