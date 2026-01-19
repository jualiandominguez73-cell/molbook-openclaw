// Diagnostic logging for debugging message flow issues
import { createSubsystemLogger } from './subsystem.js';

const diag = createSubsystemLogger('diagnostic');

// Track active sessions and their state
const sessionStates = new Map<string, {
  lastActivity: number;
  state: 'idle' | 'processing' | 'waiting';
  queueDepth: number;
}>();

// Track webhook processing
let webhookStats = {
  received: 0,
  processed: 0,
  errors: 0,
  lastReceived: 0,
};

export function logWebhookReceived(updateType: string, chatId?: number) {
  webhookStats.received++;
  webhookStats.lastReceived = Date.now();
  diag.info(`webhook received: type=${updateType} chatId=${chatId ?? 'unknown'} total=${webhookStats.received}`);
}

export function logWebhookProcessed(updateType: string, chatId?: number, durationMs?: number) {
  webhookStats.processed++;
  diag.info(`webhook processed: type=${updateType} chatId=${chatId ?? 'unknown'} duration=${durationMs ?? 0}ms processed=${webhookStats.processed}`);
}

export function logWebhookError(updateType: string, error: string) {
  webhookStats.errors++;
  diag.error(`webhook error: type=${updateType} error="${error}" errors=${webhookStats.errors}`);
}

export function logMessageQueued(sessionId: string, source: string) {
  const state = sessionStates.get(sessionId) || { lastActivity: 0, state: 'idle', queueDepth: 0 };
  state.queueDepth++;
  state.lastActivity = Date.now();
  sessionStates.set(sessionId, state);
  diag.info(`message queued: sessionId=${sessionId} source=${source} queueDepth=${state.queueDepth} sessionState=${state.state}`);
}

export function logSessionStateChange(sessionId: string, newState: 'idle' | 'processing' | 'waiting', reason?: string) {
  const state = sessionStates.get(sessionId) || { lastActivity: 0, state: 'idle', queueDepth: 0 };
  const prevState = state.state;
  state.state = newState;
  state.lastActivity = Date.now();
  if (newState === 'idle') state.queueDepth = Math.max(0, state.queueDepth - 1);
  sessionStates.set(sessionId, state);
  diag.info(`session state: sessionId=${sessionId} prev=${prevState} new=${newState} reason="${reason ?? ''}" queueDepth=${state.queueDepth}`);
}

export function logLaneEnqueue(lane: string, queueSize: number) {
  diag.debug(`lane enqueue: lane=${lane} queueSize=${queueSize}`);
}

export function logLaneDequeue(lane: string, waitMs: number, queueSize: number) {
  diag.debug(`lane dequeue: lane=${lane} waitMs=${waitMs} queueSize=${queueSize}`);
}

export function logRunAttempt(sessionId: string, runId: string, attempt: number) {
  diag.info(`run attempt: sessionId=${sessionId} runId=${runId} attempt=${attempt}`);
}

export function logActiveRuns() {
  const activeSessions = Array.from(sessionStates.entries())
    .filter(([, s]) => s.state === 'processing')
    .map(([id, s]) => `${id}(q=${s.queueDepth},age=${Math.round((Date.now() - s.lastActivity) / 1000)}s)`);
  
  diag.info(`active runs: count=${activeSessions.length} sessions=[${activeSessions.join(', ')}]`);
}

// Heartbeat every 30 seconds if there's activity
let heartbeatInterval: NodeJS.Timeout | null = null;

export function startDiagnosticHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    const activeCount = Array.from(sessionStates.values()).filter(s => s.state === 'processing').length;
    const waitingCount = Array.from(sessionStates.values()).filter(s => s.state === 'waiting').length;
    const totalQueued = Array.from(sessionStates.values()).reduce((sum, s) => sum + s.queueDepth, 0);
    
    diag.info(`heartbeat: webhooks=${webhookStats.received}/${webhookStats.processed}/${webhookStats.errors} active=${activeCount} waiting=${waitingCount} queued=${totalQueued}`);
    
    // Log any sessions that have been processing for > 2 minutes
    const now = Date.now();
    for (const [id, state] of sessionStates) {
      if (state.state === 'processing' && now - state.lastActivity > 120000) {
        diag.warn(`stuck session: sessionId=${id} state=${state.state} age=${Math.round((now - state.lastActivity) / 1000)}s queueDepth=${state.queueDepth}`);
      }
    }
  }, 30000);
}

export function stopDiagnosticHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export { diag as diagnosticLogger };
