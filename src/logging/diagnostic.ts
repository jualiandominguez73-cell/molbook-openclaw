import { emitDiagnosticEvent } from "../infra/diagnostic-events.js";
import { createSubsystemLogger } from "./subsystem.js";

const diag = createSubsystemLogger("diagnostic");

type SessionStateValue = "idle" | "processing" | "waiting";

type SessionState = {
  sessionId?: string;
  sessionKey?: string;
  lastActivity: number;
  state: SessionStateValue;
  queueDepth: number;
};

type SessionRef = {
  sessionId?: string;
  sessionKey?: string;
};

const sessionStates = new Map<string, SessionState>();

/** Tracks the last time a stuck alert was emitted per session key, plus the alert count for escalation. */
const stuckAlertState = new Map<string, { lastAlertMs: number; alertCount: number }>();

/** Escalating intervals: 5min (first seen) → 15min → 30min → every 30min */
const STUCK_ESCALATION_INTERVALS = [
  5 * 60_000, // after first alert, wait 5 min before second
  15 * 60_000, // then 15 min
  30 * 60_000, // then 30 min (repeats)
];

function getStuckInterval(alertCount: number): number {
  const idx = Math.min(alertCount, STUCK_ESCALATION_INTERVALS.length - 1);
  return STUCK_ESCALATION_INTERVALS[idx];
}

/** Threshold before a session is considered stuck (5 minutes). */
const STUCK_THRESHOLD_MS = 300_000;

/** Auto-resolve threshold: force-clear after 15 minutes stuck. */
const STUCK_AUTO_RESOLVE_MS = 15 * 60_000;

const webhookStats = {
  received: 0,
  processed: 0,
  errors: 0,
  lastReceived: 0,
};

let lastActivityAt = 0;

function markActivity() {
  lastActivityAt = Date.now();
}

function resolveSessionKey({ sessionKey, sessionId }: SessionRef) {
  return sessionKey ?? sessionId ?? "unknown";
}

function getSessionState(ref: SessionRef): SessionState {
  const key = resolveSessionKey(ref);
  const existing = sessionStates.get(key);
  if (existing) {
    if (ref.sessionId) existing.sessionId = ref.sessionId;
    if (ref.sessionKey) existing.sessionKey = ref.sessionKey;
    return existing;
  }
  const created: SessionState = {
    sessionId: ref.sessionId,
    sessionKey: ref.sessionKey,
    lastActivity: Date.now(),
    state: "idle",
    queueDepth: 0,
  };
  sessionStates.set(key, created);
  return created;
}

export function logWebhookReceived(params: {
  channel: string;
  updateType?: string;
  chatId?: number | string;
}) {
  webhookStats.received += 1;
  webhookStats.lastReceived = Date.now();
  diag.debug(
    `webhook received: channel=${params.channel} type=${params.updateType ?? "unknown"} chatId=${
      params.chatId ?? "unknown"
    } total=${webhookStats.received}`,
  );
  emitDiagnosticEvent({
    type: "webhook.received",
    channel: params.channel,
    updateType: params.updateType,
    chatId: params.chatId,
  });
  markActivity();
}

export function logWebhookProcessed(params: {
  channel: string;
  updateType?: string;
  chatId?: number | string;
  durationMs?: number;
}) {
  webhookStats.processed += 1;
  diag.debug(
    `webhook processed: channel=${params.channel} type=${
      params.updateType ?? "unknown"
    } chatId=${params.chatId ?? "unknown"} duration=${params.durationMs ?? 0}ms processed=${
      webhookStats.processed
    }`,
  );
  emitDiagnosticEvent({
    type: "webhook.processed",
    channel: params.channel,
    updateType: params.updateType,
    chatId: params.chatId,
    durationMs: params.durationMs,
  });
  markActivity();
}

export function logWebhookError(params: {
  channel: string;
  updateType?: string;
  chatId?: number | string;
  error: string;
}) {
  webhookStats.errors += 1;
  diag.error(
    `webhook error: channel=${params.channel} type=${params.updateType ?? "unknown"} chatId=${
      params.chatId ?? "unknown"
    } error="${params.error}" errors=${webhookStats.errors}`,
  );
  emitDiagnosticEvent({
    type: "webhook.error",
    channel: params.channel,
    updateType: params.updateType,
    chatId: params.chatId,
    error: params.error,
  });
  markActivity();
}

export function logMessageQueued(params: {
  sessionId?: string;
  sessionKey?: string;
  channel?: string;
  source: string;
}) {
  const state = getSessionState(params);
  state.queueDepth += 1;
  state.lastActivity = Date.now();
  diag.debug(
    `message queued: sessionId=${state.sessionId ?? "unknown"} sessionKey=${
      state.sessionKey ?? "unknown"
    } source=${params.source} queueDepth=${state.queueDepth} sessionState=${state.state}`,
  );
  emitDiagnosticEvent({
    type: "message.queued",
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    channel: params.channel,
    source: params.source,
    queueDepth: state.queueDepth,
  });
  markActivity();
}

export function logMessageProcessed(params: {
  channel: string;
  messageId?: number | string;
  chatId?: number | string;
  sessionId?: string;
  sessionKey?: string;
  durationMs?: number;
  outcome: "completed" | "skipped" | "error";
  reason?: string;
  error?: string;
}) {
  const payload = `message processed: channel=${params.channel} chatId=${
    params.chatId ?? "unknown"
  } messageId=${params.messageId ?? "unknown"} sessionId=${
    params.sessionId ?? "unknown"
  } sessionKey=${params.sessionKey ?? "unknown"} outcome=${params.outcome} duration=${
    params.durationMs ?? 0
  }ms${params.reason ? ` reason=${params.reason}` : ""}${
    params.error ? ` error="${params.error}"` : ""
  }`;
  if (params.outcome === "error") {
    diag.error(payload);
  } else if (params.outcome === "skipped") {
    diag.debug(payload);
  } else {
    diag.debug(payload);
  }
  emitDiagnosticEvent({
    type: "message.processed",
    channel: params.channel,
    chatId: params.chatId,
    messageId: params.messageId,
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    durationMs: params.durationMs,
    outcome: params.outcome,
    reason: params.reason,
    error: params.error,
  });
  markActivity();
}

export function logSessionStateChange(
  params: SessionRef & {
    state: SessionStateValue;
    reason?: string;
  },
) {
  const state = getSessionState(params);
  const isProbeSession = state.sessionId?.startsWith("probe-") ?? false;
  const prevState = state.state;
  state.state = params.state;
  state.lastActivity = Date.now();
  if (params.state === "idle") state.queueDepth = Math.max(0, state.queueDepth - 1);
  // Clear stuck-alert tracking when leaving "processing"
  if (prevState === "processing" && params.state !== "processing") {
    const key = resolveSessionKey(params);
    stuckAlertState.delete(key);
  }
  if (!isProbeSession) {
    diag.debug(
      `session state: sessionId=${state.sessionId ?? "unknown"} sessionKey=${
        state.sessionKey ?? "unknown"
      } prev=${prevState} new=${params.state} reason="${params.reason ?? ""}" queueDepth=${
        state.queueDepth
      }`,
    );
  }
  emitDiagnosticEvent({
    type: "session.state",
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    prevState,
    state: params.state,
    reason: params.reason,
    queueDepth: state.queueDepth,
  });
  markActivity();
}

export function logSessionStuck(params: SessionRef & { state: SessionStateValue; ageMs: number }) {
  const state = getSessionState(params);
  diag.warn(
    `stuck session: sessionId=${state.sessionId ?? "unknown"} sessionKey=${
      state.sessionKey ?? "unknown"
    } state=${params.state} age=${Math.round(params.ageMs / 1000)}s queueDepth=${state.queueDepth}`,
  );
  emitDiagnosticEvent({
    type: "session.stuck",
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    state: params.state,
    ageMs: params.ageMs,
    queueDepth: state.queueDepth,
  });
  markActivity();
}

export function logLaneEnqueue(lane: string, queueSize: number) {
  diag.debug(`lane enqueue: lane=${lane} queueSize=${queueSize}`);
  emitDiagnosticEvent({
    type: "queue.lane.enqueue",
    lane,
    queueSize,
  });
  markActivity();
}

export function logLaneDequeue(lane: string, waitMs: number, queueSize: number) {
  diag.debug(`lane dequeue: lane=${lane} waitMs=${waitMs} queueSize=${queueSize}`);
  emitDiagnosticEvent({
    type: "queue.lane.dequeue",
    lane,
    queueSize,
    waitMs,
  });
  markActivity();
}

export function logRunAttempt(params: SessionRef & { runId: string; attempt: number }) {
  diag.debug(
    `run attempt: sessionId=${params.sessionId ?? "unknown"} sessionKey=${
      params.sessionKey ?? "unknown"
    } runId=${params.runId} attempt=${params.attempt}`,
  );
  emitDiagnosticEvent({
    type: "run.attempt",
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    runId: params.runId,
    attempt: params.attempt,
  });
  markActivity();
}

export function logActiveRuns() {
  const activeSessions = Array.from(sessionStates.entries())
    .filter(([, s]) => s.state === "processing")
    .map(
      ([id, s]) =>
        `${id}(q=${s.queueDepth},age=${Math.round((Date.now() - s.lastActivity) / 1000)}s)`,
    );
  diag.debug(`active runs: count=${activeSessions.length} sessions=[${activeSessions.join(", ")}]`);
  markActivity();
}

let heartbeatInterval: NodeJS.Timeout | null = null;

export function startDiagnosticHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    const activeCount = Array.from(sessionStates.values()).filter(
      (s) => s.state === "processing",
    ).length;
    const waitingCount = Array.from(sessionStates.values()).filter(
      (s) => s.state === "waiting",
    ).length;
    const totalQueued = Array.from(sessionStates.values()).reduce(
      (sum, s) => sum + s.queueDepth,
      0,
    );
    const hasActivity =
      lastActivityAt > 0 ||
      webhookStats.received > 0 ||
      activeCount > 0 ||
      waitingCount > 0 ||
      totalQueued > 0;
    if (!hasActivity) return;
    if (now - lastActivityAt > 120_000 && activeCount === 0 && waitingCount === 0) return;

    diag.debug(
      `heartbeat: webhooks=${webhookStats.received}/${webhookStats.processed}/${webhookStats.errors} active=${activeCount} waiting=${waitingCount} queued=${totalQueued}`,
    );
    emitDiagnosticEvent({
      type: "diagnostic.heartbeat",
      webhooks: {
        received: webhookStats.received,
        processed: webhookStats.processed,
        errors: webhookStats.errors,
      },
      active: activeCount,
      waiting: waitingCount,
      queued: totalQueued,
    });

    for (const [key, state] of sessionStates) {
      if (state.state !== "processing") continue;
      const ageMs = now - state.lastActivity;
      if (ageMs <= STUCK_THRESHOLD_MS) continue;

      // Auto-resolve: force-clear sessions stuck for 15+ minutes
      if (ageMs > STUCK_AUTO_RESOLVE_MS) {
        state.state = "idle";
        state.lastActivity = now;
        stuckAlertState.delete(key);
        diag.warn(
          `force-clearing stuck session: sessionId=${state.sessionId ?? "unknown"} sessionKey=${
            state.sessionKey ?? "unknown"
          } age=${Math.round(ageMs / 1000)}s`,
        );
        emitDiagnosticEvent({
          type: "session.stuck.cleared",
          sessionId: state.sessionId,
          sessionKey: state.sessionKey,
          ageMs,
        });
        continue;
      }

      // Deduplicate alerts with escalating intervals
      const alertState = stuckAlertState.get(key);
      if (alertState) {
        const interval = getStuckInterval(alertState.alertCount);
        if (now - alertState.lastAlertMs < interval) continue;
        alertState.lastAlertMs = now;
        alertState.alertCount += 1;
      } else {
        stuckAlertState.set(key, { lastAlertMs: now, alertCount: 0 });
      }

      logSessionStuck({
        sessionId: state.sessionId,
        sessionKey: state.sessionKey,
        state: state.state,
        ageMs,
      });
    }
  }, 30_000);
  heartbeatInterval.unref?.();
}

export function stopDiagnosticHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export function getSessionStateByKey(key: string): SessionStateValue | undefined {
  return sessionStates.get(key)?.state;
}

export { diag as diagnosticLogger };
