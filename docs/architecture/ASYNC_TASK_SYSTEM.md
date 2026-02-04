# NnemoClaw Async Task System Architecture

**Framework: Distributed Systems Architecture with Non-Blocking Message Handling**  
**Stage: Comprehensive System Redesign**  
**Goal: Ensure chat/message interface ALWAYS responds immediately while executing long-running agent tasks asynchronously**

---

## A) PROBLEM DIAGNOSIS

### Current Blocking Paths

#### 1. **Primary Blocking Path: `src/gateway/server-methods/chat.ts`**
- **Lines 502-592**: `void dispatchInboundMessage()` is called without await, BUT...
- The handler returns BEFORE the task completes
- **Issue**: Response sent immediately (good), but NO progress updates or final results communicated back to client
- **Consequence**: Client has no visibility into long-running task state

#### 2. **Agent Execution Blocking**
- **File**: `src/auto-reply/dispatch.ts` (lines 17-32)
- **Function**: `dispatchInboundMessage()` - This is async and blocks until completion
- **File**: `src/auto-reply/reply/agent-runner.ts` (17K lines)
- **Flow**: Message → Dispatch → Agent Runner → Model API Call → Tool Execution → Response
- All synchronous from caller's perspective

#### 3. **Tool Execution Blocking**
- **File**: `src/agents/bash-tools.exec.ts` (53K lines)
- Command execution can take seconds/minutes
- No interrupt/cancel mechanism exposed to gateway layer
- **File**: `src/agents/tools/web-fetch.ts` (24K lines)
- Network calls can timeout/hang
- No progress reporting

#### 4. **Session/Transcript I/O Blocking**
- **File**: `src/gateway/session-utils.ts` (22K lines)
- Synchronous file I/O in `readSessionMessages()`, `loadSessionEntry()`
- Can block on large transcripts (thousands of messages)

### Why Replies Are Blocked

**Root Cause**: The current architecture treats message handling as a **synchronous RPC** pattern:
```
Message In → Process → Agent Run → Response Out
```

**Should be**: **Async Task Pattern**:
```
Message In → Acknowledge + Create Task → Return
             ↓
           Background Worker → Process → Progress Updates → Final Result
```

**Current flow in `chat.ts` lines 502-592**:
1. ✅ Deduplication check (fast)
2. ✅ Create AbortController (fast)
3. ✅ Store controller in map (fast)
4. ❌ `void dispatchInboundMessage()` - Fire-and-forget BUT blocks agent execution
5. ✅ Return response immediately
6. ❌ NO mechanism to send progress/completion back to client

**Gap**: The `void` pattern acknowledges quickly but creates a "fire and forget" scenario with no observability.

---

## B) TARGET ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MESSAGE LANE (Fast)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐      ┌──────────────┐      ┌─────────────┐          │
│  │ WebSocket│ ───► │ chat.send    │ ───► │ Task Queue  │          │
│  │ Gateway  │      │ Handler      │      │ Enqueue     │          │
│  └──────────┘      └──────────────┘      └─────────────┘          │
│       │                   │                      │                  │
│       │              Immediate                   │                  │
│       │              Response                    │                  │
│       │              (Task ID)                   │                  │
│       ▼                                          ▼                  │
│  ┌──────────┐                          ┌─────────────────┐         │
│  │ Client   │◄─────────────────────────│ TaskRun Record  │         │
│  │ Receives │  { runId, status:       │ Created         │         │
│  │ Ack      │    "queued" }            └─────────────────┘         │
│  └──────────┘                                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │  Task Dequeued
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        TASK LANE (Async)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐      ┌──────────────┐      ┌─────────────┐      │
│  │ Worker Pool  │ ───► │ Task Runner  │ ───► │ Agent Exec  │      │
│  │ (Concurrency │      │ Executor     │      │ Engine      │      │
│  │ Controlled)  │      └──────────────┘      └─────────────┘      │
│  └──────────────┘             │                      │             │
│                               │                      │             │
│                               │                      │             │
│                               ▼                      ▼             │
│                      ┌─────────────────┐   ┌──────────────┐       │
│                      │ Progress Events │   │ Tool Calls   │       │
│                      │ (Streaming)     │   │ (Monitored)  │       │
│                      └─────────────────┘   └──────────────┘       │
│                               │                      │             │
└───────────────────────────────┼──────────────────────┼─────────────┘
                               │                      │
                               │  Event Channel       │
                               ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EVENT CHANNEL (Broadcast)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐      ┌──────────────┐      ┌─────────────┐      │
│  │ Progress     │ ───► │ WebSocket    │ ───► │ Client UI   │      │
│  │ Publisher    │      │ Broadcast    │      │ Updates     │      │
│  └──────────────┘      └──────────────┘      └─────────────┘      │
│                                                                     │
│  Events:                                                            │
│  • task.progress    { runId, state: "running", progress: 0.3 }    │
│  • task.tool_call   { runId, tool: "bash", status: "executing" }  │
│  • task.completed   { runId, state: "completed", result: {...} }  │
│  • task.failed      { runId, state: "failed", error: "..." }      │
│  • task.canceled    { runId, state: "canceled" }                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Components

1. **Message Lane**: Synchronous, non-blocking request handlers
2. **Task Lane**: Async worker pool executing agent tasks
3. **Event Channel**: Pub/sub for progress and completion events
4. **Task Store**: Persistent state for task lifecycle

---

## C) TASK LIFECYCLE & STATE MACHINE

### TaskRun Schema

```typescript
interface TaskRun {
  // Identity
  runId: string;              // UUID for this task
  sessionKey: string;         // Session this task belongs to
  
  // State
  state: TaskState;
  createdAt: number;          // Timestamp (ms)
  startedAt?: number;         // When worker picked it up
  completedAt?: number;       // When finished/failed/canceled
  expiresAt: number;          // TTL for cleanup
  
  // Inputs
  message: string;            // User message
  images?: ChatImageContent[];
  context: {
    provider: string;
    surface: string;
    senderId?: string;
    senderName?: string;
  };
  
  // Execution
  agentId?: string;
  abortController?: AbortController;
  
  // Outputs
  result?: {
    message?: Record<string, unknown>;
    error?: string;
  };
  
  // Progress
  progress?: {
    current: number;          // 0-1
    message?: string;         // "Processing tool call..."
    toolCalls?: number;       // Count of tools executed
  };
  
  // Metadata
  retryCount: number;
  priority: number;           // 0-10, higher = more urgent
}

enum TaskState {
  QUEUED = "queued",         // In queue, not started
  RUNNING = "running",       // Worker executing
  COMPLETED = "completed",   // Success
  FAILED = "failed",         // Error
  CANCELED = "canceled",     // User/system abort
  EXPIRED = "expired"        // TTL exceeded
}
```

### State Transitions

```
                    ┌──────────┐
                    │ QUEUED   │
                    └──────────┘
                         │
              Worker     │
              Picks Up   │
                         ▼
                    ┌──────────┐
              ┌────►│ RUNNING  │◄────┐
              │     └──────────┘     │
              │          │           │
     Retry on │          │           │ Progress
     Failure  │          │           │ Update
              │          ▼           │
              │     ┌──────────┐    │
              │     │ Tool Call├────┘
              │     └──────────┘
              │          │
              │          ├──────────► Success ───► COMPLETED
              │          │
              │          ├──────────► Error ─────► FAILED
              │          │
              └──────────┤
                         │
             User Cancel ├──────────► CANCELED
                         │
             TTL Expired ├──────────► EXPIRED
```

### State Transition Rules

| From State | To State | Trigger | Side Effects |
|-----------|----------|---------|--------------|
| QUEUED | RUNNING | Worker dequeue | Set `startedAt`, broadcast `task.started` |
| RUNNING | COMPLETED | Agent success | Store result, broadcast `task.completed` |
| RUNNING | FAILED | Agent error | Store error, broadcast `task.failed`, maybe retry |
| RUNNING | CANCELED | User abort | Signal AbortController, broadcast `task.canceled` |
| QUEUED | CANCELED | User abort | Remove from queue, broadcast `task.canceled` |
| QUEUED | EXPIRED | TTL check | Remove from queue, broadcast `task.expired` |
| FAILED | QUEUED | Retry logic | Increment retryCount, re-enqueue |

---

## D) API ENDPOINTS & MESSAGE CONTRACTS

### WebSocket Methods (Gateway Protocol)

#### 1. `task.create` (replaces current `chat.send`)

**Request**:
```typescript
{
  method: "task.create",
  params: {
    sessionKey: string;
    message: string;
    images?: Array<{type: "image", source: ...}>;
    priority?: number;  // 0-10, default 5
    clientRunId?: string;
  }
}
```

**Response** (immediate):
```typescript
{
  ok: true,
  result: {
    runId: string;        // Task identifier
    status: "queued";     // Initial state
    position?: number;    // Position in queue (optional)
  }
}
```

#### 2. `task.status`

**Request**:
```typescript
{
  method: "task.status",
  params: {
    runId: string;
  }
}
```

**Response**:
```typescript
{
  ok: true,
  result: {
    runId: string;
    state: TaskState;
    progress?: {
      current: number;    // 0.0 - 1.0
      message?: string;
    };
    result?: {            // Only if completed/failed
      message?: object;
      error?: string;
    };
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
  }
}
```

#### 3. `task.cancel`

**Request**:
```typescript
{
  method: "task.cancel",
  params: {
    runId: string;
  }
}
```

**Response**:
```typescript
{
  ok: true,
  result: {
    runId: string;
    canceled: boolean;
  }
}
```

#### 4. `task.list`

**Request**:
```typescript
{
  method: "task.list",
  params: {
    sessionKey?: string;  // Filter by session
    states?: TaskState[]; // Filter by states
    limit?: number;       // Default 50
  }
}
```

**Response**:
```typescript
{
  ok: true,
  result: {
    tasks: TaskRun[];
    total: number;
  }
}
```

### Server-to-Client Events (Broadcast)

#### Event: `task.progress`

```typescript
{
  event: "task",
  data: {
    runId: string;
    sessionKey: string;
    state: "running";
    progress: {
      current: 0.3;
      message: "Executing bash command...";
      toolCalls: 2;
    };
  }
}
```

#### Event: `task.completed`

```typescript
{
  event: "task",
  data: {
    runId: string;
    sessionKey: string;
    state: "completed";
    result: {
      message: {
        role: "assistant",
        content: [...],
        timestamp: 1234567890,
        ...
      }
    };
    completedAt: 1234567890;
  }
}
```

#### Event: `task.failed`

```typescript
{
  event: "task",
  data: {
    runId: string;
    sessionKey: string;
    state: "failed";
    result: {
      error: "Model timeout after 60s"
    };
    completedAt: 1234567890;
  }
}
```

---

## E) WORKER EXECUTION MODEL

### Task Queue Design

**File**: `src/gateway/task-queue.ts` (NEW)

```typescript
interface TaskQueue {
  // Enqueue a new task
  enqueue(task: TaskRun): Promise<void>;
  
  // Dequeue next task (FIFO with priority)
  dequeue(): Promise<TaskRun | null>;
  
  // Get task by ID
  get(runId: string): Promise<TaskRun | null>;
  
  // Update task state
  update(runId: string, updates: Partial<TaskRun>): Promise<void>;
  
  // Cancel task
  cancel(runId: string): Promise<boolean>;
  
  // List tasks
  list(filter: TaskFilter): Promise<TaskRun[]>;
  
  // Cleanup expired tasks
  cleanup(): Promise<number>;
}
```

### Worker Pool

**File**: `src/gateway/task-worker-pool.ts` (NEW)

```typescript
class TaskWorkerPool {
  private workers: TaskWorker[];
  private concurrency: number;
  private queue: TaskQueue;
  
  constructor(options: {
    concurrency: number;  // Max parallel tasks
    queue: TaskQueue;
    context: GatewayRequestContext;
  }) {
    this.concurrency = options.concurrency;
    this.queue = options.queue;
    this.workers = [];
    
    // Spin up workers
    for (let i = 0; i < this.concurrency; i++) {
      this.workers.push(new TaskWorker({
        id: `worker-${i}`,
        queue: this.queue,
        context: options.context,
      }));
    }
  }
  
  async start(): Promise<void> {
    await Promise.all(this.workers.map(w => w.start()));
  }
  
  async stop(): Promise<void> {
    await Promise.all(this.workers.map(w => w.stop()));
  }
  
  getStatus(): WorkerPoolStatus {
    return {
      totalWorkers: this.workers.length,
      activeWorkers: this.workers.filter(w => w.isBusy).length,
      queueSize: this.queue.size,
    };
  }
}
```

### Individual Worker

**File**: `src/gateway/task-worker.ts` (NEW)

```typescript
class TaskWorker {
  private id: string;
  private queue: TaskQueue;
  private context: GatewayRequestContext;
  private running: boolean = false;
  private currentTask: TaskRun | null = null;
  
  async start(): Promise<void> {
    this.running = true;
    
    while (this.running) {
      try {
        // Dequeue next task
        const task = await this.queue.dequeue();
        if (!task) {
          await sleep(100); // Polling interval
          continue;
        }
        
        this.currentTask = task;
        await this.executeTask(task);
        this.currentTask = null;
        
      } catch (err) {
        this.context.logGateway.error(`Worker ${this.id} error:`, err);
      }
    }
  }
  
  async stop(): Promise<void> {
    this.running = false;
    // Cancel current task if any
    if (this.currentTask) {
      await this.queue.cancel(this.currentTask.runId);
    }
  }
  
  private async executeTask(task: TaskRun): Promise<void> {
    try {
      // Update state to RUNNING
      await this.queue.update(task.runId, {
        state: TaskState.RUNNING,
        startedAt: Date.now(),
      });
      
      // Broadcast start event
      this.context.broadcast("task", {
        runId: task.runId,
        sessionKey: task.sessionKey,
        state: "running",
      });
      
      // Execute agent (existing dispatchInboundMessage logic)
      const result = await this.runAgent(task);
      
      // Update state to COMPLETED
      await this.queue.update(task.runId, {
        state: TaskState.COMPLETED,
        completedAt: Date.now(),
        result: { message: result },
      });
      
      // Broadcast completion
      this.context.broadcast("task", {
        runId: task.runId,
        sessionKey: task.sessionKey,
        state: "completed",
        result: { message: result },
        completedAt: Date.now(),
      });
      
    } catch (err) {
      // Update state to FAILED
      await this.queue.update(task.runId, {
        state: TaskState.FAILED,
        completedAt: Date.now(),
        result: { error: String(err) },
      });
      
      // Broadcast failure
      this.context.broadcast("task", {
        runId: task.runId,
        sessionKey: task.sessionKey,
        state: "failed",
        result: { error: String(err) },
        completedAt: Date.now(),
      });
      
      // Maybe retry
      if (task.retryCount < MAX_RETRIES) {
        await this.queue.enqueue({
          ...task,
          state: TaskState.QUEUED,
          retryCount: task.retryCount + 1,
        });
      }
    }
  }
  
  private async runAgent(task: TaskRun): Promise<Record<string, unknown>> {
    // Load config
    const { cfg, entry } = loadSessionEntry(task.sessionKey);
    
    // Build context (from chat.ts logic)
    const ctx: MsgContext = {
      Body: task.message,
      BodyForAgent: task.message,
      SessionKey: task.sessionKey,
      Provider: task.context.provider,
      Surface: task.context.surface,
      SenderId: task.context.senderId,
      SenderName: task.context.senderName,
      // ...
    };
    
    // Progress reporter
    const reportProgress = (progress: number, message?: string) => {
      this.queue.update(task.runId, {
        progress: { current: progress, message },
      });
      this.context.broadcast("task", {
        runId: task.runId,
        sessionKey: task.sessionKey,
        state: "running",
        progress: { current: progress, message },
      });
    };
    
    // Create dispatcher with progress hooks
    let finalMessage: Record<string, unknown> | undefined;
    const dispatcher = createReplyDispatcher({
      onError: (err) => {
        this.context.logGateway.warn(`task ${task.runId} dispatch failed:`, err);
      },
      deliver: async (payload, info) => {
        if (info.kind === "progress") {
          // Estimate progress based on tool calls
          reportProgress(0.5, "Executing tools...");
        }
        if (info.kind === "final") {
          finalMessage = payload;
        }
      },
    });
    
    // Execute agent
    await dispatchInboundMessage({
      ctx,
      cfg,
      dispatcher,
      replyOptions: {
        runId: task.runId,
        abortSignal: task.abortController?.signal,
        images: task.images,
        onAgentRunStart: () => {
          reportProgress(0.1, "Agent started");
        },
        onModelSelected: () => {
          reportProgress(0.2, "Model selected");
        },
      },
    });
    
    // Persist transcript
    if (finalMessage) {
      const appended = appendAssistantTranscriptMessage({
        message: extractText(finalMessage),
        sessionId: entry?.sessionId ?? task.runId,
        storePath: entry?.storePath,
        sessionFile: entry?.sessionFile,
        createIfMissing: true,
      });
      
      if (appended.ok) {
        return appended.message!;
      }
    }
    
    return finalMessage ?? { role: "assistant", content: [] };
  }
  
  get isBusy(): boolean {
    return this.currentTask !== null;
  }
}
```

---

## F) MINIMAL PATCH PLAN

### Phase 1: Foundation (Week 1)

**Priority**: Infrastructure setup without breaking existing flow

1. **Create Task Schema**
   - File: `src/gateway/task-schema.ts`
   - Define `TaskRun`, `TaskState`, `TaskFilter` types
   - Add Zod validators

2. **Implement In-Memory Task Store**
   - File: `src/gateway/task-store-memory.ts`
   - Implements `TaskQueue` interface
   - Use Map for fast lookups
   - TTL cleanup via setInterval

3. **Add Task Methods to Gateway Protocol**
   - File: `src/gateway/server-methods/task.ts`
   - Implement: `task.create`, `task.status`, `task.cancel`, `task.list`
   - Register in `server-methods.ts`

**Verification**: Can create/query tasks, but they don't execute yet

### Phase 2: Worker Integration (Week 2)

**Priority**: Route execution through worker without changing logic

4. **Create Worker Pool**
   - File: `src/gateway/task-worker-pool.ts`
   - File: `src/gateway/task-worker.ts`
   - Start with concurrency=1 to match current behavior
   - Extract agent execution from `chat.ts` into worker

5. **Modify `chat.send` Handler**
   - File: `src/gateway/server-methods/chat.ts`
   - Lines 390-611: Refactor to enqueue task instead of execute
   - Return immediate response with `runId`
   - Keep old code path behind feature flag `ENABLE_ASYNC_TASKS`

**Verification**: Tasks execute via workers, responses arrive via events

### Phase 3: Progress Reporting (Week 3)

**Priority**: Add visibility into running tasks

6. **Instrument Agent Runner**
   - File: `src/auto-reply/reply/agent-runner.ts`
   - Add progress hooks: `onAgentStart`, `onToolCall`, `onToolComplete`
   - Emit progress events through dispatcher

7. **Progress Broadcasting**
   - Modify worker to listen to progress hooks
   - Broadcast `task.progress` events
   - Update task store with progress data

**Verification**: Client receives progress updates during long tasks

### Phase 4: Cancellation & Cleanup (Week 4)

**Priority**: Handle task lifecycle edge cases

8. **Implement Cancellation**
   - Wire `task.cancel` to AbortController
   - Stop worker execution gracefully
   - Clean up task state

9. **Add TTL Cleanup**
   - Background job to expire old tasks
   - Remove completed tasks after retention period
   - Configurable via `gateway.tasks.retentionSeconds`

10. **Error Recovery**
    - Retry logic for transient failures
    - Max retry limits
    - Dead letter queue for persistent failures

**Verification**: Can cancel tasks, old tasks get cleaned up

### Phase 5: Scale & Optimize (Week 5+)

11. **Persistent Task Store** (Optional)
    - File: `src/gateway/task-store-redis.ts` OR `task-store-sqlite.ts`
    - For multi-instance deployments
    - Survives gateway restarts

12. **Tunable Concurrency**
    - Config: `gateway.tasks.workerConcurrency` (default: 3)
    - Auto-scale based on queue depth
    - Per-session concurrency limits

13. **Priority Queues**
    - Higher priority for interactive sessions
    - Lower priority for batch/cron tasks

**Verification**: Can handle 10+ concurrent tasks without blocking

### Code Boundaries

| Component | File Path | Responsibility |
|-----------|-----------|---------------|
| Task Schema | `src/gateway/task-schema.ts` | Type definitions |
| Task Store (Memory) | `src/gateway/task-store-memory.ts` | Queue implementation |
| Task Store (Persistent) | `src/gateway/task-store-redis.ts` | Persistent queue (optional) |
| Worker Pool | `src/gateway/task-worker-pool.ts` | Manage worker lifecycle |
| Worker | `src/gateway/task-worker.ts` | Execute tasks |
| Task Methods | `src/gateway/server-methods/task.ts` | Gateway API handlers |
| Chat Handler (Modified) | `src/gateway/server-methods/chat.ts` | Enqueue instead of execute |
| Cleanup Job | `src/gateway/task-cleanup.ts` | TTL enforcement |
| Config | `src/config/zod-schema.gateway.ts` | Task settings |

---

## G) UX BEHAVIOR

### What the User Sees

#### Scenario 1: Simple Query (Fast)

**User sends**: "What is 2+2?"

1. **Immediate**: "✓ Message received (task: abc123)"
2. **2s later**: "The answer is 4."
3. **Status indicator**: 🟢 Completed

#### Scenario 2: Long-Running Task

**User sends**: "Analyze this 1000-line codebase and create a refactoring plan"

1. **Immediate**: "✓ Task created (task: xyz789) - Position 1 in queue"
2. **5s later**: "🔵 Running - Reading files..."
3. **15s later**: "🔵 Running - Analyzing dependencies..."
4. **30s later**: "🔵 Running - Generating recommendations..."
5. **45s later**: "✅ Here's the refactoring plan: [detailed response]"
6. **Status indicator**: 🟢 Completed

#### Scenario 3: User Sends Another Message While Task Running

**Initial task**: "Write a 500-line Python module for image processing" (running)

**User sends**: "What's the status?"

1. **Immediate response**: "✓ Message received (task: def456)"
2. **1s later**: "Your previous task (xyz789) is still running - 60% complete. I'm analyzing image filters. I'll let you know when it's done!"
3. **Previous task continues**: No interruption

#### Scenario 4: User Cancels Task

**Running task**: "Download and analyze 100GB dataset"

**User sends**: "!cancel xyz789"

1. **Immediate**: "✓ Canceling task xyz789..."
2. **2s later**: "❌ Task xyz789 canceled. Partial results: Downloaded 15GB/100GB"
3. **Status indicator**: 🔴 Canceled

#### Scenario 5: Task Fails

**User sends**: "Fetch https://nonexistent-domain.invalid"

1. **Immediate**: "✓ Task created (task: err111)"
2. **5s later**: "❌ Task failed: Network error - DNS resolution failed for nonexistent-domain.invalid"
3. **Status indicator**: 🔴 Failed

### UI Elements

**Task Status Badges**:
- 🟡 Queued (position: X)
- 🔵 Running (progress: X%)
- 🟢 Completed
- 🔴 Failed
- ⚫ Canceled

**Progress Bar** (for running tasks):
```
[████████░░░░░░░░░░░░] 40% - Executing bash command...
```

**Task List View**:
```
Recent Tasks:
• [🟢] abc123 - "What is 2+2?" - Completed 2m ago
• [🔵] xyz789 - "Analyze codebase..." - Running (60%)
• [🟡] def456 - "What's the status?" - Queued (pos: 1)
```

**Chat Integration**:
- Tasks appear inline in chat
- Progress updates stream as new messages
- Final result appears as assistant message
- Can reference tasks by ID: "Show me task xyz789"

---

## SUCCESS CRITERIA ✓

- [ ] User can send 10 messages in rapid succession, all get immediate acks
- [ ] Long-running tasks (30s+) don't block new message handling
- [ ] User receives progress updates every 5-10s for long tasks
- [ ] User can send "what's the status?" mid-task and get response
- [ ] User can cancel tasks with `!cancel <runId>`
- [ ] Multiple tasks can run concurrently (up to worker pool limit)
- [ ] Completed task results appear in chat history
- [ ] Task state survives gateway reload (if persistent store enabled)
- [ ] Failed tasks show clear error messages
- [ ] No "hanging" - all tasks eventually reach terminal state

---

## FRAMEWORK CHECK ✔

**Did this maintain your framework and goal?**

- ✅ Goal Anchor: Ensure chat ALWAYS responds immediately ✓
- ✅ Architecture: Separate Message Lane from Task Lane ✓
- ✅ Non-Negotiable: Never await long-running work in handlers ✓
- ✅ Staged Execution: 5-phase rollout plan ✓
- ✅ Content Integrity: Preserved all technical requirements ✓

This architecture guarantees that chat handlers respond in <100ms while agent tasks run asynchronously with full observability.
