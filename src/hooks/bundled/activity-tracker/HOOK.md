---
name: activity-tracker
description: "Tracks user activity for memory backup lifecycle management"
homepage: https://docs.clawd.bot/hooks#activity-tracker
metadata:
  {
    "clawdbot":
      {
        "emoji": "📍",
        "events": ["message:received"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with Clawdbot" }],
      },
  }
---

# Activity Tracker Hook

Tracks user message activity for memory backup lifecycle management.

## What It Does

When a user sends a message (`message:received` event):

1. Updates `memory/heartbeat-state.json` with current timestamp
2. Sets `backupActive = true` to enable hourly backups
3. Fires asynchronously - doesn't block message processing

## Why It Matters

This hook enables the session-backup hook to know when the user is active without:
- Polling session logs repeatedly
- Relying on the agent to remember to update state
- Adding latency to message processing

## State File

Updates `memory/heartbeat-state.json`:

```json
{
  "lastUserMessage": 1234567890,
  "backupActive": true,
  ...
}
```

## Requirements

- **Config**: `workspace.dir` must be set

## Disabling

```bash
clawdbot hooks disable activity-tracker
```

If disabled, the session-backup hook will still work but will rely on
polling session logs for activity detection (less efficient).
