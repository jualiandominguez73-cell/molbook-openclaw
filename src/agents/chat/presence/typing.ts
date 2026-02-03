/**
 * Typing indicators for multi-agent chat system.
 * Uses Redis sorted sets for efficient tracking with automatic expiration.
 */

import { getChatDbClient, REDIS_KEYS, REDIS_TTL, toJsonb, fromJsonb } from "../db/client.js";

export type TypingIndicator = {
  agentId: string;
  channelId: string;
  startedAt: number;
  threadId?: string;
};

export type TypingState = {
  channelId: string;
  typing: TypingIndicator[];
  timestamp: number;
};

// Typing indicator TTL in milliseconds
const TYPING_TTL_MS = REDIS_TTL.typing * 1000; // 10 seconds

/**
 * Set typing indicator for an agent.
 */
export async function startTyping(
  agentId: string,
  channelId: string,
  threadId?: string,
): Promise<void> {
  const db = getChatDbClient();
  const now = Date.now();
  const typingKey = REDIS_KEYS.typing(channelId);

  // Use sorted set with timestamp as score for automatic ordering
  // Value includes threadId for thread-specific typing
  const value = threadId ? `${agentId}:${threadId}` : agentId;
  await db.zadd(typingKey, now, value);

  // Set key expiration
  await db.expire(typingKey, REDIS_TTL.typing * 2); // Extra buffer for cleanup

  // Publish typing event
  await publishTypingEvent(
    channelId,
    {
      agentId,
      channelId,
      startedAt: now,
      threadId,
    },
    true,
  );

  // Update presence typing timestamp
  await updatePresenceTyping(agentId, channelId, now);
}

/**
 * Clear typing indicator for an agent.
 */
export async function stopTyping(
  agentId: string,
  channelId: string,
  threadId?: string,
): Promise<void> {
  const db = getChatDbClient();
  const typingKey = REDIS_KEYS.typing(channelId);

  const value = threadId ? `${agentId}:${threadId}` : agentId;
  await db.zrem(typingKey, value);

  // Publish stop typing event
  await publishTypingEvent(
    channelId,
    {
      agentId,
      channelId,
      startedAt: 0,
      threadId,
    },
    false,
  );

  // Clear presence typing timestamp
  await updatePresenceTyping(agentId, channelId, null);
}

/**
 * Get all agents currently typing in a channel.
 */
export async function getTypingAgents(
  channelId: string,
  threadId?: string,
): Promise<TypingIndicator[]> {
  const db = getChatDbClient();
  const typingKey = REDIS_KEYS.typing(channelId);
  const now = Date.now();
  const cutoff = now - TYPING_TTL_MS;

  // Get all entries with score (timestamp) above cutoff
  const entries = await db.zrangebyscore(typingKey, cutoff, now);

  // Clean up expired entries
  await db.zremrangebyscore(typingKey, 0, cutoff - 1);

  const indicators: TypingIndicator[] = [];
  for (const entry of entries) {
    const [agentId, entryThreadId] = entry.split(":");

    // Filter by threadId if specified
    if (threadId !== undefined && entryThreadId !== threadId) {
      continue;
    }

    indicators.push({
      agentId,
      channelId,
      startedAt: now, // Approximate, actual timestamp is in sorted set score
      threadId: entryThreadId,
    });
  }

  return indicators;
}

/**
 * Get typing state for a channel.
 */
export async function getTypingState(channelId: string, threadId?: string): Promise<TypingState> {
  const typing = await getTypingAgents(channelId, threadId);
  return {
    channelId,
    typing,
    timestamp: Date.now(),
  };
}

/**
 * Check if an agent is currently typing.
 */
export async function isTyping(
  agentId: string,
  channelId: string,
  threadId?: string,
): Promise<boolean> {
  const typing = await getTypingAgents(channelId, threadId);
  return typing.some((t) => t.agentId === agentId);
}

/**
 * Format typing indicator text for display.
 * Returns text like "Agent A is typing..." or "Agent A, Agent B are typing..."
 */
export function formatTypingText(
  typing: TypingIndicator[],
  agentNames: Map<string, string>,
): string {
  if (typing.length === 0) {
    return "";
  }

  const names = typing.map((t) => agentNames.get(t.agentId) ?? t.agentId);

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }

  if (names.length === 3) {
    return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
  }

  // More than 3 agents
  const displayCount = 2;
  const remaining = names.length - displayCount;
  const displayNames = names.slice(0, displayCount).join(", ");
  return `${displayNames}, and ${remaining} more are typing...`;
}

/**
 * Subscribe to typing events for a channel.
 */
export async function subscribeToTyping(
  channelId: string,
  handler: (indicator: TypingIndicator, isTyping: boolean) => void,
): Promise<() => Promise<void>> {
  const db = getChatDbClient();
  const channel = REDIS_KEYS.pubsubChannel(channelId);

  await db.subscribe(channel, (message) => {
    try {
      const event = fromJsonb<{
        type: string;
        data: TypingIndicator;
        isTyping: boolean;
      }>(message);
      if (event?.type === "typing.update") {
        handler(event.data, event.isTyping);
      }
    } catch {
      // Ignore invalid messages
    }
  });

  return async () => {
    await db.unsubscribe(channel);
  };
}

// Internal helpers
async function publishTypingEvent(
  channelId: string,
  indicator: TypingIndicator,
  isTyping: boolean,
): Promise<void> {
  const db = getChatDbClient();
  const channel = REDIS_KEYS.pubsubChannel(channelId);

  await db.publish(
    channel,
    toJsonb({
      type: "typing.update",
      data: indicator,
      isTyping,
      timestamp: Date.now(),
    }),
  );
}

async function updatePresenceTyping(
  agentId: string,
  channelId: string,
  typingStartedAt: number | null,
): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `UPDATE agent_presence SET typing_started_at = $1 WHERE agent_id = $2 AND channel_id = $3`,
    [typingStartedAt ? new Date(typingStartedAt) : null, agentId, channelId],
  );
}

/**
 * Auto-expire typing indicator after sending a message.
 * Call this after an agent sends a message.
 */
export async function onMessageSent(
  agentId: string,
  channelId: string,
  threadId?: string,
): Promise<void> {
  await stopTyping(agentId, channelId, threadId);
}

/**
 * Refresh typing indicator (extend TTL).
 * Call this periodically while agent is still typing.
 */
export async function refreshTyping(
  agentId: string,
  channelId: string,
  threadId?: string,
): Promise<void> {
  await startTyping(agentId, channelId, threadId);
}
