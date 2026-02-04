/**
 * Task API Methods
 * Gateway handlers for task management
 */

import { randomUUID } from "node:crypto";
import {
  TaskRun,
  TaskState,
  TaskCreateRequest,
  TaskCreateRequestSchema,
  TaskFilter,
  TaskFilterSchema,
  TaskCreateResponse,
  TaskStatusResponse,
  TaskListResponse,
  TaskCancelResponse,
  TaskSystemConfig,
  DEFAULT_TASK_CONFIG,
} from "./task-schema.js";
import type { TaskQueue } from "./task-store-memory.js";
import { MemoryTaskQueue } from "./task-store-memory.js";

export interface TaskMethodsContext {
  /** Task queue */
  queue: TaskQueue;
  /** Configuration */
  config: TaskSystemConfig;
  /** Logger */
  log?: {
    info: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  };
}

/**
 * Task Methods Handler
 * Implements gateway protocol methods for task management
 */
export class TaskMethods {
  private context: TaskMethodsContext;

  constructor(context: TaskMethodsContext) {
    this.context = context;
  }

  /**
   * Create a new task
   */
  async create(params: unknown): Promise<TaskCreateResponse> {
    // Validate params
    const parsed = TaskCreateRequestSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid task.create params: ${parsed.error.message}`);
    }

    const request = parsed.data;

    // Check for duplicate (by clientRunId)
    if (request.clientRunId) {
      const existing = await this.findByClientRunId(
        request.sessionKey,
        request.clientRunId
      );
      if (existing) {
        return {
          runId: existing.runId,
          status: existing.state,
          position: this.getQueuePosition(existing.runId),
        };
      }
    }

    // Create task
    const task: TaskRun = {
      runId: randomUUID(),
      sessionKey: request.sessionKey,
      state: TaskState.QUEUED,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.context.config.taskTtlMs,
      message: request.message,
      images: request.images,
      context: {
        provider: request.context?.provider || "gateway",
        surface: request.context?.surface || "api",
        senderId: request.context?.senderId,
        senderName: request.context?.senderName,
        groupId: request.context?.groupId,
        clientRunId: request.clientRunId,
      },
      retryCount: 0,
      priority: request.priority || 5,
    };

    // Enqueue
    await this.context.queue.enqueue(task);

    this.context.log?.info(`Task created: ${task.runId}`, {
      sessionKey: task.sessionKey,
      priority: task.priority,
    });

    return {
      runId: task.runId,
      status: TaskState.QUEUED,
      position: this.getQueuePosition(task.runId),
    };
  }

  /**
   * Get task status
   */
  async status(params: { runId: string }): Promise<TaskStatusResponse> {
    if (!params.runId) {
      throw new Error("runId is required");
    }

    const task = await this.context.queue.get(params.runId);
    if (!task) {
      throw new Error(`Task not found: ${params.runId}`);
    }

    return {
      runId: task.runId,
      state: task.state,
      progress: task.progress,
      result: task.result,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    };
  }

  /**
   * Cancel a task
   */
  async cancel(params: { runId: string }): Promise<TaskCancelResponse> {
    if (!params.runId) {
      throw new Error("runId is required");
    }

    const task = await this.context.queue.get(params.runId);
    if (!task) {
      throw new Error(`Task not found: ${params.runId}`);
    }

    const previousState = task.state;
    const canceled = await this.context.queue.cancel(params.runId);

    this.context.log?.info(`Task canceled: ${params.runId}`, {
      previousState,
      canceled,
    });

    return {
      runId: params.runId,
      canceled,
      previousState,
    };
  }

  /**
   * List tasks
   */
  async list(params: unknown): Promise<TaskListResponse> {
    // Validate params
    const parsed = TaskFilterSchema.safeParse(params || {});
    if (!parsed.success) {
      throw new Error(`Invalid task.list params: ${parsed.error.message}`);
    }

    const filter = parsed.data;
    const { tasks, total } = await this.context.queue.list(filter);

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    const hasMore = offset + tasks.length < total;

    return {
      tasks,
      total,
      hasMore,
    };
  }

  /**
   * Get queue position for a task
   */
  private getQueuePosition(runId: string): number | undefined {
    const queue = this.context.queue as MemoryTaskQueue;
    if (typeof queue.getPosition === "function") {
      const pos = queue.getPosition(runId);
      return pos > 0 ? pos : undefined;
    }
    return undefined;
  }

  /**
   * Find task by client run ID
   */
  private async findByClientRunId(
    sessionKey: string,
    clientRunId: string
  ): Promise<TaskRun | null> {
    const { tasks } = await this.context.queue.list({
      sessionKey,
      limit: 100,
    });

    return (
      tasks.find((t) => t.context.clientRunId === clientRunId) || null
    );
  }
}

/**
 * Create task methods handler
 */
export function createTaskMethods(
  queue: TaskQueue,
  config?: Partial<TaskSystemConfig>
): TaskMethods {
  return new TaskMethods({
    queue,
    config: { ...DEFAULT_TASK_CONFIG, ...config },
  });
}

// ============================================================================
// Gateway Protocol Integration
// ============================================================================

export interface TaskMethodHandlers {
  "task.create": (params: unknown) => Promise<TaskCreateResponse>;
  "task.status": (params: { runId: string }) => Promise<TaskStatusResponse>;
  "task.cancel": (params: { runId: string }) => Promise<TaskCancelResponse>;
  "task.list": (params: unknown) => Promise<TaskListResponse>;
}

/**
 * Create gateway method handlers for tasks
 */
export function createTaskMethodHandlers(
  methods: TaskMethods
): TaskMethodHandlers {
  return {
    "task.create": (params) => methods.create(params),
    "task.status": (params) => methods.status(params),
    "task.cancel": (params) => methods.cancel(params),
    "task.list": (params) => methods.list(params),
  };
}
