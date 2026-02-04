/**
 * Task Schema
 * Type definitions for the async task system
 */

import { z } from "zod";

// ============================================================================
// Task State
// ============================================================================

export enum TaskState {
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELED = "canceled",
  EXPIRED = "expired",
}

export const TaskStateSchema = z.nativeEnum(TaskState);

// ============================================================================
// Task Progress
// ============================================================================

export interface TaskProgress {
  /** Progress value 0-1 */
  current: number;
  /** Status message */
  message?: string;
  /** Number of tool calls executed */
  toolCalls?: number;
  /** Current tool being executed */
  currentTool?: string;
}

export const TaskProgressSchema = z.object({
  current: z.number().min(0).max(1),
  message: z.string().optional(),
  toolCalls: z.number().optional(),
  currentTool: z.string().optional(),
});

// ============================================================================
// Task Context
// ============================================================================

export interface TaskContext {
  /** Message provider (telegram, whatsapp, etc.) */
  provider: string;
  /** Surface (chat, group, etc.) */
  surface: string;
  /** Sender identifier */
  senderId?: string;
  /** Sender display name */
  senderName?: string;
  /** Group/channel identifier */
  groupId?: string;
  /** Client run ID (for deduplication) */
  clientRunId?: string;
}

export const TaskContextSchema = z.object({
  provider: z.string(),
  surface: z.string(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  groupId: z.string().optional(),
  clientRunId: z.string().optional(),
});

// ============================================================================
// Task Result
// ============================================================================

export interface TaskResult {
  /** Assistant message */
  message?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Error code */
  errorCode?: string;
  /** Retry suggested */
  shouldRetry?: boolean;
}

export const TaskResultSchema = z.object({
  message: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  shouldRetry: z.boolean().optional(),
});

// ============================================================================
// Image Content
// ============================================================================

export interface ChatImageContent {
  type: "image";
  source: {
    type: "base64" | "url";
    media_type?: string;
    data?: string;
    url?: string;
  };
}

export const ChatImageContentSchema = z.object({
  type: z.literal("image"),
  source: z.object({
    type: z.enum(["base64", "url"]),
    media_type: z.string().optional(),
    data: z.string().optional(),
    url: z.string().optional(),
  }),
});

// ============================================================================
// Task Run
// ============================================================================

export interface TaskRun {
  /** Unique task identifier */
  runId: string;
  /** Session key this task belongs to */
  sessionKey: string;
  /** Agent ID */
  agentId?: string;

  /** Current state */
  state: TaskState;

  /** Timestamps */
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  expiresAt: number;

  /** Input */
  message: string;
  images?: ChatImageContent[];
  context: TaskContext;

  /** Execution */
  workerId?: string;

  /** Output */
  result?: TaskResult;
  progress?: TaskProgress;

  /** Metadata */
  retryCount: number;
  priority: number;
}

export const TaskRunSchema = z.object({
  runId: z.string(),
  sessionKey: z.string(),
  agentId: z.string().optional(),

  state: TaskStateSchema,

  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  expiresAt: z.number(),

  message: z.string(),
  images: z.array(ChatImageContentSchema).optional(),
  context: TaskContextSchema,

  workerId: z.string().optional(),

  result: TaskResultSchema.optional(),
  progress: TaskProgressSchema.optional(),

  retryCount: z.number().default(0),
  priority: z.number().default(5),
});

// ============================================================================
// Task Filter
// ============================================================================

export interface TaskFilter {
  /** Filter by session */
  sessionKey?: string;
  /** Filter by agent */
  agentId?: string;
  /** Filter by states */
  states?: TaskState[];
  /** Filter by worker */
  workerId?: string;
  /** Filter by priority range */
  minPriority?: number;
  maxPriority?: number;
  /** Filter by time range */
  createdAfter?: number;
  createdBefore?: number;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export const TaskFilterSchema = z.object({
  sessionKey: z.string().optional(),
  agentId: z.string().optional(),
  states: z.array(TaskStateSchema).optional(),
  workerId: z.string().optional(),
  minPriority: z.number().optional(),
  maxPriority: z.number().optional(),
  createdAfter: z.number().optional(),
  createdBefore: z.number().optional(),
  limit: z.number().default(50),
  offset: z.number().default(0),
});

// ============================================================================
// Task Events
// ============================================================================

export type TaskEventType =
  | "task.created"
  | "task.started"
  | "task.progress"
  | "task.completed"
  | "task.failed"
  | "task.canceled"
  | "task.expired";

export interface TaskEvent {
  type: TaskEventType;
  runId: string;
  sessionKey: string;
  timestamp: number;
  data: Partial<TaskRun>;
}

export const TaskEventSchema = z.object({
  type: z.enum([
    "task.created",
    "task.started",
    "task.progress",
    "task.completed",
    "task.failed",
    "task.canceled",
    "task.expired",
  ]),
  runId: z.string(),
  sessionKey: z.string(),
  timestamp: z.number(),
  data: TaskRunSchema.partial(),
});

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface TaskCreateRequest {
  sessionKey: string;
  message: string;
  images?: ChatImageContent[];
  priority?: number;
  clientRunId?: string;
  context?: Partial<TaskContext>;
}

export const TaskCreateRequestSchema = z.object({
  sessionKey: z.string(),
  message: z.string(),
  images: z.array(ChatImageContentSchema).optional(),
  priority: z.number().min(0).max(10).default(5),
  clientRunId: z.string().optional(),
  context: TaskContextSchema.partial().optional(),
});

export interface TaskCreateResponse {
  runId: string;
  status: TaskState;
  position?: number;
}

export interface TaskStatusResponse {
  runId: string;
  state: TaskState;
  progress?: TaskProgress;
  result?: TaskResult;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TaskListResponse {
  tasks: TaskRun[];
  total: number;
  hasMore: boolean;
}

export interface TaskCancelResponse {
  runId: string;
  canceled: boolean;
  previousState?: TaskState;
}

// ============================================================================
// Configuration
// ============================================================================

export interface TaskSystemConfig {
  /** Maximum concurrent workers */
  workerConcurrency: number;
  /** Task TTL in milliseconds */
  taskTtlMs: number;
  /** Maximum retry count */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelayMs: number;
  /** Progress update interval in milliseconds */
  progressIntervalMs: number;
  /** Queue polling interval in milliseconds */
  pollIntervalMs: number;
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs: number;
}

export const DEFAULT_TASK_CONFIG: TaskSystemConfig = {
  workerConcurrency: 3,
  taskTtlMs: 30 * 60 * 1000, // 30 minutes
  maxRetries: 2,
  retryDelayMs: 5000,
  progressIntervalMs: 5000,
  pollIntervalMs: 100,
  cleanupIntervalMs: 60 * 1000, // 1 minute
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a task is in a terminal state
 */
export function isTerminalState(state: TaskState): boolean {
  return [
    TaskState.COMPLETED,
    TaskState.FAILED,
    TaskState.CANCELED,
    TaskState.EXPIRED,
  ].includes(state);
}

/**
 * Check if a task can be retried
 */
export function canRetry(task: TaskRun, config: TaskSystemConfig): boolean {
  return (
    task.state === TaskState.FAILED &&
    task.retryCount < config.maxRetries &&
    task.result?.shouldRetry !== false
  );
}

/**
 * Calculate task priority score (higher = sooner to execute)
 */
export function calculatePriorityScore(task: TaskRun): number {
  const ageBonus = (Date.now() - task.createdAt) / 1000 / 60; // minutes waiting
  return task.priority * 10 + ageBonus;
}
