# Source Patches

These patches contain local changes waiting to be merged upstream.
Apply them after `git pull` and before `pnpm build`.

## Patches

| Patch | PR | Description |
|:------|:---|:------------|
| `telegram-message-tool-thread.patch` | [#2778](https://github.com/moltbot/moltbot/pull/2778) | Fix message tool sends to General topic instead of current DM topic |
| `telegram-dm-thread-display.patch` | [#3368](https://github.com/moltbot/moltbot/pull/3368) | Display thread ID for DM topics + fix Sessions tab navigation |
| `chat-escape-stop.patch` | [#3383](https://github.com/moltbot/moltbot/pull/3383) | Escape key to stop generation in Chat tab |
| `chat-delete-session.patch` | [#3386](https://github.com/moltbot/moltbot/pull/3386) | Delete session button in Chat tab |
| `chat-edit-label.patch` | [#3415](https://github.com/moltbot/moltbot/pull/3415) | Edit session label in Chat tab |
| `subagent-thread-context.patch` | [#5296](https://github.com/openclaw/openclaw/pull/5296) | Propagate parent thread context to sub-agent sessions |

## Usage

```bash
cd ~/git_repos/moltbot/moltbot
git checkout main
git pull origin main

# Apply all patches (combined)
./patches/apply.sh

pnpm build
moltbot gateway restart
```

## After PR Merge

When a PR is merged upstream, delete the corresponding patch:

```bash
rm patches/<name>.patch
```

Then `git pull` will include the changes natively.
