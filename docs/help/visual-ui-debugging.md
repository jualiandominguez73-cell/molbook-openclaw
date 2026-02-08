---
title: Visual UI debugging (Peekaboo)
---

This guide shows how to capture a screenshot and an annotated UI map for the OpenClaw macOS app (or the local Control UI) using the Peekaboo CLI.

Prerequisites

1) Install Peekaboo

- Homebrew: `brew install steipete/tap/peekaboo`

2) Grant macOS permissions (required)

- Screen Recording:
  - System Settings → Privacy & Security → Screen Recording
  - Enable: your terminal app (Terminal/iTerm) and Peekaboo/Peekaboo Bridge (if present)
  - Quit and re-open the terminal app after toggling

- Accessibility:
  - System Settings → Privacy & Security → Accessibility
  - Enable: your terminal app (Terminal/iTerm) and Peekaboo/Peekaboo Bridge (if present)
  - Quit and re-open the terminal app after toggling

Capture recipes

- Check permission status:
  - `peekaboo permissions`

- Screenshot the frontmost window:
  - `peekaboo image --mode frontmost --retina --path /tmp/openclaw-frontmost.png`

- Build an annotated UI map (best for “what button is that?” debugging):
  - `peekaboo see --mode frontmost --annotate --path /tmp/openclaw-ui-map.png`

- Capture a specific app window (more stable than frontmost):
  - `peekaboo list windows --app "OpenClaw" --json`
  - `peekaboo see --app "OpenClaw" --window-index 0 --annotate --path /tmp/openclaw-ui-map.png`

Tips

- If `peekaboo permissions` reports Screen Recording = denied, screenshots will be blank or fail.
- If Accessibility = denied, clicks/typing/menu automation won’t work.
- When filing an issue, attach both the raw screenshot and the annotated UI map; the map includes element IDs that make repro steps much more precise.
