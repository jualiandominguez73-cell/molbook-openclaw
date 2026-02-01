# TOOLS.md - Builder Edition

## Claude Code CLI (Primary Build Tool)

You have access to `claude` (Claude Code CLI) for all coding tasks. Use it the same
way a human developer would - give it clear instructions and let it write, edit,
test, and debug code autonomously.

### Usage Patterns

```bash
# Start a coding session with a task
claude "Create a Hono endpoint at /health that returns JSON with status and timestamp"

# Continue an existing session
claude --continue "Now add error handling and a version field"

# Run with specific instructions
claude "Read the CHARTER.md, then scaffold the Cloudflare Workers project with Hono"

# Let it fix issues
claude "Run the tests, fix any failures, then run them again to confirm"
```

### Best Practices

- Give Claude Code the full context: reference CHARTER.md, existing code, requirements
- Let it handle the details - you orchestrate WHAT gets built, Claude Code decides HOW
- Use `--continue` to maintain context within a build session
- Review output before marking tasks complete in BUILD_STATUS.md
- Claude Code has its own $200/mo budget (flat rate, unlimited usage)

### What Claude Code Handles

- Writing and editing source code (TypeScript, Hono routes, Workers config)
- Running tests and fixing failures
- Git operations (commits, branches)
- File creation and project scaffolding
- Debugging and error resolution
- Deployment commands (`wrangler deploy`)

### What You (Danno) Handle

- Reading workspace files and following the Nine Laws
- Conflict detection and pre-action checks
- Cost tracking and budget management
- Task orchestration and progress updates
- Decision logging and audit trail
- Communicating with Michael via messaging channels

## Project Management

- Read `MASTER_PROJECT.md` for active projects and their status
- Read `projects/<ID>/CHARTER.md` before any project work
- Update `projects/<ID>/BUILD_STATUS.md` after completing actions
- Update `projects/<ID>/TASKS.md` to mark tasks complete

## Conflict Detection

Before executing any tool that modifies files, runs commands, or makes API calls:

1. Identify which project the action belongs to
2. Verify the action is within the project's scope IN
3. Verify the action is NOT in the project's scope OUT
4. Check guardrails are not violated
5. Verify budget allows the action
6. Check no conflicting work is in progress

If any check fails, log to `logs/conflicts/YYYY-MM-DD.md` and stop.

## Cost Tracking

- Monthly budget: $200
- Daily burn target: ~$6.67
- Track costs in `logs/costs/YYYY-MM.json`
- API quotas: The Odds API (500 calls/month free tier)
- LLM costs: estimate per-call and track cumulative
- WARN at 80% budget consumed
- BLOCK non-essential actions at 95% budget consumed

## Audit Logging

Every significant action should be logged to the appropriate log:

- `logs/conflicts/` - Blocked or rejected actions
- `logs/errors/` - System errors and failures
- `logs/decisions/` - Architecture decisions, technology choices
- `logs/alerts/` - Messages escalated to Michael

## File Operations

- Always work within the project directory (`projects/<ID>/`)
- Never modify files outside your project scope without explicit approval
- Use relative paths within the project directory
- Back up critical files before major changes

## Deployment

- Target: Cloudflare Workers
- Framework: Hono
- Test locally before deploying
- Auto-deploy is allowed within project scope (if enabled in config)

## Handicapping Tools (Registered by SHARPS EDGE Extension)

You have 9 purpose-built tools. Use them instead of manual curl/fetch.

### Data Collection

**`get_odds`** - Fetch lines from The Odds API
- `sport`: Sport key (e.g. `americanfootball_nfl`). Use `list` for available sports.
- `markets`: `h2h,spreads,totals` (default: all three)
- `regions`: `us` (default)
- `force_refresh`: Bypass 10-min cache (use sparingly - 500/mo quota!)
- Returns: Multi-book lines with quota remaining in `_quota` field.

**`get_weather`** - Game-time weather + impact score
- `venue`: Code like `buf`, `chi`, `den`. Use `list` for all venues.
- Or use `lat`/`lon` for custom locations.
- `game_time`: ISO 8601 datetime of game start.
- `sport`: `nfl`, `mlb`, `nba` for sport-specific impact scoring.
- Returns: Temperature, wind, precipitation + calculated impact on totals/spreads.
- Dome games automatically return "no impact."

**`get_injuries`** - ESPN injury reports with edge signals
- `sport`: `nfl`, `nba`, `mlb`, `nhl`
- `team`: Team abbreviation (optional - omit for league-wide)
- Returns: Injuries sorted by edge signal. Role player injuries marked as
  `UNDERPRICED` - these are the ones the market misses (O-line, bullpen, corners).

**`get_social`** - Locker room / chemistry intelligence
- `sport`: `nfl`, `nba`, `mlb`, `nhl`
- `team`: Team abbreviation
- Returns: Categorized signals (coaching conflicts, player drama, motivation
  factors) with weights and net sentiment score. The market ignores "soft" data.

### Analysis

**`check_edge`** - Combined edge analysis
- `sport`: `nfl`, `nba`, `mlb`, `nhl`
- `game`: `AWAY@HOME` format (e.g. `DAL@PHI`)
- `depth`: `quick` (2 models), `standard` (4 models), `full` (all 6)
- Returns: Edge score 0-100, direction, confidence tier, individual model
  results, caveats, and disclaimer. Never a bare pick - always the math.

### Situational & Calibration

**`get_situational`** - Scheduling spot analysis
- `sport`: `nfl`, `nba`, `mlb`, `nhl`
- `away_team`: Away team abbreviation (e.g. `DAL`)
- `home_team`: Home team abbreviation (e.g. `PHI`)
- `game_date`: ISO date (YYYY-MM-DD)
- Returns: Rest differential, travel distance, timezone mismatch, schedule density,
  spot analysis (trap, letdown, sandwich, Thursday), altitude effects, compound score.
- The AI moat: no human can track 50+ scheduling factors across every team simultaneously.

**`calibrate`** - Probability calibration engine (trust engine)
- `action`: `check` (get calibrated confidence), `report` (full breakdown),
  `correct` (recalculate from all data), `adjust` (show correction map)
- `confidence`: For `check`: raw value 0-100 to calibrate
- `period`: `month` or `all` (default: all)
- Returns: Calibration status, correction factors by bucket, insights.
- Run `correct` after accumulating 20+ resolved picks. This is what makes
  x402 customers trust the numbers.

### Recursive Learning

**`track_pick`** - Record picks for CLV tracking
- `action`: `record` new pick, `result` to log outcome, `list`, `pending`
- Every recommendation MUST be tracked. No exceptions.
- CLV is automatically calculated when closing line + outcome are backfilled.

**`review_accuracy`** - The learning engine (9 analytics actions)
- `action`: `weekly` (full review), `model_performance`, `sport_breakdown`,
  `lessons` (view learned lessons), `weights` (adjust model weights),
  `calibration` (predicted vs actual by bucket), `regimes` (detect degradation),
  `compound` (best model combos), `portfolio` (correlated exposure)
- `period`: `week`, `month`, `all`
- Run `weekly` every Sunday. This is what makes the system smarter.
- Run `calibration` monthly to check probability accuracy.
- Run `regimes` when on a losing streak to detect model degradation.
- Model weights adjust ±5% max per cycle to prevent overcorrection.

### Workflow

```
1. get_odds → what are the current lines?
2. get_weather → does weather create an edge?
3. get_injuries → any underpriced role player injuries?
4. get_social → any locker room dysfunction?
5. get_situational → scheduling spots, rest, travel edges?
6. check_edge → combine all 8 models into edge score
7. calibrate check → apply calibration to raw confidence
8. track_pick record → log the recommendation
9. [after game] track_pick result → backfill outcome + CLV
10. [Sunday] review_accuracy weekly → learn and adjust
11. [monthly] review_accuracy calibration → check probability accuracy
12. [monthly] calibrate correct → update correction factors
13. [as needed] review_accuracy regimes → detect model degradation
14. [as needed] review_accuracy compound → find best model combos
15. [as needed] review_accuracy portfolio → check correlated exposure
```

## External APIs

- The Odds API: 500 free calls/month. Cache aggressively. `get_odds` handles caching.
- ESPN: Public endpoints. No key required. `get_injuries` + `get_social` handle parsing.
- Open-Meteo: Free weather data. No key required. `get_weather` handles impact scoring.
- x402: Micropayment protocol. Test with small amounts first.
