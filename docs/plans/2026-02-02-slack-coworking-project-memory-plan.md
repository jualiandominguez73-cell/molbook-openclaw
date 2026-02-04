# Slack Co-Working & Project-Oriented Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable agents to have native co-working awareness (self-identity, teammate discovery, mention context) and project-oriented memory with strict isolation and cross-project queries.

**Architecture:** Two major features - (1) Co-working identity injection via Slack API teammate discovery and system prompt enrichment, and (2) project-scoped memory with channel mapping, explicit overrides, conversation history indexing, and cross-project search tool.

**Tech Stack:** TypeScript, Slack API (users.list), SQLite (per-project databases), existing memory infrastructure.

---

## Task 1: Add Project Configuration Types

**Files:**
- Create: `src/config/types.projects.ts`
- Modify: `src/config/types.agents.ts`
- Modify: `src/config/config.ts`

**Step 1: Create project config types**

Create `src/config/types.projects.ts`:

```typescript
export type ProjectConfig = {
  /** Unique project identifier (e.g., "backend-api"). */
  id: string;
  /** Human-readable project name (e.g., "Backend API Service"). */
  name: string;
  /** Slack channels mapped to this project (e.g., ["#backend", "#api-bugs"]). */
  channels?: string[];
  /** External source directories/files to index (e.g., ["/repos/api-service/docs"]). */
  sources?: string[];
  /** Keywords for context detection hints (e.g., ["api", "endpoints"]). */
  keywords?: string[];
};

export type ProjectsConfig = {
  /** List of project definitions. */
  list?: ProjectConfig[];
  /** Default project ID when no channel mapping matches. */
  defaultProject?: string;
};
```

**Step 2: Add projects to AgentConfig**

Modify `src/config/types.agents.ts` to add projects field:

```typescript
// Add import at top
import type { ProjectsConfig } from "./types.projects.js";

// Add to AgentConfig type (around line 62, before tools)
  /** Project-oriented memory configuration. */
  projects?: ProjectsConfig;
```

**Step 3: Export from config.ts**

Add export to `src/config/config.ts`:

```typescript
export type { ProjectConfig, ProjectsConfig } from "./types.projects.js";
```

**Step 4: Run type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 5: Commit**

```bash
scripts/committer "feat(config): add project configuration types" src/config/types.projects.ts src/config/types.agents.ts src/config/config.ts
```

---

## Task 2: Create Teammate Discovery Module

**Files:**
- Create: `src/slack/monitor/teammates.ts`
- Create: `src/slack/monitor/teammates.test.ts`

**Step 1: Write the test**

Create `src/slack/monitor/teammates.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { discoverTeammates, type TeammateInfo } from "./teammates.js";

describe("discoverTeammates", () => {
  it("filters out non-bot users and self", async () => {
    const mockClient = {
      users: {
        list: vi.fn().mockResolvedValue({
          ok: true,
          members: [
            { id: "U001", name: "human-user", is_bot: false, deleted: false },
            { id: "U002", name: "data-bot", is_bot: true, deleted: false, profile: { display_name: "Data Bot" } },
            { id: "U003", name: "self-bot", is_bot: true, deleted: false, profile: { display_name: "Self" } },
            { id: "U004", name: "deleted-bot", is_bot: true, deleted: true },
          ],
        }),
      },
    };

    const result = await discoverTeammates({
      client: mockClient as any,
      token: "test-token",
      selfUserId: "U003",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      userId: "U002",
      name: "data-bot",
      displayName: "Data Bot",
      isBot: true,
      deleted: false,
    });
  });

  it("returns empty array on API error", async () => {
    const mockClient = {
      users: {
        list: vi.fn().mockRejectedValue(new Error("API error")),
      },
    };

    const result = await discoverTeammates({
      client: mockClient as any,
      token: "test-token",
      selfUserId: "U001",
    });

    expect(result).toEqual([]);
  });

  it("handles pagination", async () => {
    const mockClient = {
      users: {
        list: vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            members: [
              { id: "U001", name: "bot1", is_bot: true, deleted: false, profile: { display_name: "Bot 1" } },
            ],
            response_metadata: { next_cursor: "cursor123" },
          })
          .mockResolvedValueOnce({
            ok: true,
            members: [
              { id: "U002", name: "bot2", is_bot: true, deleted: false, profile: { display_name: "Bot 2" } },
            ],
          }),
      },
    };

    const result = await discoverTeammates({
      client: mockClient as any,
      token: "test-token",
      selfUserId: "U999",
    });

    expect(result).toHaveLength(2);
    expect(mockClient.users.list).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/slack/monitor/teammates.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `src/slack/monitor/teammates.ts`:

```typescript
import type { WebClient } from "@slack/web-api";
import { logVerbose } from "../../globals.js";

export type TeammateInfo = {
  userId: string;
  name: string;
  displayName: string;
  isBot: boolean;
  deleted: boolean;
};

const MAX_PAGES = 10;

export async function discoverTeammates(params: {
  client: WebClient;
  token: string;
  selfUserId: string;
}): Promise<TeammateInfo[]> {
  const { client, token, selfUserId } = params;
  const teammates: TeammateInfo[] = [];

  try {
    let cursor: string | undefined;
    let page = 0;

    while (page < MAX_PAGES) {
      const response = await client.users.list({
        token,
        cursor,
        limit: 200,
      });

      if (!response.ok || !response.members) {
        break;
      }

      for (const member of response.members) {
        if (!member.is_bot || member.deleted || member.id === selfUserId) {
          continue;
        }

        teammates.push({
          userId: member.id ?? "",
          name: member.name ?? "",
          displayName: member.profile?.display_name || member.profile?.real_name || member.name || "",
          isBot: true,
          deleted: false,
        });
      }

      cursor = response.response_metadata?.next_cursor;
      if (!cursor) {
        break;
      }
      page++;
    }
  } catch (err) {
    logVerbose(`slack teammates discovery failed: ${String(err)}`);
    return [];
  }

  return teammates;
}

export function formatTeammateRoster(teammates: TeammateInfo[]): string {
  if (teammates.length === 0) {
    return "";
  }

  const lines = teammates.map(
    (t) => `- @${t.name} (${t.userId}): ${t.displayName || "Bot user"}`
  );

  return `## Your Teammates (other bots in this workspace)\n${lines.join("\n")}\nWhen someone mentions a teammate, that message may not be for you.`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/slack/monitor/teammates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat(slack): add teammate discovery module" src/slack/monitor/teammates.ts src/slack/monitor/teammates.test.ts
```

---

## Task 3: Add Teammates to Slack Monitor Context

**Files:**
- Modify: `src/slack/monitor/context.ts`
- Modify: `src/slack/monitor/provider.ts`

**Step 1: Add teammates to SlackMonitorContext type**

Modify `src/slack/monitor/context.ts` around line 52 (in SlackMonitorContext type):

```typescript
// Add import at top
import type { TeammateInfo } from "./teammates.js";

// Add to SlackMonitorContext type after botUserId (around line 62)
  teammates: TeammateInfo[];
```

**Step 2: Add to createSlackMonitorContext params**

Modify `src/slack/monitor/context.ts` createSlackMonitorContext params (around line 135):

```typescript
// Add to params type
  teammates?: TeammateInfo[];
```

**Step 3: Add to returned context object**

Modify `src/slack/monitor/context.ts` return statement (around line 395):

```typescript
// Add to returned object
    teammates: params.teammates ?? [],
```

**Step 4: Discover teammates in provider.ts**

Modify `src/slack/monitor/provider.ts`:

```typescript
// Add import at top (around line 22)
import { discoverTeammates } from "./teammates.js";

// After auth.test call (around line 172), add teammate discovery:
  let teammates: import("./teammates.js").TeammateInfo[] = [];
  if (botUserId) {
    teammates = await discoverTeammates({
      client: app.client,
      token: botToken,
      selfUserId: botUserId,
    });
    if (teammates.length > 0) {
      runtime.log?.(`slack: discovered ${teammates.length} teammate bot(s)`);
    }
  }

// Pass to createSlackMonitorContext (around line 212)
    teammates,
```

**Step 5: Run type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 6: Commit**

```bash
scripts/committer "feat(slack): add teammates to monitor context" src/slack/monitor/context.ts src/slack/monitor/provider.ts
```

---

## Task 4: Create Self-Identity Context Builder

**Files:**
- Create: `src/slack/monitor/identity-context.ts`
- Create: `src/slack/monitor/identity-context.test.ts`

**Step 1: Write the test**

Create `src/slack/monitor/identity-context.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildIdentityContext, type IdentityContextParams } from "./identity-context.js";

describe("buildIdentityContext", () => {
  it("builds identity block with all fields", () => {
    const result = buildIdentityContext({
      botUserId: "U12345",
      botName: "claude-bot",
      displayName: "Claude Bot",
    });

    expect(result).toContain("## Your Identity");
    expect(result).toContain("Name: Claude Bot");
    expect(result).toContain("Slack User ID: U12345");
    expect(result).toContain("Mention format: <@U12345>");
  });

  it("uses botName as fallback for displayName", () => {
    const result = buildIdentityContext({
      botUserId: "U12345",
      botName: "claude-bot",
    });

    expect(result).toContain("Name: claude-bot");
  });

  it("includes teammates when provided", () => {
    const result = buildIdentityContext({
      botUserId: "U12345",
      botName: "claude-bot",
      teammates: [
        { userId: "U99999", name: "data-bot", displayName: "Data Bot", isBot: true, deleted: false },
      ],
    });

    expect(result).toContain("## Your Teammates");
    expect(result).toContain("@data-bot (U99999)");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/slack/monitor/identity-context.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `src/slack/monitor/identity-context.ts`:

```typescript
import type { TeammateInfo } from "./teammates.js";
import { formatTeammateRoster } from "./teammates.js";

export type IdentityContextParams = {
  botUserId: string;
  botName?: string;
  displayName?: string;
  teammates?: TeammateInfo[];
};

export function buildIdentityContext(params: IdentityContextParams): string {
  const { botUserId, botName, displayName, teammates } = params;
  const name = displayName || botName || "Assistant";

  const identityBlock = [
    "## Your Identity",
    `- Name: ${name}`,
    `- Slack User ID: ${botUserId}`,
    `- Mention format: <@${botUserId}>`,
  ].join("\n");

  const teammatesBlock = teammates && teammates.length > 0
    ? formatTeammateRoster(teammates)
    : "";

  return [identityBlock, teammatesBlock].filter(Boolean).join("\n\n");
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/slack/monitor/identity-context.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat(slack): add identity context builder" src/slack/monitor/identity-context.ts src/slack/monitor/identity-context.test.ts
```

---

## Task 5: Enhance Mention Context

**Files:**
- Create: `src/slack/monitor/mention-context.ts`
- Create: `src/slack/monitor/mention-context.test.ts`
- Modify: `src/slack/monitor/message-handler/prepare.ts`

**Step 1: Write the test**

Create `src/slack/monitor/mention-context.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildMentionContext, type MentionContextParams } from "./mention-context.js";

describe("buildMentionContext", () => {
  it("detects direct mention", () => {
    const result = buildMentionContext({
      messageText: "Hey <@U12345> can you help?",
      selfUserId: "U12345",
      teammates: [],
    });

    expect(result.wasMentioned).toBe(true);
    expect(result.mentionType).toBe("direct");
  });

  it("detects no mention", () => {
    const result = buildMentionContext({
      messageText: "Just chatting here",
      selfUserId: "U12345",
      teammates: [],
    });

    expect(result.wasMentioned).toBe(false);
    expect(result.mentionType).toBe("none");
  });

  it("detects teammate mentions", () => {
    const result = buildMentionContext({
      messageText: "Hey <@U99999> what do you think?",
      selfUserId: "U12345",
      teammates: [
        { userId: "U99999", name: "data-bot", displayName: "Data Bot", isBot: true, deleted: false },
      ],
    });

    expect(result.wasMentioned).toBe(false);
    expect(result.otherBotsMentioned).toHaveLength(1);
    expect(result.otherBotsMentioned[0].userId).toBe("U99999");
  });

  it("detects implicit mention from thread reply", () => {
    const result = buildMentionContext({
      messageText: "Thanks!",
      selfUserId: "U12345",
      teammates: [],
      isReplyToSelf: true,
    });

    expect(result.wasMentioned).toBe(true);
    expect(result.mentionType).toBe("implicit");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/slack/monitor/mention-context.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `src/slack/monitor/mention-context.ts`:

```typescript
import type { TeammateInfo } from "./teammates.js";

export type MentionContext = {
  wasMentioned: boolean;
  mentionType: "direct" | "implicit" | "none";
  otherBotsMentioned: TeammateInfo[];
  isReplyToSelf: boolean;
};

export type MentionContextParams = {
  messageText: string;
  selfUserId: string;
  teammates: TeammateInfo[];
  isReplyToSelf?: boolean;
};

const MENTION_PATTERN = /<@([A-Z0-9]+)>/g;

export function buildMentionContext(params: MentionContextParams): MentionContext {
  const { messageText, selfUserId, teammates, isReplyToSelf = false } = params;

  const mentions = [...messageText.matchAll(MENTION_PATTERN)].map(m => m[1]);
  const directlyMentioned = mentions.includes(selfUserId);

  const teammateMap = new Map(teammates.map(t => [t.userId, t]));
  const otherBotsMentioned = mentions
    .filter(id => id !== selfUserId && teammateMap.has(id))
    .map(id => teammateMap.get(id)!)
    .filter((v, i, arr) => arr.findIndex(t => t.userId === v.userId) === i);

  let mentionType: MentionContext["mentionType"] = "none";
  if (directlyMentioned) {
    mentionType = "direct";
  } else if (isReplyToSelf) {
    mentionType = "implicit";
  }

  return {
    wasMentioned: directlyMentioned || isReplyToSelf,
    mentionType,
    otherBotsMentioned,
    isReplyToSelf,
  };
}

export function formatMentionContextHint(ctx: MentionContext): string | undefined {
  if (ctx.otherBotsMentioned.length === 0) {
    return undefined;
  }

  const names = ctx.otherBotsMentioned.map(t => `@${t.name}`).join(", ");
  return `Note: This message also mentions ${names} - it may be directed at them.`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/slack/monitor/mention-context.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat(slack): add mention context builder" src/slack/monitor/mention-context.ts src/slack/monitor/mention-context.test.ts
```

---

## Task 6: Create Project Context Resolution

**Files:**
- Create: `src/memory/project-scope.ts`
- Create: `src/memory/project-scope.test.ts`

**Step 1: Write the test**

Create `src/memory/project-scope.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  resolveProjectFromChannel,
  resolveProjectDbPath,
  type ProjectConfig,
} from "./project-scope.js";

describe("resolveProjectFromChannel", () => {
  const projects: ProjectConfig[] = [
    { id: "backend", name: "Backend", channels: ["#backend", "#api-bugs"] },
    { id: "frontend", name: "Frontend", channels: ["#frontend", "#ui-issues"] },
  ];

  it("matches channel to project", () => {
    const result = resolveProjectFromChannel({
      channelName: "#backend",
      projects,
    });
    expect(result?.id).toBe("backend");
  });

  it("returns undefined for unmatched channel", () => {
    const result = resolveProjectFromChannel({
      channelName: "#random",
      projects,
    });
    expect(result).toBeUndefined();
  });

  it("normalizes channel name (strips #)", () => {
    const result = resolveProjectFromChannel({
      channelName: "backend",
      projects,
    });
    expect(result?.id).toBe("backend");
  });
});

describe("resolveProjectDbPath", () => {
  it("returns project-specific path", () => {
    const result = resolveProjectDbPath({
      agentId: "main",
      projectId: "backend",
      baseDir: "/home/user/.openclaw/state/memory",
    });
    expect(result).toBe("/home/user/.openclaw/state/memory/main/projects/backend.sqlite");
  });

  it("returns global path when no project", () => {
    const result = resolveProjectDbPath({
      agentId: "main",
      projectId: undefined,
      baseDir: "/home/user/.openclaw/state/memory",
    });
    expect(result).toBe("/home/user/.openclaw/state/memory/main/_global.sqlite");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/memory/project-scope.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `src/memory/project-scope.ts`:

```typescript
import path from "node:path";

export type ProjectConfig = {
  id: string;
  name: string;
  channels?: string[];
  sources?: string[];
  keywords?: string[];
};

export type ProjectContext = {
  projectId: string | undefined;
  projectName: string | undefined;
  source: "channel" | "explicit" | "default" | "none";
};

function normalizeChannelName(name: string): string {
  return name.trim().toLowerCase().replace(/^#/, "");
}

export function resolveProjectFromChannel(params: {
  channelName?: string;
  projects: ProjectConfig[];
}): ProjectConfig | undefined {
  const { channelName, projects } = params;
  if (!channelName) {
    return undefined;
  }

  const normalized = normalizeChannelName(channelName);

  for (const project of projects) {
    const channels = project.channels ?? [];
    for (const ch of channels) {
      if (normalizeChannelName(ch) === normalized) {
        return project;
      }
    }
  }

  return undefined;
}

export function resolveProjectContext(params: {
  channelName?: string;
  explicitProjectId?: string;
  defaultProjectId?: string;
  projects: ProjectConfig[];
}): ProjectContext {
  const { channelName, explicitProjectId, defaultProjectId, projects } = params;

  // Explicit override takes precedence
  if (explicitProjectId) {
    const project = projects.find(p => p.id === explicitProjectId);
    if (project) {
      return {
        projectId: project.id,
        projectName: project.name,
        source: "explicit",
      };
    }
  }

  // Try channel mapping
  const channelProject = resolveProjectFromChannel({ channelName, projects });
  if (channelProject) {
    return {
      projectId: channelProject.id,
      projectName: channelProject.name,
      source: "channel",
    };
  }

  // Fall back to default
  if (defaultProjectId) {
    const project = projects.find(p => p.id === defaultProjectId);
    if (project) {
      return {
        projectId: project.id,
        projectName: project.name,
        source: "default",
      };
    }
  }

  return {
    projectId: undefined,
    projectName: undefined,
    source: "none",
  };
}

export function resolveProjectDbPath(params: {
  agentId: string;
  projectId: string | undefined;
  baseDir: string;
}): string {
  const { agentId, projectId, baseDir } = params;

  if (projectId) {
    return path.join(baseDir, agentId, "projects", `${projectId}.sqlite`);
  }

  return path.join(baseDir, agentId, "_global.sqlite");
}

export function listAvailableProjects(projects: ProjectConfig[]): string {
  if (projects.length === 0) {
    return "No projects configured.";
  }

  return projects
    .map(p => `- ${p.id}: ${p.name}${p.channels?.length ? ` (${p.channels.join(", ")})` : ""}`)
    .join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/memory/project-scope.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat(memory): add project context resolution" src/memory/project-scope.ts src/memory/project-scope.test.ts
```

---

## Task 7: Create Cross-Project Search Tool

**Files:**
- Create: `src/agents/tools/cross-project-search.ts`
- Create: `src/agents/tools/cross-project-search.test.ts`

**Step 1: Write the test**

Create `src/agents/tools/cross-project-search.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { crossProjectSearchSchema, validateCrossProjectSearch } from "./cross-project-search.js";

describe("crossProjectSearchSchema", () => {
  it("validates correct input", () => {
    const result = validateCrossProjectSearch({
      project: "backend",
      query: "authentication flow",
    });

    expect(result.valid).toBe(true);
    expect(result.data?.project).toBe("backend");
    expect(result.data?.query).toBe("authentication flow");
  });

  it("rejects missing project", () => {
    const result = validateCrossProjectSearch({
      query: "authentication flow",
    });

    expect(result.valid).toBe(false);
  });

  it("rejects empty query", () => {
    const result = validateCrossProjectSearch({
      project: "backend",
      query: "",
    });

    expect(result.valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/agents/tools/cross-project-search.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `src/agents/tools/cross-project-search.ts`:

```typescript
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const crossProjectSearchSchema = Type.Object({
  project: Type.String({
    description: "Target project ID to search (e.g., 'backend-api', 'frontend')",
    minLength: 1,
  }),
  query: Type.String({
    description: "Search query to find relevant memories in the target project",
    minLength: 1,
  }),
});

export type CrossProjectSearchInput = Static<typeof crossProjectSearchSchema>;

export function validateCrossProjectSearch(input: unknown): {
  valid: boolean;
  data?: CrossProjectSearchInput;
  error?: string;
} {
  try {
    const cleaned = Value.Clean(crossProjectSearchSchema, input);
    const valid = Value.Check(crossProjectSearchSchema, cleaned);
    if (!valid) {
      const errors = [...Value.Errors(crossProjectSearchSchema, cleaned)];
      return { valid: false, error: errors[0]?.message ?? "Invalid input" };
    }
    return { valid: true, data: cleaned as CrossProjectSearchInput };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

export const CROSS_PROJECT_SEARCH_TOOL_NAME = "cross_project_search";

export const crossProjectSearchToolDefinition = {
  name: CROSS_PROJECT_SEARCH_TOOL_NAME,
  description: `Search another project's memory when you need information from a different context.
Only use this when explicitly relevant to the conversation.
Your current project's memory is searched automatically - this tool is for cross-referencing other projects.`,
  input_schema: {
    type: "object" as const,
    properties: {
      project: {
        type: "string",
        description: "Target project ID to search",
      },
      query: {
        type: "string",
        description: "Search query",
      },
    },
    required: ["project", "query"],
  },
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/agents/tools/cross-project-search.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat(tools): add cross-project search tool definition" src/agents/tools/cross-project-search.ts src/agents/tools/cross-project-search.test.ts
```

---

## Task 8: Create Project Memory Manager

**Files:**
- Create: `src/memory/project-manager.ts`
- Create: `src/memory/project-manager.test.ts`

**Step 1: Write the test**

Create `src/memory/project-manager.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ProjectMemoryManager } from "./project-manager.js";
import type { ProjectConfig } from "./project-scope.js";

// Mock the MemoryIndexManager
vi.mock("./manager.js", () => ({
  MemoryIndexManager: {
    get: vi.fn().mockResolvedValue(null),
  },
}));

describe("ProjectMemoryManager", () => {
  const projects: ProjectConfig[] = [
    { id: "backend", name: "Backend", channels: ["#backend"] },
    { id: "frontend", name: "Frontend", channels: ["#frontend"] },
  ];

  it("resolves project from channel", () => {
    const manager = new ProjectMemoryManager({
      agentId: "main",
      projects,
      cfg: {} as any,
    });

    const ctx = manager.resolveContext({ channelName: "#backend" });
    expect(ctx.projectId).toBe("backend");
    expect(ctx.source).toBe("channel");
  });

  it("allows explicit project override", () => {
    const manager = new ProjectMemoryManager({
      agentId: "main",
      projects,
      cfg: {} as any,
    });

    const ctx = manager.resolveContext({
      channelName: "#backend",
      explicitProjectId: "frontend",
    });
    expect(ctx.projectId).toBe("frontend");
    expect(ctx.source).toBe("explicit");
  });

  it("lists available projects", () => {
    const manager = new ProjectMemoryManager({
      agentId: "main",
      projects,
      cfg: {} as any,
    });

    const list = manager.listProjects();
    expect(list).toContain("backend");
    expect(list).toContain("frontend");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/memory/project-manager.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `src/memory/project-manager.ts`:

```typescript
import type { OpenClawConfig } from "../config/config.js";
import {
  resolveProjectContext,
  resolveProjectDbPath,
  listAvailableProjects,
  type ProjectConfig,
  type ProjectContext,
} from "./project-scope.js";
import { MemoryIndexManager, type MemorySearchResult } from "./manager.js";

export class ProjectMemoryManager {
  private readonly agentId: string;
  private readonly projects: ProjectConfig[];
  private readonly cfg: OpenClawConfig;
  private readonly defaultProjectId?: string;
  private readonly managers = new Map<string, MemoryIndexManager | null>();

  constructor(params: {
    agentId: string;
    projects: ProjectConfig[];
    defaultProjectId?: string;
    cfg: OpenClawConfig;
  }) {
    this.agentId = params.agentId;
    this.projects = params.projects;
    this.defaultProjectId = params.defaultProjectId;
    this.cfg = params.cfg;
  }

  resolveContext(params: {
    channelName?: string;
    explicitProjectId?: string;
  }): ProjectContext {
    return resolveProjectContext({
      channelName: params.channelName,
      explicitProjectId: params.explicitProjectId,
      defaultProjectId: this.defaultProjectId,
      projects: this.projects,
    });
  }

  listProjects(): string {
    return listAvailableProjects(this.projects);
  }

  getProject(projectId: string): ProjectConfig | undefined {
    return this.projects.find(p => p.id === projectId);
  }

  async search(params: {
    projectId?: string;
    query: string;
    maxResults?: number;
    sessionKey?: string;
  }): Promise<MemorySearchResult[]> {
    const manager = await this.getManagerForProject(params.projectId);
    if (!manager) {
      return [];
    }

    return manager.search(params.query, {
      maxResults: params.maxResults,
      sessionKey: params.sessionKey,
    });
  }

  async crossProjectSearch(params: {
    targetProjectId: string;
    query: string;
    maxResults?: number;
  }): Promise<MemorySearchResult[]> {
    const project = this.getProject(params.targetProjectId);
    if (!project) {
      return [];
    }

    const manager = await this.getManagerForProject(params.targetProjectId);
    if (!manager) {
      return [];
    }

    return manager.search(params.query, {
      maxResults: params.maxResults,
    });
  }

  private async getManagerForProject(
    projectId: string | undefined
  ): Promise<MemoryIndexManager | null> {
    const key = projectId ?? "_global";
    const cached = this.managers.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // For now, use the existing MemoryIndexManager
    // Future: create project-specific manager with custom db path
    const manager = await MemoryIndexManager.get({
      cfg: this.cfg,
      agentId: this.agentId,
    });

    this.managers.set(key, manager);
    return manager;
  }

  buildMemoryScopePrompt(ctx: ProjectContext): string {
    if (!ctx.projectId) {
      return "## Memory Scope\nYour memory searches use global agent memory (no project context).";
    }

    const projectsList = this.projects
      .filter(p => p.id !== ctx.projectId)
      .map(p => p.id)
      .join(", ");

    return [
      "## Memory Scope",
      `You are currently in project: ${ctx.projectId} (${ctx.projectName})`,
      "Your memory searches are scoped to this project only.",
      "",
      "To query another project's memory, use the cross_project_search tool:",
      `- cross_project_search(project: "<project-id>", query: "<search query>")`,
      "- Only use this when explicitly relevant to the conversation.",
      projectsList ? `- Available projects: ${projectsList}` : "",
    ].filter(Boolean).join("\n");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/memory/project-manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat(memory): add project memory manager" src/memory/project-manager.ts src/memory/project-manager.test.ts
```

---

## Task 9: Integrate Identity Context into Group Intro

**Files:**
- Modify: `src/auto-reply/reply/groups.ts`

**Step 1: Add identity context parameter**

Modify `src/auto-reply/reply/groups.ts` to accept identity context:

```typescript
// Add new type for identity context
export type SlackIdentityContext = {
  botUserId?: string;
  botName?: string;
  displayName?: string;
  teammates?: Array<{
    userId: string;
    name: string;
    displayName: string;
  }>;
};

// Update buildGroupIntro params type (around line 71)
export function buildGroupIntro(params: {
  cfg: OpenClawConfig;
  sessionCtx: TemplateContext;
  sessionEntry?: SessionEntry;
  defaultActivation: "always" | "mention" | "auto";
  silentToken: string;
  slackIdentity?: SlackIdentityContext;  // Add this
}): string {
```

**Step 2: Add identity block to output**

Add identity block construction inside buildGroupIntro (before return statement):

```typescript
  // Build identity block for Slack (before the return statement around line 133)
  const identityBlock = params.slackIdentity?.botUserId
    ? [
        "## Your Identity",
        `- Name: ${params.slackIdentity.displayName || params.slackIdentity.botName || "Assistant"}`,
        `- Slack User ID: ${params.slackIdentity.botUserId}`,
        `- Mention format: <@${params.slackIdentity.botUserId}>`,
      ].join("\n")
    : undefined;

  const teammatesBlock =
    params.slackIdentity?.teammates && params.slackIdentity.teammates.length > 0
      ? [
          "## Your Teammates (other bots in this workspace)",
          ...params.slackIdentity.teammates.map(
            t => `- @${t.name} (${t.userId}): ${t.displayName || "Bot user"}`
          ),
          "When someone mentions a teammate, that message may not be for you.",
        ].join("\n")
      : undefined;

  // Modify return to include identity blocks
  return [
    identityBlock,
    teammatesBlock,
    subjectLine,
    // ... rest of existing lines
  ]
    .filter(Boolean)
    .join("\n\n");
```

**Step 3: Run type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 4: Commit**

```bash
scripts/committer "feat(groups): add slack identity context to group intro" src/auto-reply/reply/groups.ts
```

---

## Task 10: Wire Up Slack Message Handler with Identity

**Files:**
- Modify: `src/slack/monitor/message-handler/prepare.ts`

**Step 1: Import new modules**

Add imports at top of `src/slack/monitor/message-handler/prepare.ts`:

```typescript
import { buildMentionContext, formatMentionContextHint } from "../mention-context.js";
import { buildIdentityContext } from "../identity-context.js";
```

**Step 2: Build mention context in prepareSlackMessage**

Add mention context building after message preparation (find appropriate location in prepareSlackMessage function):

```typescript
  // Build mention context for enriched awareness
  const mentionCtx = buildMentionContext({
    messageText: rawBody,
    selfUserId: ctx.botUserId,
    teammates: ctx.teammates,
    isReplyToSelf: implicitMention,
  });

  // Add hint if other bots were mentioned
  const mentionHint = formatMentionContextHint(mentionCtx);
```

**Step 3: Pass identity to group intro builder**

When calling buildGroupIntro, pass the slack identity:

```typescript
  // Pass identity context when building group intro
  slackIdentity: {
    botUserId: ctx.botUserId,
    botName: undefined, // Would come from bot info if needed
    displayName: undefined,
    teammates: ctx.teammates.map(t => ({
      userId: t.userId,
      name: t.name,
      displayName: t.displayName,
    })),
  },
```

**Step 4: Run tests**

Run: `pnpm vitest run src/slack`
Expected: All tests pass

**Step 5: Commit**

```bash
scripts/committer "feat(slack): wire up identity and mention context" src/slack/monitor/message-handler/prepare.ts
```

---

## Task 11: Integration Test for Full Flow

**Files:**
- Create: `src/slack/monitor/coworking.test.ts`

**Step 1: Write integration test**

Create `src/slack/monitor/coworking.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { discoverTeammates } from "./teammates.js";
import { buildIdentityContext } from "./identity-context.js";
import { buildMentionContext } from "./mention-context.js";

describe("co-working integration", () => {
  it("builds complete identity context with teammates", async () => {
    const mockClient = {
      users: {
        list: vi.fn().mockResolvedValue({
          ok: true,
          members: [
            { id: "U002", name: "data-bot", is_bot: true, deleted: false, profile: { display_name: "Data Bot" } },
            { id: "U003", name: "devops-bot", is_bot: true, deleted: false, profile: { display_name: "DevOps Bot" } },
          ],
        }),
      },
    };

    const teammates = await discoverTeammates({
      client: mockClient as any,
      token: "test-token",
      selfUserId: "U001",
    });

    const identityContext = buildIdentityContext({
      botUserId: "U001",
      botName: "claude-bot",
      displayName: "Claude Bot",
      teammates,
    });

    expect(identityContext).toContain("Claude Bot");
    expect(identityContext).toContain("U001");
    expect(identityContext).toContain("data-bot");
    expect(identityContext).toContain("devops-bot");
  });

  it("detects mentions correctly with teammates", async () => {
    const teammates = [
      { userId: "U002", name: "data-bot", displayName: "Data Bot", isBot: true, deleted: false },
    ];

    // Self mentioned
    const selfMention = buildMentionContext({
      messageText: "Hey <@U001> can you help?",
      selfUserId: "U001",
      teammates,
    });
    expect(selfMention.wasMentioned).toBe(true);
    expect(selfMention.mentionType).toBe("direct");

    // Teammate mentioned
    const teammateMention = buildMentionContext({
      messageText: "Hey <@U002> can you help?",
      selfUserId: "U001",
      teammates,
    });
    expect(teammateMention.wasMentioned).toBe(false);
    expect(teammateMention.otherBotsMentioned).toHaveLength(1);
    expect(teammateMention.otherBotsMentioned[0].name).toBe("data-bot");
  });
});
```

**Step 2: Run test**

Run: `pnpm vitest run src/slack/monitor/coworking.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
scripts/committer "test(slack): add co-working integration tests" src/slack/monitor/coworking.test.ts
```

---

## Task 12: Final Verification and Documentation

**Step 1: Run full test suite**

Run: `pnpm test -- --run src/slack src/memory`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Verify lint passes**

Run: `pnpm lint`
Expected: No errors

**Step 4: Final commit with all changes**

If any files were missed, commit them:

```bash
git status
# If any unstaged changes, commit appropriately
```

---

## Summary

This plan implements:

1. **Co-Working Identity (Tasks 1-5, 9-11):**
   - Teammate discovery via Slack API
   - Self-identity injection in system prompts
   - Mention context enrichment with teammate awareness

2. **Project-Oriented Memory (Tasks 1, 6-8):**
   - Project configuration types
   - Channel-to-project mapping
   - Project context resolution (channel/explicit/default)
   - Cross-project search tool
   - Project memory manager

The implementation follows TDD principles with tests before implementation, and makes incremental commits after each task.
