#!/usr/bin/env python3
"""Initialize the SQLite subscriptions database."""

import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "subscriptions.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    email TEXT,
    status TEXT DEFAULT 'inactive',
    current_period_end INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_id ON subscriptions(stripe_customer_id);
"""

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")

if __name__ == "__main__":
    init_db()
