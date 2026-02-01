# Projects UX: /projects wipe — rollback checklist

Scope: **projects-ux plugin only** (`extensions/projects-ux`).

## What this feature changes

- Adds a destructive Reset/Wipe UX under `/projects` → `More…` → `Reset…`.
- Supports:
  - wiping **one** project (primary)
  - wiping **all** Projects-UX state for this DM (recovery)
- All destructive actions are guarded by a 2-step nonce confirmation + automatic backups.
- Deletes **only** `projects-ux` plugin state under `~/.openclaw/projects-ux/`.
- Does **not** touch:
  - `~/projects/` on disk
  - OpenClaw core state
  - other plugins
  - main assistant memory system

## Rollback options

### A) Roll back code (disable feature)

If the command UX is confusing or breaks `/projects`:

1) Revert the plugin commit(s):

```bash
git log --oneline -- extensions/projects-ux/index.ts | head
# pick the commit(s) for reset/wipe

git revert <sha>
```

2) Restart the gateway:

```bash
openclaw gateway restart
```

### B) Restore user data after an accidental wipe

The command creates a backup directory:

- `~/.openclaw/backup_projects_ux_YYYYMMDD-HHMMSS/projects-ux/`

To restore:

```bash
openclaw gateway stop

# move aside the empty/new state
mv ~/.openclaw/projects-ux ~/.openclaw/projects-ux.RESTORED_ASIDE.$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# restore from backup
cp -a ~/.openclaw/backup_projects_ux_YYYYMMDD-HHMMSS/projects-ux ~/.openclaw/projects-ux

openclaw gateway start
```

## Emergency recovery

If reset/wipe leaves the plugin in a bad state:

```bash
openclaw gateway stop
rm -rf ~/.openclaw/projects-ux
openclaw gateway start
```

The plugin should re-create an empty default state on next use.
