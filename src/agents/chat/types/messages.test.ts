import { describe, it, expect } from "vitest";
import { generateMessageId, extractMentions } from "./messages.js";

describe("messages types", () => {
  describe("generateMessageId", () => {
    it("should generate a unique message ID with cmsg_ prefix", () => {
      const id = generateMessageId();
      expect(id).toMatch(/^cmsg_[a-f0-9-]{36}$/);
    });

    it("should generate unique IDs on each call", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateMessageId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("extractMentions", () => {
    it("should extract explicit agent mentions (@agent:id)", () => {
      const mentions = extractMentions("Hello @agent:coder can you help?");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "agent",
        id: "coder",
        startIndex: 6,
      });
    });

    it("should extract multiple explicit mentions", () => {
      const mentions = extractMentions("@agent:coder and @agent:reviewer please review");
      expect(mentions).toHaveLength(2);
      expect(mentions[0].id).toBe("coder");
      expect(mentions[1].id).toBe("reviewer");
    });

    it("should extract pattern mentions (@AgentName)", () => {
      const mentions = extractMentions("Hey @Coder can you help?");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "agent",
        id: "Coder",
      });
    });

    it("should extract @channel mention", () => {
      const mentions = extractMentions("@channel please review this");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "channel",
        id: "channel",
      });
    });

    it("should extract @all mention", () => {
      const mentions = extractMentions("@all what do you think?");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "all",
        id: "all",
      });
    });

    it("should extract @here mention", () => {
      const mentions = extractMentions("@here need help!");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "all",
        id: "all",
      });
    });

    it("should extract user mentions (@user:id)", () => {
      const mentions = extractMentions("@user:john123 check this");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "user",
        id: "john123",
      });
    });

    it("should handle messages without mentions", () => {
      const mentions = extractMentions("Hello world, no mentions here");
      expect(mentions).toHaveLength(0);
    });

    it("should handle email addresses without extracting them as mentions", () => {
      const mentions = extractMentions("Contact me at test@example.com");
      // Should not extract email as mention
      expect(mentions).toHaveLength(0);
    });

    it("should return mentions in order of appearance", () => {
      const mentions = extractMentions("@agent:first then @agent:second");
      expect(mentions[0].id).toBe("first");
      expect(mentions[1].id).toBe("second");
      expect(mentions[0].startIndex).toBeLessThan(mentions[1].startIndex);
    });

    it("should handle mixed mention types", () => {
      const mentions = extractMentions("@agent:coder @all @user:admin help");
      expect(mentions).toHaveLength(3);
    });

    it("should not extract lowercase pattern mentions", () => {
      // Only capitalized names are pattern mentions
      const mentions = extractMentions("@coder help me");
      // 'coder' is lowercase, so it won't match the capitalized pattern
      expect(mentions.filter((m) => m.type === "agent" && m.id === "coder")).toHaveLength(0);
    });

    it("should handle mentions at start, middle, and end", () => {
      const text = "@agent:start middle @agent:middle end @agent:end";
      const mentions = extractMentions(text);
      expect(mentions).toHaveLength(3);
    });

    it("should deduplicate overlapping mentions", () => {
      // This tests that the deduplication logic works
      const mentions = extractMentions("@Agent hello");
      // Should only return one mention, not duplicates
      const uniqueStarts = new Set(mentions.map((m) => m.startIndex));
      expect(uniqueStarts.size).toBe(mentions.length);
    });
  });
});
