# Slack Co-Working & Project-Oriented Memory Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable agents to have native co-working awareness (self-identity, teammate discovery, mention context) and project-oriented memory with strict isolation and cross-project queries.

**Architecture:** Two major features - (1) Co-working identity injection into system prompts with Slack-based teammate discovery, and (2) project-scoped memory with channel mapping, explicit overrides, and cross-project search capability.

**Tech Stack:** TypeScript, Slack API (users.list, users.info), SQLite (per-project databases), existing memory indexing infrastructure.

---

## Feature 1: Co-Working Identity Model

### 1.1 Self-Awareness Injection

The agent's system prompt includes an identity context block with Slack-specific information:

```
## Your Identity
- Name: Claude Bot
- Slack User ID: U0ABC123XYZ
- Mention format: <@U0ABC123XYZ>
```

This enables the agent to:
- Understand when it's being directly addressed
- Recognize its own messages in conversation history
- Reason about mentions contextually

### 1.2 Teammate Discovery via Slack API

On Slack monitor startup, the agent queries the workspace for other bot users:

```typescript
type TeammateInfo = {
  userId: string;           // U0DEF456
  name: string;             // data-bot
  displayName: string;      // Data Bot
  isBot: boolean;
  deleted: boolean;
};
```

**Discovery flow:**
1. Call `users.list` with bot token
2. Filter for `is_bot: true` and `deleted: false`
3. Exclude self (current bot user ID)
4. Cache roster for session duration

**System prompt injection:**
```
## Your Teammates (other bots in this workspace)
- @data-bot (U0DEF456): Bot user
- @devops-bot (U0GHI789): Bot user
When someone mentions a teammate, that message may not be for you.
```

### 1.3 Mention Context Enrichment

Each incoming message receives metadata about mentions:

```typescript
type MentionContext = {
  wasMentioned: boolean;              // Direct @mention of this agent
  mentionType: "direct" | "implicit" | "none";
  otherBotsMentioned: TeammateInfo[]; // Which teammates were mentioned
  isReplyToSelf: boolean;             // Thread where agent is parent
};
```

This context is passed to the system prompt and/or message preprocessing to help the agent understand conversational dynamics.

---

## Feature 2: Project-Oriented Memory

### 2.1 Project Configuration

Projects are defined in agent config:

```typescript
type ProjectConfig = {
  id: string;                    // "backend-api"
  name: string;                  // "Backend API Service"
  channels?: string[];           // ["#backend", "#api-bugs"]
  sources?: string[];            // ["/repos/api-service/docs", "/repos/api-service/README.md"]
  keywords?: string[];           // ["api", "endpoints", "REST"] - hints for context detection
};
```

**Config location:** `agents.list[].projects` or `agents.defaults.projects`

### 2.2 Storage Structure

Each project gets its own SQLite database:

```
~/.openclaw/state/memory/
  {agentId}/
    _global.sqlite              # Agent's personal/global memory (fallback)
    projects/
      backend-api.sqlite        # Project-specific memory
      frontend-app.sqlite
      marketing.sqlite
```

### 2.3 Memory Sources Per Project

1. **Conversation history** - Messages from mapped channels/threads automatically indexed to that project's database
2. **Linked sources** - Configured directories/files synced to project memory on startup and periodically

### 2.4 Context Detection Flow

Hybrid approach with channel mapping as default and explicit overrides:

1. Message arrives → check channel against project mappings
2. If channel mapped → use that project's context
3. User command `/project <id>` → override for this thread
4. No mapping found → use `_global.sqlite`

**Thread inheritance:** First message sets project context, all replies inherit it.

### 2.5 Strict Isolation

When agent is in a project context:
- Memory searches ONLY query that project's SQLite database
- No automatic bleed-through from other projects or global memory
- Clean separation between project domains

### 2.6 Cross-Project Queries

Explicit cross-reference via tool:

```typescript
// Tool: cross_project_search
type CrossProjectSearchInput = {
  project: string;   // Target project ID
  query: string;     // Search query
};

type CrossProjectSearchOutput = MemorySearchResult[];
```

**System prompt guidance:**
```
## Memory Scope
You are currently in project: backend-api
Your memory searches are scoped to this project only.

To query another project's memory, use the cross_project_search tool:
- cross_project_search(project: "frontend-app", query: "auth patterns")
- Only use this when explicitly relevant to the conversation.
- Available projects: backend-api, frontend-app, marketing
```

**Audit trail:** Cross-project queries are logged with reason for transparency.

---

## Implementation Notes

### Files to Create/Modify

**Co-working identity:**
- `src/slack/monitor/teammates.ts` - Teammate discovery via Slack API
- `src/slack/monitor/context.ts` - Add teammates to SlackMonitorContext
- `src/slack/monitor/message-handler/prepare.ts` - Add MentionContext
- `src/auto-reply/reply/groups.ts` - Inject identity + teammates into system prompt

**Project memory:**
- `src/config/types.projects.ts` - ProjectConfig type definition
- `src/memory/project-scope.ts` - Project context resolution
- `src/memory/manager.ts` - Update to support project-scoped databases
- `src/memory/cross-project-search.ts` - Cross-project query implementation
- `src/agents/tools/cross-project-search.ts` - Tool definition for agent

### Migration Path

1. Existing agent memory in `{agentId}.sqlite` becomes `{agentId}/_global.sqlite`
2. Projects start empty, populated as conversations occur in mapped channels
3. Backward compatible - agents without project config use global memory only
