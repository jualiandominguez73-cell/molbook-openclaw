# Slack Thread Sessions Investigation

**Issue:** When replying to a Slack thread after some time, the session appears "fresh" instead of continuing the prior conversation.

**Branch:** `explore/slack-thread-sessions`

---

## Understanding the Flow

### 1. Thread Session Key Generation (Working)

When a Slack message arrives in a thread:

**File:** `src/slack/monitor/message-handler/prepare.ts`
```javascript
const threadTs = message.thread_ts;
const hasThreadTs = typeof threadTs === "string" && threadTs.length > 0;
const isThreadReply = hasThreadTs && (threadTs !== message.ts || Boolean(message.parent_user_id));
const threadKeys = resolveThreadSessionKeys({
  baseSessionKey,
  threadId: isThreadReply ? threadTs : undefined,
  // ...
});
const sessionKey = threadKeys.sessionKey;  // e.g. "agent:main:main:thread:1768689812.877999"
```

**File:** `src/routing/session-key.ts`
```javascript
export function resolveThreadSessionKeys(params) {
  const threadId = (params.threadId ?? "").trim();
  if (!threadId) {
    return { sessionKey: params.baseSessionKey, parentSessionKey: undefined };
  }
  const useSuffix = params.useSuffix ?? true;
  const sessionKey = useSuffix
    ? `${params.baseSessionKey}:thread:${threadId}`
    : params.baseSessionKey;
  return { sessionKey, parentSessionKey: params.parentSessionKey };
}
```

✅ **This part works** - thread sessions get unique keys like `agent:main:main:thread:1768689812.877999`

---

### 2. Session Store Lookup & Idle Timeout (Potential Issue)

**File:** `src/auto-reply/reply/session.ts` (lines ~100-120)

```javascript
const idleMinutes = Math.max(sessionCfg?.idleMinutes ?? DEFAULT_IDLE_MINUTES, 1);
// ...
const idleMs = idleMinutes * 60_000;
const freshEntry = entry && Date.now() - entry.updatedAt <= idleMs;

if (!isNewSession && freshEntry) {
  // USE existing session
  sessionId = entry.sessionId;
  systemSent = entry.systemSent ?? false;
  // ...
} else {
  // CREATE new session
  sessionId = crypto.randomUUID();
  isNewSession = true;
  // ...
}
```

**File:** `src/config/sessions/types.ts`
```javascript
export const DEFAULT_IDLE_MINUTES = 60;
```

⚠️ **Potential Issue:** If you return to a thread after 60+ minutes, the session is treated as "idle" and a NEW session is created, losing conversation context.

---

## Root Cause Confirmed

The **60-minute idle timeout** applies to thread sessions the same as DMs. When returning to a thread after >60 min, a new session is created, losing all conversation history.

**Evidence from OpenProse thread:**
- Original session `996378c0`: Last activity `2026-01-17T23:12:44Z`, had 41 messages with full research
- New session `b3307ab8`: Started `2026-01-18T03:23:05Z` (4+ hours later), only got thread starter context
- All AI research/responses from original session = lost

## Expected Behavior

**Threads are explicit conversation continuations.** When a user replies in a thread, they're intentionally continuing that specific conversation and expect the full thread context to always be available.

- Thread sessions should have **infinite idle timeout** (never expire)
- User can manually `/compact` or `/new` if they want to reset
- This matches user mental model: "I'm replying in this thread = continue this conversation"

## Fix Implemented

Check for `:thread:` in session key and skip idle timeout for thread sessions.

---

## Files to Examine

| File | Purpose |
|------|---------|
| `src/slack/monitor/message-handler/prepare.ts` | Slack message processing, thread detection |
| `src/routing/session-key.ts` | Session key generation for threads |
| `src/auto-reply/reply/session.ts` | Session initialization, idle timeout logic |
| `src/config/sessions/types.ts` | DEFAULT_IDLE_MINUTES constant |
| `src/config/sessions/store.ts` | Session store persistence |
| `src/slack/threading.ts` | Thread reply targeting |

---

## Debug Steps

1. **Check session store:** Look at `~/.clawdbot/sessions/main/sessions.json` (or similar) to see if thread session entries exist and their `updatedAt` timestamps.

2. **Add logging:** In `session.ts`, log when a session is considered "stale" vs "fresh":
   ```javascript
   console.log(`Session ${sessionKey}: freshEntry=${freshEntry}, idleMs=${idleMs}, age=${Date.now() - (entry?.updatedAt ?? 0)}`);
   ```

3. **Test with short idle:** Set `session.idleMinutes: 2` in config, trigger a thread, wait 3 min, reply again - confirm it's creating a new session.

---

## Alternative Theories

1. **Session key mismatch:** Something causing the session key to differ between initial thread message and follow-up.

2. **Transcript not loading:** Session entry exists but the conversation transcript isn't being loaded correctly.

3. **Thread starter context:** The `ThreadStarterBody` / `ParentSessionKey` logic might be interfering.

---

## Notes

- Sessions list showed thread sessions DO exist (e.g. `agent:main:main:thread:1768689812.877999`)
- The session key generation logic looks correct
- Most likely culprit is the idle timeout treating threads the same as DMs

---

*Created: 2026-01-18*
*Branch: explore/slack-thread-sessions*
