# Visual readiness runbook (Peekaboo + UI maps)

Goal: make OpenClaw’s UI state easy to observe/debug with reproducible screenshots and UI maps.

## 1) macOS permissions (required)

Peekaboo needs both:

- Screen Recording (to capture the screen/window contents)
- Accessibility (to inspect UI elements and drive clicks/typing)

### Grant Screen Recording permission (Terminal)

1. Open **System Settings**
2. Go to **Privacy & Security**
3. Scroll to **Screen Recording**
4. Enable the toggle for **Terminal** (or **iTerm** if that’s what you use)
5. If there’s a separate **Peekaboo** / **Peekaboo Bridge** entry, enable that too
6. Quit Terminal completely (Cmd+Q) and reopen it

### Grant Accessibility permission (Terminal)

1. Open **System Settings**
2. Go to **Privacy & Security**
3. Scroll to **Accessibility**
4. Enable the toggle for **Terminal** (or **iTerm**)
5. If there’s a separate **Peekaboo** / **Peekaboo Bridge** entry, enable that too
6. Quit Terminal completely (Cmd+Q) and reopen it

## 2) What becomes possible once enabled

- Capture a debugging screenshot of the OpenClaw dashboard/control UI
- Generate an annotated UI map (stable element IDs) for reproducible “click this” scripts
- Automate UI probes (open app, focus window, list windows, click buttons, etc.)

## 3) Recommended snapshot commands

Run these from Terminal after permissions are enabled:

- Check permissions:
  - peekaboo permissions

- Screenshot (frontmost window or full screen):
  - peekaboo image --mode frontmost --retina --path /tmp/openclaw-frontmost.png
  - peekaboo image --mode screen --screen-index 0 --retina --path /tmp/openclaw-screen0.png

- UI map (annotated):
  - peekaboo see --annotate --path /tmp/openclaw-ui-map.png

Tip: keep the OpenClaw Control UI on the main screen, unobstructed, before running `see`.
