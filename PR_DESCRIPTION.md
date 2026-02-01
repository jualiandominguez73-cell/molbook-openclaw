# PR description (copy into GitHub PR to follow [CONTRIBUTING](CONTRIBUTING.md))

---

## Summary

Fixes Render deployment: CIDR support for trusted proxies, startup script, blueprint, and docs for LLM API key configuration.

## What & why

- **CIDR in `isTrustedProxyAddress()`** — Render’s load balancer uses private IPs; supporting CIDR (e.g. `10.0.0.0/8`) fixes “Proxy headers detected from untrusted address” and is backward compatible with exact IPs.
- **`scripts/render-start.sh`** — Writes config with trusted proxies and env (OPENCLAW*\* / MOLTBOT*\*), then starts the gateway so one-click Render deploys work.
- **`render.yaml`** — Blueprint with `dockerCommand`, env vars, disk; secrets use `sync: false`.
- **`docs/render.mdx`** — How to set LLM API keys in the Render dashboard and optional config-file method.

## AI-assisted

- [x] This PR is AI-assisted (Cursor/Claude).
- [x] Tested: Render deploy path and CIDR tests run locally; CI (tsgo, format, lint, build) addressed for fork.
- [x] I understand what the code does (proxy trust, config bootstrap, docs).

## Checklist (CONTRIBUTING)

- [x] `pnpm tsgo && pnpm format && pnpm lint && pnpm build && pnpm test` (or equivalent) run locally.
- [x] PR is focused (Render + CIDR + docs).
- [x] Description explains what & why above.

---

_Paste the sections above into your PR description on GitHub. You can delete this file after copying._
