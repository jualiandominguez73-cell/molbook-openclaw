/**
 * Task System
 * Main entry point for the async task system
 */

import { EventEmitter } from "node:events";
import {
  TaskRun,
  TaskState,
  TaskProgress,
  TaskResult,
  TaskEvent,
  TaskSystemConfig,
  DEFAULT_TASK_CONFIG,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskStatusResponse,
  TaskListResponse,
  TaskCancelResponse,
  TaskFilter,
} from "./task-schema.js";
import { MemoryTaskQueue, TaskQueue } from "./task-store-memory.js";
import { TaskWorkerPool, createWorkerPool } from "./task-worker.js";
import { TaskMethods, createTaskMethods } from "./task-methods.js";

export interface TaskSystemContext {
  /** Configuration */
  config?: Partial<TaskSystemConfig>;
  /** Logger */
  log?: {
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  };
  /** Broadcast function for events */
  broadcast?: (event: string, data: unknown) => void;
  /** Agent executor function */
  executeAgent: (
    task: TaskRun,
    onProgress: (progress: TaskProgress) => void
  ) => Promise<TaskResult>;
}

/**
 * Task System
 * Orchestrates queue, workers, and API methods
 */
export class TaskSystem extends EventEmitter {
  private config: TaskSystemConfig;
  private queue: TaskQueue;
  private workerPool: TaskWorkerPool;
  private methods: TaskMethods;
  private running: boolean = false;
  private log: NonNullable<TaskSystemContext["log"]>;

  constructor(context: TaskSystemContext) {
    super();

    this.config = { ...DEFAULT_TASK_CONFIG, ...context.config };

    this.log = context.log || {
      info: (msg, data) => console.log(`[TaskSystem] ${msg}`, data || ""),
      warn: (msg, data) => console.warn(`[TaskSystem] ${msg}`, data || ""),
      error: (msg, data) => console.error(`[TaskSystem] ${msg}`, data || ""),
    };

    // Create queue
    this.queue = new MemoryTaskQueue(this.config);

    // Forward queue events
    this.queue.on("task", (event: TaskEvent) => {
      this.emit("task", event);
      this.emit(event.type, event);

      // Broadcast if configured
      if (context.broadcast) {
        context.broadcast(event.type, event);
      }
    });

    // Create worker pool
    this.workerPool = createWorkerPool({
      concurrency: this.config.workerConcurrency,
      queue: this.queue,
      config: this.config,
      log: this.log,
      broadcast: context.broadcast,
      executeAgent: context.executeAgent,
    });

    // Forward worker events
    this.workerPool.on("task.started", (data) => this.emit("worker.task.started", data));
    this.workerPool.on("task.completed", (data) => this.emit("worker.task.completed", data));
    this.workerPool.on("task.failed", (data) => this.emit("worker.task.failed", data));

    // Create API methods
    this.methods = createTaskMethods(this.queue, this.config);
  }

  /**
   * Start the task system
   */
  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    await this.workerPool.start();

    this.log.info("Task system started", {
      workers: this.config.workerConcurrency,
    });
  }

  /**
   * Stop the task system
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    await this.workerPool.stop();
    this.queue.stop();

    this.log.info("Task system stopped");
  }

  // ========================================================================
  // API Methods
  // ========================================================================

  /**
   * Create a new task
   */
  async createTask(params: TaskCreateRequest): Promise<TaskCreateResponse> {
    return this.methods.create(params);
  }

  /**
   * Get task status
   */
  async getTaskStatus(runId: string): Promise<TaskStatusResponse> {
    return this.methods.status({ runId });
  }

  /**
   * Cancel a task
   */
  async cancelTask(runId: string): Promise<TaskCancelResponse> {
    return this.methods.cancel({ runId });
  }

  /**
   * List tasks
   */
  async listTasks(filter?: TaskFilter): Promise<TaskListResponse> {
    return this.methods.list(filter || {});
  }

  /**
   * Get task by ID
   */
  async getTask(runId: string): Promise<TaskRun | null> {
    return this.queue.get(runId);
  }

  // ========================================================================
  // Status & Statistics
  // ========================================================================

  /**
   * Get system status
   */
  getStatus(): {
    running: boolean;
    workers: {
      total: number;
      active: number;
      idle: number;
    };
    queue: {
      size: number;
      active: number;
    };
    tasks: {
      total: number;
      queued: number;
      running: number;
      completed: number;
      failed: number;
    };
  } {
    const poolStatus = this.workerPool.getStatus();
    const queueStats = (this.queue as MemoryTaskQueue).getStats();

    return {
      running: this.running,
      workers: {
        total: poolStatus.totalWorkers,
        active: poolStatus.activeWorkers,
        idle: poolStatus.idleWorkers,
      },
      queue: {
        size: poolStatus.queueSize,
        active: this.queue.activeCount,
      },
      tasks: {
        total: queueStats.total,
        queued: queueStats.queued,
        running: queueStats.running,
        completed: queueStats.completed,
        failed: queueStats.failed,
      },
    };
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): TaskRun[] {
    return this.workerPool.getActiveTasks();
  }

  /**
   * Get configuration
   */
  getConfig(): TaskSystemConfig {
    return { ...this.config };
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  // ========================================================================
  // Gateway Integration
  // ========================================================================

  /**
   * Get gateway method handlers
   */
  getMethodHandlers(): Record<string, (params: unknown) => Promise<unknown>> {
    return {
      "task.create": (params) => this.methods.create(params),
      "task.status": (params) =>
        this.methods.status(params as { runId: string }),
      "task.cancel": (params) =>
        this.methods.cancel(params as { runId: string }),
      "task.list": (params) => this.methods.list(params),
    };
  }
}

/**
 * Create a task system instance
 */
export function createTaskSystem(context: TaskSystemContext): TaskSystem {
  return new TaskSystem(context);
}

// Re-export types and utilities
export * from "./task-schema.js";
export type { TaskQueue } from "./task-store-memory.js";
export { MemoryTaskQueue, createTaskQueue } from "./task-store-memory.js";
export { TaskWorker, TaskWorkerPool, createWorkerPool } from "./task-worker.js";
export { TaskMethods, createTaskMethods, createTaskMethodHandlers } from "./task-methods.js";
