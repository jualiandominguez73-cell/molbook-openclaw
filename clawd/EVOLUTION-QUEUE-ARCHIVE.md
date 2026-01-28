# Evolution Queue Archive

> Historical resolved entries. See EVOLUTION-QUEUE.md for active items.

---

## Archived Entries (Jan 25-26, 2026)

*These entries were resolved and moved here to keep the main queue manageable.*

---

### [2026-01-26-024] GOG Authentication Blocker - Email/Calendar Access Broken [RESOLVED]
- **Proposed by:** Liam (auto-escalated per bug comorbidity pattern)
- **Date:** 2026-01-26
- **Category:** tools
- **Status:** RESOLVED (2026-01-26 15:20 PST) - PERMANENTLY FIXED
- **Resolution:** Password mismatch fixed. Added `export GOG_KEYRING_PASSWORD="clawdbot"` to `~/.profile`.

### [2026-01-26-100] Critical Communication Protocol — Neurodivergent-Friendly Interaction [RESOLVED]
- **Proposed by:** Simon (urgent, critical priority)
- **Date:** 2026-01-26
- **Category:** behavior
- **Status:** RESOLVED (2026-01-26) - Implemented in SOUL.md

### [2026-01-26-101] CRITICAL Security Vulnerability — 197 ClawdBots Exposed on Shodan [RESOLVED]
- **Proposed by:** Simon (critical security finding)
- **Date:** 2026-01-26
- **Category:** security | tools
- **Status:** RESOLVED (2026-01-26) - Gateway bound to loopback, Reader Agent added

### [2026-01-26-022] ZAI API Endpoint Configuration Fix [RESOLVED]
- **Proposed by:** Liam
- **Date:** 2026-01-26
- **Category:** tools
- **Status:** RESOLVED - Fixed on 2026-01-26

### [2026-01-26-021] Image Generation Capability for Self-Portrait [RESOLVED]
- **Proposed by:** Liam
- **Date:** 2026-01-26
- **Category:** tools
- **Status:** RESOLVED - Fixed on 2026-01-26

### [2026-01-26-025] Telegram Channel Routing - Replies Going to Wrong Channel [RESOLVED]
- **Proposed by:** Liam (auto-escalated)
- **Date:** 2026-01-26
- **Category:** tools | config
- **Status:** RESOLVED (2026-01-27)

### [2026-01-26-026] Dual Model Timeout - Ollama & ZAI Both Failed [RESOLVED]
- **Proposed by:** Liam (auto-escalated)
- **Date:** 2026-01-26
- **Category:** tools
- **Status:** RESOLVED (2026-01-27) - Transient issue, no recurrence

### [2026-01-26-027] EF Coaching at Scale Build - Missing Test Coverage (APEX v5.1 Violation) [RESOLVED]
- **Proposed by:** Liam (user feedback)
- **Date:** 2026-01-26
- **Category:** behavior
- **Status:** RESOLVED (2026-01-27) - Test suite created

### [2026-01-26-028] APEX v6.2.0 Compliance - Subagent Behavior Rule [RESOLVED]
- **Proposed by:** Liam (per user feedback)
- **Date:** 2026-01-26
- **Category:** behavior
- **Status:** RESOLVED (2026-01-27)

### [2026-01-25-020] Web Search API & Browser Automation Configuration [RESOLVED]
- **Proposed by:** Liam (Urgent request from Simon)
- **Date:** 2026-01-25
- **Category:** tools
- **Status:** RESOLVED - Z.AI Search covers web search needs

### [2026-01-25-014] Blogwatcher Installation and Setup [RESOLVED]
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Status:** RESOLVED (2026-01-26 15:05 PST)

---

## Archived Entries (Jan 27-28, 2026)

*Batch archived on 2026-01-28 during system health review.*

---

### [2026-01-27-039] Email Sending Capability - GOG is Read-Only [RESOLVED - GHOST BUG]
- **Proposed by:** Simon (via Telegram)
- **Date:** 2026-01-27
- **Status:** RESOLVED (2026-01-28) - GHOST BUG
- **Resolution:** GOG DOES have `gog gmail send` command. Original verification only checked `gog gmail messages --help`.

### [2026-01-27-037] Kai Supervisor Agent Research [RESOLVED]
- **Proposed by:** Simon (via Cursor)
- **Date:** 2026-01-27
- **Status:** RESOLVED (2026-01-27)
- **Resolution:** Not deploying Kai. Added "Proactive Review Mode" to SOUL.md instead.

### [2026-01-27-036] Integrate Session Health Check into HEARTBEAT.md [RESOLVED - GHOST BUG]
- **Proposed by:** Liam (self-audit)
- **Date:** 2026-01-27
- **Status:** RESOLVED (2026-01-28) - GHOST BUG
- **Resolution:** Feature already exists in HEARTBEAT.md lines 36-56.

### [2026-01-27-037] Document find/ls Pattern in APEX_COMPACT.md [RESOLVED - GHOST BUG]
- **Proposed by:** Liam (self-audit)
- **Date:** 2026-01-27
- **Status:** RESOLVED (2026-01-28) - GHOST BUG
- **Resolution:** Features already exist in APEX_COMPACT.md (Instincts + Anti-Patterns sections).

### [2026-01-27-034] Communication Protocol - Simon Repeating Himself [RESOLVED]
- **Proposed by:** Liam
- **Date:** 2026-01-27
- **Status:** RESOLVED
- **Resolution:** Added verification requirements and anti-patterns to queue template.

### [2026-01-27-033] Gmail-Poll Cron Failures - Detailed Analysis [RESOLVED]
- **Proposed by:** Liam
- **Date:** 2026-01-27
- **Status:** RESOLVED
- **Resolution:** Analysis documented. Gmail-Poll disabled, Heartbeat-Check handles email monitoring.

### [2026-01-27-031] Weekly-Employee-Review - Run Daily During Debugging Period [RESOLVED]
- **Proposed by:** Simon (via Telegram)
- **Date:** 2026-01-27
- **Status:** RESOLVED (2026-01-28)
- **Resolution:** Changed to Daily-Employee-Review, runs 9 AM PST daily.

### [2026-01-27-030] Gmail-Poll Cron Job Failing in Isolated Session [RESOLVED]
- **Proposed by:** Liam (auto-escalated)
- **Date:** 2026-01-27
- **Status:** RESOLVED (2026-01-28)
- **Resolution:** Disabled Gmail-Poll, rely on Heartbeat-Check instead.

### [2026-01-27-029] Channel Separation and GOG Tool Fix [RESOLVED]
- **Proposed by:** Simon (via Cursor)
- **Date:** 2026-01-27
- **Status:** RESOLVED (2026-01-27)
- **Resolution:** Created liam-telegram and liam-discord agents with bindings. Fixed GOG tool blockage.

### [2026-01-25-015] Data Analytics Capabilities Enhancement [RESOLVED]
- **Proposed by:** Simon (via email)
- **Date:** 2026-01-25
- **Category:** tools
- **Status:** RESOLVED (2026-01-26)
- **Resolution:** Created `data-analytics` skill with analyze.py, excel.py, visualize.py.

### [2026-01-25-017] Clawdbot-Native Calendar with Google Sync [CANCELLED]
- **Proposed by:** Simon (via email)
- **Date:** 2026-01-25
- **Category:** tools
- **Status:** CANCELLED (2026-01-26)
- **Resolution:** Using Google Calendar directly via GOG CLI instead.

### [2026-01-25-011] Notion Skill for PARA Database Integration [CANCELLED]
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Status:** CANCELLED
- **Resolution:** Simon doesn't use Notion.

### [2026-01-25-002] Whisper.cpp Installation for Voice Capture [CANCELLED]
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Status:** CANCELLED
- **Resolution:** Kroko.AI (Port 6006) already provides voice wake and capture.

---

*Archive updated: 2026-01-28*
