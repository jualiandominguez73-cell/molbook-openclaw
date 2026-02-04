---
summary: "Product-manager perspective: new use cases and features to onboard and activate new OpenClaw users"
title: "New User Onboarding Use Cases (PM Plan)"
---

# New User Onboarding: Use Cases and Features (PM Perspective)

## Current state (brief)

- **Value prop**: Personal AI assistant, self-hosted, multi-channel (WhatsApp, Telegram, Slack, Discord, etc.), local-first.
- **Onboarding**: CLI wizard (`openclaw onboard`), macOS app first-run, Control UI with token; fastest path to first chat is Control UI (no channel setup).
- **Friction**: CLI-first, many channels and pairing steps, OAuth/API keys; "first value" can be delayed until gateway + auth + (optional) channel are done.
- **Docs**: [Getting started](https://docs.openclaw.ai/start/getting-started), [Wizard](https://docs.openclaw.ai/start/wizard), [FAQ "top five use cases"](https://docs.openclaw.ai/start/showcase), [Showcase](https://docs.openclaw.ai/start/showcase).

---

## Strategic gaps (why new users don't stick)

| Gap                       | Impact                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Time-to-value**         | First "wow" often requires install → onboard → gateway → token; no zero-commitment try (e.g. hosted demo or one-click Docker). |
| **Persona**               | Flow is optimized for technical users; non-devs need a "connect one channel and go" path.                                      |
| **Use-case clarity**      | "Top five" in FAQ are generic; no in-product templates or "starter packs" (e.g. Developer vs Family vs Executive).             |
| **Activation milestones** | No explicit Day 1 / Day 7 guidance or in-UI nudges ("You've sent 5 messages—add WhatsApp next").                               |
| **Channel-first entry**   | Today: gateway → auth → then channels. Many users think "I want it in WhatsApp" first; no channel-first wizard path.           |
| **Retention hooks**       | Wizard ends with "What now: showcase"; no first-week checklist or "recommended next step" inside Control UI.                   |

---

## New use cases (jobs-to-be-done) to attract new users

**1. "Try it in 60 seconds" (zero-commitment)**

- **Job**: "I want to see OpenClaw before installing anything."
- **Idea**: Hosted demo (read-only or sandbox) at e.g. try.openclaw.ai: paste a prompt, see a sample response and a "Run this yourself" CTA. Optional: one-click Docker Compose that starts gateway + opens Control UI with a throwaway token.
- **Outcome**: More top-of-funnel signups and installs from users who already "get" the product.

**2. "My assistant in my favorite app" (channel-first)**

- **Job**: "I want OpenClaw in WhatsApp (or Telegram / Slack) first; I don't care about the rest yet."
- **Idea**: Channel-first onboarding: "Which app do you use most?" → single-channel quick path (e.g. WhatsApp QR + allowlist your number only) → first message in that channel, then "Add more channels later" in Control UI.
- **Outcome**: Shorter path to first message on the surface that matters to the user.

**3. "Daily briefing / morning digest" (habit-forming)**

- **Job**: "I want one useful thing every morning without thinking."
- **Idea**: Out-of-the-box "Daily briefing" cron (or heartbeat): timezone + optional sources (e.g. "summarize my unread Gmail labels"). Promoted in onboarding: "Enable daily briefing? (You can change the time later.)"
- **Outcome**: Day-2+ habit and retention without requiring user to configure cron themselves.

**4. "Remind me / follow-up" (low-friction automation)**

- **Job**: "I want to say 'remind me in 1 hour' or 'follow up on this next week' in chat."
- **Idea**: First-class reminder UX: natural-language parsing + cron/heartbeat or a dedicated `remind` tool; show "Reminder set" in chat and optionally in Control UI (Cron tab or Activity).
- **Outcome**: High perceived utility with minimal setup; differentiator vs "just a chatbot."

**5. "Safe place for my notes and tasks" (memory + trust)**

- **Job**: "I want the assistant to remember my preferences and tasks without sending data to the cloud."
- **Idea**: Emphasize "Nothing leaves your machine" in onboarding and in Control UI (e.g. small "Local-only" badge, one-click "Where is my data?" doc link). Optional: "Memory & privacy" step in wizard that shows workspace path and "no telemetry" note.
- **Outcome**: Pulls in privacy- and security-conscious users and sets expectations.

**6. "Starter pack" by persona (segment onboarding)**

- **Job**: "I'm a developer / executive / parent—what should I do first?"
- **Idea**: At end of wizard (or in Control UI first-run): "What's your main use?" → Developer (CLI + cron + browser tool), Executive (briefing + Slack/Teams), Family (WhatsApp + reminders). Each path: 3–5 concrete "Try this" items (e.g. "Send 'remind me in 30m' in chat") and deep links to docs.
- **Outcome**: Higher activation and fewer "I installed it, now what?" drop-offs.

**7. "See what others built" (social proof)**

- **Job**: "I want to believe this is real and see examples."
- **Idea**: In-product "Examples" or "What others built": 1–2 sentence use cases + link to Showcase or a short video; optional "Copy this prompt" for common tasks. In wizard final screen: "See what people built" with 2–3 showcase links.
- **Outcome**: Trust and ideas for first tasks without leaving the product.

**8. "Is it working? Am I safe?" (confidence)**

- **Job**: "I want to know the system is healthy and my DMs aren't open to strangers."
- **Idea**: Post-onboarding "Health & security" summary: gateway status, DM policy (pairing vs open), link to `openclaw doctor`. Optional: Activity dashboard (already in progress) plus "Security" strip (e.g. "Pairing required for DMs" / "Run security audit").
- **Outcome**: Reduces anxiety and support load; aligns with existing doctor/audit work.

---

## Feature ideas (prioritized by impact on acquisition/activation)

**High impact (reduce time-to-value or expand persona)**

- **Channel-first wizard path**: New flow "I use [WhatsApp | Telegram | Slack] most" → skip or defer other channels; single-channel setup → "Send your first message" with link to pairing/QR.
  - _Touchpoints_: `src/wizard/onboarding.ts`, `src/commands/onboard-channels.ts`, wizard step ordering and prompts.
- **"What now" / first-week checklist in Control UI**: After first connect (or first chat), show a dismissible checklist: e.g. "Send a message", "Add a channel", "Set a reminder", "Run a daily briefing". Each item links to the relevant tab or doc.
  - _Touchpoints_: Control UI (e.g. new "Getting started" or "Next steps" block on Overview/Activity), optional backend flag "onboarding_checklist_dismissed" or "first_message_at".
- **Daily briefing as onboarding opt-in**: In wizard "Skills" or "Optional features", "Enable daily briefing? (Time zone from system, you can change it in Cron.)" → create one default cron job and document it in "What now".
  - _Touchpoints_: `src/wizard/onboarding.ts`, `src/cron`, cron UI in Control UI.

**Medium impact (activation + retention)**

- **Starter packs (persona)**: At end of wizard or in Control UI, "What's your main use?" → Developer / Executive / Family → 3–5 "Try this" items + doc links.
  - _Touchpoints_: Wizard finalize (`src/wizard/onboarding.finalize.ts`), or Control UI Overview/Activity.
- **Remind me / follow-up in chat**: Natural-language "remind me in X" / "follow up on this in Y" parsed and mapped to cron or a dedicated tool; confirmation in chat + optional visibility in Cron/Activity.
  - _Touchpoints_: Agent tools, session/cron integration.
- **"Try OpenClaw" demo page**: Static or minimal-backend page at try.openclaw.ai: paste prompt → sample response + "Run this yourself: install + onboard" CTA.
  - _Touchpoints_: Marketing/website (likely outside main repo); optional Docker one-liner in install docs.

**Lower effort / quick wins**

- **"Where is my data?" / "Local-only" in UI**: Small badge or one-line in Control UI (Overview or Settings): "Data stays on this machine" with link to docs.
  - _Touchpoints_: Control UI (Overview or app shell).
- **Wizard "What now" line**: Add 2–3 persona-based suggestions to the final "What now" in `src/wizard/onboarding.finalize.ts` (e.g. "Developers: try `openclaw agent --message 'list my cron jobs'`" vs "Everyone: open the dashboard and send a message").
- **Security/health one-liner**: In wizard summary or Control UI Overview, "DMs: pairing required. Run `openclaw doctor` to check config."
  - _Touchpoints_: `src/wizard/onboarding.finalize.ts`, Control UI Overview.

---

## Suggested roadmap (phasing)

- **Phase 1 (quick wins)**: Channel-first path, in-UI "What now" checklist, wizard "What now" + security one-liner. Delivers faster first message and clearer next steps.
- **Phase 2 (habits)**: Daily briefing opt-in, "remind me" in chat. Delivers Day-2+ value and repeat use.
- **Phase 3 (scale)**: Starter packs, try.openclaw.ai (or equivalent). Broadens funnel and segments onboarding.

---

## Dependencies and constraints

- **Wizard protocol**: Shared across CLI and macOS app; new steps or flows should stay within existing RPC where possible.
- **Control UI**: Already has Overview, Activity, Channels, Cron, etc.; checklist and "Local-only" fit current tabs and state.
- **No new backend required** for checklist or wizard copy; channel-first path and daily-briefing cron need wizard + cron changes only.
- **Docs**: New flows (channel-first, daily briefing, remind-me) should be reflected in Getting started and Wizard docs.

---

## Success metrics (suggested)

- **Activation**: % of new installs that send at least one message within 24h (and optionally within 7d).
- **Channel attachment**: % of new users who add at least one channel (WhatsApp/Telegram/Slack/etc.) within 7d.
- **Retention**: % of users who return to Control UI or send a message in days 2–7.
- **Funnel**: If "Try OpenClaw" exists: visit → install (or signup) conversion.

This plan is **read-only**: no code or config changes. Implementation would be separate PRs per feature, aligned with the phases above.
