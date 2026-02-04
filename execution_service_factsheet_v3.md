# Execution Service Factsheet (v3)

**Status**: Product Architecture
**Last Updated**: 2026-02-04
**Changes from v2**: Added frontend, project board UI, sleep-time compute, trace-based self-improvement, async/sync hybrid collaboration model, dual interaction modes (quick/task), chat-based task creation, question supersession, external world watchers, policy engine (attention/WIP/autonomy/planning policies), weekly review ritual, success criteria with self-assessment, priority classification, behavior calibration.

---

## 1. Service Overview

### 1.1 Purpose

The Execution Service is a **web-based autonomous agent platform**. Users interact through **two modes**: a conversational chat for quick questions and task creation, and a project-board UI (inspired by Linear/Jira) for monitoring agent progress, reviewing deliverables, and collaborating with agents through both asynchronous comments and synchronous discussions.

Tasks are typically created through conversation — the user describes a goal in the chat, the agent refines requirements via sync dialogue, produces a plan, and the user confirms before async execution begins. Users can also create tasks directly from the board UI.

Agents run autonomously in Docker containers using an LLM-in-a-loop architecture. A **Policy Engine** governs agent-human interaction — controlling notification timing, WIP limits, autonomy level, and planning heuristics — so the human's attention is protected while the agent maximizes autonomous progress. A **Watcher Service** monitors external sources (email, messaging, APIs, price feeds) and triggers agent actions when conditions are met. A background **Sleep-Time Compute** system reviews daily traces to generate reminders, consolidate memory, detect failure patterns, and propose self-improvements.

### 1.2 Core Capabilities

| Capability | Description |
|------------|-------------|
| **Dual Interaction Modes** | Quick mode (chatbot) for simple queries; Task mode (board) for long-horizon work |
| **Chat-Based Task Creation** | User describes goal in chat; agent refines requirements via sync dialogue; produces plan for user confirmation |
| **Project Board** | Kanban-style task management where agent plan steps auto-populate as work items |
| **Agent Execution** | LLM-in-a-loop with tools, planning, compaction, sub-agents (unchanged from v2) |
| **First-Draft Review** | Agent produces deliverables; user reviews/approves/requests changes on the board |
| **Async Collaboration** | Agent and user communicate via comments on work items; agent can supersede outdated questions |
| **Sync Collaboration** | Live discussions for requirement refinement, complex decisions; agent can re-enter when environment changes |
| **External World Watchers** | Plugin-based monitoring of email, messaging, APIs, price feeds with condition evaluation and trigger actions |
| **Policy Engine** | Configurable policies governing notification timing (AttentionPolicy), concurrency limits (WIPPolicy), agent autonomy level, and planning heuristics |
| **Weekly Review** | System-scheduled interactive session: review all tasks, re-prioritize, process pending reviews, calibrate agent behavior |
| **Success Criteria** | Tasks carry explicit outcome definitions (OKR-style); agent self-assesses before publishing deliverables |
| **Sleep-Time Compute** | Nightly background jobs: daily digest, memory consolidation, failure analysis, skill generation |
| **Trace-Based Self-Improvement** | Review agent traces, detect patterns, propose prompt/skill updates |
| **File System Browser** | Each agent workspace is browsable in the UI — plans, memos, scratch files, deliverables, tool outputs |

### 1.3 System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND (Web App)                                │
│                                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │
│  │ Chat Panel   │ │ Project Board│ │ Task Detail │ │ Sync Chat  │ │   File    │ │
│  │ (Quick Mode  │ │ (Kanban/List)│ │ + Comments  │ │ (Live Mode)│ │  Browser  │ │
│  │  + Task      │ │              │ │             │ │            │ │(Workspace)│ │
│  │  Creation)   │ │              │ │             │ │            │ │           │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬──────┘ └─────┬──────┘ └─────┬─────┘ │
│         └────────────────┴────────────────┴───────────────┴───────────────┘       │
│                                        │                                         │
│                              WebSocket + REST API                                │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┼─────────────────────────────────────────┐
│                              API SERVER (Backend)                                │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ Session           │  │ Board Sync       │  │ Discussion Scheduler          │   │
│  │ Coordinator       │  │ Engine           │  │                               │   │
│  │ (routing, HITL,   │  │ (plan → board    │  │ (schedule sync sessions,      │   │
│  │  control)         │  │  projection)     │  │  weekly review, availability) │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ Policy Engine                                                            │   │
│  │ (attention policy, WIP policy, autonomy policy, planning policy)        │   │
│  │ → Notification Service (batching, digest windows, DND, priority filter) │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ Agent Runner      │  │ Trace Store      │  │ Sleep-Time Compute            │   │
│  │ (agent loop,      │  │ (JSONL per task, │  │ (nightly: digest, memory,     │   │
│  │  tools, container)│  │  query API)      │  │  failures, skills)            │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ Watcher Service                                                          │   │
│  │ (source plugins: email, webhook, API poll, messaging, RSS, cron)        │   │
│  │ (condition eval: regex, threshold, LLM-as-judge)                        │   │
│  │ (actions: create task, inject into task, notify, run skill)             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │                    │
         ▼                    ▼                    ▼                    ▼
   ┌──────────┐       ┌────────────┐       ┌────────────┐       ┌──────────┐
   │  Docker  │       │   Redis    │       │  Context   │       │ Database │
   │  Engine  │       │  Streams   │       │  Service   │       │ (Postgres)│
   └──────────┘       └────────────┘       └────────────┘       └──────────┘
```

---

## 2. Interaction Modes

### 2.1 Two Modes

Not all interactions need a kanban board. The system supports two modes:

| Mode | Entry Point | When to Use | What Happens |
|------|-------------|-------------|--------------|
| **Quick Mode** | Chat panel | Simple questions, brainstorming, small actions, status checks | Chatbot-style: user sends message, agent responds. No board item created. |
| **Task Mode** | Chat panel (auto-escalation) or "New Task" button on board | Multi-step research, analysis, builds, anything taking >5 minutes | Agent refines requirements → produces plan → user confirms → async execution on board. |

### 2.2 Quick Mode

Standard chatbot UX. User types in the chat panel, agent responds directly. No task, no board item, no plan. Examples:

- "What's the capital of France?" → immediate answer
- "Summarize this PDF" → reads + responds
- "What's the status of my tasks?" → checks board, responds

Quick mode conversations are still persisted (for trace/memory purposes) but do not appear on the project board.

### 2.3 Task Mode — Chat-Based Task Creation

Most tasks start as a conversation, not a form. The flow:

```
User types in chat: "Analyze our top 10 competitors' pricing"
        │
        ▼
Agent evaluates goal clarity
        │
        ├── Goal is clear enough:
        │     Agent creates plan → presents plan to user in chat
        │     User confirms / modifies → Task created on board
        │     Agent begins async execution
        │
        └── Goal is ambiguous:
              Agent enters sync dialogue to refine requirements:
              "Which competitors? SaaS only or all? What dimensions?"
              User and agent chat back and forth
              Agent produces requirement summary + plan
              User confirms → Task created on board
              Agent begins async execution
```

```typescript
/** Task creation from chat conversation */
async function handleChatMessage(userId: string, message: string): Promise<void> {
  // Classify: is this a quick question or a task?
  const classification = await classifyIntent(message);

  if (classification.mode === 'quick') {
    // Quick mode: respond directly
    const response = await agentRespond(userId, message);
    await ws.send(userId, { type: 'chat_response', content: response });
    return;
  }

  // Task mode: start task creation flow
  const goalAnalysis = await analyzeGoalClarity(message);

  if (goalAnalysis.clear_enough) {
    // Generate plan and present for confirmation
    const plan = await generateInitialPlan(message, goalAnalysis);
    await ws.send(userId, {
      type: 'plan_proposal',
      goal: message,
      plan: plan,
      message: 'Here is my proposed plan. Confirm to start, or let me know what to change.',
    });
    // User confirms → createTask() → board item created → async execution
  } else {
    // Enter sync refinement dialogue
    await ws.send(userId, {
      type: 'refinement_start',
      questions: goalAnalysis.clarifying_questions,
      message: goalAnalysis.opening_message,
    });
    // Continue sync chat until requirements are clear → then propose plan
  }
}
```

### 2.4 "New Task" Button (Alternative)

Users can also create tasks directly from the board UI by clicking "New Task". This opens a form with:
- Goal (text)
- Optional constraints
- Optional file attachments

The same flow applies: agent evaluates clarity, may ask clarifying questions via sync chat, proposes a plan, user confirms.

### 2.5 Re-Entry to Sync Mode

The agent can re-enter sync mode at any point during async execution when the environment changes and the original requirements no longer make sense:

```typescript
// Agent detects environment change that invalidates current approach
// Example: a dependency was deprecated, a competitor changed their pricing page, etc.

// Agent calls request_discussion with reason
await tools.request_discussion({
  item_id: currentWorkItem,
  topic: 'Requirements may need revision',
  context: 'The competitor pricing page now requires enterprise login. Our original approach of scraping public pages no longer works. I need to discuss alternative approaches.',
  urgency: 'high',
  block: true,  // pause until we discuss
  preparation_notes: 'Options: (A) Use their API instead, (B) Find cached version, (C) Skip this competitor',
});
```

---

## 3. Project Board

### 3.1 Concept

The project board is the **primary UI for managing long-horizon tasks**. Once a task is confirmed through chat, it appears on the board:

- Task appears as an **Epic** or **Story** depending on complexity
- Agent starts working, calls `update_plan` → plan steps automatically appear as **Work Items** on the board
- Agent updates plan status → Work Item status updates in real-time
- Agent leaves **Comments** on Work Items with findings, questions, blockers
- User comments asynchronously on Work Items to steer the agent
- User can enter **Sync Mode** to have a live discussion with the agent on any Work Item

### 3.2 Data Model

```typescript
/** A Task is the top-level unit — an Epic or Story depending on complexity */
interface Task {
  task_id: string;
  session_id: string;
  user_id: string;

  /** User-provided goal */
  goal: string;
  constraints?: string[];

  /** Auto-classified based on estimated complexity */
  size: 'story' | 'epic';

  /**
   * TaskStatus is for VISUALIZATION ONLY — it tells the frontend what
   * badge/color to show on the board. The real execution state is controlled
   * by the agent loop internally (running, waiting on injection queue, etc.).
   * The UI status is derived from agent internal state, not the other way around.
   */
  status: TaskStatus;

  /** Agent's current plan — source of truth for Work Items */
  plan_snapshot?: PlanSnapshot;

  /**
   * Success criteria (OKR-style Key Results). The agent evaluates deliverables
   * against these before publishing. Human reviews the self-assessment.
   * Generated by agent during planning, confirmed by human.
   */
  success_criteria?: SuccessCriterion[];

  /** Deliverables produced by the agent */
  deliverables: Deliverable[];

  /** Usage metrics */
  usage: UsageMetrics;

  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface SuccessCriterion {
  id: string;
  description: string;               // e.g., "Report covers all 10 competitors"
  type: 'required' | 'stretch';      // Stretch = nice-to-have (OKR 0.7 principle)
  /** Agent self-assessment — filled when deliverable is published */
  assessment?: {
    met: boolean;
    confidence: number;              // 0.0-1.0
    evidence: string;                // "Covered 10/10 competitors. See output/report.md Section 3."
  };
}

/**
 * Visualization-only status. Derived from agent internal state.
 * Note: no DISCUSSING status — sync discussions are a UI-layer concern.
 * A task remains RUNNING while a discussion happens on one of its work items.
 */
enum TaskStatus {
  PLANNING = 'PLANNING',         // Agent is refining requirements / creating plan
  RUNNING = 'RUNNING',           // Agent is executing
  BLOCKED = 'BLOCKED',           // Agent is waiting for user input
  PAUSED = 'PAUSED',             // User manually paused
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
```

### 3.3 Work Items (Plan Steps → Board Items)

Work Items are **projections of the agent's plan** — not a separate data model the agent writes to. When the agent calls `update_plan`, the system extracts plan steps and projects them onto the board.

```typescript
/** A Work Item is a projection of a plan step onto the board */
interface WorkItem {
  item_id: string;              // Same as plan step id
  task_id: string;
  description: string;
  status: WorkItemStatus;
  notes?: string;               // Agent's notes from the plan step

  /** Comments from agent and user */
  comments: Comment[];

  /** Sub-agent label if this step is being handled by a sub-agent */
  sub_agent_label?: string;

  /** Evidence/screenshots attached during execution */
  evidence: EvidenceRef[];

  /** Timestamps */
  started_at?: string;
  completed_at?: string;

  /** Position on the board (ordering) */
  sort_order: number;
}

enum WorkItemStatus {
  TODO = 'TODO',                 // plan step status: pending
  IN_PROGRESS = 'IN_PROGRESS',  // plan step status: in_progress
  DONE = 'DONE',                // plan step status: done
  BLOCKED = 'BLOCKED',          // plan step status: blocked
  SKIPPED = 'SKIPPED',          // plan step status: skipped
}
```

### 3.4 Plan-to-Board Projection

When the agent calls `update_plan`, the Board Sync Engine runs:

```typescript
async function syncPlanToBoard(taskId: string, plan: PlanSnapshot): Promise<void> {
  const existingItems = await db.getWorkItems(taskId);
  const existingIds = new Set(existingItems.map(i => i.item_id));

  for (const step of plan.steps) {
    if (existingIds.has(step.id)) {
      // Update existing item
      await db.updateWorkItem(step.id, {
        description: step.description,
        status: mapPlanStatusToWorkItemStatus(step.status),
        notes: step.notes,
        updated_at: new Date().toISOString(),
      });
      existingIds.delete(step.id);
    } else {
      // Create new item
      await db.createWorkItem({
        item_id: step.id,
        task_id: taskId,
        description: step.description,
        status: mapPlanStatusToWorkItemStatus(step.status),
        notes: step.notes,
        sort_order: plan.steps.indexOf(step),
      });
    }
  }

  // Items no longer in plan → mark as SKIPPED
  for (const removedId of existingIds) {
    await db.updateWorkItem(removedId, { status: 'SKIPPED' });
  }

  // Push real-time update to frontend via WebSocket
  await ws.broadcast(taskId, { type: 'board_updated', items: plan.steps });
}

function mapPlanStatusToWorkItemStatus(planStatus: string): WorkItemStatus {
  const map: Record<string, WorkItemStatus> = {
    'pending': 'TODO',
    'in_progress': 'IN_PROGRESS',
    'done': 'DONE',
    'blocked': 'BLOCKED',
    'skipped': 'SKIPPED',
  };
  return map[planStatus] || 'TODO';
}
```

### 3.5 Comments

Comments are the async communication channel between agent and user.

```typescript
interface Comment {
  comment_id: string;
  item_id: string;              // Work Item this comment is on
  task_id: string;
  author_type: 'agent' | 'user' | 'system';
  author_id: string;
  content: string;
  comment_type: CommentType;
  created_at: string;

  /**
   * Question supersession: when the agent re-asks a question because
   * the environment changed, the old question gets this field set.
   * UI renders superseded questions with strikethrough — still visible
   * (may contain valuable context) but clearly marked as outdated.
   */
  superseded_by?: string;       // comment_id of the replacement question

  /** For discussion_request type */
  discussion_request?: DiscussionRequest;
}

type CommentType =
  | 'note'                // Agent shares a finding or progress update
  | 'question'            // Agent asks user a question (async HITL)
  | 'answer'              // User answers agent's question
  | 'feedback'            // User gives feedback or correction
  | 'decision'            // Agent records a decision made
  | 'blocker'             // Agent reports a blocker
  | 'discussion_request'  // Agent requests a live discussion
  | 'discussion_summary'  // Agent posts discussion summary + next steps
  | 'deliverable'         // Agent announces a deliverable for review
  | 'system';             // System-generated (e.g., status change)
```

### 3.6 Question Supersession

When the agent posts a question and the environment later changes (new data arrives, a dependency breaks, etc.), the agent can supersede its own question rather than leaving an outdated question for the user:

```typescript
const postCommentTool_supersede_example = {
  // Agent calls post_comment with supersedes field
  name: 'post_comment',
  arguments: {
    item_id: 'step-3',
    content: 'Approach A is no longer viable (their API is down). Should I try approach C instead?',
    comment_type: 'question',
    block: true,
    supersedes: 'comment-xyz',  // ID of the old question
  },
};

// System behavior:
async function handleSupersession(newComment: Comment, supersededId: string): Promise<void> {
  // Mark old comment as superseded
  await db.updateComment(supersededId, {
    superseded_by: newComment.comment_id,
  });

  // If agent was blocked on the old question, the new question replaces it
  // UI: old question shows with strikethrough, new question is active
  await ws.broadcast(newComment.task_id, {
    type: 'comment_superseded',
    old_comment_id: supersededId,
    new_comment: newComment,
  });
}
```

**UI rendering**: superseded questions appear with ~~strikethrough text~~ and a label "Superseded by newer question below". The old question remains visible because it may still contain valuable context about the agent's reasoning history.

### 3.7 Agent Comment Tool

The agent posts comments via a tool. This replaces `ask_user` for async questions.

```typescript
const postCommentTool: Tool = {
  name: 'post_comment',
  description: `Post a comment on a work item in the project board. Use this to:
- Share findings or progress with the user
- Ask questions (the user will answer when available)
- Report blockers
- Record important decisions
- Announce deliverables for review

For urgent questions that block your progress, set block=true.
For questions that can wait, set block=false and continue working.`,
  parameters: {
    type: 'object',
    properties: {
      item_id: {
        type: 'string',
        description: 'The work item ID to comment on. Use "task" to comment at the task level.',
      },
      content: { type: 'string' },
      comment_type: {
        type: 'string',
        enum: ['note', 'question', 'decision', 'blocker', 'deliverable'],
      },
      block: {
        type: 'boolean',
        description: 'If true, pause execution until user responds. If false, continue working.',
        default: false,
      },
      supersedes: {
        type: 'string',
        description: 'Comment ID of a previous question this supersedes. The old question will be shown with strikethrough.',
      },
    },
    required: ['item_id', 'content', 'comment_type'],
  },
};
```

**Behavior**:
- `block: false` → Comment posted, agent continues working. User responds whenever.
- `block: true` → Comment posted, agent loop returns `BLOCKED`. User sees notification. When user responds, agent resumes.

### 3.8 User Comment Injection

When a user posts a comment on a Work Item, the system injects it into the agent's context:

```typescript
// User posts comment via API
async function handleUserComment(taskId: string, itemId: string, content: string): Promise<void> {
  // Save to database
  const comment = await db.createComment({
    item_id: itemId,
    task_id: taskId,
    author_type: 'user',
    content,
    comment_type: 'feedback',
  });

  // Inject into agent's context
  await injectionQueue.push(taskId, {
    injection_type: 'user_comment',
    content: `User commented on work item "${itemId}": ${content}`,
    metadata: { item_id: itemId, comment_id: comment.comment_id },
  });
}
```

The agent sees the comment on its next iteration and can react to it.

---

## 4. First-Draft Review Flow

### 4.1 Concept

Long-running tasks produce **deliverables** (reports, code, data, screenshots). Instead of the agent "completing" and sending a chat message, it publishes deliverables for structured review.

### 4.2 Flow

```
Agent completes a major piece of work
        │
        ▼
Agent calls publish_deliverable:
  filepath: "output/pricing-report.md"
  description: "Competitive pricing analysis report"
  type: "report"
        │
        ▼
Agent calls post_comment on the relevant work item:
  comment_type: "deliverable"
  content: "Pricing analysis complete. Report ready for review."
        │
        ▼
Board UI: Work Item shows "Deliverable Ready for Review" badge
User clicks → sees the deliverable rendered inline (markdown, images, etc.)
        │
        ├── User approves → posts comment "Looks good, continue"
        │   → injected into agent context → agent moves to next step
        │
        ├── User requests changes → posts comment "Add competitor D"
        │   → injected into agent context → agent revises deliverable
        │
        └── User does nothing → agent continues to next step after timeout
            (configurable: wait_for_review_timeout)
```

### 4.3 Deliverable Review States

```typescript
interface Deliverable {
  deliverable_id: string;
  task_id: string;
  item_id?: string;              // Associated work item
  filepath: string;
  description: string;
  type: 'report' | 'code' | 'data' | 'screenshot' | 'other';
  review_status: ReviewStatus;
  content?: string;              // Inline for small files
  size_bytes?: number;
  created_at: string;
  reviewed_at?: string;
  reviewer_comment?: string;
}

enum ReviewStatus {
  PENDING = 'PENDING',           // Awaiting user review
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  AUTO_APPROVED = 'AUTO_APPROVED', // Timeout, agent continued
}
```

### 4.4 Review Configuration

```typescript
interface ReviewConfig {
  /** Block agent until user reviews deliverable? */
  require_review: boolean;             // default: false

  /** If require_review=false, how long to wait before auto-approving */
  auto_approve_timeout_seconds: number; // default: 300 (5 min)

  /** Deliverable types that always require review */
  always_require_review: string[];     // default: [] (e.g., ['code', 'report'])
}
```

---

## 5. Async/Sync Hybrid Collaboration

### 5.1 Two Modes

| Mode | How It Works | When to Use |
|------|-------------|-------------|
| **Async** | Agent posts comments on Work Items. User responds when available. Agent may or may not block. | Default. Most interactions. Low-urgency questions, progress updates, deliverable reviews. |
| **Sync** | Live chat between agent and user. Can be agent-initiated or system-initiated. | Requirement refinement at task start, complex decisions, environment changes that invalidate assumptions, trade-off discussions. |

Sync mode serves two primary purposes:
1. **Requirement refinement** — at task creation, when the goal is ambiguous (see Section 2.3)
2. **Mid-execution re-alignment** — when the agent detects the environment has changed and needs to revisit decisions with the user (see Section 2.5)

### 5.2 Async Mode (Default)

Agent works autonomously. Communication happens through comments:

```
Agent working on task...
  │
  ├── Posts note: "Found 3 pricing tiers for Competitor A" (non-blocking)
  │
  ├── Posts question: "Should I include free tier in comparison?" (non-blocking, continues)
  │
  ├── Posts blocker: "Login to Competitor B requires 2FA. Need credentials." (blocking)
  │   └── Agent pauses. User sees notification. Responds when available.
  │
  └── Posts deliverable: "Draft report ready for review" (non-blocking or blocking per config)
```

User sees all of this on the board. Can respond to any comment at any time. Responses are injected into the agent's context.

### 5.3 Sync Mode (Discussions)

When the agent determines a topic needs interactive discussion:

```typescript
const requestDiscussionTool: Tool = {
  name: 'request_discussion',
  description: `Request a live discussion with the user about a specific topic.
Use when:
- A decision has significant trade-offs that need user input
- The topic is too complex for async back-and-forth
- You need to walk the user through options interactively
- The user needs to see something demonstrated live

The user will be notified and can set their availability.
You will be notified when the discussion is scheduled.`,
  parameters: {
    type: 'object',
    properties: {
      item_id: {
        type: 'string',
        description: 'Work item this discussion relates to',
      },
      topic: {
        type: 'string',
        description: 'What you want to discuss',
      },
      context: {
        type: 'string',
        description: 'Background context and what you have prepared',
      },
      estimated_duration_minutes: {
        type: 'number',
        description: 'Estimated discussion length',
        default: 10,
      },
      urgency: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'How urgently this discussion is needed',
        default: 'medium',
      },
      block: {
        type: 'boolean',
        description: 'If true, pause work until discussion happens. If false, continue other work.',
        default: false,
      },
      preparation_notes: {
        type: 'string',
        description: 'Notes for the user to review before the discussion (agenda items, options to consider)',
      },
    },
    required: ['item_id', 'topic', 'context'],
  },
};
```

### 5.4 Discussion Lifecycle

```
Agent calls request_discussion (or system triggers at task creation)
        │
        ▼
System creates DiscussionRequest:
  status: REQUESTED
  Board UI: Work Item shows "Discussion Requested" badge
  User gets notification (push/email) with topic + preparation notes
        │
        ▼
User sets availability:
  "I'm free now" → discussion starts immediately
  "Schedule for 3pm" → system schedules
  "Not now, answer async instead" → converts to async question
        │
        ▼ (if scheduled)
At scheduled time:
  System sends notification: "Agent is ready to discuss. Join now?"
  User confirms → discussion begins (task stays RUNNING)
        │
        ▼
SYNC CHAT MODE:
  User and agent exchange messages in real-time
  Agent sees user messages immediately (not via injection queue — direct)
  Chat happens in a dedicated panel associated with the Work Item
  Agent can help user refine/understand their requirements
        │
        ▼
Discussion ends (user clicks "End Discussion" or timeout):
  1. Agent generates discussion summary
  2. Agent posts summary as a comment (type: discussion_summary)
  3. Agent generates next steps and updates plan
  4. Agent asks user to confirm next steps
        │
        ▼
User confirms → Agent resumes async execution
User modifies → Agent updates plan accordingly
```

### 5.5 Discussion Data Model

```typescript
interface DiscussionRequest {
  request_id: string;
  task_id: string;
  item_id: string;
  topic: string;
  context: string;
  preparation_notes?: string;
  urgency: 'low' | 'medium' | 'high';
  estimated_duration_minutes: number;
  status: DiscussionStatus;
  requested_at: string;
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
}

enum DiscussionStatus {
  REQUESTED = 'REQUESTED',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',         // User chose async instead
  EXPIRED = 'EXPIRED',           // User never responded
}

interface DiscussionSession {
  session_id: string;
  request_id: string;
  task_id: string;
  item_id: string;
  messages: DiscussionMessage[];
  summary?: string;
  next_steps?: string[];
  confirmed_by_user: boolean;
}

interface DiscussionMessage {
  message_id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}
```

### 5.6 Sync Chat Implementation

During a sync discussion, the agent loop switches from injection-queue-based input to **direct WebSocket streaming**:

```typescript
async function runSyncDiscussion(
  agentLoop: AgentLoop,
  discussion: DiscussionRequest,
  ws: WebSocketConnection,
): Promise<DiscussionSession> {
  const messages: DiscussionMessage[] = [];

  // Agent opens with prepared context
  const opener = await agentLoop.generateDiscussionOpener(discussion);
  messages.push({ role: 'agent', content: opener, timestamp: now() });
  ws.send({ type: 'discussion_message', message: opener, role: 'agent' });

  // Real-time exchange
  while (true) {
    const userMessage = await ws.waitForMessage({ timeout: 120_000 }); // 2 min inactivity timeout

    if (userMessage.type === 'end_discussion') break;
    if (userMessage.type === 'message') {
      messages.push({ role: 'user', content: userMessage.content, timestamp: now() });

      // Agent responds immediately (sync mode — no queuing)
      const agentResponse = await agentLoop.respondToDiscussionMessage(
        userMessage.content,
        messages,
        discussion,
      );
      messages.push({ role: 'agent', content: agentResponse, timestamp: now() });
      ws.send({ type: 'discussion_message', message: agentResponse, role: 'agent' });
    }
  }

  // Generate summary + next steps
  const summary = await agentLoop.generateDiscussionSummary(messages, discussion);
  const nextSteps = await agentLoop.generateNextSteps(messages, discussion);

  // Post as comment
  await postComment(discussion.item_id, {
    comment_type: 'discussion_summary',
    content: `## Discussion Summary\n\n${summary}\n\n## Next Steps\n\n${nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
  });

  return { messages, summary, next_steps: nextSteps, confirmed_by_user: false };
}
```

---

## 6. File System Browser

### 6.1 Purpose

Every agent has a Docker workspace. The File Browser lets users see what the agent is doing in its file system — plans, memos, scratch files, deliverables, tool outputs.

### 6.2 API and User File Access

The file browser is not read-only. Users can upload files to the agent workspace (datasets, reference docs, images) and edit files the agent created:

```typescript
interface FileBrowserAPI {
  /** List files in a directory */
  listFiles(taskId: string, path: string): Promise<FileEntry[]>;

  /** Read file content */
  readFile(taskId: string, path: string): Promise<FileContent>;

  /** Get file tree */
  getFileTree(taskId: string): Promise<FileTreeNode>;

  /** Upload a file to the workspace */
  uploadFile(taskId: string, path: string, content: Buffer): Promise<FileEntry>;

  /** Edit a file in the workspace (triggers injection so agent knows) */
  editFile(taskId: string, path: string, content: string): Promise<FileEntry>;

  /** Delete a file */
  deleteFile(taskId: string, path: string): Promise<void>;
}
```

When the user uploads or edits a file, the system injects a notification into the agent context:

```typescript
await injectionQueue.push(taskId, {
  injection_type: 'external_event',
  content: `User uploaded file to workspace: ${path}`,
  metadata: { path, action: 'uploaded' },
});
```

### 6.3 UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  File Browser — Task "Competitive Pricing Analysis"          │
├──────────────────┬──────────────────────────────────────────┤
│  /workspace/     │  .plan.md                                 │
│  ├── .plan.md    │                                           │
│  ├── .memo/      │  # Execution Plan                        │
│  │   ├── find... │                                           │
│  │   └── deci... │  **Approach**: Research 5 competitors...  │
│  ├── .scratch/   │                                           │
│  │   └── tool... │  ## Steps                                 │
│  └── output/     │  - [x] **research**: Collect pricing...   │
│      ├── repo... │  - [>] **compare**: Build comparison...   │
│      └── scre... │  - [ ] **report**: Generate final...      │
│                  │                                           │
└──────────────────┴──────────────────────────────────────────┘
```

Special rendering:
- `.plan.md` → rendered as a progress tracker
- `output/*` → rendered with "Review" button for deliverables
- `.memo/*` → collapsed by default (agent's working memory)
- `.scratch/*` → hidden by default (temporary files)

---

## 7. Sleep-Time Compute

### 7.1 Purpose

Sleep-time compute runs background jobs when agents are idle (typically nightly). It processes the day's traces and produces actionable outputs for the next day.

### 7.2 Jobs

| Job | Schedule | Input | Output | Description |
|-----|----------|-------|--------|-------------|
| **Daily Digest** | 00:00 daily | All task traces from past 24h | DailyDigest | Summarize what happened, generate reminders for tomorrow |
| **Memory Consolidation** | 01:00 daily | All `.memo/` files across tasks | Consolidated knowledge entries | Merge scattered notes into structured, searchable knowledge |
| **Failure Pattern Detection** | 02:00 daily | Failed task traces from past 7 days | ImprovementProposal[] | Identify recurring failures, propose prompt/skill updates |
| **Stale Task Detection** | 03:00 daily | All RUNNING/PAUSED tasks | StaleTaskAlert[] | Flag tasks with no progress for >24h |
| **Skill Extraction** | Weekly (Sunday) | All traces from past week | Candidate SKILL.md files | Detect repeated workflows, generate reusable skills |
| **Workspace Cleanup** | 04:00 daily | Completed task workspaces | Cleanup report | Archive old workspaces, free disk space |

### 7.3 Daily Digest

```typescript
interface DailyDigest {
  digest_id: string;
  user_id: string;
  date: string;                     // YYYY-MM-DD
  generated_at: string;

  /** What happened today */
  summary: string;

  /** Tasks completed */
  completed_tasks: TaskDigestEntry[];

  /** Tasks still in progress */
  active_tasks: TaskDigestEntry[];

  /** Tasks that need attention */
  attention_needed: AttentionItem[];

  /** Reminders for tomorrow */
  reminders: Reminder[];

  /** Metrics */
  metrics: DailyMetrics;
}

interface TaskDigestEntry {
  task_id: string;
  goal: string;
  status: TaskStatus;
  key_events: string[];           // "Completed pricing research", "Blocked on login credentials"
  deliverables_produced: number;
  tokens_used: number;
}

interface AttentionItem {
  task_id: string;
  item_id?: string;
  attention_type: 'blocked' | 'stale' | 'review_pending' | 'discussion_requested' | 'failed';
  description: string;
  action_needed: string;
}

interface Reminder {
  reminder_id: string;
  source_task_id?: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  /** How the reminder was generated */
  reason: 'agent_requested' | 'stale_detection' | 'pattern_detected' | 'deadline_approaching';
}

interface DailyMetrics {
  tasks_completed: number;
  tasks_created: number;
  total_tokens: number;
  total_duration_minutes: number;
  deliverables_produced: number;
  discussions_held: number;
  comments_exchanged: number;
}
```

### 7.4 Daily Digest Generation

```typescript
async function generateDailyDigest(userId: string, date: string): Promise<DailyDigest> {
  // Gather today's traces
  const traces = await traceStore.getTracesForUser(userId, date);
  const tasks = await db.getTasksUpdatedSince(userId, startOfDay(date));
  const pendingReviews = await db.getPendingDeliverables(userId);
  const pendingDiscussions = await db.getPendingDiscussions(userId);
  const blockedTasks = await db.getBlockedTasks(userId);

  // Generate digest via LLM
  const digest = await llm.call({
    model: 'fast-model',
    messages: [
      { role: 'system', content: DAILY_DIGEST_PROMPT },
      { role: 'user', content: JSON.stringify({
        traces_summary: summarizeTraces(traces),
        tasks,
        pending_reviews: pendingReviews,
        pending_discussions: pendingDiscussions,
        blocked_tasks: blockedTasks,
      })},
    ],
  });

  return parseDailyDigest(digest.content);
}

const DAILY_DIGEST_PROMPT = `You are a daily digest generator. Given today's agent activity,
produce a concise summary that helps the user plan tomorrow.

Focus on:
- What was accomplished
- What needs the user's attention (blocked tasks, pending reviews, discussion requests)
- Reminders based on observed patterns (e.g., "You asked about X yesterday but didn't follow up")
- Approaching deadlines

Be concise. Use bullet points. Prioritize action items.`;
```

### 7.5 Memory Consolidation

Agents write scattered notes to `.memo/` files during execution. Memory consolidation merges these into structured knowledge:

```typescript
async function consolidateMemory(userId: string): Promise<void> {
  // Gather all memo files across active task workspaces
  const memos = await gatherAllMemoFiles(userId);

  // Group by topic via LLM
  const consolidation = await llm.call({
    model: 'fast-model',
    messages: [
      { role: 'system', content: MEMORY_CONSOLIDATION_PROMPT },
      { role: 'user', content: formatMemosForConsolidation(memos) },
    ],
  });

  // Write consolidated entries to Context Service
  const entries = parseConsolidationResult(consolidation.content);
  for (const entry of entries) {
    await contextService.upsertKnowledge(userId, entry);
  }
}

const MEMORY_CONSOLIDATION_PROMPT = `You are a knowledge manager. Given scattered agent memos
from multiple tasks, consolidate them into structured knowledge entries.

Each entry should have:
- topic: What this knowledge is about
- content: The consolidated information
- source_tasks: Which tasks this came from
- confidence: How reliable this information is (verified/observed/inferred)

Merge duplicate information. Resolve contradictions (note which is newer).
Remove ephemeral notes that are no longer relevant (e.g., "trying approach X" when X already succeeded or failed).`;
```

### 7.6 Failure Pattern Detection

```typescript
interface ImprovementProposal {
  proposal_id: string;
  detection_type: 'recurring_failure' | 'user_correction' | 'inefficiency' | 'skill_gap';
  description: string;
  evidence: TraceEvidence[];
  proposed_change: ProposedChange;
  confidence: number;              // 0.0 - 1.0
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
}

type ProposedChange =
  | { type: 'prompt_update'; section: string; current: string; proposed: string }
  | { type: 'new_skill'; skill_name: string; skill_content: string }
  | { type: 'skill_update'; skill_name: string; changes: string }
  | { type: 'risk_rule'; pattern: string; proposed_level: string }
  | { type: 'tool_hint'; tool_name: string; hint: string };

interface TraceEvidence {
  task_id: string;
  trace_file: string;
  iteration: number;
  description: string;
}
```

**Flow**:

```
Sleep-time agent analyzes traces from past 7 days
        │
        ▼
Detects patterns:
  "Agent failed to login 8 times across 3 tasks before trying alternative approach"
  "User corrected report format in 4 out of 5 tasks"
  "Agent spends 15+ iterations on PDF extraction every time"
        │
        ▼
Generates ImprovementProposals:
  1. prompt_update: "Add to system prompt: If login fails twice, try alternative methods"
  2. prompt_update: "Add to system prompt: Use markdown tables for comparison reports"
  3. new_skill: Generate "pdf-extraction" SKILL.md
        │
        ▼
Proposals appear on Board UI as "System Improvement" items
User reviews each proposal: Approve / Reject / Modify
        │
        ▼
Approved → Applied automatically:
  - Prompt updates: appended to agent's system prompt
  - New skills: written to /skills/ directory
  - Risk rules: added to risk policy config
```

### 7.7 Skill Extraction

```typescript
async function extractSkills(userId: string): Promise<void> {
  const weekTraces = await traceStore.getTracesForUser(userId, pastWeek());

  const extraction = await llm.call({
    model: 'thinking-model',
    messages: [
      { role: 'system', content: SKILL_EXTRACTION_PROMPT },
      { role: 'user', content: summarizeTracesForSkillExtraction(weekTraces) },
    ],
  });

  const candidates = parseSkillCandidates(extraction.content);
  for (const skill of candidates) {
    await db.createImprovementProposal({
      detection_type: 'skill_gap',
      description: `Repeated workflow detected: ${skill.name}`,
      proposed_change: {
        type: 'new_skill',
        skill_name: skill.name,
        skill_content: skill.content,
      },
    });
  }
}

const SKILL_EXTRACTION_PROMPT = `Analyze these agent traces from the past week.
Identify repeated workflows that the agent performs across multiple tasks.

For each repeated workflow, generate a SKILL.md file that would help
the agent perform this workflow faster in the future.

A good skill candidate:
- Appears in 2+ different tasks
- Takes 5+ agent iterations to figure out each time
- Has a consistent pattern that can be documented
- Would save significant time if pre-documented`;
```

---

## 8. Trace System

### 8.1 Trace Storage

Every agent loop iteration produces trace entries stored as JSONL:

```typescript
interface TraceEntry {
  trace_id: string;
  task_id: string;
  timestamp: string;
  iteration: number;
  event_type: TraceEventType;
  duration_ms?: number;
  tokens?: { input: number; output: number };
  data: Record<string, unknown>;
}

type TraceEventType =
  | 'agent_start'
  | 'llm_request'          // Full prompt sent to LLM
  | 'llm_response'         // Full LLM response
  | 'tool_call'            // Tool name + params
  | 'tool_result'          // Tool output (possibly truncated)
  | 'plan_updated'         // New plan snapshot
  | 'comment_posted'       // Agent posted a comment
  | 'injection_received'   // External input received
  | 'compaction_start'
  | 'compaction_end'
  | 'memory_flush'
  | 'sub_agent_spawn'
  | 'sub_agent_complete'
  | 'risk_check'
  | 'doom_loop_detected'
  | 'discussion_started'
  | 'discussion_ended'
  | 'deliverable_published'
  | 'agent_end';
```

### 8.2 Trace Query API

```typescript
interface TraceStore {
  /** Get all traces for a task */
  getTraces(taskId: string): Promise<TraceEntry[]>;

  /** Get traces for a user across all tasks in a date range */
  getTracesForUser(userId: string, date: string): Promise<TraceEntry[]>;

  /** Get traces matching a filter */
  queryTraces(filter: TraceFilter): Promise<TraceEntry[]>;

  /** Get a summary of a task's trace (for sleep-time compute) */
  getTraceSummary(taskId: string): Promise<TraceSummary>;
}

interface TraceFilter {
  task_id?: string;
  user_id?: string;
  event_types?: TraceEventType[];
  date_from?: string;
  date_to?: string;
  limit?: number;
}

interface TraceSummary {
  task_id: string;
  total_iterations: number;
  total_tokens: number;
  total_duration_ms: number;
  tool_call_counts: Record<string, number>;
  compaction_count: number;
  errors: TraceSummaryError[];
  user_corrections: string[];
  key_decisions: string[];
}
```

### 8.3 Trace Viewer in UI

The trace viewer lets users inspect agent behavior step by step (like LangSmith):

```
┌─────────────────────────────────────────────────────────────────┐
│  Trace Viewer — Task "Competitive Pricing Analysis"              │
├──────────┬──────────────────────────────────────────────────────┤
│ Timeline │  Iteration 14: tool_call                              │
│          │                                                       │
│  #1  ●   │  Tool: browser                                        │
│  #2  ●   │  Action: navigate                                     │
│  #3  ●   │  URL: https://competitor-a.com/pricing                │
│  #4  ●   │                                                       │
│  #5  ●   │  Duration: 3.2s                                       │
│  #6  ●   │  Risk: MEDIUM                                         │
│  #7  ●   │                                                       │
│  #8  ●   │  Result:                                               │
│  #9  ●   │  Page loaded successfully. Title: "Pricing - ..."     │
│  #10 ●   │  Screenshot saved to .scratch/screenshot-14.png       │
│  #11 ●   │                                                       │
│  #12 ●   │  ┌─────────────────────────────────────┐              │
│  #13 ●   │  │ Context at this step:                │              │
│  #14 ● ← │  │ Tokens: 42,318 / 128,000            │              │
│  #15 ○   │  │ Plan: 2/5 steps done                 │              │
│  #16 ○   │  │ Compactions: 1                        │              │
│  #17 ○   │  └─────────────────────────────────────┘              │
│          │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## 9. Recursive Self-Improvement Loop

### 9.1 The Full Loop

```
                    ┌──────────────────────────────┐
                    │        AGENT EXECUTES         │
                    │    (produces traces, results)  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     TRACES STORED (JSONL)     │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │    SLEEP-TIME COMPUTE         │
                    │  (nightly analysis)           │
                    │                               │
                    │  • Failure pattern detection   │
                    │  • User correction analysis    │
                    │  • Inefficiency detection      │
                    │  • Skill gap identification    │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  IMPROVEMENT PROPOSALS        │
                    │  (appear on Board for review)  │
                    └──────────────┬───────────────┘
                                   │
                            User reviews
                                   │
                    ┌──────┬───────┴───────┬──────┐
                    │      │               │      │
                 Approve  Modify        Reject   Ignore
                    │      │
                    ▼      ▼
                    ┌──────────────────────────────┐
                    │     CHANGES APPLIED           │
                    │                               │
                    │  • System prompt updated       │
                    │  • New SKILL.md created         │
                    │  • Risk rules adjusted          │
                    │  • Memory entries added          │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                          (next agent execution
                           uses improved config)
                                   │
                    ┌──────────────┘
                    │
                    ▼
              AGENT EXECUTES (improved) ─── loop continues ───▶
```

### 9.2 Safety: Human in the Loop

Improvement proposals are NEVER auto-applied. They always require user review:

```typescript
interface ImprovementReview {
  proposal_id: string;
  action: 'approve' | 'approve_modified' | 'reject';
  modified_change?: ProposedChange;   // If approve_modified
  reviewer_comment?: string;
}
```

This prevents:
- Prompt drift (agent gradually changing its own behavior)
- Cascading errors (one bad trace leading to harmful prompt changes)
- Loss of control (agent optimizing for metrics the user doesn't care about)

### 9.3 Applied Changes Tracking

```typescript
interface AppliedChange {
  change_id: string;
  proposal_id: string;
  change_type: ProposedChange['type'];
  applied_at: string;
  applied_by: string;              // user_id
  rollback_available: boolean;
  previous_value?: string;         // For rollback
}
```

All changes are versioned. User can rollback any applied change from the UI.

---

## 10. External World Watchers

### 10.1 Purpose

Agents need to monitor the external world — email, messaging channels, APIs, price feeds, file changes — and react when conditions are met. The Watcher Service runs as a persistent background service (separate from per-task agent loops) that polls or listens to external sources and triggers agent actions.

**Key insight from OpenClaw**: OpenClaw already IS a watcher system — it monitors ~15 messaging channels (Telegram, Discord, Slack, Signal, WhatsApp, iMessage, MS Teams, Matrix, etc.) for inbound events and routes them to agents. The architecture lesson: use a **unified SourcePlugin interface** with three transport modes (WebSocket/SSE for real-time, webhook for push, polling for pull), event normalization, and deduplication.

### 10.2 SourcePlugin Interface

Learned from OpenClaw's `ChannelPlugin` pattern — every source implements the same adapter contract:

```typescript
/**
 * SourcePlugin interface — inspired by OpenClaw's ChannelPlugin.
 * Each external source (email, Slack, API, etc.) implements this contract.
 * Core sources ship built-in; community sources can be added as plugins.
 */
interface SourcePlugin {
  id: string;                          // e.g., 'email', 'slack', 'api_poll', 'webhook'
  name: string;                        // Human-readable name
  transport: 'polling' | 'webhook' | 'stream';  // How events arrive

  /** Initialize the source with user credentials/config */
  initialize(config: SourceConfig): Promise<void>;

  /** Start listening/polling for events */
  start(handler: (event: NormalizedEvent) => Promise<void>): Promise<void>;

  /** Stop listening */
  stop(): Promise<void>;

  /** Health check */
  healthCheck(): Promise<SourceHealth>;
}

/** Unified event shape — all sources normalize to this before condition eval */
interface NormalizedEvent {
  source_id: string;             // Which source plugin
  event_id: string;              // For deduplication
  timestamp: string;
  event_type: string;            // Source-specific: 'new_email', 'price_update', 'message', etc.
  content: string;               // Human-readable summary
  raw_data: Record<string, unknown>;  // Full source-specific payload
  metadata: {
    from?: string;               // Sender/origin
    subject?: string;            // For email/message
    channel?: string;            // For messaging
    url?: string;                // Source URL
  };
}

interface SourceHealth {
  status: 'healthy' | 'degraded' | 'disconnected';
  last_event_at?: string;
  error?: string;
}
```

### 10.3 Built-in Source Plugins

| Plugin | Transport | Description |
|--------|-----------|-------------|
| `email_imap` | polling | IMAP polling for new emails. Filter by from/subject/folder. |
| `webhook` | webhook | Receives HTTP POST from external services (Stripe, GitHub, Zapier, etc.) |
| `api_poll` | polling | Polls any REST API endpoint on a schedule. Extracts data via JSONPath. |
| `rss` | polling | RSS/Atom feed monitoring. |
| `websocket` | stream | Connects to a WebSocket endpoint (e.g., stock price feeds). |
| `cron` | polling | Time-based triggers (no external source — just a schedule). |

**Extensible**: community plugins follow the same `SourcePlugin` interface:

| Plugin (Extension) | Transport | Description |
|---------------------|-----------|-------------|
| `slack_events` | webhook/stream | Slack Events API (Socket Mode or HTTP). Learned from OpenClaw's dual-mode Slack support. |
| `telegram_bot` | webhook | Telegram Bot API updates. |
| `discord_events` | stream | Discord gateway WebSocket events. |
| `whatsapp` | webhook | WhatsApp Business API webhooks. |
| `github_events` | webhook | GitHub webhooks (push, PR, issue, etc.). |
| `stock_price` | stream/polling | Financial data APIs (Alpha Vantage, Yahoo Finance, etc.). |

### 10.4 Watcher Data Model

```typescript
interface Watcher {
  watcher_id: string;
  user_id: string;
  name: string;                    // User-provided name: "Alert me when stock drops"

  /** Which source plugin to use */
  source_plugin: string;           // e.g., 'email_imap', 'api_poll', 'webhook'
  source_config: SourceConfig;     // Plugin-specific config (credentials, URLs, filters)

  /** When to trigger — evaluated against every NormalizedEvent */
  condition: WatcherCondition;

  /** What to do when triggered */
  action: WatcherAction;

  /** Polling interval (for polling transport only) */
  poll_interval_seconds?: number;   // e.g., 60 for email, 300 for price

  enabled: boolean;
  created_at: string;
  last_checked_at?: string;
  last_triggered_at?: string;
  trigger_count: number;
}

type WatcherCondition =
  | { type: 'any_new' }                                    // Any new event from source
  | { type: 'contains'; text: string }                     // Content contains text
  | { type: 'regex'; pattern: string }                     // Content matches regex
  | { type: 'threshold'; field: string; op: '<' | '>' | '=' | '<=' | '>='; value: number }
  | { type: 'llm_judge'; prompt: string }                  // LLM evaluates: "Is this email urgent?"
  | { type: 'compound'; operator: 'and' | 'or'; conditions: WatcherCondition[] };

type WatcherAction =
  | { type: 'create_task'; goal_template: string }         // Create new task (template can reference {{event.content}})
  | { type: 'inject_into_task'; task_id: string }          // Feed event into a running task's injection queue
  | { type: 'notify_user'; channel: 'email' | 'push' | 'in_app' }
  | { type: 'run_skill'; skill_name: string; args_template: string }
  | { type: 'multi'; actions: WatcherAction[] };           // Multiple actions

type SourceConfig = Record<string, unknown>;  // Plugin-specific
// Examples:
// email_imap: { host, port, user, password, folder, from_filter, subject_filter }
// api_poll:   { url, method, headers, extract_path, auth }
// webhook:    { path_suffix, verify_secret }
// rss:        { feed_url }
```

### 10.5 Deduplication

Learned from OpenClaw: Telegram uses update IDs, Discord uses debounced coalescing, Signal tracks SSE stream IDs. Every watcher maintains a dedup window:

```typescript
interface DeduplicationState {
  watcher_id: string;
  /** Recent event IDs — ring buffer of last N events */
  recent_event_ids: string[];
  max_size: number;              // Default: 1000
  /** For ordered sources (email IMAP), track last seen ID */
  last_seen_id?: string;
}

function shouldProcess(event: NormalizedEvent, state: DeduplicationState): boolean {
  if (state.recent_event_ids.includes(event.event_id)) return false;
  state.recent_event_ids.push(event.event_id);
  if (state.recent_event_ids.length > state.max_size) {
    state.recent_event_ids.shift();
  }
  return true;
}
```

### 10.6 LLM-as-Judge Condition

The `llm_judge` condition is particularly powerful for natural-language conditions that can't be expressed as regex or thresholds:

```typescript
async function evaluateLlmJudge(
  event: NormalizedEvent,
  prompt: string,
): Promise<boolean> {
  const result = await llm.call({
    model: 'fast-model',  // Use cheap/fast model for high-frequency evaluation
    messages: [
      {
        role: 'system',
        content: `You are an event filter. Given an event, decide if it matches the user's condition.
Respond with ONLY "yes" or "no".`,
      },
      {
        role: 'user',
        content: `Condition: ${prompt}\n\nEvent:\n${JSON.stringify(event, null, 2)}`,
      },
    ],
  });
  return result.content.trim().toLowerCase() === 'yes';
}
```

Examples:
- "Any email from my investor that sounds urgent"
- "Price movement greater than 5% in either direction"
- "A GitHub issue that looks like a security vulnerability"
- "A Slack message asking me for something by a deadline"

### 10.7 Resilience

Learned from OpenClaw's Signal SSE reconnect pattern — exponential backoff with jitter for all transports:

```typescript
interface ReconnectPolicy {
  initial_delay_ms: number;       // 1000
  max_delay_ms: number;           // 60000
  backoff_factor: number;         // 2
  jitter: boolean;                // true
  max_retries?: number;           // undefined = infinite
}

async function runWithReconnect(
  source: SourcePlugin,
  handler: (event: NormalizedEvent) => Promise<void>,
  policy: ReconnectPolicy,
): Promise<void> {
  let attempts = 0;
  while (true) {
    try {
      await source.start(handler);
      attempts = 0;  // Reset on successful connection
    } catch (error) {
      attempts++;
      if (policy.max_retries && attempts > policy.max_retries) throw error;
      const delay = Math.min(
        policy.initial_delay_ms * Math.pow(policy.backoff_factor, attempts),
        policy.max_delay_ms,
      );
      const jitter = policy.jitter ? Math.random() * delay * 0.3 : 0;
      await sleep(delay + jitter);
    }
  }
}
```

### 10.8 Watcher Management API

```typescript
// REST API
POST   /api/watchers                    // Create watcher
GET    /api/watchers                    // List watchers
GET    /api/watchers/:id               // Get watcher detail
PATCH  /api/watchers/:id               // Update (enable/disable/modify)
DELETE /api/watchers/:id               // Delete watcher
GET    /api/watchers/:id/history       // Get trigger history
POST   /api/watchers/:id/test          // Test watcher with a sample event
```

---

## 11. Policy Engine

### 11.1 Purpose

The Policy Engine is the layer between agent actions and human-facing outputs. It governs **when** and **how** the agent communicates with the human, how much autonomy the agent has, and how work is prioritized. All policies are **user-configurable** with sensible defaults.

**Design rationale** (from human productivity research):
- **Deep Work**: humans have ~4 hours/day of focused cognitive capacity. Every notification costs context-switching time.
- **Kanban WIP limits**: limiting work-in-progress increases throughput 40% and reduces lead time 60%.
- **GTD Weekly Review**: periodic structured review is the "critical success factor" — more effective than continuous monitoring.
- **Eisenhower Matrix**: not all agent communications are equally urgent. Classify before routing.
- **OKR**: track outcomes (success criteria) not just activities (plan steps).

### 11.2 Policy Configuration

```typescript
interface UserPolicy {
  attention: AttentionPolicy;
  wip: WIPPolicy;
  review: ReviewPolicy;         // Already exists (Section 4.4), now part of policy engine
  autonomy: AutonomyPolicy;
  planning: PlanningPolicy;
}
```

### 11.3 AttentionPolicy

Controls how and when the human receives notifications. **Default: notify immediately** (user can tighten later).

```typescript
interface AttentionPolicy {
  /**
   * Notification threshold: which events generate push notifications.
   * Default: 'all' — notify immediately for everything.
   * Can be tightened to reduce interruptions.
   */
  notification_threshold: 'blocker_only' | 'high_and_blocker' | 'medium_and_above' | 'all';

  /**
   * Digest windows: batch non-urgent notifications into scheduled check-in moments.
   * Items below notification_threshold accumulate and are delivered at these times.
   * Default: [] (empty — no batching, everything immediate).
   * Example: ['09:00', '13:00', '17:00'] — three check-ins per day.
   */
  digest_windows: string[];

  /**
   * Do-not-disturb periods. Agent accumulates, never notifies.
   * Emergency blockers still go through.
   * Default: [] (no DND periods).
   */
  dnd_periods: { start: string; end: string }[];

  /**
   * Auto-approve low-risk deliverables without human review.
   * When the agent's self-assessment confidence is above this threshold
   * AND all required success criteria are met, auto-approve.
   * Default: undefined (all deliverables require human review).
   */
  auto_approve_confidence_threshold?: number;  // e.g., 0.95
}

// Default policy — notify everything immediately
const DEFAULT_ATTENTION_POLICY: AttentionPolicy = {
  notification_threshold: 'all',
  digest_windows: [],
  dnd_periods: [],
  auto_approve_confidence_threshold: undefined,
};
```

**Priority classification**: every agent communication gets a priority level before the notification engine routes it:

```typescript
type NotificationPriority = 'low' | 'medium' | 'high' | 'blocker';

function classifyPriority(event: AgentEvent): NotificationPriority {
  // Blockers: agent is paused, cannot continue
  if (event.type === 'comment' && event.block) return 'blocker';
  if (event.type === 'discussion_request' && event.urgency === 'high' && event.block) return 'blocker';

  // High: deliverables ready for review, high-urgency discussions
  if (event.type === 'deliverable_published') return 'high';
  if (event.type === 'discussion_request' && event.urgency === 'high') return 'high';

  // Medium: non-blocking questions, task status changes
  if (event.type === 'comment' && event.comment_type === 'question') return 'medium';
  if (event.type === 'task_status_changed') return 'medium';

  // Low: notes, progress updates, decisions
  return 'low';
}
```

### 11.4 WIPPolicy

Controls concurrency limits. The bottleneck is **human review bandwidth**, not agent execution capacity. **All configurable.**

```typescript
interface WIPPolicy {
  /**
   * Max tasks the agent can execute simultaneously.
   * This is a resource limit (Docker containers, API rate limits).
   * Default: 5.
   */
  max_concurrent_tasks: number;

  /**
   * Max deliverables pending human review.
   * When this limit is reached, the agent prioritizes tasks that don't
   * need review yet, or works on stretch/optional items.
   * Default: 10.
   */
  max_pending_review: number;

  /**
   * Max blocking questions (agent is paused waiting for answer).
   * When this limit is reached, the agent attempts to self-resolve
   * by trying alternative approaches or making a best-effort decision
   * and noting the assumption.
   * Default: 5.
   */
  max_pending_questions: number;

  /**
   * What to do when max_pending_review is reached.
   * Default: 'deprioritize_review_tasks'.
   */
  review_queue_full_behavior:
    | 'deprioritize_review_tasks'    // Focus on tasks that don't need review yet
    | 'auto_approve_low_risk'        // Auto-approve deliverables with high self-assessment confidence
    | 'pause_new_deliverables'       // Stop producing deliverables until queue drains
    | 'continue_anyway';             // Ignore the limit
}

const DEFAULT_WIP_POLICY: WIPPolicy = {
  max_concurrent_tasks: 5,
  max_pending_review: 10,
  max_pending_questions: 5,
  review_queue_full_behavior: 'deprioritize_review_tasks',
};
```

### 11.5 AutonomyPolicy

Controls how much the agent asks vs just does. Tunable based on trust level and human feedback.

```typescript
interface AutonomyPolicy {
  /**
   * For small additions requested via comments (< estimated N minutes),
   * agent acts without updating the plan or asking for confirmation.
   * Maps to GTD's "two-minute rule".
   * Default: 5 (minutes).
   */
  micro_request_threshold_minutes: number;

  /**
   * Agent self-resolves non-blocking questions after this timeout
   * by making a best-effort decision and noting the assumption.
   * Default: undefined (never auto-resolve — always wait).
   */
  auto_resolve_timeout_minutes?: number;

  /**
   * Agent proactively reports: risk flags, confidence levels, scope concerns.
   * 'minimal': only report blockers.
   * 'standard': blockers + risks + confidence on deliverables.
   * 'verbose': everything including progress notes.
   * Default: 'standard'.
   */
  proactive_reporting: 'minimal' | 'standard' | 'verbose';

  /**
   * When the agent detects scope creep or a task taking much longer
   * than expected, it proposes scope negotiation.
   * Default: true.
   */
  scope_negotiation: boolean;
}

const DEFAULT_AUTONOMY_POLICY: AutonomyPolicy = {
  micro_request_threshold_minutes: 5,
  auto_resolve_timeout_minutes: undefined,
  proactive_reporting: 'standard',
  scope_negotiation: true,
};
```

### 11.6 PlanningPolicy

Controls how the agent structures and orders its work.

```typescript
interface PlanningPolicy {
  /**
   * "Eat the Frog" — order plan steps by uncertainty/risk first.
   * Discovers blockers early so human can unblock sooner.
   * Default: true.
   */
  risk_first_ordering: boolean;

  /**
   * Include "stretch" items in plans (OKR 0.7 principle).
   * Stretch items are nice-to-have, not required for task completion.
   * Default: true.
   */
  include_stretch_items: boolean;

  /**
   * Agent must generate success criteria during planning.
   * Human confirms criteria before execution begins.
   * Default: true.
   */
  require_success_criteria: boolean;
}

const DEFAULT_PLANNING_POLICY: PlanningPolicy = {
  risk_first_ordering: true,
  include_stretch_items: true,
  require_success_criteria: true,
};
```

### 11.7 Notification Service

The Notification Service sits between the Policy Engine and the frontend. It implements batching, digest windows, and DND.

```typescript
async function routeNotification(
  userId: string,
  event: AgentEvent,
  policy: AttentionPolicy,
): Promise<void> {
  const priority = classifyPriority(event);

  // Blockers always go through, even during DND
  if (priority === 'blocker') {
    await sendImmediateNotification(userId, event);
    return;
  }

  // Check DND
  if (isInDndPeriod(policy.dnd_periods)) {
    await queueForNextDigest(userId, event);
    return;
  }

  // Check threshold
  if (!meetsThreshold(priority, policy.notification_threshold)) {
    if (policy.digest_windows.length > 0) {
      await queueForNextDigest(userId, event);
    }
    // If no digest windows and below threshold, still store but don't notify
    return;
  }

  // Meets threshold → send immediately
  await sendImmediateNotification(userId, event);
}

async function sendDigest(userId: string): Promise<void> {
  const queued = await db.getQueuedNotifications(userId);
  if (queued.length === 0) return;

  // Group by task, summarize
  const digest = await generateDigestSummary(queued);
  await ws.send(userId, { type: 'notification_digest', digest });
  await db.clearQueuedNotifications(userId);
}
```

### 11.8 Weekly Review (System-Scheduled)

**From GTD**: David Allen calls the weekly review "the critical success factor." This is a system-initiated interactive session, not an agent-initiated discussion.

```typescript
interface WeeklyReview {
  review_id: string;
  user_id: string;
  week: string;                    // ISO week: "2026-W05"
  scheduled_at: string;            // Configurable: default Sunday 18:00
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';

  /** System-generated briefing (from sleep-time compute data) */
  briefing: WeeklyBriefing;

  /** User actions during review */
  actions_taken?: ReviewAction[];
}

interface WeeklyBriefing {
  /** What happened this week */
  completed_tasks: TaskDigestEntry[];
  active_tasks: TaskDigestEntry[];

  /** Pending human actions — the backlog to clear */
  pending_reviews: { deliverable_id: string; task_goal: string; age_hours: number }[];
  pending_questions: { comment_id: string; task_goal: string; question: string; age_hours: number }[];
  pending_discussions: { request_id: string; topic: string }[];
  pending_improvements: { proposal_id: string; description: string }[];

  /** Stale items to close or re-prioritize */
  stale_tasks: { task_id: string; goal: string; idle_days: number }[];

  /** Agent behavior metrics (for calibration) */
  behavior_metrics: {
    questions_asked: number;
    questions_self_resolved: number;
    deliverables_produced: number;
    avg_self_assessment_confidence: number;
    times_agent_was_wrong: number;        // User rejected high-confidence deliverables
    notifications_sent: number;
  };

  /** Self-improvement proposals to review */
  improvement_proposals: ImprovementProposal[];

  /** Suggested policy adjustments based on this week's data */
  suggested_policy_changes?: PolicySuggestion[];
}

interface PolicySuggestion {
  policy_field: string;              // e.g., "attention.notification_threshold"
  current_value: unknown;
  suggested_value: unknown;
  reason: string;                    // "You had 47 notifications this week but only acted on 12. Consider raising the threshold."
}

type ReviewAction =
  | { type: 'approve_deliverable'; deliverable_id: string }
  | { type: 'answer_question'; comment_id: string; answer: string }
  | { type: 'cancel_task'; task_id: string }
  | { type: 'reprioritize_task'; task_id: string; new_priority: number }
  | { type: 'approve_improvement'; proposal_id: string }
  | { type: 'reject_improvement'; proposal_id: string }
  | { type: 'adjust_policy'; policy: Partial<UserPolicy> }
  | { type: 'calibrate_behavior'; feedback: string };
```

**Flow**:

```
Every week (configurable: Sunday 18:00 default):
  System generates WeeklyBriefing from sleep-time compute data
  Sends notification: "Your weekly review is ready"
  Human opens /review page:
    │
    ├── Task Review
    │   See all tasks: completed, active, stale
    │   Close stale tasks, re-prioritize, add new goals
    │
    ├── Action Queue
    │   Process pending reviews, questions, discussions in batch
    │   (This is the "inbox zero" moment)
    │
    ├── Improvement Proposals
    │   Approve/reject self-improvement proposals
    │
    ├── Behavior Calibration
    │   See agent metrics: questions asked, confidence accuracy, notifications sent
    │   Adjust policies: "send fewer notifications" / "ask less, decide more"
    │   System suggests policy changes based on data
    │
    └── Next Week Focus
        Set top 3 priority tasks for next week
        Agent will prioritize these in planning
```

### 11.9 Self-Assessment Pipeline

Before publishing a deliverable, the agent evaluates it against the task's success criteria:

```typescript
async function publishWithSelfAssessment(
  taskId: string,
  deliverable: Deliverable,
  policy: UserPolicy,
): Promise<void> {
  const task = await db.getTask(taskId);

  if (task.success_criteria?.length) {
    // Agent self-assesses against each criterion
    const assessment = await agentLoop.selfAssess(deliverable, task.success_criteria);

    // Attach assessment to deliverable
    deliverable.self_assessment = assessment;

    // Update success criteria with assessment results
    for (const criterion of task.success_criteria) {
      const result = assessment.find(a => a.criterion_id === criterion.id);
      if (result) criterion.assessment = result;
    }
  }

  // Check auto-approve conditions
  const allRequiredMet = task.success_criteria
    ?.filter(c => c.type === 'required')
    .every(c => c.assessment?.met && c.assessment.confidence >= (policy.attention.auto_approve_confidence_threshold ?? 1.1));

  if (allRequiredMet && policy.attention.auto_approve_confidence_threshold) {
    deliverable.review_status = 'AUTO_APPROVED';
  } else {
    deliverable.review_status = 'PENDING';
  }

  await db.createDeliverable(deliverable);
  await routeNotification(task.user_id, {
    type: 'deliverable_published',
    deliverable,
    self_assessment: deliverable.self_assessment,
  }, policy.attention);
}
```

### 11.10 Behavior Calibration

Human feedback on agent behavior feeds back into policy adjustments and self-improvement proposals.

```typescript
interface BehaviorFeedback {
  feedback_id: string;
  user_id: string;
  feedback_type:
    | 'too_many_questions'       // → increase autonomy
    | 'not_enough_updates'       // → increase proactive_reporting
    | 'too_many_notifications'   // → raise notification_threshold
    | 'wrong_priorities'         // → adjust planning policy
    | 'confidence_too_high'      // → agent overestimates its work quality
    | 'confidence_too_low'       // → agent underestimates, causing unnecessary reviews
    | 'custom';
  description?: string;
  created_at: string;

  /** System-suggested policy change based on this feedback */
  suggested_change?: PolicySuggestion;
}
```

When the human provides feedback (during weekly review or anytime), the system:
1. Records the feedback
2. Suggests a concrete policy change
3. If approved, applies the change
4. Feeds into the self-improvement loop (sleep-time compute can detect the pattern)

---

## 12. Frontend Architecture

### 12.1 Pages

| Page | Path | Purpose |
|------|------|---------|
| **Home** | `/` | Chat panel (Quick Mode) + Board overview side by side |
| **Board** | `/board` | Full Kanban/list view of all tasks and their work items |
| **Task Detail** | `/task/:id` | Single task view: work items, comments, deliverables, file browser |
| **Sync Chat** | `/task/:id/discuss/:requestId` | Live discussion panel |
| **Trace Viewer** | `/task/:id/trace` | Step-by-step trace inspection |
| **Digest** | `/digest` | Daily digest view with reminders and attention items |
| **Improvements** | `/improvements` | Pending improvement proposals for review |
| **Watchers** | `/watchers` | Manage external world watchers |
| **Weekly Review** | `/review` | Interactive weekly review: task review, action queue, behavior calibration |
| **Settings** | `/settings` | Agent config, model selection, risk policies, **policy configuration** |

### 12.2 Real-Time Updates (WebSocket)

```typescript
type WebSocketEvent =
  | { type: 'board_updated'; task_id: string; items: WorkItem[] }
  | { type: 'comment_posted'; task_id: string; item_id: string; comment: Comment }
  | { type: 'task_status_changed'; task_id: string; status: TaskStatus }
  | { type: 'deliverable_published'; task_id: string; deliverable: Deliverable }
  | { type: 'discussion_requested'; task_id: string; request: DiscussionRequest }
  | { type: 'discussion_message'; session_id: string; message: DiscussionMessage }
  | { type: 'trace_event'; task_id: string; entry: TraceEntry }
  | { type: 'agent_iteration'; task_id: string; iteration: number; token_usage: number }
  | { type: 'file_changed'; task_id: string; path: string; action: 'created' | 'modified' | 'deleted' }
  | { type: 'digest_ready'; digest_id: string }
  | { type: 'improvement_proposed'; proposal: ImprovementProposal }
  | { type: 'watcher_triggered'; watcher_id: string; event: NormalizedEvent }
  | { type: 'comment_superseded'; old_comment_id: string; new_comment: Comment }
  | { type: 'chat_response'; content: string }              // Quick mode response
  | { type: 'plan_proposal'; goal: string; plan: PlanSnapshot }  // Task creation: plan for confirmation
  | { type: 'refinement_start'; questions: string[]; message: string }  // Task creation: need to refine
  | { type: 'notification_digest'; digest: NotificationDigest }        // Batched notifications (AttentionPolicy)
  | { type: 'weekly_review_ready'; review_id: string }                 // Weekly review available
  | { type: 'policy_suggestion'; suggestion: PolicySuggestion };       // System suggests policy change
```

### 12.3 REST API

```typescript
// Chat (Quick Mode + Task Creation)
POST   /api/chat                           // Send chat message (quick mode or task creation)
POST   /api/chat/confirm-plan              // User confirms proposed plan → creates task
POST   /api/chat/modify-plan              // User modifies proposed plan before confirming

// Tasks
POST   /api/tasks                          // Create new task (alternative to chat flow)
GET    /api/tasks                          // List tasks
GET    /api/tasks/:id                      // Get task detail
PATCH  /api/tasks/:id                      // Update (pause/resume/cancel)
DELETE /api/tasks/:id                      // Cancel and cleanup

// Work Items
GET    /api/tasks/:id/items                // List work items for task

// Comments
GET    /api/tasks/:id/items/:itemId/comments    // List comments
POST   /api/tasks/:id/items/:itemId/comments    // Post comment (user → agent)
POST   /api/tasks/:id/comments                  // Post task-level comment

// Deliverables
GET    /api/tasks/:id/deliverables         // List deliverables
PATCH  /api/tasks/:id/deliverables/:did    // Review (approve/request changes)
GET    /api/tasks/:id/deliverables/:did/content  // Get deliverable content

// Discussions
POST   /api/tasks/:id/discussions/:rid/schedule  // Set availability / schedule
POST   /api/tasks/:id/discussions/:rid/start     // Start discussion (returns WS URL)
POST   /api/tasks/:id/discussions/:rid/end       // End discussion
GET    /api/tasks/:id/discussions                // List discussions

// Files (read + write)
GET    /api/tasks/:id/files                // Get file tree
GET    /api/tasks/:id/files/*path          // Get file content
POST   /api/tasks/:id/files/*path          // Upload file to workspace
PUT    /api/tasks/:id/files/*path          // Edit file in workspace
DELETE /api/tasks/:id/files/*path          // Delete file

// Traces
GET    /api/tasks/:id/trace                // Get trace entries
GET    /api/tasks/:id/trace/summary        // Get trace summary

// Digest
GET    /api/digest                         // Get latest daily digest
GET    /api/digest/:date                   // Get digest for specific date

// Improvements
GET    /api/improvements                   // List pending proposals
PATCH  /api/improvements/:id               // Review (approve/reject/modify)
POST   /api/improvements/:id/rollback      // Rollback applied change

// Watchers
POST   /api/watchers                       // Create watcher
GET    /api/watchers                       // List watchers
GET    /api/watchers/:id                   // Get watcher detail
PATCH  /api/watchers/:id                   // Update (enable/disable/modify)
DELETE /api/watchers/:id                   // Delete watcher
GET    /api/watchers/:id/history           // Get trigger history
POST   /api/watchers/:id/test             // Test watcher with sample event

// Policies
GET    /api/policies                       // Get current user policies
PATCH  /api/policies                       // Update policies (attention, WIP, autonomy, planning)
GET    /api/policies/defaults              // Get default policy values

// Weekly Review
GET    /api/review                         // Get current/latest weekly review
GET    /api/review/:week                   // Get review for specific week (e.g., 2026-W05)
POST   /api/review/:id/actions             // Submit review actions (batch process)
POST   /api/review/:id/calibrate           // Submit behavior calibration feedback

// Settings
GET    /api/settings                       // Get current settings
PATCH  /api/settings                       // Update settings
```

### 12.4 Tech Stack (Recommendation)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js (App Router) + React | SSR, API routes, good DX |
| UI Components | shadcn/ui + Tailwind | Fast to build, customizable |
| Real-time | WebSocket (native or Socket.io) | Board updates, trace streaming, sync chat |
| State | React Query (TanStack) | Server state, caching, optimistic updates |
| Board DnD | @dnd-kit | Drag-and-drop for kanban |
| Markdown | react-markdown + rehype | Render deliverables, comments |
| Backend | Node.js + Express or Fastify | Same language as execution service |
| Database | PostgreSQL | Tasks, comments, proposals, discussions |
| Queue | Redis Streams | Agent communication (unchanged) |
| File storage | Docker volumes + API | Workspace file access |

---

## 13. Updated Tool Inventory

Tools added or modified from v2:

| Tool | Change | Description |
|------|--------|-------------|
| `post_comment` | **NEW** | Post comments on board work items. Supports `supersedes` param for question supersession. Replaces `ask_user` for async. |
| `request_discussion` | **NEW** | Request a live sync discussion with user (requirement refinement, mid-execution re-alignment) |
| `update_plan` | **MODIFIED** | Now triggers Board Sync Engine to project plan onto board |
| `publish_deliverable` | **MODIFIED** | Now creates reviewable deliverable entry with review status |
| `ask_user` | **REMOVED** | Replaced by `post_comment(block=true)` for blocking questions |

Full tool list:

| Tool | Risk | Category |
|------|------|----------|
| `bash` | MEDIUM-CRITICAL | Environment |
| `read` | LOW | File System |
| `write` | MEDIUM-HIGH | File System |
| `edit` | LOW | File System |
| `glob` | LOW | File System |
| `grep` | LOW | File System |
| `browser` | MEDIUM-HIGH | Environment |
| `web_search` | MEDIUM | Information |
| `web_fetch` | MEDIUM | Information |
| `update_plan` | LOW | Context + Board |
| `save_memo` | LOW | Context |
| `search_memo` | LOW | Context |
| `post_comment` | LOW | Collaboration |
| `request_discussion` | LOW | Collaboration |
| `spawn_agent` | MEDIUM | Orchestration |
| `publish_deliverable` | LOW | Output |
| `list_skills` | LOW | Skills |
| `read_skill` | LOW | Skills |

---

## 14. Updated Agent Loop

### 14.1 Changes from v2

The agent loop from v2 (Section 4) is unchanged in its core structure. The additions:

1. **`update_plan` side effect**: After the tool executes, call `syncPlanToBoard()` to project plan onto the board UI.
2. **`post_comment` side effect**: After the tool executes, broadcast the comment via WebSocket.
3. **`publish_deliverable` side effect**: Create a reviewable deliverable entry in the database.
4. **`request_discussion` side effect**: Create a DiscussionRequest, notify user.
5. **Injection types expanded**: Now includes `user_comment` and `discussion_scheduled` in addition to v2 types.

```typescript
// Extended injection types
interface AgentInjection {
  injection_type:
    | 'user_message'
    | 'user_comment'             // NEW: user commented on a work item
    | 'hitl_response'
    | 'external_event'
    | 'system_control'
    | 'discussion_scheduled'     // NEW: user scheduled a discussion
    | 'review_feedback'          // NEW: user reviewed a deliverable
    | 'watcher_event'           // NEW: external watcher triggered
    | 'file_uploaded';          // NEW: user uploaded/edited file in workspace
  content: string;
  metadata?: Record<string, unknown>;
}
```

### 14.2 Tool Side Effects Pipeline

```typescript
async function executeToolWithSideEffects(
  toolCall: ToolCall,
  container: Container,
  taskId: string,
): Promise<string> {
  // Execute the tool
  const result = await executeTool(toolCall, container);

  // Side effects based on tool name
  switch (toolCall.name) {
    case 'update_plan':
      const plan = JSON.parse(toolCall.arguments);
      await syncPlanToBoard(taskId, plan);
      await ws.broadcast(taskId, { type: 'board_updated', items: plan.steps });
      break;

    case 'post_comment':
      const comment = JSON.parse(toolCall.arguments);
      const saved = await db.createComment({ task_id: taskId, ...comment, author_type: 'agent' });
      await ws.broadcast(taskId, { type: 'comment_posted', comment: saved });
      break;

    case 'publish_deliverable':
      const deliv = JSON.parse(toolCall.arguments);
      const entry = await db.createDeliverable({ task_id: taskId, ...deliv, review_status: 'PENDING' });
      await ws.broadcast(taskId, { type: 'deliverable_published', deliverable: entry });
      break;

    case 'request_discussion':
      const req = JSON.parse(toolCall.arguments);
      const discussion = await db.createDiscussionRequest({ task_id: taskId, ...req });
      await ws.broadcast(taskId, { type: 'discussion_requested', request: discussion });
      await notifyUser(taskId, `Agent wants to discuss: ${req.topic}`);
      break;
  }

  return result;
}
```

---

## 15. Database Schema

### 15.1 Tables

```sql
-- Tasks
CREATE TABLE tasks (
  task_id        TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  goal           TEXT NOT NULL,
  constraints    JSONB,
  size           TEXT CHECK (size IN ('story', 'epic')),
  status         TEXT NOT NULL DEFAULT 'PLANNING',  -- Visualization-only: PLANNING → RUNNING → COMPLETED
  plan_snapshot  JSONB,
  success_criteria JSONB,                         -- SuccessCriterion[] (OKR-style, Section 11)
  usage          JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

-- Work Items (projections of plan steps)
CREATE TABLE work_items (
  item_id        TEXT NOT NULL,
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  description    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'TODO',
  notes          TEXT,
  sub_agent_label TEXT,
  sort_order     INT NOT NULL DEFAULT 0,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  PRIMARY KEY (task_id, item_id)
);

-- Comments
CREATE TABLE comments (
  comment_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  item_id        TEXT,         -- NULL for task-level comments
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  author_type    TEXT NOT NULL CHECK (author_type IN ('agent', 'user', 'system')),
  author_id      TEXT NOT NULL,
  content        TEXT NOT NULL,
  comment_type   TEXT NOT NULL,
  superseded_by  TEXT REFERENCES comments(comment_id),  -- Question supersession
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deliverables
CREATE TABLE deliverables (
  deliverable_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  item_id        TEXT,
  filepath       TEXT NOT NULL,
  description    TEXT NOT NULL,
  type           TEXT NOT NULL,
  review_status  TEXT NOT NULL DEFAULT 'PENDING',
  content        TEXT,
  size_bytes     BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewer_comment TEXT
);

-- Discussion Requests
CREATE TABLE discussion_requests (
  request_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  item_id        TEXT NOT NULL,
  topic          TEXT NOT NULL,
  context        TEXT NOT NULL,
  preparation_notes TEXT,
  urgency        TEXT NOT NULL DEFAULT 'medium',
  estimated_duration_minutes INT NOT NULL DEFAULT 10,
  status         TEXT NOT NULL DEFAULT 'REQUESTED',
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at   TIMESTAMPTZ,
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ
);

-- Discussion Sessions
CREATE TABLE discussion_sessions (
  session_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  request_id     TEXT NOT NULL REFERENCES discussion_requests(request_id),
  task_id        TEXT NOT NULL,
  item_id        TEXT NOT NULL,
  messages       JSONB NOT NULL DEFAULT '[]',
  summary        TEXT,
  next_steps     JSONB,
  confirmed_by_user BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Improvement Proposals
CREATE TABLE improvement_proposals (
  proposal_id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  detection_type TEXT NOT NULL,
  description    TEXT NOT NULL,
  evidence       JSONB NOT NULL DEFAULT '[]',
  proposed_change JSONB NOT NULL,
  confidence     FLOAT NOT NULL DEFAULT 0.5,
  status         TEXT NOT NULL DEFAULT 'pending_review',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewer_comment TEXT
);

-- Applied Changes (for rollback)
CREATE TABLE applied_changes (
  change_id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  proposal_id    TEXT NOT NULL REFERENCES improvement_proposals(proposal_id),
  change_type    TEXT NOT NULL,
  applied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by     TEXT NOT NULL,
  previous_value TEXT,
  rollback_available BOOLEAN DEFAULT TRUE
);

-- Daily Digests
CREATE TABLE daily_digests (
  digest_id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  date           DATE NOT NULL,
  content        JSONB NOT NULL,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Trace index (traces stored as JSONL files, this is the index)
CREATE TABLE trace_index (
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  trace_file     TEXT NOT NULL,
  total_entries  INT NOT NULL DEFAULT 0,
  total_tokens   BIGINT NOT NULL DEFAULT 0,
  started_at     TIMESTAMPTZ NOT NULL,
  ended_at       TIMESTAMPTZ,
  PRIMARY KEY (task_id)
);

-- Watchers (external world monitoring)
CREATE TABLE watchers (
  watcher_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  name           TEXT NOT NULL,
  source_plugin  TEXT NOT NULL,
  source_config  JSONB NOT NULL,
  condition      JSONB NOT NULL,
  action         JSONB NOT NULL,
  poll_interval_seconds INT,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  trigger_count  INT NOT NULL DEFAULT 0
);

-- Watcher trigger history
CREATE TABLE watcher_history (
  history_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  watcher_id     TEXT NOT NULL REFERENCES watchers(watcher_id),
  event_id       TEXT NOT NULL,
  event_data     JSONB NOT NULL,
  condition_result BOOLEAN NOT NULL,
  action_taken   TEXT,
  created_task_id TEXT REFERENCES tasks(task_id),
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat conversations (Quick Mode history)
CREATE TABLE chat_messages (
  message_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content        TEXT NOT NULL,
  /** If this chat led to task creation, link it */
  spawned_task_id TEXT REFERENCES tasks(task_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Policies (Policy Engine configuration per user)
CREATE TABLE user_policies (
  user_id        TEXT PRIMARY KEY,
  attention      JSONB NOT NULL DEFAULT '{}',   -- AttentionPolicy
  wip            JSONB NOT NULL DEFAULT '{}',   -- WIPPolicy
  review         JSONB NOT NULL DEFAULT '{}',   -- ReviewPolicy (Section 4.4)
  autonomy       JSONB NOT NULL DEFAULT '{}',   -- AutonomyPolicy
  planning       JSONB NOT NULL DEFAULT '{}',   -- PlanningPolicy
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly Reviews
CREATE TABLE weekly_reviews (
  review_id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  week           TEXT NOT NULL,                 -- ISO week: "2026-W05"
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  briefing       JSONB NOT NULL DEFAULT '{}',   -- WeeklyBriefing
  actions_taken  JSONB,                         -- ReviewAction[]
  completed_at   TIMESTAMPTZ,
  UNIQUE(user_id, week)
);

-- Notification Queue (for digest batching / DND accumulation)
CREATE TABLE notification_queue (
  notification_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  event_data     JSONB NOT NULL,
  priority       TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'blocker')),
  queued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at   TIMESTAMPTZ
);
CREATE INDEX idx_notification_queue_user_pending
  ON notification_queue(user_id) WHERE delivered_at IS NULL;

-- Behavior Feedback (calibration data from human)
CREATE TABLE behavior_feedback (
  feedback_id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  feedback_type  TEXT NOT NULL,
  description    TEXT,
  suggested_change JSONB,                       -- PolicySuggestion
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 16. Unchanged from v2

The following sections from v2 are unchanged and still apply:

| v2 Section | Topic |
|------------|-------|
| 4. Agent Loop | Core loop pseudocode, injection queue, initial context (with additions in Section 14 above) |
| 5. Planning Tool | update_plan definition and execution (now also triggers board sync) |
| 6. Compaction Engine | Full compaction flow, memory flush, summarization |
| 7. File System Context | Workspace layout, memo tools, tiered memory |
| 9. Sub-Agent Management | spawn_agent, sub-agent manager, result passing |
| 10. Skills System | SKILL.md, list_skills, read_skill |
| 11. Risk Control | Classification, rules, doom loop detection |
| 12. Docker Container Management | Container lifecycle, configuration, per-task isolation |
| 17. Configuration | Environment variables, per-task overrides |
| 18. Error Handling | Error categories, LLM retry, container errors |
| Appendix A | System prompt template (extend with collaboration instructions) |

---

## 17. System Prompt Additions (for v3)

Append to the system prompt template from v2:

```markdown
# Collaboration

You work with a human via a project board. Your plan steps appear as work items on the board.

## Comments
Use `post_comment` to communicate with the user on specific work items:
- Share findings and progress (comment_type: "note")
- Ask questions (comment_type: "question") — set block=true only if you cannot proceed without the answer
- Report blockers (comment_type: "blocker", block=true)
- Record important decisions (comment_type: "decision")
- Announce deliverables (comment_type: "deliverable")

The user will respond via comments when they are available. You will see their responses
as injected messages. React to feedback by adjusting your approach.

## Discussions
For complex topics that need interactive conversation, use `request_discussion`.
The user will schedule a time, and you will have a live chat to resolve the issue.
After the discussion:
1. Summarize the discussion
2. Post the summary as a comment (type: discussion_summary)
3. Update your plan with agreed next steps
4. Ask the user to confirm the plan

## Deliverables
When you complete a piece of work, use `publish_deliverable`.
The user may review and request changes. Check for review feedback in your injections.

## Question Updates
If the environment changes and a previous question you asked is no longer relevant,
post a new question with `supersedes` set to the old question's ID. The old question
will be shown with strikethrough. Always re-evaluate your pending questions when
significant new information arrives.

## Async vs Sync
Default to async (comments). Only request sync discussions when:
- The topic has significant trade-offs requiring interactive exploration
- Multiple rounds of async back-and-forth would be slower
- The environment changed and your original requirements may need revision
- You need to demonstrate or walk through something live

## Planning

### Risk-First Ordering
Order your plan steps by uncertainty and risk first ("eat the frog"). Steps that depend
on unknown factors, external access, or user decisions should come before routine work.
This surfaces blockers early so the human can unblock you sooner.

### Success Criteria
During planning, generate explicit success criteria for the task:
- **Required** criteria: must be met for the task to be considered complete.
- **Stretch** criteria: nice-to-have (aim for ~70% of stretch goals, per the OKR principle).
Present criteria to the user for confirmation before starting execution.

### Stretch Items
Include "stretch" items in your plan — additional improvements beyond the core goal.
Mark them clearly as stretch so the user knows what is required vs optional.

## Autonomy and Proactive Behavior

### Micro-Requests
For small follow-up actions requested via comments that you estimate will take less than
a few minutes, act immediately without updating the plan or asking for confirmation.
Just do it and post a note when done.

### Self-Assessment
Before publishing a deliverable, evaluate it against each success criterion. Report:
- Whether each required criterion is met (with evidence)
- Confidence level (0.0 - 1.0) for each assessment
- Status of stretch criteria
The human reviews your self-assessment alongside the deliverable.

### Proactive Risk Reporting
Flag risks early. Do not wait until you are fully blocked to report concerns:
- If a step is taking much longer than expected, post a note with status and estimate.
- If you discover scope is larger than originally estimated, propose scope negotiation
  rather than silently expanding.
- If you make an assumption to avoid blocking, explicitly note the assumption so the
  human can correct it if wrong.
- If you notice patterns that may affect other tasks, post a note.

### Manage-Up Behavior
You are not just a task executor — you are a project partner. Act like a senior employee
who manages up:
- Surface risks before they become blockers
- Propose alternatives when you hit obstacles (don't just report the problem)
- Note assumptions and confidence levels on decisions you make autonomously
- Suggest improvements to the process or task framing when you notice inefficiencies
```

---

## Appendix A: Migration from v2 to v3

### What to Add

| Component | Purpose |
|-----------|---------|
| `src/chat/` | Quick mode handler, intent classification, goal clarity analysis |
| `src/board/` | Board Sync Engine, plan-to-board projection |
| `src/comments/` | Comment storage, injection, and supersession logic |
| `src/discussion/` | Discussion scheduler, sync chat handler, requirement refinement |
| `src/deliverable/` | Deliverable review management |
| `src/watcher/` | Watcher service, SourcePlugin interface, condition evaluators, dedup |
| `src/watcher/plugins/` | Built-in source plugins (email, webhook, api_poll, rss, cron) |
| `src/sleep-time/` | All sleep-time compute jobs |
| `src/trace/` | Trace store, query API, summarization |
| `src/improvement/` | Improvement proposal management |
| `src/policy/` | Policy Engine: AttentionPolicy, WIPPolicy, AutonomyPolicy, PlanningPolicy, priority classification |
| `src/notification/` | Notification Service: routing, batching, digest windows, DND, priority filtering |
| `src/review/` | Weekly Review: briefing generator, review session handler, policy suggestions |
| `src/calibration/` | Behavior feedback collection, policy suggestion engine |
| `src/api/` | REST API routes (chat, tasks, watchers, files, policies, weekly review, etc.) |
| `src/ws/` | WebSocket server for real-time updates |
| `src/frontend/` | Next.js web application |
| Database migrations | PostgreSQL schema (including watchers, chat_messages, superseded_by, user_policies, weekly_reviews, notification_queue, behavior_feedback) |

### What to Modify

| Component | Change |
|-----------|--------|
| `update_plan` tool | Add board sync side effect |
| `ask_user` tool | Remove, replace with `post_comment(block=true)` |
| `post_comment` tool | Add `supersedes` parameter for question supersession |
| Agent loop | Add tool side effects pipeline |
| Injection types | Add `user_comment`, `discussion_scheduled`, `review_feedback`, `watcher_event`, `file_uploaded` |
| TaskStatus enum | Remove `DISCUSSING`, add `PLANNING`, mark as visualization-only |
| Task data model | Add `success_criteria: SuccessCriterion[]` for OKR-style outcome definitions |
| `publish_deliverable` flow | Add self-assessment pipeline: evaluate against success criteria before publishing |
| Notification routing | All agent events route through Policy Engine → Notification Service before reaching frontend |
| System prompt | Add planning (risk-first, success criteria), autonomy (micro-requests, manage-up), self-assessment instructions |

### What is Unchanged

| Component | Notes |
|-----------|-------|
| Agent loop core | Same LLM-in-a-loop |
| Compaction engine | Same |
| Sub-agent management | Same |
| Skills system | Same |
| Risk control | Same |
| Container management | Same |
| Session Coordinator | Same (extended with board events) |

---

*End of Execution Service Factsheet (v3)*
