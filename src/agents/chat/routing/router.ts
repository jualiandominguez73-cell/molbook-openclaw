/**
 * Message router for multi-agent chat system.
 * Determines which agents should receive and respond to messages.
 */

import type { AgentChannel, AgentChannelMember, AgentListeningMode } from "../types/channels.js";
import type { ChannelMessage } from "../types/messages.js";
import { type MentionParseResult, matchPatternMentions, parseMentions } from "./mention-parser.js";

export type RoutingDecision = {
  /** Agents that should respond to the message */
  respondingAgents: string[];
  /** Agents that should observe (receive but not respond) */
  observingAgents: string[];
  /** Whether this is a broadcast message */
  isBroadcast: boolean;
  /** Reason for routing decision */
  reason: RoutingReason;
  /** Parsed mentions from the message */
  mentions: MentionParseResult;
};

export type RoutingReason =
  | "explicit_mention" // @agent:id mentioned
  | "pattern_mention" // @AgentName matched
  | "broadcast" // @all/@channel/@here
  | "default_agent" // No mention, routed to default agent
  | "active_listeners" // No mention, routed to agents with mode=active
  | "coordinator" // Routed via coordinator agent
  | "no_target"; // No agents to route to

export type RoutingContext = {
  channelId: string;
  message: string;
  authorId: string;
  authorType: "agent" | "user" | "system" | "external";
  threadId?: string;
  channel?: AgentChannel;
  agentNames?: Map<string, string>; // agentId -> displayName
};

/**
 * Resolve which agents should receive a message.
 */
export function resolveTargetAgents(ctx: RoutingContext): RoutingDecision {
  const mentions = parseMentions(ctx.message);
  const members = ctx.channel?.members ?? [];

  // Get agent names for pattern matching
  const agentNames = ctx.agentNames ?? buildAgentNameMap(members);

  // Filter out the author from potential targets
  const eligibleMembers = members.filter((m) => m.agentId !== ctx.authorId);

  // 1. Check for explicit mentions (@agent:id)
  if (mentions.explicitMentions.length > 0) {
    return routeToExplicitMentions(mentions, eligibleMembers);
  }

  // 2. Check for broadcast mentions (@all, @channel, @here)
  if (mentions.isBroadcast) {
    return routeToBroadcast(mentions, eligibleMembers);
  }

  // 3. Check for pattern mentions (@AgentName)
  if (mentions.patternMentions.length > 0) {
    const patternMatches = matchPatternMentions(mentions.patternMentions, agentNames);
    if (patternMatches.size > 0) {
      return routeToPatternMentions(mentions, patternMatches, eligibleMembers);
    }
  }

  // 4. Check for coordinator agents
  const coordinators = eligibleMembers.filter((m) => m.listeningMode === "coordinator");
  if (coordinators.length > 0) {
    return routeToCoordinator(mentions, coordinators, eligibleMembers);
  }

  // 5. Route to default agent if set
  if (ctx.channel?.defaultAgentId) {
    const defaultMember = eligibleMembers.find((m) => m.agentId === ctx.channel?.defaultAgentId);
    if (defaultMember) {
      return routeToDefaultAgent(mentions, defaultMember, eligibleMembers);
    }
  }

  // 6. Route to active listeners
  const activeListeners = eligibleMembers.filter((m) => m.listeningMode === "active");
  if (activeListeners.length > 0) {
    return routeToActiveListeners(mentions, activeListeners, eligibleMembers);
  }

  // 7. No target found
  return {
    respondingAgents: [],
    observingAgents: getObservers(eligibleMembers),
    isBroadcast: false,
    reason: "no_target",
    mentions,
  };
}

function routeToExplicitMentions(
  mentions: MentionParseResult,
  members: AgentChannelMember[],
): RoutingDecision {
  const memberSet = new Set(members.map((m) => m.agentId));
  const respondingAgents = mentions.explicitMentions.filter((id) => memberSet.has(id));

  return {
    respondingAgents,
    observingAgents: getObservers(members, respondingAgents),
    isBroadcast: false,
    reason: "explicit_mention",
    mentions,
  };
}

function routeToBroadcast(
  mentions: MentionParseResult,
  members: AgentChannelMember[],
): RoutingDecision {
  // All agents that can receive broadcasts (not observers)
  const respondingAgents = members
    .filter((m) => m.listeningMode !== "observer" && m.receiveBroadcasts !== false)
    .map((m) => m.agentId);

  return {
    respondingAgents,
    observingAgents: getObservers(members, respondingAgents),
    isBroadcast: true,
    reason: "broadcast",
    mentions,
  };
}

function routeToPatternMentions(
  mentions: MentionParseResult,
  patternMatches: Map<string, string>,
  members: AgentChannelMember[],
): RoutingDecision {
  const memberSet = new Set(members.map((m) => m.agentId));
  const respondingAgents = [...patternMatches.values()].filter((id) => memberSet.has(id));

  return {
    respondingAgents,
    observingAgents: getObservers(members, respondingAgents),
    isBroadcast: false,
    reason: "pattern_mention",
    mentions,
  };
}

function routeToCoordinator(
  mentions: MentionParseResult,
  coordinators: AgentChannelMember[],
  members: AgentChannelMember[],
): RoutingDecision {
  // Route to the first coordinator
  const coordinatorId = coordinators[0].agentId;

  return {
    respondingAgents: [coordinatorId],
    observingAgents: getObservers(members, [coordinatorId]),
    isBroadcast: false,
    reason: "coordinator",
    mentions,
  };
}

function routeToDefaultAgent(
  mentions: MentionParseResult,
  defaultMember: AgentChannelMember,
  members: AgentChannelMember[],
): RoutingDecision {
  return {
    respondingAgents: [defaultMember.agentId],
    observingAgents: getObservers(members, [defaultMember.agentId]),
    isBroadcast: false,
    reason: "default_agent",
    mentions,
  };
}

function routeToActiveListeners(
  mentions: MentionParseResult,
  activeListeners: AgentChannelMember[],
  members: AgentChannelMember[],
): RoutingDecision {
  const respondingAgents = activeListeners.map((m) => m.agentId);

  return {
    respondingAgents,
    observingAgents: getObservers(members, respondingAgents),
    isBroadcast: false,
    reason: "active_listeners",
    mentions,
  };
}

function getObservers(members: AgentChannelMember[], excludeIds: string[] = []): string[] {
  const excludeSet = new Set(excludeIds);
  return members
    .filter((m) => m.listeningMode === "observer" && !excludeSet.has(m.agentId))
    .map((m) => m.agentId);
}

function buildAgentNameMap(members: AgentChannelMember[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    // Use custom name if available, otherwise use agentId
    map.set(member.agentId, member.customName ?? member.agentId);
  }
  return map;
}

/**
 * Check if an agent should respond to a message based on routing.
 */
export function shouldAgentRespond(agentId: string, routing: RoutingDecision): boolean {
  return routing.respondingAgents.includes(agentId);
}

/**
 * Check if an agent should observe (receive but not respond) a message.
 */
export function shouldAgentObserve(agentId: string, routing: RoutingDecision): boolean {
  return routing.observingAgents.includes(agentId) || routing.respondingAgents.includes(agentId);
}

/**
 * Get priority order for responding agents.
 * Higher priority agents respond first in sequential modes.
 */
export function getResponsePriority(
  agentId: string,
  routing: RoutingDecision,
  members: AgentChannelMember[],
): number {
  const member = members.find((m) => m.agentId === agentId);
  if (!member) {
    return 999;
  }

  // Priority based on role
  const rolePriority: Record<AgentChannelMember["role"], number> = {
    owner: 0,
    admin: 1,
    member: 2,
    observer: 3,
  };

  // Priority based on listening mode
  const modePriority: Record<AgentListeningMode, number> = {
    coordinator: 0,
    active: 1,
    "mention-only": 2,
    observer: 3,
  };

  // Explicit mentions get highest priority
  const mentionIndex = routing.mentions.explicitMentions.indexOf(agentId);
  if (mentionIndex !== -1) {
    return mentionIndex;
  }

  return rolePriority[member.role] * 10 + modePriority[member.listeningMode];
}

/**
 * Filter messages for an agent based on their listening mode.
 */
export function filterMessagesForAgent(
  agentId: string,
  messages: ChannelMessage[],
  member: AgentChannelMember,
  agentNames: Map<string, string>,
): ChannelMessage[] {
  if (member.listeningMode === "active") {
    // Active agents see all messages
    return messages;
  }

  if (member.listeningMode === "observer") {
    // Observers see all but shouldn't respond
    return messages;
  }

  if (member.listeningMode === "mention-only") {
    // Only see messages where mentioned or broadcast
    return messages.filter((msg) => {
      const mentions = parseMentions(msg.content);

      // Check explicit mention
      if (mentions.explicitMentions.includes(agentId)) {
        return true;
      }

      // Check broadcast
      if (mentions.isBroadcast && member.receiveBroadcasts !== false) {
        return true;
      }

      // Check pattern mention
      const displayName = agentNames.get(agentId);
      if (displayName && mentions.patternMentions.length > 0) {
        const matches = matchPatternMentions(mentions.patternMentions, agentNames);
        if ([...matches.values()].includes(agentId)) {
          return true;
        }
      }

      return false;
    });
  }

  if (member.listeningMode === "coordinator") {
    // Coordinators see all messages to route them
    return messages;
  }

  return [];
}
