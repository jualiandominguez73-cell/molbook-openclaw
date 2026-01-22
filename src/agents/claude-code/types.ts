/**
 * Claude Code Session Types
 *
 * Type definitions for managing Claude Code sessions as subprocesses.
 */

import type { ChildProcessWithoutNullStreams } from "node:child_process";

/**
 * Parameters for starting a Claude Code session.
 */
export interface ClaudeCodeSessionParams {
  /** Project identifier (e.g., "juzi" or "juzi @experimental"). Required unless workingDir is provided. */
  project?: string;

  /** Initial prompt to send to Claude Code */
  prompt?: string;

  /** Resume a specific session by token */
  resumeToken?: string;

  /** Working directory. Required unless project is provided. */
  workingDir?: string;

  /** Model to use (opus, sonnet, haiku) */
  model?: "opus" | "sonnet" | "haiku";

  /** Permission mode for Claude Code */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";

  /** Callback for session events */
  onEvent?: (event: SessionEvent) => void;

  /** Callback for questions (return answer to send back) */
  onQuestion?: (question: string) => Promise<string | null>;

  /** Callback for session state changes */
  onStateChange?: (state: SessionState) => void;

  /**
   * Callback when a blocker is detected.
   * Return true if you'll handle resolution (session stays alive).
   * Return false to let session transition to done/blocked state.
   */
  onBlocker?: (blocker: BlockerInfo) => Promise<boolean>;
}

/**
 * Event types from Claude Code session file.
 */
export type SessionEventType =
  | "assistant_message"
  | "user_message"
  | "tool_use"
  | "tool_result"
  | "summary"
  | "system";

/**
 * A single event parsed from the session .jsonl file.
 */
export interface SessionEvent {
  type: SessionEventType;
  timestamp: Date;
  text?: string;
  toolName?: string;
  toolInput?: string;
  /** For tool_result events: the tool_use_id this result corresponds to */
  toolUseId?: string;
  /** For tool_result events: the result content */
  result?: string;
  /** For tool_result events: whether the result is an error */
  isError?: boolean;
  isWaitingForInput?: boolean;
  raw?: Record<string, unknown>;
}

/**
 * Current state of the session.
 */
export type SessionStatus =
  | "starting"
  | "running"
  | "waiting_for_input"
  | "idle"
  | "completed"
  | "cancelled"
  | "failed"
  | "blocked"; // Session hit a blocker that needs external intervention

/**
 * Information about a detected blocker.
 */
export interface BlockerInfo {
  /** The detected blocker reason */
  reason: string;
  /** The full last message containing blocker context */
  lastMessage: string;
  /** Extracted context if parseable (wallet address, amounts, etc.) */
  extractedContext?: Record<string, unknown>;
  /** Patterns that triggered the blocker detection */
  matchedPatterns: string[];
}

/**
 * Snapshot of session state for UI updates.
 */
export interface SessionState {
  /** Session status */
  status: SessionStatus;

  /** Project name (e.g., "juzi @experimental") */
  projectName: string;

  /** Resume token for this session */
  resumeToken: string;

  /** Runtime in human-readable format (e.g., "0h 12m") */
  runtimeStr: string;

  /** Runtime in seconds */
  runtimeSeconds: number;

  /** Current phase status (e.g., "Phase 3 in progress") */
  phaseStatus: string;

  /** Git branch */
  branch: string;

  /** Recent actions for display */
  recentActions: Array<{ icon: string; description: string; fullText?: string }>;

  /** Whether Claude is waiting for user input */
  hasQuestion: boolean;

  /** The question text if waiting */
  questionText: string;

  /** Total events processed */
  totalEvents: number;

  /** Whether session is idle (no active tool use) */
  isIdle: boolean;

  /** Blocker info if session is blocked */
  blockerInfo?: BlockerInfo;
}

/**
 * Internal session data stored in registry.
 */
export interface ClaudeCodeSessionData {
  /** Unique session ID */
  id: string;

  /** Resume token (UUID) */
  resumeToken: string;

  /** Project name */
  projectName: string;

  /** Working directory */
  workingDir: string;

  /** Path to session .jsonl file */
  sessionFile: string;

  /** Child process handle */
  child?: ChildProcessWithoutNullStreams;

  /** Process ID */
  pid?: number;

  /** Start time */
  startedAt: number;

  /** Current status */
  status: SessionStatus;

  /** Event callbacks */
  onEvent?: (event: SessionEvent) => void;
  onQuestion?: (question: string) => Promise<string | null>;
  onStateChange?: (state: SessionState) => void;
  onBlocker?: (blocker: BlockerInfo) => Promise<boolean>;

  /** File watcher abort controller */
  watcherAbort?: AbortController;

  /** Session parser instance */
  parser?: unknown; // SessionParser - using unknown to avoid circular import

  /** Parsed events count */
  eventCount: number;

  /** All parsed events (for state tracking) */
  events: SessionEvent[];

  /** Recent actions buffer */
  recentActions: Array<{ icon: string; description: string; fullText?: string }>;

  /** Current phase status */
  phaseStatus: string;

  /** Git branch */
  branch: string;

  /** Current question if any */
  currentQuestion?: string;

  /** Whether this is a resumed session (skip old history in events) */
  isResume?: boolean;

  /** Timestamp when session started (for filtering old events on resume) */
  sessionStartTime?: number;

  /** Blocker info if session hit a blocker */
  blockerInfo?: BlockerInfo;
}

/**
 * Result of starting a session.
 */
export interface SessionStartResult {
  /** Whether start was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Session ID for tracking */
  sessionId?: string;

  /** Resume token */
  resumeToken?: string;
}

/**
 * Project resolution result.
 */
export interface ResolvedProject {
  /** Full path to project directory */
  workingDir: string;

  /** Display name (e.g., "juzi @experimental") */
  displayName: string;

  /** Git branch */
  branch: string;

  /** Whether this is a worktree */
  isWorktree: boolean;

  /** Main project name (without worktree suffix) */
  mainProject: string;

  /** Worktree name if applicable */
  worktreeName?: string;
}
