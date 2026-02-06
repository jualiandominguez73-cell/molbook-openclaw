# 🎯 OpenClaw Projects — Automated Team Coordination

Framework for multi-agent project management with RACI matrices, agent registries, and automatic delegation.

---

## 📁 Structure

```
projects/
├── README.md                          # This file
├── templates/                         # Project templates (user-created)
│   └── [user creates their own]
└── active/                           # Active projects directory
    └── [user projects go here]
```

---

## 🚀 Quick Start

### 1. Create Your Project Template

Create a YAML template with your project definition:

```yaml
name: your-project-name
displayName: "Your Project Display Name"
description: "What this project is about"
timeline:
  startDate: "2026-02-06"
  endDate: "2026-02-12"
  duration: "1 week"
goal: "High-level objective"
team:
  lead: coordinator-agent-id
  members:
    - id: agent-name
      role: "Agent Role"
      responsibility: "What they do"
raci:
  - task: "Something"
    responsible: agent-name
    accountable: agent-name
    consulted: [other-agents]
    informed: [more-agents]
successCriteria:
  - id: "metric-id"
    title: "Metric Name"
    goal: "Target value"
schedule:
  standup:
    time: "09:00"
    format: "slack"
```

### 2. Use the project-coordinator Skill

The `project-coordinator` skill handles:

- Project initialization from templates
- REGISTRY + RESPONSIBILITIES generation
- Agent registry per project
- Automatic team spawning
- Daily standup scheduling
- Progress tracking
- Escalation routing

See `skills/project-coordinator/SKILL.md` for full documentation.

### 3. Spawn Your Team

Use `team-coordinator` to delegate work:

```typescript
sessions_spawn({
  agentId: "your-lead-agent",
  task: "Your project task...",
  label: "Your Project: Your Feature",
});
```

---

## 📋 YAML Template Schema

Every project template should include:

```yaml
# Identification
name: string # Machine-readable identifier
displayName: string # Human-readable name
description: string # Executive summary

# Timeline
timeline:
  startDate: ISO-8601 date
  endDate: ISO-8601 date
  duration: string # "1 week", "2 sprints", etc.
  timezone: string # "America/Vancouver"
  workingDays: [list of days]

# Goal
goal: string # Multi-line goal statement

# Team Structure
team:
  lead: agent-id # Project lead
  members:
    - id: agent-id
      role: string
      title: string
      responsibility: string
      hoursPerWeek: number
      availability: string
      escalation: string

# RACI Matrix
raci:
  - task: string
    responsible: agent-id
    accountable: agent-id
    consulted: [agent-ids]
    informed: [agent-ids]
    priority: CRITICAL|HIGH|MEDIUM|LOW
    dueDate: ISO-8601 datetime

# Success Metrics
successCriteria:
  - id: string
    title: string
    goal: string
    current: string
    metric: string
    owner: agent-id

# Schedule
schedule:
  standup:
    time: string # "09:00"
    duration: string # "15 minutes"
    format: string # "slack", "email", etc.
    channel: string # "#channel-name"
    daysOfWeek: [list]
  review:
    time: string
    format: string
    daysOfWeek: [list]
  kickoff:
    date: ISO-8601 date
    time: string
    duration: string
    attendees: [agent-ids]

# Escalation Rules
escalation:
  low_risk:
    definition: string
    process: string
  medium_risk:
    definition: string
    process: string
  high_risk:
    definition: string
    process: string
  blocker:
    definition: string
    process: string

# Deliverables
deliverables:
  - name: string
    description: string
    owner: agent-id
    dueDate: ISO-8601 datetime

# Dependencies
dependencies:
  - string # Task dependencies

# Risk Register
risks:
  - id: string
    title: string
    severity: CRITICAL|HIGH|MEDIUM|LOW
    probability: HIGH|MEDIUM|LOW
    mitigation: string
    owner: agent-id

# Tools & Resources
tools:
  github:
    repo: string
    projectBoard: string
  slack:
    channel: string
  documentation:
    - string # Doc references

# Metadata
metadata:
  version: string
  lastUpdated: ISO-8601 datetime
  createdBy: string
  status: string # "READY", "DRAFT", "ARCHIVED"
```

---

## 🎓 Key Concepts

### RACI Matrix

**R** = Responsible (does the work)  
**A** = Accountable (signs off, single owner per task)  
**C** = Consulted (provides input/advice)  
**I** = Informed (notified after decision)

**Rule:** Each task has exactly ONE accountable person.

### Agent Registry

Central reference for team structure:

```
Agent: agent-name
├── Role: Agent Role Title
├── Responsibility: What they own
├── Status: Online|Busy|Offline
├── Response Time: < X hours
├── Availability: Hours of operation
└── Tasks: [assigned work items]
```

### Escalation Rules

Define decision-making at different risk levels:

- **Low Risk** (< 2 hours impact) → Owner decides autonomously
- **Medium Risk** (2-48 hours) → Owner proposes, accountable reviews
- **High Risk** (> 48 hours) → Owner proposes, accountable + lead approve
- **Blocker** (prevents other work) → Escalate immediately

### Success Criteria

Every project needs measurable goals:

```
Metric: "Unit test coverage"
├── Current: "65%"
├── Goal: "80%"
├── Owner: backend-lead
└── Measurement: "Coverage percentage"
```

---

## 📊 Project Lifecycle

### Phase 1: Planning

1. Create YAML template
2. Define team & RACI
3. Set success criteria
4. Schedule standup/review dates

### Phase 2: Execution

1. Generate REGISTRY + RESPONSIBILITIES
2. Kick off meeting
3. Daily standups
4. Track progress
5. Escalate blockers

### Phase 3: Closure

1. Final review meeting
2. Consolidate metrics
3. Generate report
4. Document lessons learned

---

## 🛠️ Integration Points

This framework integrates with:

- **project-coordinator skill** → Project management
- **team-coordinator skill** → Agent hierarchy & delegation
- **sessions_spawn** → Spawn agents with tasks
- **message tool** → Send updates to Slack/Telegram/Discord
- **cron** → Schedule standups & reviews
- **REGISTRY.md** → Agent discovery per project
- **RESPONSIBILITIES.md** → RACI enforcement

---

## 📚 Documentation

- **skills/project-coordinator/SKILL.md** — Full skill documentation
- **This README.md** — Framework overview & best practices

---

## 💡 Best Practices

### RACI Discipline

✅ Every task has exactly 1 Accountable  
✅ Responsible role is clear & specific  
✅ Consulted agents are named (not "everyone")  
✅ Escalation paths are explicit

❌ Don't use "everyone" for Consulted/Informed  
❌ Don't skip defining Responsible  
❌ Don't leave escalation undefined

### Team Communication

✅ Daily standups (async-friendly format)  
✅ Shared REGISTRY + RESPONSIBILITIES  
✅ Explicit escalation paths  
✅ Weekly reviews against targets

❌ Don't scatter docs across tools  
❌ Don't have unclear ownership  
❌ Don't skip reviews

### Metrics & Tracking

✅ Measurable success criteria (not vague goals)  
✅ Daily progress visibility  
✅ Blocker escalation process  
✅ Final metrics report

❌ Don't set "improve quality" as goal  
❌ Don't go dark without updates  
❌ Don't ignore blockers

---

## 🚀 Creating a New Project

1. **Create your YAML template:**

   ```yaml
   name: my-project
   displayName: "My Project Name"
   # ... rest of template
   ```

2. **Validate YAML:**

   ```bash
   yamllint my-project.yaml
   ```

3. **Generate project files:**
   - REGISTRY.md (agent profiles)
   - RESPONSIBILITIES.md (RACI matrix)
   - ACTION_PLAN.md (day-by-day tasks)

4. **Spawn your agents:**

   ```typescript
   sessions_spawn({
     agentId: "lead-agent",
     task: "Lead my project...",
     label: "My Project: Leadership",
   });
   ```

5. **Run daily standups:**
   - 09:00 PST every weekday
   - Format: Slack message
   - Template: What I did | What I'm doing | Blockers

6. **Weekly reviews:**
   - Friday EOD
   - Progress vs targets
   - Issues & decisions
   - Plan ahead

---

## 🔗 Template Locations

User-created templates go in:

```
projects/templates/your-template-name.yaml
```

Active projects go in:

```
projects/active/your-project-name/
└── project.yaml
└── REGISTRY.md
└── RESPONSIBILITIES.md
└── ACTION_PLAN.md
```

---

## 🆘 Common Questions

**Q: Can I use OpenClaw agents in my projects?**  
A: Yes! Use any agent from the team-coordinator hierarchy.

**Q: How do I define custom RACI rules?**  
A: Define in the `raci:` section of your YAML template.

**Q: What if RACI needs to change mid-project?**  
A: Update RESPONSIBILITIES.md and document the change decision.

**Q: How do I escalate a blocker?**  
A: Follow the process defined in your `escalation:` section.

---

## 📅 Version History

| Version | Date       | Changes                   |
| ------- | ---------- | ------------------------- |
| 1.0.0   | 2026-02-06 | Initial framework release |

---

## 📝 Contributing

To improve the project coordination framework:

1. Update YAML schema in this README
2. Enhance project-coordinator skill
3. Document new best practices
4. Submit PR with description

---

**Framework Status:** 🟢 Production Ready  
**Last Updated:** 2026-02-06  
**Maintained By:** OpenClaw Development
