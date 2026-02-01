# Cursor Weekly Tasks

**Purpose:** Proactive maintenance tasks Cursor should perform weekly.

## Weekly Checklist

### Trust Ladder Review (Every Monday)
1. Read `~/clawd/supervisor-reports/trust-ladder-tracking.md`
2. Cross-reference Liam's self-logs with actual session files in `~/.clawdbot/agents/liam-telegram/sessions/`
3. Check for:
   - Missing self-logs (Liam forgot to log)
   - Discrepancies (logged vs actual behavior)
   - Verification compliance
   - Outbound restriction violations
4. Update level recommendation if criteria met
5. **Only escalate to Simon if:**
   - Violation detected
   - Level change recommended
   - Dishonest logging suspected

### APEX Backup Check (Every Friday)
1. Verify `~/.cursor/rules/apex-v7.mdc` exists
2. Compare with `~/clawd/apex-vault/APEX_*.mdc.backup`
3. Update backup if version changed

### Documentation Health (Monthly)
1. Check `FRUSTRATION-PATTERNS.md` for new patterns
2. Check `SUCCESS-PATTERNS.md` for wins to reinforce
3. Propose compaction if files getting bloated

---

## How to Trigger

When Simon asks for a "status" or "health check", include Trust Ladder status.

When starting a new session after Monday, check if weekly review is needed.

---

*Created: 2026-01-31*
*Last review: [pending]*
