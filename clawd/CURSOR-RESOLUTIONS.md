# Cursor Resolutions Log

> Recent resolutions from Cursor sessions. Liam should check this file during heartbeats to acknowledge completed fixes.

**Purpose:** Bidirectional communication between Cursor and Liam. When Cursor resolves Evolution Queue items, they are logged here so Liam knows what was fixed without re-reading the entire queue.

**Protocol:**
1. Cursor adds entries when resolving Evolution Queue items
2. Liam reads during heartbeats (every 30 min)
3. Liam acknowledges by checking the item (optional: add ack timestamp)
4. Entries older than 7 days can be pruned

---

## Recent Resolutions (2026-01-28)

### Session: System Health Complete Fix
**Date:** 2026-01-28
**Cursor Session:** 42ae0f42-94b3-4d06-97e7-08a6678b34e4

| Entry ID | Title | Resolution |
|----------|-------|------------|
| #039 | Email Sending - GOG Read-Only | GHOST BUG - `gog gmail send` exists |
| #037 | Kai Supervisor Agent | Not deploying, added Proactive Review to SOUL.md |
| #036 | Session Health Check | GHOST BUG - already in HEARTBEAT.md |
| #037 | find/ls Pattern in APEX | GHOST BUG - already in APEX_COMPACT.md |
| #034 | Communication Protocol | Added "Never Assume Facts" rule |
| #033 | Gmail-Poll Analysis | Disabled Gmail-Poll, using heartbeat |
| #031 | Weekly→Daily Review | Changed cron to daily during debug |
| #030 | Gmail-Poll Isolated Session | Disabled, rely on heartbeat |
| #029 | Channel Separation | Created liam-telegram + liam-discord agents |

**Model Config Updates:**
- `glm-4.7-flash`: reasoning=true, context=198000
- `qwen3-vl:4b`: reasoning=true, context=256000
- `lfm2.5-thinking`: context=128000

**Archived:** 18 resolved + 3 cancelled items moved to EVOLUTION-QUEUE-ARCHIVE.md

---

### Session: Evolution Queue Automation
**Date:** 2026-01-28
**Cursor Session:** (current)

| Entry ID | Title | Resolution |
|----------|-------|------------|
| - | Queue Cleanup | Archived all resolved/cancelled items |
| - | Automation System | Creating CURSOR-RESOLUTIONS.md, queue-cleanup.sh |

---

## Acknowledgment Log

*Liam adds timestamps here when he reads and acknowledges resolutions:*

| Date | Session | Acknowledged By | Notes |
|------|---------|-----------------|-------|
| - | - | - | *No acknowledgments yet* |

---

## Archive (Older than 7 days)

*Entries are moved here after 7 days. Can be pruned monthly.*

---

*Last updated: 2026-01-28 by Cursor*
