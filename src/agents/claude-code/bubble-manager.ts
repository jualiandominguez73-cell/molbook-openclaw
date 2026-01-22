/**
 * Bubble Manager for Claude Code Sessions
 *
 * Manages Telegram status bubble messages with:
 * - Real-time status updates
 * - Inline keyboard buttons (Continue, Cancel)
 * - Message editing for progress updates
 *
 * Bubble format:
 * ```
 * **juzi @experimental**
 * 0h 12m · Phase 3 in progress
 *
 * ✓ Read src/config.ts
 * ✓ Edited src/auth.ts
 * ▸ Running tests
 *
 * [Continue] [Cancel]
 * ```
 */

import type { Bot } from "grammy";
import type { SessionState } from "./types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("claude-code/bubble");

/**
 * Takopi-style markup constants.
 * CLEAR_MARKUP removes all buttons when session ends/cancels.
 */
export const CLEAR_MARKUP = { inline_keyboard: [] as never[] };

/**
 * Check if status indicates a final state (no buttons needed).
 */
export function isFinalStatus(status: string): boolean {
  return (
    status === "completed" || status === "cancelled" || status === "failed" || status === "done"
  );
}

/**
 * Get appropriate markup based on status.
 * Returns CLEAR_MARKUP for final states, undefined otherwise (let caller build keyboard).
 */
export function getMarkupForStatus(status: string): typeof CLEAR_MARKUP | undefined {
  return isFinalStatus(status) ? CLEAR_MARKUP : undefined;
}

/**
 * Options for creating a bubble.
 */
export interface BubbleOptions {
  /** Telegram chat ID */
  chatId: string | number;

  /** Thread/topic ID (for supergroups with topics) */
  threadId?: number;

  /** Telegram bot API instance */
  api: Bot["api"];

  /** Session resume token (for button callbacks) */
  resumeToken: string;

  /** Callback data prefix (default: "claude") */
  callbackPrefix?: string;
}

/**
 * Bubble instance for a session.
 */
export interface BubbleInstance {
  /** Telegram message ID */
  messageId: number;

  /** Chat ID */
  chatId: string | number;

  /** Thread ID if applicable */
  threadId?: number;

  /** Resume token */
  resumeToken: string;

  /** Last update time */
  lastUpdate: number;
}

/**
 * Registry of active bubbles by session ID.
 */
const activeBubbles = new Map<string, BubbleInstance>();

/**
 * Takopi-style hard break: two spaces + newline.
 */
const HARD_BREAK = "  \n";

/**
 * Compact runtime format ("0h 5m" → "5m", "1h 30m" → "1h 30m").
 */
function compactRuntime(runtime: string): string {
  if (runtime.startsWith("0h ")) {
    return runtime.slice(3);
  }
  return runtime;
}

/**
 * Format session state into bubble message text (Takopi-style).
 *
 * Format:
 * ```
 * working · project · 45m
 *
 * 🐶 implement auth
 * ▸ Reading file.ts
 * ✓ Wrote config.json
 * 💬 Claude: Done!
 *
 * ctx: project @branch
 * `claude --resume token`
 * ```
 *
 * Icons:
 * - 🐶 = DyDo command (what DyDo sent to Claude Code)
 * - 💬 = Claude Code message
 * - ▸ = Active tool/action
 * - ✓ = Completed action
 */
export function formatBubbleMessage(state: SessionState): string {
  // Takopi-style header: "status · project · runtime" (no bold)
  const status = state.isIdle ? "done" : "working";
  const runtime = compactRuntime(state.runtimeStr);
  const header = `${status} · ${state.projectName} · ${runtime}`;

  // Build body lines (no list markers, use hard breaks)
  const bodyLines: string[] = [];

  if (state.isIdle) {
    // DONE STATE: Focus on result, not what was asked
    // Don't show DyDo command - show Claude's summary

    const lastMessage = state.recentActions
      .slice()
      .reverse()
      .find((a) => a.icon === "💬");
    if (lastMessage) {
      // Allow more text in done state (Telegram limit is 4096)
      const maxSummaryLength = 2500;
      const msg =
        lastMessage.description.length > maxSummaryLength
          ? lastMessage.description.slice(0, maxSummaryLength - 3) + "..."
          : lastMessage.description;
      bodyLines.push(`💬 ${msg}`);
    } else {
      bodyLines.push("_(session complete)_");
    }
  } else {
    // WORKING STATE: Show recent actions (no DyDo command pinned at top)
    const actionsToShow = state.recentActions.slice(-6);
    if (actionsToShow.length > 0) {
      for (const action of actionsToShow) {
        bodyLines.push(`${action.icon} ${action.description}`);
      }
    } else {
      bodyLines.push("_(waiting...)_");
    }
  }

  // Question indicator
  if (state.hasQuestion && state.questionText) {
    const questionPreview = state.questionText.slice(0, 100);
    bodyLines.push(`❓ ${questionPreview}${state.questionText.length > 100 ? "..." : ""}`);
  }

  // Footer: context and resume command with hard breaks
  const ctxLine = state.projectName.includes("@")
    ? `ctx: ${state.projectName}`
    : `ctx: ${state.projectName} @${state.branch}`;
  const resumeLine = `\`claude --resume ${state.resumeToken}\``;
  const footer = ctxLine + HARD_BREAK + resumeLine;

  // Assemble: header \n\n body \n\n footer
  const body = bodyLines.length > 0 ? bodyLines.join(HARD_BREAK) : null;
  const parts = [header, body, footer].filter(Boolean);
  return parts.join("\n\n");
}

/**
 * Build inline keyboard for bubble (Takopi-style lowercase labels).
 *
 * Button states:
 * - working: [cancel] only - DyDo handles CC questions automatically
 * - done (idle): [continue] [cancel] - User gives next direction
 * - finished: no buttons
 *
 * Note: No "answer" button - DyDo intercepts and answers CC questions.
 */
export function buildBubbleKeyboard(
  resumeToken: string,
  state: SessionState,
  prefix: string = "claude",
): Array<Array<{ text: string; callback_data: string }>> {
  const tokenPrefix = resumeToken.slice(0, 8);

  // Session has ended (process exited): show [continue] [cancel] to allow resume
  // Note: With takopi-style stdin.end(), we can't send input to running sessions,
  // so "continue" only makes sense when the process has actually exited
  if (
    state.status === "completed" ||
    state.status === "cancelled" ||
    state.status === "failed" ||
    state.status === "blocked"
  ) {
    return [
      [
        { text: "continue", callback_data: `${prefix}:continue:${tokenPrefix}` },
        { text: "cancel", callback_data: `${prefix}:cancel:${tokenPrefix}` },
      ],
    ];
  }

  // Session is running: only show [cancel]
  // User can reply to bubble to give new instructions (will resume session)
  return [[{ text: "cancel", callback_data: `${prefix}:cancel:${tokenPrefix}` }]];
}

/**
 * Create a new bubble message.
 */
export async function createBubble(
  sessionId: string,
  state: SessionState,
  options: BubbleOptions,
): Promise<BubbleInstance | undefined> {
  const { chatId, threadId, api, resumeToken, callbackPrefix = "claude" } = options;

  const text = formatBubbleMessage(state);
  const keyboard = buildBubbleKeyboard(resumeToken, state, callbackPrefix);

  try {
    const result = await api.sendMessage(chatId, text, {
      message_thread_id: threadId,
      parse_mode: "Markdown",
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
    });

    const bubble: BubbleInstance = {
      messageId: result.message_id,
      chatId,
      threadId,
      resumeToken,
      lastUpdate: Date.now(),
    };

    activeBubbles.set(sessionId, bubble);
    log.info(`[${sessionId}] Created bubble: ${result.message_id}`);

    return bubble;
  } catch (err) {
    log.error(`[${sessionId}] Failed to create bubble: ${err}`);
    return undefined;
  }
}

/**
 * Update an existing bubble message.
 */
export async function updateBubble(
  sessionId: string,
  state: SessionState,
  api: Bot["api"],
  callbackPrefix: string = "claude",
): Promise<boolean> {
  const bubble = activeBubbles.get(sessionId);
  if (!bubble) {
    log.warn(`[${sessionId}] No bubble to update`);
    return false;
  }

  // Throttle updates (min 1 second between edits)
  const now = Date.now();
  if (now - bubble.lastUpdate < 1000) {
    return true; // Skip this update
  }

  const text = formatBubbleMessage(state);
  const keyboard = buildBubbleKeyboard(bubble.resumeToken, state, callbackPrefix);

  try {
    await api.editMessageText(bubble.chatId, bubble.messageId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
    });

    bubble.lastUpdate = now;
    log.debug(`[${sessionId}] Updated bubble`);
    return true;
  } catch (err) {
    // Telegram returns error if message content hasn't changed
    const errMsg = String(err);
    if (errMsg.includes("message is not modified")) {
      return true; // Not an error, just no change
    }
    log.warn(`[${sessionId}] Failed to update bubble: ${err}`);
    return false;
  }
}

/**
 * Delete a bubble message.
 */
export async function deleteBubble(sessionId: string, api: Bot["api"]): Promise<boolean> {
  const bubble = activeBubbles.get(sessionId);
  if (!bubble) {
    return false;
  }

  try {
    await api.deleteMessage(bubble.chatId, bubble.messageId);
    activeBubbles.delete(sessionId);
    log.info(`[${sessionId}] Deleted bubble`);
    return true;
  } catch (err) {
    log.warn(`[${sessionId}] Failed to delete bubble: ${err}`);
    activeBubbles.delete(sessionId);
    return false;
  }
}

/**
 * Get bubble for a session.
 */
export function getBubble(sessionId: string): BubbleInstance | undefined {
  return activeBubbles.get(sessionId);
}

/**
 * Get bubble by resume token prefix.
 */
export function getBubbleByToken(tokenPrefix: string): BubbleInstance | undefined {
  for (const bubble of activeBubbles.values()) {
    if (bubble.resumeToken.startsWith(tokenPrefix)) {
      return bubble;
    }
  }
  return undefined;
}

/**
 * Send a final completion message.
 */
export async function sendCompletionMessage(
  sessionId: string,
  state: SessionState,
  api: Bot["api"],
  completedPhases: string[] = [],
): Promise<boolean> {
  const bubble = activeBubbles.get(sessionId);
  if (!bubble) {
    return false;
  }

  // Takopi-style: header · project · runtime
  const runtime = compactRuntime(state.runtimeStr);
  const header = `done · ${state.projectName} · ${runtime}`;

  // Body: summary of completed work
  const bodyLines: string[] = [];
  bodyLines.push(`✓ ${state.totalEvents.toLocaleString()} events`);

  if (completedPhases.length > 0) {
    for (const phase of completedPhases) {
      bodyLines.push(`✓ ${phase}`);
    }
  }

  // Footer: context and resume command with hard breaks
  const ctxLine = state.projectName.includes("@")
    ? `ctx: ${state.projectName}`
    : `ctx: ${state.projectName} @${state.branch}`;
  const resumeLine = `\`claude --resume ${state.resumeToken}\``;
  const footer = ctxLine + HARD_BREAK + resumeLine;

  // Assemble with double newlines between sections
  const body = bodyLines.join(HARD_BREAK);
  const text = [header, body, footer].join("\n\n");

  try {
    // Edit the bubble to show completion (no buttons)
    await api.editMessageText(bubble.chatId, bubble.messageId, text, {
      parse_mode: "Markdown",
    });

    activeBubbles.delete(sessionId);
    log.info(`[${sessionId}] Sent completion message`);
    return true;
  } catch (err) {
    log.error(`[${sessionId}] Failed to send completion message: ${err}`);
    return false;
  }
}

/**
 * BubbleManager class for managing a session's bubble.
 *
 * Usage:
 * ```typescript
 * const manager = new BubbleManager(api, chatId, threadId);
 * await manager.create(sessionId, state, resumeToken);
 *
 * // On state changes
 * await manager.update(state);
 *
 * // On completion
 * await manager.complete(state, completedPhases);
 * ```
 */
export class BubbleManager {
  private api: Bot["api"];
  private chatId: string | number;
  private threadId?: number;
  private sessionId?: string;
  private callbackPrefix: string;

  constructor(
    api: Bot["api"],
    chatId: string | number,
    threadId?: number,
    callbackPrefix: string = "claude",
  ) {
    this.api = api;
    this.chatId = chatId;
    this.threadId = threadId;
    this.callbackPrefix = callbackPrefix;
  }

  /**
   * Create a new bubble for a session.
   */
  async create(
    sessionId: string,
    state: SessionState,
    resumeToken: string,
  ): Promise<BubbleInstance | undefined> {
    this.sessionId = sessionId;
    return createBubble(sessionId, state, {
      chatId: this.chatId,
      threadId: this.threadId,
      api: this.api,
      resumeToken,
      callbackPrefix: this.callbackPrefix,
    });
  }

  /**
   * Update the bubble with new state.
   */
  async update(state: SessionState): Promise<boolean> {
    if (!this.sessionId) {
      return false;
    }
    return updateBubble(this.sessionId, state, this.api, this.callbackPrefix);
  }

  /**
   * Mark the session as complete.
   */
  async complete(state: SessionState, completedPhases: string[] = []): Promise<boolean> {
    if (!this.sessionId) {
      return false;
    }
    return sendCompletionMessage(this.sessionId, state, this.api, completedPhases);
  }

  /**
   * Delete the bubble.
   */
  async delete(): Promise<boolean> {
    if (!this.sessionId) {
      return false;
    }
    return deleteBubble(this.sessionId, this.api);
  }

  /**
   * Get the current bubble instance.
   */
  getBubble(): BubbleInstance | undefined {
    if (!this.sessionId) {
      return undefined;
    }
    return getBubble(this.sessionId);
  }
}
