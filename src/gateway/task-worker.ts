/**
 * Task Worker
 * Executes individual tasks from the queue
 */

import { EventEmitter } from "node:events";
import {
  TaskRun,
  TaskState,
  TaskProgress,
  TaskResult,
  TaskSystemConfig,
  DEFAULT_TASK_CONFIG,
  canRetry,
} from "./task-schema.js";
import type { TaskQueue } from "./task-store-memory.js";

export interface TaskWorkerContext {
  /** Worker ID */
  workerId: string;
  /** Task queue */
  queue: TaskQueue;
  /** Configuration */
  config: TaskSystemConfig;
  /** Logger */
  log: {
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  };
  /** Broadcast function for events */
  broadcast?: (event: string, data: unknown) => void;
  /** Execute agent task */
  executeAgent: (task: TaskRun, onProgress: (progress: TaskProgress) => void) => Promise<TaskResult>;
}

export class TaskWorker extends EventEmitter {
  private context: TaskWorkerContext;
  private running: boolean = false;
  private currentTask: TaskRun | null = null;
  private abortController: AbortController | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(context: TaskWorkerContext) {
    super();
    this.context = context;
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.context.log.info(`Worker ${this.context.workerId} started`);

    // Start polling loop
    this.poll();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    this.running = false;

    // Cancel current task
    if (this.currentTask && this.abortController) {
      this.abortController.abort();
    }

    // Clear poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    this.context.log.info(`Worker ${this.context.workerId} stopped`);
  }

  /**
   * Check if worker is busy
   */
  get isBusy(): boolean {
    return this.currentTask !== null;
  }

  /**
   * Get current task
   */
  get current(): TaskRun | null {
    return this.currentTask;
  }

  /**
   * Poll for tasks
   */
  private poll(): void {
    if (!this.running) return;

    // Schedule next poll
    const scheduleNext = () => {
      if (this.running) {
        this.pollTimer = setTimeout(
          () => this.poll(),
          this.context.config.pollIntervalMs
        );
      }
    };

    // Skip if busy
    if (this.isBusy) {
      scheduleNext();
      return;
    }

    // Try to dequeue
    this.context.queue
      .dequeue()
      .then(async (task) => {
        if (task) {
          await this.executeTask(task);
        }
        scheduleNext();
      })
      .catch((err) => {
        this.context.log.error(`Worker ${this.context.workerId} poll error:`, err);
        scheduleNext();
      });
  }

  /**
   * Execute a task
   */
  private async executeTask(task: TaskRun): Promise<void> {
    this.currentTask = task;
    this.abortController = new AbortController();

    try {
      // Update state to RUNNING
      await this.context.queue.update(task.runId, {
        state: TaskState.RUNNING,
        startedAt: Date.now(),
        workerId: this.context.workerId,
      });

      // Broadcast start event
      this.broadcastEvent("task.started", task);

      // Progress reporter
      const onProgress = (progress: TaskProgress) => {
        this.context.queue.update(task.runId, { progress }).catch(() => {});
        this.broadcastEvent("task.progress", { ...task, progress });
      };

      // Execute agent
      const result = await this.context.executeAgent(task, onProgress);

      // Check if aborted
      if (this.abortController.signal.aborted) {
        return;
      }

      // Determine final state
      const finalState = result.error ? TaskState.FAILED : TaskState.COMPLETED;

      // Update state
      await this.context.queue.update(task.runId, {
        state: finalState,
        completedAt: Date.now(),
        result,
        progress: { current: 1.0, message: result.error ? "Failed" : "Completed" },
      });

      // Broadcast completion
      const eventType = result.error ? "task.failed" : "task.completed";
      this.broadcastEvent(eventType, {
        ...task,
        state: finalState,
        result,
        completedAt: Date.now(),
      });

      // Handle retry if failed
      if (finalState === TaskState.FAILED && canRetry(task, this.context.config)) {
        this.context.log.info(`Scheduling retry for task ${task.runId}`);
        setTimeout(async () => {
          try {
            const queue = this.context.queue as { requeue?: (id: string) => Promise<boolean> };
            if (queue.requeue) {
              await queue.requeue(task.runId);
            }
          } catch (err) {
            this.context.log.error(`Retry failed for task ${task.runId}:`, err);
          }
        }, this.context.config.retryDelayMs);
      }
    } catch (err) {
      // Unexpected error
      this.context.log.error(`Worker ${this.context.workerId} task error:`, err);

      await this.context.queue.update(task.runId, {
        state: TaskState.FAILED,
        completedAt: Date.now(),
        result: {
          error: String(err),
          shouldRetry: true,
        },
      });

      this.broadcastEvent("task.failed", {
        ...task,
        state: TaskState.FAILED,
        result: { error: String(err) },
        completedAt: Date.now(),
      });
    } finally {
      this.currentTask = null;
      this.abortController = null;
    }
  }

  /**
   * Broadcast an event
   */
  private broadcastEvent(event: string, data: unknown): void {
    this.emit(event, data);
    if (this.context.broadcast) {
      this.context.broadcast(event, data);
    }
  }
}

// ============================================================================
// Worker Pool
// ============================================================================

export interface WorkerPoolConfig {
  /** Number of workers */
  concurrency: number;
  /** Task queue */
  queue: TaskQueue;
  /** System configuration */
  config?: Partial<TaskSystemConfig>;
  /** Logger */
  log?: TaskWorkerContext["log"];
  /** Broadcast function */
  broadcast?: (event: string, data: unknown) => void;
  /** Agent executor */
  executeAgent: TaskWorkerContext["executeAgent"];
}

export class TaskWorkerPool extends EventEmitter {
  private workers: TaskWorker[] = [];
  private queue: TaskQueue;
  private config: TaskSystemConfig;
  private running: boolean = false;

  constructor(poolConfig: WorkerPoolConfig) {
    super();

    this.queue = poolConfig.queue;
    this.config = { ...DEFAULT_TASK_CONFIG, ...poolConfig.config };

    const defaultLog: TaskWorkerContext["log"] = {
      info: (msg, data) => console.log(`[TaskPool] ${msg}`, data || ""),
      warn: (msg, data) => console.warn(`[TaskPool] ${msg}`, data || ""),
      error: (msg, data) => console.error(`[TaskPool] ${msg}`, data || ""),
    };

    // Create workers
    for (let i = 0; i < poolConfig.concurrency; i++) {
      const context: TaskWorkerContext = {
        workerId: `worker-${i}`,
        queue: this.queue,
        config: this.config,
        log: poolConfig.log || defaultLog,
        broadcast: poolConfig.broadcast,
        executeAgent: poolConfig.executeAgent,
      };

      const worker = new TaskWorker(context);

      // Forward events
      worker.on("task.started", (data) => this.emit("task.started", data));
      worker.on("task.progress", (data) => this.emit("task.progress", data));
      worker.on("task.completed", (data) => this.emit("task.completed", data));
      worker.on("task.failed", (data) => this.emit("task.failed", data));

      this.workers.push(worker);
    }
  }

  /**
   * Start all workers
   */
  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    await Promise.all(this.workers.map((w) => w.start()));
  }

  /**
   * Stop all workers
   */
  async stop(): Promise<void> {
    this.running = false;
    await Promise.all(this.workers.map((w) => w.stop()));
  }

  /**
   * Get pool status
   */
  getStatus(): {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    queueSize: number;
    running: boolean;
  } {
    const active = this.workers.filter((w) => w.isBusy).length;

    return {
      totalWorkers: this.workers.length,
      activeWorkers: active,
      idleWorkers: this.workers.length - active,
      queueSize: this.queue.size,
      running: this.running,
    };
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): TaskWorker | undefined {
    return this.workers.find((w) => w.current?.workerId === workerId);
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): TaskRun[] {
    return this.workers
      .map((w) => w.current)
      .filter((t): t is TaskRun => t !== null);
  }
}

/**
 * Create a worker pool
 */
export function createWorkerPool(config: WorkerPoolConfig): TaskWorkerPool {
  return new TaskWorkerPool(config);
}
