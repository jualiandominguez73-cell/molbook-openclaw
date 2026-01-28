# Evolution Queue

> Liam: Propose improvements here. Simon reviews and implements approved items.

## How to Submit

**REQUIRED: Verify before submitting.** Run verification command, paste output as evidence.

```
### [YYYY-MM-DD-NNN] Short title
- **Proposed by:** Liam
- **Date:** YYYY-MM-DD
- **Category:** behavior | identity | rules | tools | memory | showcase-idea
- **Target file:** (which file would change, or "new skill")
- **Verified:** [YES - ran grep/command] or [N/A - new feature]
- **Evidence:** `[paste command output showing issue exists]`
- **Description:** What to change and why
- **Status:** pending
```

**Verification commands:**
- "Missing from file X": `grep -n "[feature]" ~/clawd/[file].md`
- "Tool broken": `which [tool] && [tool] --help`
- "Cron failing": `clawdbot cron list | grep [job]`

**RULE:** If grep FINDS the feature, DO NOT create the entry (it's a ghost bug).

**IMPORTANT:** ALL entries (including external reports from Simon/Telegram) should be verified before implementation. Don't assume external reports are accurate - always verify with commands first.

## Pending

### [2026-02-10-042] Debug Mode Frequency Reversion (SCHEDULED)
- **Proposed by:** Cursor (via debug mode plan)
- **Date:** 2026-01-28
- **Category:** config
- **Target file:** `~/.clawdbot/cron/jobs.json`, `~/clawd/HEARTBEAT.md`
- **Verified:** N/A - scheduled future task
- **Scheduled for:** 2026-02-10
- **Description:**
  - **Purpose:** Revert debug mode frequencies back to normal after 2-week development period
  - **Actions required on 2026-02-10:**
    1. Delete or disable `Evening-Self-Audit` cron job
    2. Delete or disable `Model-Health-Check` cron job
    3. Change `self-evaluation` schedule from `0 3 * * 0,3` to `0 3 * * 0` (Sunday only)
    4. Change `Queue-Cleanup` schedule from `0 20 * * 0,3` to `0 20 * * 0` (Sunday only)
    5. Update HEARTBEAT.md to remove Debug Mode section
    6. Update METRICS.md frequency from daily to weekly
  - **Verification:** Run `clawdbot cron list` to confirm schedules reverted
- **Status:** pending (scheduled for 2026-02-10)

### [2026-01-28-040] File Verification Protocol for Status Requests
- **Proposed by:** Cursor (via comorbidity analysis)
- **Date:** 2026-01-28
- **Category:** behavior
- **Target file:** `SOUL.md`
- **Verified:** YES - Discord Liam hallucinated "Evolution Queue: Empty" when 2 items existed
- **Description:**
  - **Problem:** When asked for status/sitrep, agents guess file contents instead of reading them
  - **Observed:** Discord Liam reported "Evolution Queue: Empty / Clear" without using read tool
  - **Impact:** Medium - Causes incorrect status reports and user frustration
  - **Proposed addition to SOUL.md:**
    ```
    ## File Verification Protocol
    When asked for status, sitrep, or project list:
    1. ALWAYS use read tool to check tracking files FIRST
    2. Files to verify: EVOLUTION-QUEUE.md, progress/, MEMORY.md
    3. Never guess file contents - verify with read tool
    4. Anti-pattern: "No active projects" without checking files
    ```
- **Status:** pending

### [2026-01-28-041] Cursor-Liam Bidirectional Communication Protocol
- **Proposed by:** Cursor (via automation plan)
- **Date:** 2026-01-28
- **Category:** behavior | rules
- **Target file:** `SOUL.md`
- **Verified:** N/A - new feature proposal
- **Description:**
  - **Problem:** No bidirectional feedback loop between Cursor and Liam. When Cursor resolves Evolution Queue items, Liam has no way to know without re-reading the entire queue.
  - **Current state:** Liam writes to EVOLUTION-QUEUE.md → Simon reviews → Cursor implements → Manual marking as resolved
  - **Gap:** Liam may cite stale "pending" entries as blockers (documented issue)
  - **Solution implemented:**
    1. Created `~/clawd/CURSOR-RESOLUTIONS.md` for Cursor to log resolutions
    2. Created `~/clawd/scripts/queue-cleanup.sh` for automated detection
    3. Enhanced `~/clawd/scripts/self-audit.sh` with queue integrity checks
    4. Added `Queue-Cleanup` cron job (weekly Sunday 8 PM)
    5. Added "Cursor Resolutions Acknowledgment" section to HEARTBEAT.md
  - **Proposed SOUL.md addition:**
    ```
    ## Cursor-Liam Communication Protocol
    - Read CURSOR-RESOLUTIONS.md during heartbeats for recent fixes
    - Acknowledge resolutions by adding timestamp to acknowledgment log
    - Run queue-cleanup.sh weekly to detect stale/resolved entries
    - Never cite Evolution Queue entries as blockers without verification
    ```
- **Status:** pending

### [2026-01-27-038] Telegram Multi-Message Split Formatting - Weird Spaces
- **Proposed by:** Simon (via Telegram)
- **Date:** 2026-01-27
- **Category:** behavior | tools
- **Target file:** Unknown (likely Telegram channel adapter or message chunking logic)
- **Verified:** N/A - formatting issue observed by user, not file-based
- **Description:**
  - **Problem:** Long responses that get split into multiple Telegram messages have weird spacing
  - **Symptoms:** Text is hard to read due to irregular spacing patterns at split points
  - **Scope:** ONLY affects Telegram (Discord not affected)
  - **Trigger condition:** Only happens on long messages that come in as multiple messages
  - **Impact:** Low - not critical, but degrades readability on long responses
  - **Root cause (suspected):** Telegram message chunking/splitting logic adding extra spaces or newlines at split boundaries
  - **Questions needing investigation:**
    1. How does Clawdbot split long messages for Telegram? (character limit?)
    2. Is there whitespace being added at split points?
    3. Does this happen at specific split patterns (paragraph breaks, list items, code blocks)?
    4. Can chunking logic be adjusted to avoid orphaned spaces?
- **Status:** pending

### [2026-01-26-023] Improve Fallback Logic for Network Errors
- **Proposed by:** Bug-comorbidity analysis
- **Date:** 2026-01-26
- **Category:** tools
- **Target file:** `src/agents/model-fallback.ts`, `src/agents/failover-error.ts`
- **Description:** The model fallback logic doesn't recognize `TypeError: fetch failed` as a failover-worthy error. When ZAI API fails with network errors, it crashes instead of trying the Ollama fallback. The `coerceToFailoverError` function only handles: rate limit, auth, billing, timeout, format errors — but NOT generic network failures.
- **Impact:** Medium - Gateway crashes instead of gracefully falling back
- **Suggested fix:** Add network error patterns (`fetch failed`, `ECONNREFUSED`, `ENOTFOUND`) to the failover classification
- **Status:** PAUSED (2026-01-26) - needs more research into Clawdbot core architecture before implementation

### [2026-01-25-019] Digital Download Business Research & Strategy
- **Proposed by:** Simon (via Slack)
- **Date:** 2026-01-25
- **Category:** showcase-idea
- **Target file:** ~/clawd/plans/digital-download-business-iteration2.md (reference)
- **Description:** Simon requested research and brainstorming of digital download business ideas as a second source of income. Conducted 2 iterations of research following APEX v4.4.1 standards. Delivered comprehensive analysis with 7+ business ideas, competitor research, pricing strategies, go-to-market plans, and validation experiments. Top 3 recommendations: (1) LMS Analytics Templates Vault ($800K-1.2M/mo potential, 9-week timeline, leverages Simon's LMS experience), (2) AI-Powered Data Analysis Accelerator ($1.5M-3M/mo, 9-week timeline, fits Simon's core skills), (3) Ceramics Business Intelligence Dashboard ($300K-600K/mo, 10-week timeline, sustainable niche with Instagram integration). Research includes competitor analysis, pricing benchmarks, technical feasibility, and validation experiments for each concept.
- **Impact:** High - Provides actionable path to secondary income, leverages Simon's domain expertise (LMS, data analytics, ceramics)
- **Solution:** Full research documented in iteration files; requires Simon's decision on which concept(s) to pursue; implementation can proceed once concept selected
- **Status:** PAUSED per Simon's request (2026-01-25)

### [2026-01-25-018] Edison Learning Operations Job Opportunity Tracking
- **Proposed by:** Simon (via email)
- **Date:** 2026-01-25
- **Category:** memory
- **Target file:** MEMORY.md
- **Description:** Simon interviewed for "EDISON Learning Operations Senior Specialist" position on Friday, Jan 23, 2026. He forwarded the job posting PDF via email to me. Given his background in Learning Management Systems (Capital Group: Talent Development Associate, 8,000+ associates trained; Southern California Edison: LMS admin, SAP SuccessFactors; PIMCO: LMS coordinator, Cornerstone CSOD), this role aligns with his expertise. Need to track this opportunity, research EDISON company, prepare for follow-up, and document interview learnings.
- **Impact:** Medium - Career advancement opportunity aligned with Simon's LMS expertise
- **Solution:** Track application status, research EDISON company details (size, products, clients, tech stack), prepare potential interview questions, monitor email for follow-up, document interview outcomes and learnings
- **Status:** PAUSED (2026-01-26) - per Simon's request

### [2026-01-25-016] PuenteWorks Documentation Import
- **Proposed by:** Simon (via email)
- **Date:** 2026-01-25
- **Category:** memory
- **Target file:** MEMORY.md and memory/*.md
- **Description:** Simon has PuenteWorks documentation on his original Mac that he wants to import into my memory. The documentation is in his old Claude account. Need to download and ingest this information to understand PuenteWorks better - its products, services, history, clients, processes, and vision.
- **Impact:** High - Critical context for supporting Simon's business
- **Solution:** Simon retrieves documentation from Mac/Claude account → Liam ingests and processes → Updates MEMORY.md with PuenteWorks knowledge → Enables better business support
- **Status:** pending - waiting for Simon to provide files

### [2026-01-25-003] Instagram Intelligence Deployment
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New skill deployment
- **Description:** Built overnight build (Instagram Intelligence Suite) with scripts for API-based scraping, image download, AI analysis, insights generation, and reporting. Currently awaiting Simon's Instagram Basic Display API access token. Once deployed, will provide automated monitoring of @cerafica_design for new posts, sales announcements, and show dates.
- **Impact:** High - Proactive business intelligence for Simon's ceramics business
- **Solution:** Simon obtains API token → Install scripts to system PATH → Set up cron job → Create Slack alerting
- **Status:** pending (postponed by Simon)

### [2026-01-25-007] Low-Friction Capture Methods
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New capabilities
- **Description:** NeuroSecond requires <2 second capture. Voice capture available via Kroko.AI (Port 6006). Need text capture methods: Telegram natural language capture (Liam recognizes capture intent), email-to-capture (clawdbot@puenteworks.com). No special commands needed - Liam recognizes phrases like "remind me to...", "idea:", "note to self:", etc.
- **Impact:** High - Critical for NeuroSecond methodology
- **Solution:** Natural language capture recognition in Liam's SOUL.md, email parsing
- **Status:** IN PROGRESS - Being implemented via natural-capture skill

### [2026-01-25-010] Automated Summarization for NeuroSecond "Distill"
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New capability
- **Description:** NeuroSecond "Distill" stage needs: on-demand note summarization, automatic action item extraction, connection finding between notes, weekly review generation. Should leverage AI to surface insights and reduce cognitive load.
- **Impact:** Medium - Reduces manual review burden
- **Solution:** Build summarization pipeline, action item extraction, connection detection, weekly review generator
- **Status:** pending

### [2026-01-25-012] Automated Testing for Overnight Builds
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** Overnight build process
- **Description:** Currently manual testing of overnight builds. Every overnight project should include test.sh script. Need automated testing before delivery to Simon, with test coverage reports. Ensures quality and reduces broken deliveries.
- **Impact:** Medium - Improves overnight build reliability
- **Solution:** Add test.sh to all templates, automated testing pipeline, coverage reports
- **Status:** pending

### [2026-01-27-035] Add test.sh Template to Overnight Build Process
- **Proposed by:** Liam (self-audit)
- **Date:** 2026-01-27
- **Category:** behavior | tools
- **Target file:** Overnight build template/process (new skill template or OVERNIGHT-BUILDS.md)
- **Description:**
  - **Problem:** Self-audit found regression guard gap — not consistently running tests before/after code changes
  - **APEX violation:** Point One requires "Test before/after delivery" but this isn't systematic in overnight builds
  - **Impact:** Medium - Risk of delivering broken code, requires manual fixes after Simon discovers issues
  - **Root cause:** EF Coaching at Scale was built without tests (later fixed per ticket 027), but other projects don't have test.sh
  - **Proposed solution:**
    1. Create test.sh template for skill builds (file structure, syntax, basic functionality)
    2. Add automated test requirement to overnight build process
    3. Test results must pass before announcing "complete"
    4. Cover: structure validation, syntax checks, DB initialization, module imports
  - **Rationale:** APEX v6.2.0 Quality Gate — prevent regression, ensure quality before delivery
- **Status:** pending

## Approved

*(No approved items pending implementation)*

## Implemented

### [2026-01-25-001] Enable Memory Search for Semantic Recall
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Configured local Ollama embeddings using `nomic-embed-text` via OpenAI-compatible API. Updated `clawdbot.json` and `STATUS.md`.

### [2026-01-25-005] Enhanced Calendar with Preparation Reminders
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Updated `HEARTBEAT.md` with 24h alerts, 2h reminders, post-meeting summaries, and conflict detection.

### [2026-01-25-006] PARA Task Management Integration
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Created `para-tasks` skill with SQLite backend (`para.sqlite`) and Python-based CRUD scripts.

### [2026-01-25-008] Context Cue System for ADHD Support
- **Implemented:** 2026-01-25
- **Category:** behavior
- **Solution:** Created `liam-cue` command and updated `HEARTBEAT.md` to proactively surface context and next actions.

### [2026-01-25-009] Visual Timer Integration for Time Blindness
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Created `visual-timer` skill wrapping Clawdbot's cron system for Slack-based timers.

### [2026-01-25-013-015] System Health & Self-Diagnostics Suite
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Enhanced `health-check.sh` with auto-fix flag, added daily `Liam-Self-Diagnostics` cron job.

### [2026-01-25-004] GitHub PR/Issue Monitoring Integration
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** GitHub CLI (`gh`) authenticated as Pastorsimon1798 with full scopes (gist, read:org, repo, workflow). Ready for monitoring integration.

## Rejected

(Declined with reason)
