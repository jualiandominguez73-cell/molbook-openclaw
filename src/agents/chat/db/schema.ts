/**
 * PostgreSQL + TimescaleDB schema for multi-agent chat system.
 * Uses TimescaleDB for time-series data (messages, presence).
 * Uses Redis for real-time features (presence cache, typing indicators, pub/sub).
 */

export const SCHEMA_VERSION = 1;

/**
 * Core schema creation SQL for PostgreSQL with TimescaleDB extension.
 */
export const SCHEMA_SQL = `
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_meta (key, value) VALUES ('version', '${SCHEMA_VERSION}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Agent Channels
CREATE TABLE IF NOT EXISTS agent_channels (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('public', 'private', 'dm', 'broadcast')),
  name TEXT NOT NULL,
  topic TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  default_agent_id TEXT,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  archived_by TEXT,
  settings JSONB DEFAULT '{}',
  pinned_message_ids TEXT[] DEFAULT '{}',
  CONSTRAINT valid_name CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 100)
);

CREATE INDEX IF NOT EXISTS idx_channels_type ON agent_channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_name ON agent_channels(name);
CREATE INDEX IF NOT EXISTS idx_channels_created_at ON agent_channels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channels_archived ON agent_channels(archived) WHERE archived = FALSE;

-- Channel Members
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL REFERENCES agent_channels(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'observer')),
  listening_mode TEXT NOT NULL DEFAULT 'mention-only' CHECK (listening_mode IN ('active', 'mention-only', 'observer', 'coordinator')),
  receive_broadcasts BOOLEAN DEFAULT TRUE,
  custom_name TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted_until TIMESTAMPTZ,
  PRIMARY KEY (channel_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_members_agent ON channel_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_members_role ON channel_members(role);
CREATE INDEX IF NOT EXISTS idx_members_listening ON channel_members(listening_mode);

-- Channel Messages (TimescaleDB hypertable for time-series optimization)
CREATE TABLE IF NOT EXISTS channel_messages (
  id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('agent', 'user', 'system', 'external')),
  author_name TEXT,
  content TEXT NOT NULL,
  content_blocks JSONB,
  thread_id TEXT,
  parent_message_id TEXT,
  mentions JSONB,
  reactions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  seq BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}',
  external_source_id TEXT,
  external_platform TEXT,
  PRIMARY KEY (id, created_at)
);

-- Convert to TimescaleDB hypertable for efficient time-series queries
SELECT create_hypertable('channel_messages', 'created_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_messages_channel ON channel_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON channel_messages(thread_id, created_at DESC) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_author ON channel_messages(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_seq ON channel_messages(channel_id, seq DESC);
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON channel_messages USING gin(to_tsvector('english', content));

-- Enable compression for older data (messages older than 7 days)
SELECT add_compression_policy('channel_messages', INTERVAL '7 days', if_not_exists => TRUE);

-- Channel Threads
CREATE TABLE IF NOT EXISTS channel_threads (
  thread_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES agent_channels(id) ON DELETE CASCADE,
  parent_message_id TEXT NOT NULL,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_threads_channel ON channel_threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_threads_last_message ON channel_threads(last_message_at DESC);

-- Thread Subscribers
CREATE TABLE IF NOT EXISTS thread_subscribers (
  thread_id TEXT NOT NULL REFERENCES channel_threads(thread_id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  notification_level TEXT DEFAULT 'all' CHECK (notification_level IN ('all', 'mentions', 'none')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (thread_id, agent_id)
);

-- Agent Presence (TimescaleDB for historical tracking)
CREATE TABLE IF NOT EXISTS agent_presence (
  agent_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'busy', 'away', 'offline')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  typing_started_at TIMESTAMPTZ,
  custom_status TEXT,
  PRIMARY KEY (agent_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_status ON agent_presence(status);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON agent_presence(last_seen_at DESC);

-- Presence History (for analytics, using TimescaleDB)
CREATE TABLE IF NOT EXISTS presence_history (
  agent_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('presence_history', 'recorded_at',
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Enable compression for presence history (older than 1 day)
SELECT add_compression_policy('presence_history', INTERVAL '1 day', if_not_exists => TRUE);

-- Retention policy: drop presence history older than 30 days
SELECT add_retention_policy('presence_history', INTERVAL '30 days', if_not_exists => TRUE);

-- External Bindings
CREATE TABLE IF NOT EXISTS external_bindings (
  binding_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES agent_channels(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'discord', 'telegram')),
  external_account_id TEXT NOT NULL,
  external_target_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  sync_options JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enabled BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  sync_cursor TEXT,
  UNIQUE (channel_id, platform, external_target_id)
);

CREATE INDEX IF NOT EXISTS idx_bindings_channel ON external_bindings(channel_id);
CREATE INDEX IF NOT EXISTS idx_bindings_platform ON external_bindings(platform);
CREATE INDEX IF NOT EXISTS idx_bindings_enabled ON external_bindings(enabled) WHERE enabled = TRUE;

-- Collaboration Sessions
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  session_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES agent_channels(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('war-room', 'expert-panel', 'chain-of-thought', 'consensus', 'coordinator')),
  coordinator_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_collab_channel ON collaboration_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_collab_status ON collaboration_sessions(status) WHERE status = 'active';

-- Collaboration Participants
CREATE TABLE IF NOT EXISTS collaboration_participants (
  session_id TEXT NOT NULL REFERENCES collaboration_sessions(session_id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('coordinator', 'participant', 'observer')),
  expertise TEXT[],
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  contribution_count INTEGER DEFAULT 0,
  PRIMARY KEY (session_id, agent_id)
);

-- Message read receipts for tracking unread counts
CREATE TABLE IF NOT EXISTS message_read_receipts (
  channel_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  last_read_seq BIGINT NOT NULL DEFAULT 0,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel_id, agent_id)
);

-- Muted channels per agent
CREATE TABLE IF NOT EXISTS muted_channels (
  agent_id TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES agent_channels(id) ON DELETE CASCADE,
  muted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted_until TIMESTAMPTZ, -- NULL means indefinite
  PRIMARY KEY (agent_id, channel_id)
);

-- Functions for common operations

-- Function to get next sequence number for a channel
CREATE OR REPLACE FUNCTION get_next_message_seq(p_channel_id TEXT)
RETURNS BIGINT AS $$
DECLARE
  next_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(seq), 0) + 1 INTO next_seq
  FROM channel_messages
  WHERE channel_id = p_channel_id;
  RETURN next_seq;
END;
$$ LANGUAGE plpgsql;

-- Function to update thread message count
CREATE OR REPLACE FUNCTION update_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE channel_threads
    SET message_count = message_count + 1,
        last_message_at = NEW.created_at
    WHERE thread_id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update thread stats
DROP TRIGGER IF EXISTS trg_update_thread_stats ON channel_messages;
CREATE TRIGGER trg_update_thread_stats
  AFTER INSERT ON channel_messages
  FOR EACH ROW
  WHEN (NEW.thread_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_stats();

-- Continuous aggregate for message counts per channel per hour (analytics)
CREATE MATERIALIZED VIEW IF NOT EXISTS channel_message_stats_hourly
WITH (timescaledb.continuous) AS
SELECT
  channel_id,
  time_bucket('1 hour', created_at) AS bucket,
  COUNT(*) AS message_count,
  COUNT(DISTINCT author_id) AS unique_authors
FROM channel_messages
WHERE deleted_at IS NULL
GROUP BY channel_id, bucket
WITH NO DATA;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('channel_message_stats_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
`;

/**
 * Migration scripts for schema updates
 */
export const MIGRATIONS: Record<number, string> = {
  1: SCHEMA_SQL, // Initial schema
};

/**
 * SQL to check if schema needs initialization
 */
export const CHECK_SCHEMA_SQL = `
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'schema_meta'
);
`;

/**
 * SQL to get current schema version
 */
export const GET_VERSION_SQL = `
SELECT value FROM schema_meta WHERE key = 'version';
`;
