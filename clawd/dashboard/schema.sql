-- Liam Dashboard Database Schema
-- Version: 1.0.0
-- Created: 2026-01-28

-- Enable WAL mode for concurrent access
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;

-- System metrics time series
CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    cpu_percent REAL NOT NULL,
    mem_percent REAL NOT NULL,
    mem_total_gb REAL NOT NULL,
    disk_percent REAL NOT NULL,
    disk_total TEXT NOT NULL,
    gateway_status TEXT NOT NULL,
    active_sessions INTEGER NOT NULL DEFAULT 0
);

-- Evolution Queue snapshots
CREATE TABLE IF NOT EXISTS queue_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    queue_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    section TEXT NOT NULL
);

-- Session activity log
CREATE TABLE IF NOT EXISTS session_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    agent_id TEXT NOT NULL,
    channel TEXT,
    session_key TEXT NOT NULL,
    updated_at TEXT
);

-- Agent activity log (real-time observability)
CREATE TABLE IF NOT EXISTS agent_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    run_id TEXT NOT NULL,
    session_key TEXT,
    stream TEXT NOT NULL,  -- lifecycle, tool, assistant, error
    event_type TEXT,       -- start, end, tool_call, result, thinking, etc.
    summary TEXT,
    raw_data TEXT          -- JSON blob for full event data
);

-- Liminal interactions tracking
CREATE TABLE IF NOT EXISTS liminal_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    interaction_type TEXT NOT NULL,  -- spinner, principles, reaction, etc.
    reaction TEXT,                  -- 👍 ❤️ 🔥 💀 🤔
    notes TEXT                      -- Additional context
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_queue_item_id ON queue_snapshots(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_session_agent ON session_activity(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON agent_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_run_id ON agent_activity(run_id);
