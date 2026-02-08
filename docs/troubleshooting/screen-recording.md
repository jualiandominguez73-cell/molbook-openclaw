---
summary: "Fix macOS Screen Recording permission issues for OpenClaw UI automation and screenshots"
title: "Screen Recording Permissions (macOS)"
---

# Screen Recording Permissions (macOS)

Some OpenClaw workflows (and tools like Peekaboo) need **Screen Recording**
permission on macOS to read pixels from your display.

If Screen Recording is denied, you may see symptoms like:

- Blank / black screenshots
- UI automation tools reporting missing permissions
- Visual debugging features failing to capture the Control UI

## Grant Screen Recording to Terminal

1) Open **System Settings**.
2) Go to **Privacy & Security**.
3) Select **Screen Recording**.
4) Enable the toggle for **Terminal**.
   - If you use iTerm, VS Code, or another shell host, enable that app instead.
5) Quit and relaunch Terminal.
   - Use **Terminal > Quit Terminal** (not just closing the window).

## Grant Screen Recording to OpenClaw (macOS app)

If you run the OpenClaw macOS app (menubar app), also enable Screen Recording
for:

- **OpenClaw** (the app bundle)

Then quit and relaunch the OpenClaw app.

## Also consider Accessibility

For interaction (click/type/menu control), macOS also requires **Accessibility**
permission:

- System Settings → Privacy & Security → Accessibility

Enable it for Terminal and/or OpenClaw if you are driving UI actions.

## What becomes possible once enabled

- Reliable screenshots of the OpenClaw Control UI and dashboard state.
- Annotated UI maps (element bounding boxes) via Peekaboo `see --annotate`.
- Visual regression debugging (capture before/after images).
- End-to-end UI automation (when paired with Accessibility permissions).

## Quick verification

If you have Peekaboo installed:

```bash
peekaboo permissions
```

It should report Screen Recording + Accessibility as granted for the host app you
are running it from.
