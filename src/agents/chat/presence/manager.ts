/**
 * Presence manager for multi-agent chat system.
 * Uses Redis for real-time presence tracking with PostgreSQL for persistence.
 */

import { getChatDbClient, REDIS_KEYS, REDIS_TTL, toJsonb, fromJsonb } from "../db/client.js";

export type AgentStatus = "active" | "busy" | "away" | "offline";

export type AgentPresence = {
  agentId: string;
  channelId: string;
  status: AgentStatus;
  lastSeenAt: number;
  typingStartedAt?: number;
  customStatus?: string;
};

export type PresenceUpdate = {
  agentId: string;
  channelId: string;
  status: AgentStatus;
  customStatus?: string;
};

export type PresenceSnapshot = {
  channelId: string;
  presence: AgentPresence[];
  timestamp: number;
};

// In-memory cache for fast lookups (synced with Redis)
const presenceCache = new Map<string, AgentPresence>();
const CACHE_KEY = (agentId: string, channelId: string) => `${channelId}:${agentId}`;

// TTL constants
const PRESENCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes - consider away after this

/**
 * Update agent presence in a channel.
 */
export async function updatePresence(update: PresenceUpdate): Promise<AgentPresence> {
  const db = getChatDbClient();
  const now = Date.now();

  const presence: AgentPresence = {
    agentId: update.agentId,
    channelId: update.channelId,
    status: update.status,
    lastSeenAt: now,
    customStatus: update.customStatus,
  };

  // Update Redis (real-time)
  const redisKey = REDIS_KEYS.presence(update.agentId, update.channelId);
  await db.set(redisKey, toJsonb(presence), REDIS_TTL.presence);

  // Update local cache
  presenceCache.set(CACHE_KEY(update.agentId, update.channelId), presence);

  // Update PostgreSQL (persistence) - async, don't wait
  updatePresenceDb(presence).catch(() => {
    // Ignore DB errors for presence updates
  });

  // Publish presence update event
  await publishPresenceUpdate(presence);

  return presence;
}

/**
 * Get agent presence in a channel.
 */
export async function getPresence(
  agentId: string,
  channelId: string,
): Promise<AgentPresence | null> {
  // Check local cache first
  const cached = presenceCache.get(CACHE_KEY(agentId, channelId));
  if (cached && Date.now() - cached.lastSeenAt < PRESENCE_TTL_MS) {
    return cached;
  }

  // Check Redis
  const db = getChatDbClient();
  const redisKey = REDIS_KEYS.presence(agentId, channelId);
  const redisValue = await db.get(redisKey);

  if (redisValue) {
    const presence = fromJsonb<AgentPresence>(redisValue);
    if (presence) {
      presenceCache.set(CACHE_KEY(agentId, channelId), presence);
      return presence;
    }
  }

  // Check PostgreSQL
  const row = await db.queryOne<{
    agent_id: string;
    channel_id: string;
    status: string;
    last_seen_at: Date;
    typing_started_at: Date | null;
    custom_status: string | null;
  }>(`SELECT * FROM agent_presence WHERE agent_id = $1 AND channel_id = $2`, [agentId, channelId]);

  if (row) {
    const presence: AgentPresence = {
      agentId: row.agent_id,
      channelId: row.channel_id,
      status: row.status as AgentStatus,
      lastSeenAt: new Date(row.last_seen_at).getTime(),
      typingStartedAt: row.typing_started_at
        ? new Date(row.typing_started_at).getTime()
        : undefined,
      customStatus: row.custom_status ?? undefined,
    };

    // Cache it
    presenceCache.set(CACHE_KEY(agentId, channelId), presence);
    await db.set(redisKey, toJsonb(presence), REDIS_TTL.presence);

    return presence;
  }

  return null;
}

/**
 * Get all presence in a channel.
 */
export async function getChannelPresence(channelId: string): Promise<AgentPresence[]> {
  const db = getChatDbClient();

  // Get from PostgreSQL (most reliable for full list)
  const rows = await db.query<{
    agent_id: string;
    channel_id: string;
    status: string;
    last_seen_at: Date;
    typing_started_at: Date | null;
    custom_status: string | null;
  }>(`SELECT * FROM agent_presence WHERE channel_id = $1`, [channelId]);

  const presenceList: AgentPresence[] = [];
  const now = Date.now();

  for (const row of rows) {
    const lastSeenAt = new Date(row.last_seen_at).getTime();

    // Determine effective status based on last seen time
    let effectiveStatus = row.status as AgentStatus;
    if (effectiveStatus !== "offline") {
      if (now - lastSeenAt > PRESENCE_TTL_MS) {
        effectiveStatus = "offline";
      } else if (now - lastSeenAt > ACTIVE_THRESHOLD_MS) {
        effectiveStatus = "away";
      }
    }

    const presence: AgentPresence = {
      agentId: row.agent_id,
      channelId: row.channel_id,
      status: effectiveStatus,
      lastSeenAt,
      typingStartedAt: row.typing_started_at
        ? new Date(row.typing_started_at).getTime()
        : undefined,
      customStatus: row.custom_status ?? undefined,
    };

    presenceList.push(presence);

    // Update cache
    presenceCache.set(CACHE_KEY(row.agent_id, channelId), presence);
  }

  return presenceList;
}

/**
 * Set agent as active (heartbeat).
 */
export async function heartbeat(agentId: string, channelId: string): Promise<void> {
  const existing = await getPresence(agentId, channelId);
  const status = existing?.status ?? "active";

  await updatePresence({
    agentId,
    channelId,
    status: status === "offline" ? "active" : status,
    customStatus: existing?.customStatus,
  });
}

/**
 * Set agent as offline.
 */
export async function setOffline(agentId: string, channelId?: string): Promise<void> {
  const db = getChatDbClient();

  if (channelId) {
    await updatePresence({
      agentId,
      channelId,
      status: "offline",
    });
  } else {
    // Set offline in all channels
    const rows = await db.query<{ channel_id: string }>(
      `SELECT channel_id FROM agent_presence WHERE agent_id = $1`,
      [agentId],
    );

    for (const row of rows) {
      await updatePresence({
        agentId,
        channelId: row.channel_id,
        status: "offline",
      });
    }
  }
}

/**
 * Get online agents in a channel.
 */
export async function getOnlineAgents(channelId: string): Promise<string[]> {
  const presence = await getChannelPresence(channelId);
  return presence.filter((p) => p.status !== "offline").map((p) => p.agentId);
}

/**
 * Check if an agent is online.
 */
export async function isOnline(agentId: string, channelId: string): Promise<boolean> {
  const presence = await getPresence(agentId, channelId);
  return presence !== null && presence.status !== "offline";
}

/**
 * Get presence snapshot for a channel.
 */
export async function getPresenceSnapshot(channelId: string): Promise<PresenceSnapshot> {
  const presence = await getChannelPresence(channelId);
  return {
    channelId,
    presence,
    timestamp: Date.now(),
  };
}

// Internal helpers
async function updatePresenceDb(presence: AgentPresence): Promise<void> {
  const db = getChatDbClient();

  await db.execute(
    `INSERT INTO agent_presence (agent_id, channel_id, status, last_seen_at, typing_started_at, custom_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (agent_id, channel_id) DO UPDATE SET
       status = EXCLUDED.status,
       last_seen_at = EXCLUDED.last_seen_at,
       typing_started_at = EXCLUDED.typing_started_at,
       custom_status = EXCLUDED.custom_status`,
    [
      presence.agentId,
      presence.channelId,
      presence.status,
      new Date(presence.lastSeenAt),
      presence.typingStartedAt ? new Date(presence.typingStartedAt) : null,
      presence.customStatus ?? null,
    ],
  );

  // Also record in presence history for analytics
  await db.execute(
    `INSERT INTO presence_history (agent_id, channel_id, status, recorded_at)
     VALUES ($1, $2, $3, NOW())`,
    [presence.agentId, presence.channelId, presence.status],
  );
}

async function publishPresenceUpdate(presence: AgentPresence): Promise<void> {
  const db = getChatDbClient();
  const channel = REDIS_KEYS.pubsubChannel(presence.channelId);

  await db.publish(
    channel,
    toJsonb({
      type: "presence.update",
      data: presence,
      timestamp: Date.now(),
    }),
  );
}

/**
 * Clean up stale presence entries.
 * Run periodically to remove entries for agents that haven't been seen.
 */
export async function cleanupStalePresence(): Promise<number> {
  const db = getChatDbClient();
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);

  // Mark as offline in PostgreSQL
  const result = await db.execute(
    `UPDATE agent_presence SET status = 'offline' WHERE last_seen_at < $1 AND status != 'offline'`,
    [cutoff],
  );

  // Clear from local cache
  const now = Date.now();
  for (const [key, presence] of presenceCache) {
    if (now - presence.lastSeenAt > PRESENCE_TTL_MS) {
      presenceCache.delete(key);
    }
  }

  return result.rowCount;
}

/**
 * Subscribe to presence updates for a channel.
 */
export async function subscribeToPresence(
  channelId: string,
  handler: (presence: AgentPresence) => void,
): Promise<() => Promise<void>> {
  const db = getChatDbClient();
  const channel = REDIS_KEYS.pubsubChannel(channelId);

  await db.subscribe(channel, (message) => {
    try {
      const event = fromJsonb<{ type: string; data: AgentPresence }>(message);
      if (event?.type === "presence.update") {
        handler(event.data);
      }
    } catch {
      // Ignore invalid messages
    }
  });

  return async () => {
    await db.unsubscribe(channel);
  };
}
