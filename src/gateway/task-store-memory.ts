/**
 * In-Memory Task Store
 * Implements task queue with priority ordering
 */

import { EventEmitter } from "node:events";
import {
  TaskRun,
  TaskState,
  TaskFilter,
  TaskEvent,
  TaskEventType,
  TaskSystemConfig,
  DEFAULT_TASK_CONFIG,
  isTerminalState,
  calculatePriorityScore,
} from "./task-schema.js";

export interface TaskQueue extends EventEmitter {
  /** Enqueue a new task */
  enqueue(task: TaskRun): Promise<void>;

  /** Dequeue next task (priority-ordered) */
  dequeue(): Promise<TaskRun | null>;

  /** Get task by ID */
  get(runId: string): Promise<TaskRun | null>;

  /** Update task state */
  update(runId: string, updates: Partial<TaskRun>): Promise<TaskRun | null>;

  /** Cancel task */
  cancel(runId: string): Promise<boolean>;

  /** List tasks matching filter */
  list(filter: TaskFilter): Promise<{ tasks: TaskRun[]; total: number }>;

  /** Get queue size */
  size: number;

  /** Get active (running) count */
  activeCount: number;

  /** Cleanup expired tasks */
  cleanup(): Promise<number>;

  /** Stop the queue */
  stop(): void;
}

export class MemoryTaskQueue extends EventEmitter implements TaskQueue {
  private tasks: Map<string, TaskRun> = new Map();
  private queue: string[] = []; // runIds in priority order
  private config: TaskSystemConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stopped: boolean = false;

  constructor(config: Partial<TaskSystemConfig> = {}) {
    super();
    this.config = { ...DEFAULT_TASK_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Enqueue a new task
   */
  async enqueue(task: TaskRun): Promise<void> {
    if (this.stopped) {
      throw new Error("Queue is stopped");
    }

    // Store task
    this.tasks.set(task.runId, task);

    // Add to priority queue
    this.insertByPriority(task.runId);

    // Emit event
    this.emitEvent("task.created", task);
  }

  /**
   * Dequeue next task for processing
   */
  async dequeue(): Promise<TaskRun | null> {
    if (this.stopped || this.queue.length === 0) {
      return null;
    }

    // Find first queued task
    for (let i = 0; i < this.queue.length; i++) {
      const runId = this.queue[i];
      const task = this.tasks.get(runId);

      if (task && task.state === TaskState.QUEUED) {
        // Remove from queue
        this.queue.splice(i, 1);
        return task;
      }
    }

    return null;
  }

  /**
   * Get task by ID
   */
  async get(runId: string): Promise<TaskRun | null> {
    return this.tasks.get(runId) || null;
  }

  /**
   * Update task
   */
  async update(runId: string, updates: Partial<TaskRun>): Promise<TaskRun | null> {
    const task = this.tasks.get(runId);
    if (!task) {
      return null;
    }

    // Apply updates
    const updated: TaskRun = { ...task, ...updates };
    this.tasks.set(runId, updated);

    // Determine event type
    let eventType: TaskEventType | null = null;
    if (updates.state && updates.state !== task.state) {
      switch (updates.state) {
        case TaskState.RUNNING:
          eventType = "task.started";
          break;
        case TaskState.COMPLETED:
          eventType = "task.completed";
          break;
        case TaskState.FAILED:
          eventType = "task.failed";
          break;
        case TaskState.CANCELED:
          eventType = "task.canceled";
          break;
        case TaskState.EXPIRED:
          eventType = "task.expired";
          break;
      }
    } else if (updates.progress) {
      eventType = "task.progress";
    }

    if (eventType) {
      this.emitEvent(eventType, updated);
    }

    return updated;
  }

  /**
   * Cancel a task
   */
  async cancel(runId: string): Promise<boolean> {
    const task = this.tasks.get(runId);
    if (!task) {
      return false;
    }

    // Can only cancel non-terminal tasks
    if (isTerminalState(task.state)) {
      return false;
    }

    // Update state
    await this.update(runId, {
      state: TaskState.CANCELED,
      completedAt: Date.now(),
    });

    // Remove from queue
    const queueIndex = this.queue.indexOf(runId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    }

    return true;
  }

  /**
   * List tasks matching filter
   */
  async list(filter: TaskFilter): Promise<{ tasks: TaskRun[]; total: number }> {
    let results = Array.from(this.tasks.values());

    // Apply filters
    if (filter.sessionKey) {
      results = results.filter((t) => t.sessionKey === filter.sessionKey);
    }
    if (filter.agentId) {
      results = results.filter((t) => t.agentId === filter.agentId);
    }
    if (filter.states && filter.states.length > 0) {
      results = results.filter((t) => filter.states!.includes(t.state));
    }
    if (filter.workerId) {
      results = results.filter((t) => t.workerId === filter.workerId);
    }
    if (filter.minPriority !== undefined) {
      results = results.filter((t) => t.priority >= filter.minPriority!);
    }
    if (filter.maxPriority !== undefined) {
      results = results.filter((t) => t.priority <= filter.maxPriority!);
    }
    if (filter.createdAfter !== undefined) {
      results = results.filter((t) => t.createdAt >= filter.createdAfter!);
    }
    if (filter.createdBefore !== undefined) {
      results = results.filter((t) => t.createdAt <= filter.createdBefore!);
    }

    // Sort by created time (newest first)
    results.sort((a, b) => b.createdAt - a.createdAt);

    const total = results.length;

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    results = results.slice(offset, offset + limit);

    return { tasks: results, total };
  }

  /**
   * Get queue size (queued tasks)
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Get active (running) task count
   */
  get activeCount(): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.state === TaskState.RUNNING) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get queue position for a task
   */
  getPosition(runId: string): number {
    const index = this.queue.indexOf(runId);
    return index >= 0 ? index + 1 : -1;
  }

  /**
   * Cleanup expired and old tasks
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [runId, task] of this.tasks) {
      // Expire queued tasks past TTL
      if (task.state === TaskState.QUEUED && task.expiresAt < now) {
        await this.update(runId, {
          state: TaskState.EXPIRED,
          completedAt: now,
        });
        const queueIndex = this.queue.indexOf(runId);
        if (queueIndex >= 0) {
          this.queue.splice(queueIndex, 1);
        }
        cleaned++;
        continue;
      }

      // Remove old terminal tasks
      if (isTerminalState(task.state)) {
        const age = now - (task.completedAt || task.createdAt);
        if (age > this.config.taskTtlMs * 2) {
          this.tasks.delete(runId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Re-enqueue a failed task for retry
   */
  async requeue(runId: string): Promise<boolean> {
    const task = this.tasks.get(runId);
    if (!task || task.state !== TaskState.FAILED) {
      return false;
    }

    await this.update(runId, {
      state: TaskState.QUEUED,
      retryCount: task.retryCount + 1,
      startedAt: undefined,
      completedAt: undefined,
      result: undefined,
      workerId: undefined,
    });

    this.insertByPriority(runId);
    return true;
  }

  /**
   * Stop the queue
   */
  stop(): void {
    this.stopped = true;
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Insert task ID into queue by priority
   */
  private insertByPriority(runId: string): void {
    const task = this.tasks.get(runId);
    if (!task) return;

    const score = calculatePriorityScore(task);

    // Find insertion point
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const other = this.tasks.get(this.queue[i]);
      if (other && calculatePriorityScore(other) < score) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, runId);
  }

  /**
   * Emit a task event
   */
  private emitEvent(type: TaskEventType, task: TaskRun): void {
    const event: TaskEvent = {
      type,
      runId: task.runId,
      sessionKey: task.sessionKey,
      timestamp: Date.now(),
      data: task,
    };

    this.emit("task", event);
    this.emit(type, event);
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((err) => {
        console.error("[TaskQueue] Cleanup error:", err);
      });
    }, this.config.cleanupIntervalMs);

    this.cleanupTimer.unref();
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    canceled: number;
  } {
    const stats = {
      total: this.tasks.size,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
    };

    for (const task of this.tasks.values()) {
      switch (task.state) {
        case TaskState.QUEUED:
          stats.queued++;
          break;
        case TaskState.RUNNING:
          stats.running++;
          break;
        case TaskState.COMPLETED:
          stats.completed++;
          break;
        case TaskState.FAILED:
          stats.failed++;
          break;
        case TaskState.CANCELED:
          stats.canceled++;
          break;
      }
    }

    return stats;
  }
}

/**
 * Create a new memory task queue
 */
export function createTaskQueue(config?: Partial<TaskSystemConfig>): TaskQueue {
  return new MemoryTaskQueue(config);
}
