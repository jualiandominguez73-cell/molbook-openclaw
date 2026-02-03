import { describe, it, expect } from "vitest";
import type { AgentChannel, AgentChannelMember } from "../types/channels.js";
import type { ChannelMessage } from "../types/messages.js";
import {
  resolveTargetAgents,
  shouldAgentRespond,
  shouldAgentObserve,
  getResponsePriority,
  filterMessagesForAgent,
} from "./router.js";

describe("router", () => {
  const createMockChannel = (
    members: Partial<AgentChannelMember>[],
    defaultAgentId?: string,
  ): AgentChannel => ({
    id: "test-channel",
    type: "public",
    name: "Test Channel",
    createdAt: Date.now(),
    createdBy: "admin",
    defaultAgentId,
    members: members.map((m) => ({
      agentId: m.agentId ?? "agent",
      role: m.role ?? "member",
      listeningMode: m.listeningMode ?? "mention-only",
      joinedAt: Date.now(),
      receiveBroadcasts: m.receiveBroadcasts ?? true,
      ...m,
    })),
  });

  describe("resolveTargetAgents", () => {
    it("should route to explicitly mentioned agents", () => {
      const channel = createMockChannel([
        { agentId: "coder", listeningMode: "mention-only" },
        { agentId: "reviewer", listeningMode: "mention-only" },
      ]);

      const result = resolveTargetAgents({
        channelId: "test",
        message: "@agent:coder help me",
        authorId: "user123",
        authorType: "user",
        channel,
      });

      expect(result.respondingAgents).toContain("coder");
      expect(result.respondingAgents).not.toContain("reviewer");
      expect(result.reason).toBe("explicit_mention");
    });

    it("should route broadcast to all agents with receiveBroadcasts", () => {
      const channel = createMockChannel([
        { agentId: "coder", listeningMode: "mention-only", receiveBroadcasts: true },
        { agentId: "reviewer", listeningMode: "mention-only", receiveBroadcasts: true },
        { agentId: "observer", listeningMode: "observer" },
      ]);

      const result = resolveTargetAgents({
        channelId: "test",
        message: "@all what do you think?",
        authorId: "user123",
        authorType: "user",
        channel,
      });

      expect(result.respondingAgents).toContain("coder");
      expect(result.respondingAgents).toContain("reviewer");
      expect(result.respondingAgents).not.toContain("observer");
      expect(result.isBroadcast).toBe(true);
    });

    it("should route to default agent when no mention", () => {
      const channel = createMockChannel(
        [
          { agentId: "coder", listeningMode: "mention-only" },
          { agentId: "default", listeningMode: "mention-only" },
        ],
        "default",
      );

      const result = resolveTargetAgents({
        channelId: "test",
        message: "Help me with this",
        authorId: "user123",
        authorType: "user",
        channel,
      });

      expect(result.respondingAgents).toContain("default");
      expect(result.reason).toBe("default_agent");
    });

    it("should route to active listeners when no mention or default", () => {
      const channel = createMockChannel([
        { agentId: "active1", listeningMode: "active" },
        { agentId: "active2", listeningMode: "active" },
        { agentId: "passive", listeningMode: "mention-only" },
      ]);

      const result = resolveTargetAgents({
        channelId: "test",
        message: "Hello",
        authorId: "user123",
        authorType: "user",
        channel,
      });

      expect(result.respondingAgents).toContain("active1");
      expect(result.respondingAgents).toContain("active2");
      expect(result.respondingAgents).not.toContain("passive");
      expect(result.reason).toBe("active_listeners");
    });

    it("should route to coordinator first", () => {
      const channel = createMockChannel([
        { agentId: "coordinator", listeningMode: "coordinator" },
        { agentId: "worker", listeningMode: "mention-only" },
      ]);

      const result = resolveTargetAgents({
        channelId: "test",
        message: "Help me",
        authorId: "user123",
        authorType: "user",
        channel,
      });

      expect(result.respondingAgents).toEqual(["coordinator"]);
      expect(result.reason).toBe("coordinator");
    });

    it("should exclude author from targets", () => {
      const channel = createMockChannel([
        { agentId: "agent1", listeningMode: "active" },
        { agentId: "agent2", listeningMode: "active" },
      ]);

      const result = resolveTargetAgents({
        channelId: "test",
        message: "Hello",
        authorId: "agent1",
        authorType: "agent",
        channel,
      });

      expect(result.respondingAgents).not.toContain("agent1");
      expect(result.respondingAgents).toContain("agent2");
    });

    it("should return no_target when no agents match", () => {
      const channel = createMockChannel([{ agentId: "observer", listeningMode: "observer" }]);

      const result = resolveTargetAgents({
        channelId: "test",
        message: "Hello",
        authorId: "user123",
        authorType: "user",
        channel,
      });

      expect(result.respondingAgents).toHaveLength(0);
      expect(result.reason).toBe("no_target");
    });

    it("should match pattern mentions to agent names", () => {
      const channel = createMockChannel([
        { agentId: "agent-coder", listeningMode: "mention-only", customName: "Coder" },
      ]);

      const agentNames = new Map([["agent-coder", "Coder"]]);

      const result = resolveTargetAgents({
        channelId: "test",
        message: "@Coder help",
        authorId: "user123",
        authorType: "user",
        channel,
        agentNames,
      });

      expect(result.respondingAgents).toContain("agent-coder");
      expect(result.reason).toBe("pattern_mention");
    });
  });

  describe("shouldAgentRespond", () => {
    it("should return true if agent is in respondingAgents", () => {
      const routing = {
        respondingAgents: ["coder", "reviewer"],
        observingAgents: [],
        isBroadcast: false,
        reason: "explicit_mention" as const,
        mentions: {
          explicitMentions: [],
          patternMentions: [],
          isBroadcast: false,
          strippedMessage: "",
          allMentions: [],
        },
      };

      expect(shouldAgentRespond("coder", routing)).toBe(true);
      expect(shouldAgentRespond("other", routing)).toBe(false);
    });
  });

  describe("shouldAgentObserve", () => {
    it("should return true if agent is in observingAgents or respondingAgents", () => {
      const routing = {
        respondingAgents: ["coder"],
        observingAgents: ["observer"],
        isBroadcast: false,
        reason: "explicit_mention" as const,
        mentions: {
          explicitMentions: [],
          patternMentions: [],
          isBroadcast: false,
          strippedMessage: "",
          allMentions: [],
        },
      };

      expect(shouldAgentObserve("coder", routing)).toBe(true);
      expect(shouldAgentObserve("observer", routing)).toBe(true);
      expect(shouldAgentObserve("other", routing)).toBe(false);
    });
  });

  describe("getResponsePriority", () => {
    it("should prioritize explicitly mentioned agents", () => {
      const routing = {
        respondingAgents: ["coder", "reviewer"],
        observingAgents: [],
        isBroadcast: false,
        reason: "explicit_mention" as const,
        mentions: {
          explicitMentions: ["coder", "reviewer"],
          patternMentions: [],
          isBroadcast: false,
          strippedMessage: "",
          allMentions: [],
        },
      };

      const members: AgentChannelMember[] = [
        { agentId: "coder", role: "member", listeningMode: "mention-only", joinedAt: 0 },
        { agentId: "reviewer", role: "admin", listeningMode: "mention-only", joinedAt: 0 },
      ];

      const coderPriority = getResponsePriority("coder", routing, members);
      const reviewerPriority = getResponsePriority("reviewer", routing, members);

      expect(coderPriority).toBeLessThan(reviewerPriority);
    });

    it("should return high priority for non-members", () => {
      const routing = {
        respondingAgents: [],
        observingAgents: [],
        isBroadcast: false,
        reason: "no_target" as const,
        mentions: {
          explicitMentions: [],
          patternMentions: [],
          isBroadcast: false,
          strippedMessage: "",
          allMentions: [],
        },
      };

      const priority = getResponsePriority("unknown", routing, []);
      expect(priority).toBe(999);
    });
  });

  describe("filterMessagesForAgent", () => {
    const createMessage = (content: string): ChannelMessage => ({
      id: "msg-1",
      channelId: "test",
      authorId: "user",
      authorType: "user",
      content,
      createdAt: Date.now(),
      seq: 1,
    });

    it("should return all messages for active agents", () => {
      const messages = [createMessage("Hello"), createMessage("World")];
      const member: AgentChannelMember = {
        agentId: "agent",
        role: "member",
        listeningMode: "active",
        joinedAt: 0,
      };

      const filtered = filterMessagesForAgent("agent", messages, member, new Map());
      expect(filtered).toHaveLength(2);
    });

    it("should filter messages for mention-only agents", () => {
      const messages = [
        createMessage("Hello"),
        createMessage("@agent:coder help"),
        createMessage("@all broadcast"),
      ];
      const member: AgentChannelMember = {
        agentId: "coder",
        role: "member",
        listeningMode: "mention-only",
        joinedAt: 0,
        receiveBroadcasts: true,
      };

      const filtered = filterMessagesForAgent("coder", messages, member, new Map());
      expect(filtered).toHaveLength(2);
    });

    it("should return all messages for observers", () => {
      const messages = [createMessage("Hello"), createMessage("World")];
      const member: AgentChannelMember = {
        agentId: "observer",
        role: "observer",
        listeningMode: "observer",
        joinedAt: 0,
      };

      const filtered = filterMessagesForAgent("observer", messages, member, new Map());
      expect(filtered).toHaveLength(2);
    });
  });
});
