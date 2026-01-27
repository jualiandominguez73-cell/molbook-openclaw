/**
 * Status Updates Module
 *
 * Provides intermittent status messages during bot activity to keep users informed
 * about what's happening while the AI processes their request.
 *
 * Features:
 * - Configurable status message phases
 * - Elapsed time tracking
 * - Final response checkmark marking
 * - Platform-specific message update handling
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("status-updates");

export type StatusPhase =
  | "sending_query"
  | "sending_query_model_resolved"
  | "receiving_reasoning"
  | "processing_tools"
  | "generating_response"
  | "complete";

export type StatusUpdateMode = "off" | "edit" | "inline";

export type StatusUpdateConfig = {
  /** Enable status updates (default: false). */
  enabled?: boolean;
  /** Mode for status updates: "off", "edit" (update same message), "inline" (new messages). */
  mode?: StatusUpdateMode;
  /** Interval in milliseconds between elapsed time updates (default: 5000). */
  updateIntervalMs?: number;
  /** Show phase descriptions like "Sending query..." (default: true). */
  showPhases?: boolean;
  /** Show elapsed time in status messages (default: true). */
  showElapsedTime?: boolean;
  /** Mark final responses with ✅ (default: true). */
  markFinalWithCheckmark?: boolean;
  /** Minimum duration before showing elapsed time (ms, default: 3000). */
  elapsedTimeThresholdMs?: number;
};

export type StatusUpdateCallbacks = {
  /** Send or update status message. Returns message ID if applicable. */
  sendStatus: (text: string, messageId?: string) => Promise<string | undefined>;
  /** Edit an existing message with final content and checkmark. */
  editFinal?: (text: string, messageId: string) => Promise<void>;
  /** Check if the channel supports message editing. */
  supportsEdit?: () => boolean;
  /** Delete a status message (for cleanup). */
  deleteStatus?: (messageId: string) => Promise<void>;
};

export type StatusUpdateState = {
  phase: StatusPhase;
  startedAt: number;
  statusMessageId?: string;
  lastUpdateAt: number;
  elapsedSeconds: number;
  isComplete: boolean;
  providerUsed?: string;
  modelUsed?: string;
};

const DEFAULT_CONFIG: Required<StatusUpdateConfig> = {
  enabled: false,
  mode: "edit",
  updateIntervalMs: 5000,
  showPhases: true,
  showElapsedTime: true,
  markFinalWithCheckmark: false,
  elapsedTimeThresholdMs: 3000,
};

const PHASE_MESSAGES: Record<StatusPhase, string> = {
  sending_query: "Sending query to AI model",
  sending_query_model_resolved: "Sending query to AI model",
  receiving_reasoning: "Processing reasoning data",
  processing_tools: "Executing tools",
  generating_response: "Generating response",
  complete: "Complete",
};

const PHASE_EMOJI: Record<StatusPhase, string> = {
  sending_query: "⏳",
  sending_query_model_resolved: "⏳",
  receiving_reasoning: "🧠",
  processing_tools: "🔧",
  generating_response: "✍️",
  complete: "✅",
};

export function resolveStatusUpdateConfig(
  config?: Partial<StatusUpdateConfig>,
): Required<StatusUpdateConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

function formatElapsedTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const paddedSeconds = remainingSeconds.toString().padStart(2, "0");
  return `${minutes}:${paddedSeconds}`;
}

function formatStatusMessage(
  state: StatusUpdateState,
  config: Required<StatusUpdateConfig>,
): string {
  const parts: string[] = [];
  const phase = state.phase;
  const elapsedSeconds = state.elapsedSeconds;

  if (config.showPhases) {
    const emoji = PHASE_EMOJI[phase];
    let message = PHASE_MESSAGES[phase];

    if (phase === "sending_query_model_resolved" && state.providerUsed && state.modelUsed) {
      message = `Sending request to ${state.providerUsed}/${state.modelUsed}`;
    }

    parts.push(`${emoji} ${message}`);
  }

  if (config.showElapsedTime && elapsedSeconds * 1000 >= config.elapsedTimeThresholdMs) {
    const elapsed = formatElapsedTime(elapsedSeconds);
    parts.push(`(${elapsed})`);
  }

  return parts.join(" ") || "Processing...";
}

export class StatusUpdateController {
  private config: Required<StatusUpdateConfig>;
  private callbacks: StatusUpdateCallbacks;
  private state: StatusUpdateState;
  private updateTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private editedInPlace: boolean = false;

  constructor(config: StatusUpdateConfig, callbacks: StatusUpdateCallbacks) {
    this.config = resolveStatusUpdateConfig(config);
    this.callbacks = callbacks;
    this.state = {
      phase: "sending_query",
      startedAt: Date.now(),
      lastUpdateAt: Date.now(),
      elapsedSeconds: 0,
      isComplete: false,
    };
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.mode !== "off";
  }

  wasEditedInPlace(): boolean {
    return this.editedInPlace;
  }

  getStatusMessageId(): string | undefined {
    return this.state.statusMessageId;
  }

  supportsEdit(): boolean {
    return this.callbacks.supportsEdit?.() ?? false;
  }

  async start(): Promise<void> {
    if (!this.isEnabled() || this.stopped) return;

    log.debug("Starting status updates");

    // Send initial status message
    await this.sendUpdate();

    // Start update timer if showing elapsed time
    if (this.config.showElapsedTime) {
      this.startUpdateTimer();
    }
  }

  async setPhase(phase: StatusPhase, data?: { provider?: string; model?: string }): Promise<void> {
    if (!this.isEnabled() || this.stopped || this.state.isComplete) return;

    if (phase === this.state.phase) return;

    log.debug(`Status phase: ${this.state.phase} -> ${phase}`);
    this.state.phase = phase;
    if (data?.provider) this.state.providerUsed = data.provider;
    if (data?.model) this.state.modelUsed = data.model;

    if (phase === "complete") {
      this.state.isComplete = true;
      this.stopUpdateTimer();
      return; // Suppress redundant sendUpdate for "complete" phase
    }

    await this.sendUpdate();
  }

  async cleanup(): Promise<void> {
    this.stopUpdateTimer();
    this.stopped = true;

    // Delete status message if it exists and response is being sent separately
    if (this.state.statusMessageId && !this.state.isComplete && this.callbacks.deleteStatus) {
      try {
        await this.callbacks.deleteStatus(this.state.statusMessageId);
      } catch (err) {
        log.debug(`Failed to cleanup status message: ${String(err)}`);
      }
    }
  }

  private async sendUpdate(): Promise<void> {
    if (this.stopped) return;

    const now = Date.now();
    this.state.elapsedSeconds = Math.floor((now - this.state.startedAt) / 1000);
    this.state.lastUpdateAt = now;

    const text = formatStatusMessage(this.state, this.config);

    try {
      if (this.config.mode === "edit" && this.supportsEdit() && this.state.statusMessageId) {
        // Edit existing message
        this.state.statusMessageId = await this.callbacks.sendStatus(
          text,
          this.state.statusMessageId,
        );
      } else {
        // Send new message (or first message in edit mode)
        const messageId = await this.callbacks.sendStatus(text, this.state.statusMessageId);
        if (messageId) {
          this.state.statusMessageId = messageId;
        }
      }
    } catch (err) {
      log.debug(`Failed to send status update: ${String(err)}`);
    }
  }

  private startUpdateTimer(): void {
    if (this.updateTimer) return;

    this.updateTimer = setInterval(async () => {
      if (this.stopped || this.state.isComplete) {
        this.stopUpdateTimer();
        return;
      }
      await this.sendUpdate();
    }, this.config.updateIntervalMs);
  }

  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
}

export function createStatusUpdateController(
  config: StatusUpdateConfig,
  callbacks: StatusUpdateCallbacks,
): StatusUpdateController {
  return new StatusUpdateController(config, callbacks);
}

/**
 * Create status update callbacks for channels that support message editing.
 */
export function createEditableStatusCallbacks(params: {
  sendMessage: (text: string) => Promise<string | undefined>;
  editMessage: (text: string, messageId: string) => Promise<void>;
  deleteMessage?: (messageId: string) => Promise<void>;
}): StatusUpdateCallbacks {
  return {
    sendStatus: async (text, messageId) => {
      if (messageId) {
        await params.editMessage(text, messageId);
        return messageId;
      }
      return params.sendMessage(text);
    },
    editFinal: params.editMessage,
    supportsEdit: () => true,
    deleteStatus: params.deleteMessage,
  };
}

/**
 * Create status update callbacks for channels that don't support editing.
 */
export function createInlineStatusCallbacks(params: {
  sendMessage: (text: string) => Promise<string | undefined>;
}): StatusUpdateCallbacks {
  return {
    sendStatus: async (text) => {
      return params.sendMessage(text);
    },
    supportsEdit: () => false,
  };
}
