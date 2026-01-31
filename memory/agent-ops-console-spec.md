# Agent Ops Console — Project Document

> **Last Updated:** 2026-01-30
> **Status:** Incubating (Internal Dogfood → Productize)
> **Owner:** David Hurley
> **Vikunja Project:** ID 8

---

## Executive Summary

**Agent Ops Console** is a real-time operations dashboard for AI agent fleets. Unlike existing LLM observability tools that focus on retrospective tracing and debugging, Agent Ops Console provides live operational control — see what's running, why it's running, and intervene when needed.

**One-liner:** "Datadog for AI Agents — but real-time, with task context and intervention."

---

## The Problem

As organizations deploy multiple AI agents (for coding, research, customer service, operations), a critical visibility gap emerges:

**Current tools are observability-focused, not operations-focused:**
- They show you traces AFTER execution
- No real-time view of agent status (running/paused/idle)
- No connection between business tasks and agent sessions
- Can't intervene in running agents
- No fleet-level visibility across heterogeneous agents

**The shoehorning problem:**
Teams try to use project management tools (Linear, Notion, Vikunja) to track agent work, but:
- Labels as workaround for agent assignment
- No live session data
- Manual status updates
- No model/cost tracking
- Completely disconnected from actual execution

**Market validation:**
- LangSmith raised $260M (but developer debugging focus)
- Arize raised $131M (model observability)
- AgentOps.ai raised $2.6M (agent debugging)
- Microsoft launching Agent 365 (enterprise control plane)
- IBM building AgentOps on OpenTelemetry

**Nobody is building the ops console — the thing you stare at while agents run.**

---

## The Solution

Agent Ops Console sits between you and your agent fleet, providing:

1. **Real-Time Agent Status** — Live WebSocket feed of running/paused/idle/errored
2. **Task ↔ Session Linking** — "This task spawned these sessions, cost $X, took Y minutes"
3. **Intervention Capabilities** — Pause, inject context, redirect, kill
4. **Cost/Token Tracking** — Per-agent, per-task, per-model breakdown
5. **Multi-Framework Support** — OpenClaw first, then LangChain, CrewAI, AutoGen

### Key Differentiators

| Solution | Built For | Model | Limitation |
|----------|-----------|-------|------------|
| LangSmith | Developers | Traces | Retrospective, LangChain-first |
| Arize Phoenix | ML Engineers | Metrics | Model focus, not agent focus |
| AgentOps.ai | Developers | Replay | Python-only, no intervention |
| Microsoft Agent 365 | Enterprises | Lifecycle | M365/Azure locked |
| **Agent Ops Console** | **Operators** | **Real-Time Ops** | Built for running fleets |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Ops Console                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │   Agent     │ │   Session   │ │    Task     │ │  Control  │  │
│  │   Status    │ │   Monitor   │ │   Tracker   │ │   Plane   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ↑                ↑                ↑                ↑
    WebSocket         Session API      Task API        Commands
         │                │                │                │
┌────────┴────────────────┴────────────────┴────────────────┴────┐
│                    Agent Runtime (OpenClaw)                     │
└────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Description | Status |
|-----------|-------------|--------|
| **Agent Registry** | List of agents with configs and capabilities | To Build |
| **Session Monitor** | Real-time WebSocket session status feed | To Build |
| **Task Tracker** | Bidirectional task ↔ session linking | To Build |
| **Cost Engine** | Token counting and cost attribution | To Build |
| **Control Plane** | Pause, resume, kill, inject commands | To Build |
| **Dashboard UI** | Next.js real-time web interface | To Build |

---

## MVP Features (Internal Dogfood)

### Must Have (Week 1-2)

1. **Agent Roster View**
   - List all agents with name, avatar, description
   - Live status indicator (🟢 running | 🟡 idle | 🔴 error | ⏸️ paused)
   - Current model, token count, session duration

2. **Session Feed**
   - Real-time list of active sessions
   - Session → Agent mapping
   - Start time, elapsed, model, tokens
   - Expandable for live log tail

3. **Task Board**
   - Kanban of tasks (Inbox | Assigned | Running | Complete)
   - Task → Session linking (click task, see sessions it spawned)
   - Session → Task linking (click session, see originating task)
   - Aggregate cost per task

4. **OpenClaw Integration**
   - Direct API calls to OpenClaw gateway
   - sessions_list, sessions_spawn, sessions_send
   - Real-time status via polling or WebSocket

### Should Have (Week 3-4)

5. **Cost Dashboard**
   - Per-agent cost breakdown
   - Per-task cost breakdown
   - Per-model cost breakdown
   - Daily/weekly/monthly trends

6. **Intervention Controls**
   - Pause running session
   - Send message to session
   - Kill session
   - View session logs

7. **Alert System**
   - Runaway cost alerts (> $X in Y minutes)
   - Error rate alerts
   - Stuck session alerts (no activity for Z minutes)

### Nice to Have (Phase 2)

8. **Multi-Framework Support**
   - LangChain integration
   - CrewAI integration
   - OpenTelemetry receiver

9. **Audit Log**
   - Full history of agent actions
   - Export for compliance

10. **Team Features**
    - Multi-user access
    - Role-based permissions
    - Shared views

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js 14 + React | Fast iteration, SSR, familiar |
| **Styling** | Tailwind CSS | Rapid UI development |
| **Real-Time** | WebSocket (socket.io or native) | Live updates required |
| **State** | Zustand or Jotai | Lightweight, TypeScript |
| **Backend** | Next.js API routes + OpenClaw API | Minimize new infra |
| **Database** | SQLite (local) → Postgres (prod) | Start simple |
| **Hosting** | Vercel | Easy deploys |

---

## Competitive Landscape

### Tier 1: Well-Funded (Observability Focus)

| Product | Raised | Focus | Gap |
|---------|--------|-------|-----|
| LangSmith | $260M | LangChain debugging | Not real-time ops |
| Arize | $131M | Model metrics | Not agent-focused |
| Galileo | $68M | Hallucination detection | Quality, not ops |
| Braintrust | $45M | Evaluation/testing | Not runtime ops |

### Tier 2: Agent-Specific

| Product | Raised | Focus | Gap |
|---------|--------|-------|-----|
| AgentOps.ai | $2.6M | Agent replay | Python-only, no intervention |
| Langfuse | $4.5M | OSS observability | No task linking |
| Helicone | ~$5M | Cost tracking | Proxy model, not ops |

### Tier 3: Enterprise

| Product | Focus | Gap |
|---------|-------|-----|
| Microsoft Agent 365 | Full control plane | M365-locked |
| Datadog LLM | Enterprise APM | $50K+/year, generic |

### Our Position

**"Agent Operations" vs "Agent Observability"**

Everyone else: Retrospective debugging for developers
Us: Real-time control for operators

---

## Pricing Model (Future)

### Free / Self-Hosted
- Open source dashboard
- Local deployment
- Single user
- Basic features

### Pro ($29/mo per seat)
- Cloud hosted
- Team access
- All integrations
- Alerts

### Enterprise
- SSO/SAML
- Audit logs
- Custom retention
- SLA

---

## Branding

**Name:** Agent Console
**Domain:** agentconsole.app ✅ (purchased, in Vercel)
**Tagline:** "Real-time operations dashboard for AI agents"

---

## Roadmap

### Phase 1: Internal Dogfood (2 weeks)
- [ ] Dashboard scaffold
- [ ] OpenClaw integration
- [ ] Agent roster + status
- [ ] Session feed
- [ ] Basic task → session linking
- [ ] Replace Vikunja + Mission Control for DBH Ventures

### Phase 2: Feature Complete (2 weeks)
- [ ] Real WebSocket updates
- [ ] Full intervention controls
- [ ] Cost tracking
- [ ] Alerts

### Phase 3: Polish & Launch (2 weeks)
- [ ] UI/UX polish
- [ ] Landing page
- [ ] Documentation
- [ ] Product Hunt launch

### Phase 4: Growth
- [ ] Multi-framework support
- [ ] Team features
- [ ] Billing

---

## Success Metrics

### Internal Dogfood
- Fully replace Vikunja + Mission Control
- David can see all agent activity in one place
- No more label-based agent tracking

### External Launch
- 100 GitHub stars in first month
- 50 active users (free tier)
- 10 paid subscribers (Pro tier)

---

## Open Questions

1. **WebSocket vs Polling?** — OpenClaw may not expose WebSocket; may need to poll initially
2. **Task source?** — Vikunja initially, then support others (Linear, Jira)?
3. **Self-hosted priority?** — How important for initial users?
4. **Name?** — Final domain decision needed

---

## References

- [Scout Research: Agent Ops Landscape](/Users/steve/.openclaw/agents/main/sessions/05a6c2fd-e7e7-40c5-ac33-248015990bed.jsonl)
- [MeshGuard Project Document](bear://x-callback-url/open-note?title=MeshGuard%20%E2%80%94%20Project%20Document)
- [SaveState Concept](bear://x-callback-url/open-note?title=SaveState%20%E2%80%94%20Time%20Machine%20for%20AI)
- [Mission Control Spec](/Users/steve/clawd/memory/mission-control-spec.md)

---

#projects #savestate #agentops #dbhventures
