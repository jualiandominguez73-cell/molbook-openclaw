---
summary: "CLI reference for `openclaw config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `openclaw config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `openclaw configure`).

## Secrets

Use the secrets helper to migrate sensitive values in `openclaw.json` to
`${ENV_VAR}` references. This keeps secrets out of the config file and lets
you source them from 1Password or another password manager.

```bash
openclaw config secrets plan
openclaw config secrets apply
```

### 1Password setup

Store the env vars in 1Password and inject them at runtime. Example workflow:

```bash
openclaw config secrets plan --prefix OPENCLAW_SECRET_
# Create a template with 1Password references (example values).
cat > ~/.openclaw/openclaw.env.tpl <<'EOF'
OPENCLAW_GATEWAY_TOKEN=op://Vault/OpenClaw/Gateway Token
TELEGRAM_BOT_TOKEN=op://Vault/OpenClaw/Telegram Bot Token
OPENCLAW_SECRET_TOOLS_WEB_SEARCH_APIKEY=op://Vault/OpenClaw/Brave Search
EOF

op inject -i ~/.openclaw/openclaw.env.tpl -o ~/.openclaw/openclaw.env
set -a
source ~/.openclaw/openclaw.env
set +a
openclaw config secrets apply
```

Restart the gateway after updating secrets.

## Examples

```bash
openclaw config get browser.executablePath
openclaw config set browser.executablePath "/usr/bin/google-chrome"
openclaw config set agents.defaults.heartbeat.every "2h"
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
openclaw config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
openclaw config get agents.defaults.workspace
openclaw config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
openclaw config get agents.list
openclaw config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--json` to require JSON5 parsing.

```bash
openclaw config set agents.defaults.heartbeat.every "0m"
openclaw config set gateway.port 19001 --json
openclaw config set channels.whatsapp.groups '["*"]' --json
```

Restart the gateway after edits.
