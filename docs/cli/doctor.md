---
summary: "CLI reference for `openclaw doctor` (health checks + guided repairs)"
read_when:
  - You have connectivity/auth issues and want guided fixes
  - You updated and want a sanity check
title: "doctor"
---

# `openclaw doctor`

Health checks + quick fixes for the gateway and channels.

Related:

- Troubleshooting: [Troubleshooting](/gateway/troubleshooting)
- Security audit: [Security](/gateway/security)

## Examples

```bash
openclaw doctor
openclaw doctor --repair
openclaw doctor --deep
```

### Example: Telegram command-menu warnings

When Telegram menu commands are close to or over the Bot API limit, `openclaw doctor` reports dedicated check IDs:

```text
[warn] channels.telegram.commands.menu.near_limit
Telegram menu commands are near platform limit
Telegram command menu currently resolves to 92 commands; Telegram's limit is 100, so adding more commands can break menu registration.
Remediation: Keep menu commands below the limit: disable per-skill menu commands with channels.telegram.commands.nativeSkills=false and/or trim channels.telegram.customCommands.

[warn] channels.telegram.commands.menu.limit_exceeded
Telegram menu commands exceed platform limit
Telegram command menu currently resolves to 117 commands; Telegram accepts at most 100, so setMyCommands will fail and menu updates may be stale.
Remediation: Reduce menu commands: disable per-skill menu commands with channels.telegram.commands.nativeSkills=false and/or trim channels.telegram.customCommands.
```

Notes:

- Interactive prompts (like keychain/OAuth fixes) only run when stdin is a TTY and `--non-interactive` is **not** set. Headless runs (cron, Telegram, no terminal) will skip prompts.
- `--fix` (alias for `--repair`) writes a backup to `~/.openclaw/openclaw.json.bak` and drops unknown config keys, listing each removal.

## macOS: `launchctl` env overrides

If you previously ran `launchctl setenv OPENCLAW_GATEWAY_TOKEN ...` (or `...PASSWORD`), that value overrides your config file and can cause persistent “unauthorized” errors.

```bash
launchctl getenv OPENCLAW_GATEWAY_TOKEN
launchctl getenv OPENCLAW_GATEWAY_PASSWORD

launchctl unsetenv OPENCLAW_GATEWAY_TOKEN
launchctl unsetenv OPENCLAW_GATEWAY_PASSWORD
```
