import { describe, it, expect } from "vitest";
import {
  parseMentions,
  hasMentions,
  mentionsAgent,
  formatMention,
  extractAgentIds,
  normalizeAgentName,
  matchPatternMentions,
} from "./mention-parser.js";

describe("mention-parser", () => {
  describe("parseMentions", () => {
    it("should parse explicit agent mentions", () => {
      const result = parseMentions("Hello @agent:coder");
      expect(result.explicitMentions).toEqual(["coder"]);
      expect(result.isBroadcast).toBe(false);
    });

    it("should parse multiple explicit mentions", () => {
      const result = parseMentions("@agent:coder @agent:reviewer help");
      expect(result.explicitMentions).toContain("coder");
      expect(result.explicitMentions).toContain("reviewer");
    });

    it("should parse pattern mentions (@AgentName)", () => {
      const result = parseMentions("Hey @Coder can you help?");
      expect(result.patternMentions).toContain("Coder");
    });

    it("should detect broadcast mentions", () => {
      expect(parseMentions("@all please review").isBroadcast).toBe(true);
      expect(parseMentions("@channel meeting now").isBroadcast).toBe(true);
      expect(parseMentions("@here urgent!").isBroadcast).toBe(true);
    });

    it("should strip mentions from message", () => {
      const result = parseMentions("@agent:coder help me with this");
      expect(result.strippedMessage).toBe("help me with this");
    });

    it("should strip multiple mentions", () => {
      const result = parseMentions("@agent:coder @agent:reviewer review this");
      expect(result.strippedMessage).toBe("review this");
    });

    it("should handle messages without mentions", () => {
      const result = parseMentions("Hello world");
      expect(result.explicitMentions).toHaveLength(0);
      expect(result.patternMentions).toHaveLength(0);
      expect(result.isBroadcast).toBe(false);
      expect(result.strippedMessage).toBe("Hello world");
    });

    it("should include all mentions with positions", () => {
      const result = parseMentions("@agent:test hello");
      expect(result.allMentions).toHaveLength(1);
      expect(result.allMentions[0]).toMatchObject({
        type: "explicit",
        value: "test",
        startIndex: 0,
      });
    });

    it("should deduplicate explicit mentions", () => {
      const result = parseMentions("@agent:coder @agent:coder help");
      expect(result.explicitMentions).toHaveLength(1);
    });
  });

  describe("hasMentions", () => {
    it("should return true for explicit mentions", () => {
      expect(hasMentions("@agent:coder help")).toBe(true);
    });

    it("should return true for pattern mentions", () => {
      expect(hasMentions("@Coder help")).toBe(true);
    });

    it("should return true for broadcast mentions", () => {
      expect(hasMentions("@all help")).toBe(true);
    });

    it("should return false for no mentions", () => {
      expect(hasMentions("Hello world")).toBe(false);
    });
  });

  describe("mentionsAgent", () => {
    it("should return true for explicit mention by ID", () => {
      expect(mentionsAgent("@agent:coder help", "coder")).toBe(true);
    });

    it("should return false for different agent ID", () => {
      expect(mentionsAgent("@agent:coder help", "reviewer")).toBe(false);
    });

    it("should return true for pattern mention by name", () => {
      expect(mentionsAgent("@Coder help", "any-id", "Coder")).toBe(true);
    });

    it("should be case-insensitive for pattern names", () => {
      expect(mentionsAgent("@CODER help", "any-id", "coder")).toBe(true);
    });

    it("should return false when no mention", () => {
      expect(mentionsAgent("Hello world", "coder")).toBe(false);
    });
  });

  describe("formatMention", () => {
    it("should format mention with display name", () => {
      expect(formatMention("coder", "Code Assistant")).toBe("@Code Assistant");
    });

    it("should format mention without display name", () => {
      expect(formatMention("coder")).toBe("@agent:coder");
    });
  });

  describe("extractAgentIds", () => {
    it("should extract agent IDs from explicit mentions", () => {
      const ids = extractAgentIds("@agent:coder @agent:reviewer help");
      expect(ids).toContain("coder");
      expect(ids).toContain("reviewer");
    });

    it("should return empty array for no explicit mentions", () => {
      expect(extractAgentIds("Hello world")).toEqual([]);
    });
  });

  describe("normalizeAgentName", () => {
    it("should lowercase the name", () => {
      expect(normalizeAgentName("Coder")).toBe("coder");
    });

    it("should remove special characters", () => {
      expect(normalizeAgentName("Code-Assistant")).toBe("codeassistant");
    });

    it("should trim whitespace", () => {
      expect(normalizeAgentName("  coder  ")).toBe("coder");
    });
  });

  describe("matchPatternMentions", () => {
    it("should match exact names", () => {
      const agentNames = new Map([
        ["agent-1", "Coder"],
        ["agent-2", "Reviewer"],
      ]);
      const matches = matchPatternMentions(["Coder"], agentNames);
      expect(matches.get("Coder")).toBe("agent-1");
    });

    it("should match prefix names", () => {
      const agentNames = new Map([["agent-1", "CodeAssistant"]]);
      const matches = matchPatternMentions(["Code"], agentNames);
      expect(matches.get("Code")).toBe("agent-1");
    });

    it("should not match short prefixes", () => {
      const agentNames = new Map([["agent-1", "Coder"]]);
      const matches = matchPatternMentions(["Co"], agentNames);
      expect(matches.has("Co")).toBe(false);
    });

    it("should return empty map for no matches", () => {
      const agentNames = new Map([["agent-1", "Coder"]]);
      const matches = matchPatternMentions(["Unknown"], agentNames);
      expect(matches.size).toBe(0);
    });
  });
});
