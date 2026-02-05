/**
 * Security Events System for OpenClaw.
 *
 * Provides a centralized security event emission system that allows
 * the cybersecurity agent to monitor system-wide security events.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security/events");

// Event severity levels
export type SecurityEventSeverity = "critical" | "high" | "medium" | "low" | "info";

// Security event categories
export type SecurityEventCategory =
  | "authentication"
  | "authorization"
  | "access_control"
  | "command_execution"
  | "network"
  | "file_system"
  | "configuration"
  | "session"
  | "rate_limit"
  | "injection"
  | "anomaly"
  | "audit";

// Security event payload
export interface SecurityEvent {
  /** Unique event ID */
  id: string;
  /** Event timestamp */
  timestamp: number;
  /** Event category */
  category: SecurityEventCategory;
  /** Event severity */
  severity: SecurityEventSeverity;
  /** Event action/type */
  action: string;
  /** Human-readable description */
  description: string;
  /** Source of the event (component/module) */
  source: string;
  /** Session key if applicable */
  sessionKey?: string;
  /** Agent ID if applicable */
  agentId?: string;
  /** User/sender ID if applicable */
  userId?: string;
  /** IP address if applicable */
  ipAddress?: string;
  /** Channel (telegram, discord, etc.) if applicable */
  channel?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Whether the event was blocked/prevented */
  blocked?: boolean;
  /** Related event IDs for correlation */
  relatedEvents?: string[];
}

// Event listener type
export type SecurityEventListener = (event: SecurityEvent) => void | Promise<void>;

// Internal state
const listeners = new Set<SecurityEventListener>();
let eventCounter = 0;

/**
 * Generate a unique event ID.
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (++eventCounter).toString(36).padStart(4, "0");
  const random = Math.random().toString(36).slice(2, 6);
  return `sec_${timestamp}_${counter}_${random}`;
}

/**
 * Emit a security event to all registered listeners.
 */
export function emitSecurityEvent(event: Omit<SecurityEvent, "id" | "timestamp">): SecurityEvent {
  const fullEvent: SecurityEvent = {
    ...event,
    id: generateEventId(),
    timestamp: Date.now(),
  };

  // Log based on severity
  if (fullEvent.severity === "critical" || fullEvent.severity === "high") {
    log.warn(
      `[${fullEvent.severity.toUpperCase()}] ${fullEvent.category}: ${fullEvent.description}`,
    );
  } else {
    log.debug(`[${fullEvent.severity}] ${fullEvent.category}: ${fullEvent.description}`);
  }

  // Notify all listeners
  for (const listener of listeners) {
    try {
      const result = listener(fullEvent);
      if (result instanceof Promise) {
        result.catch((err) => {
          log.error(
            `security event listener error: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }
    } catch (err) {
      log.error(
        `security event listener error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return fullEvent;
}

/**
 * Register a security event listener.
 * Returns a function to unregister the listener.
 */
export function onSecurityEvent(listener: SecurityEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Clear all security event listeners (for testing).
 */
export function clearSecurityEventListeners(): void {
  listeners.clear();
}

/**
 * Get the number of registered listeners.
 */
export function getSecurityEventListenerCount(): number {
  return listeners.size;
}

// Convenience functions for common security events

/**
 * Emit an authentication event.
 */
export function emitAuthEvent(params: {
  action:
    | "login"
    | "logout"
    | "failed"
    | "token_refresh"
    | "token_invalid"
    | "mfa_required"
    | "mfa_success"
    | "mfa_failed";
  success: boolean;
  source: string;
  userId?: string;
  ipAddress?: string;
  sessionKey?: string;
  reason?: string;
  context?: Record<string, unknown>;
}): SecurityEvent {
  return emitSecurityEvent({
    category: "authentication",
    severity: params.success ? "info" : params.action === "failed" ? "medium" : "low",
    action: `auth:${params.action}`,
    description: params.success
      ? `Authentication ${params.action} successful`
      : `Authentication ${params.action}${params.reason ? `: ${params.reason}` : ""}`,
    source: params.source,
    userId: params.userId,
    ipAddress: params.ipAddress,
    sessionKey: params.sessionKey,
    blocked: !params.success,
    context: params.context,
  });
}

/**
 * Emit an authorization/access control event.
 */
export function emitAccessEvent(params: {
  action: "granted" | "denied" | "elevated" | "revoked";
  resource: string;
  source: string;
  userId?: string;
  sessionKey?: string;
  reason?: string;
  context?: Record<string, unknown>;
}): SecurityEvent {
  return emitSecurityEvent({
    category: "access_control",
    severity: params.action === "denied" ? "medium" : "info",
    action: `access:${params.action}`,
    description: `Access ${params.action} for resource: ${params.resource}${params.reason ? ` (${params.reason})` : ""}`,
    source: params.source,
    userId: params.userId,
    sessionKey: params.sessionKey,
    blocked: params.action === "denied",
    context: { resource: params.resource, ...params.context },
  });
}

/**
 * Emit a command execution security event.
 */
export function emitCommandEvent(params: {
  action: "requested" | "approved" | "denied" | "executed" | "failed" | "elevated";
  command: string;
  source: string;
  sessionKey?: string;
  agentId?: string;
  reason?: string;
  elevated?: boolean;
  context?: Record<string, unknown>;
}): SecurityEvent {
  const severity: SecurityEventSeverity =
    params.action === "denied"
      ? "medium"
      : params.action === "elevated"
        ? "high"
        : params.action === "failed"
          ? "low"
          : "info";

  return emitSecurityEvent({
    category: "command_execution",
    severity,
    action: `command:${params.action}`,
    description: `Command ${params.action}: ${params.command.slice(0, 100)}${params.command.length > 100 ? "..." : ""}${params.reason ? ` (${params.reason})` : ""}`,
    source: params.source,
    sessionKey: params.sessionKey,
    agentId: params.agentId,
    blocked: params.action === "denied",
    context: {
      command: params.command,
      elevated: params.elevated,
      ...params.context,
    },
  });
}

/**
 * Emit a rate limit event.
 */
export function emitRateLimitEvent(params: {
  action: "warning" | "exceeded" | "blocked";
  limit: string;
  current: number;
  max: number;
  source: string;
  userId?: string;
  ipAddress?: string;
  sessionKey?: string;
  context?: Record<string, unknown>;
}): SecurityEvent {
  return emitSecurityEvent({
    category: "rate_limit",
    severity:
      params.action === "blocked" ? "high" : params.action === "exceeded" ? "medium" : "low",
    action: `rate_limit:${params.action}`,
    description: `Rate limit ${params.action}: ${params.limit} (${params.current}/${params.max})`,
    source: params.source,
    userId: params.userId,
    ipAddress: params.ipAddress,
    sessionKey: params.sessionKey,
    blocked: params.action === "blocked",
    context: {
      limit: params.limit,
      current: params.current,
      max: params.max,
      ...params.context,
    },
  });
}

/**
 * Emit a potential injection/attack event.
 */
export function emitInjectionEvent(params: {
  type:
    | "prompt_injection"
    | "command_injection"
    | "sql_injection"
    | "xss"
    | "path_traversal"
    | "ssrf";
  input: string;
  source: string;
  blocked: boolean;
  sessionKey?: string;
  userId?: string;
  channel?: string;
  context?: Record<string, unknown>;
}): SecurityEvent {
  return emitSecurityEvent({
    category: "injection",
    severity: "high",
    action: `injection:${params.type}`,
    description: `Potential ${params.type.replace(/_/g, " ")} detected${params.blocked ? " and blocked" : ""}`,
    source: params.source,
    sessionKey: params.sessionKey,
    userId: params.userId,
    channel: params.channel,
    blocked: params.blocked,
    context: {
      type: params.type,
      inputPreview: params.input.slice(0, 200),
      ...params.context,
    },
  });
}

/**
 * Emit a network security event.
 */
export function emitNetworkEvent(params: {
  action: "connection" | "blocked" | "ssrf_attempt" | "suspicious_ip" | "proxy_detected";
  source: string;
  ipAddress?: string;
  destination?: string;
  blocked?: boolean;
  reason?: string;
  context?: Record<string, unknown>;
}): SecurityEvent {
  return emitSecurityEvent({
    category: "network",
    severity: params.action === "ssrf_attempt" || params.action === "blocked" ? "high" : "info",
    action: `network:${params.action}`,
    description: `Network ${params.action}${params.destination ? ` to ${params.destination}` : ""}${params.reason ? `: ${params.reason}` : ""}`,
    source: params.source,
    ipAddress: params.ipAddress,
    blocked: params.blocked,
    context: {
      destination: params.destination,
      ...params.context,
    },
  });
}

/**
 * Emit an anomaly detection event.
 */
export function emitAnomalyEvent(params: {
  type: "unusual_activity" | "suspicious_pattern" | "threshold_exceeded" | "behavior_change";
  description: string;
  source: string;
  severity?: SecurityEventSeverity;
  sessionKey?: string;
  userId?: string;
  context?: Record<string, unknown>;
}): SecurityEvent {
  return emitSecurityEvent({
    category: "anomaly",
    severity: params.severity ?? "medium",
    action: `anomaly:${params.type}`,
    description: params.description,
    source: params.source,
    sessionKey: params.sessionKey,
    userId: params.userId,
    context: params.context,
  });
}

/**
 * Emit a configuration change security event.
 */
export function emitConfigEvent(params: {
  action: "changed" | "invalid" | "security_degraded" | "reset";
  setting: string;
  source: string;
  oldValue?: unknown;
  newValue?: unknown;
  context?: Record<string, unknown>;
}): SecurityEvent {
  return emitSecurityEvent({
    category: "configuration",
    severity: params.action === "security_degraded" ? "high" : "info",
    action: `config:${params.action}`,
    description: `Configuration ${params.action}: ${params.setting}`,
    source: params.source,
    context: {
      setting: params.setting,
      oldValue: params.oldValue,
      newValue: params.newValue,
      ...params.context,
    },
  });
}

/**
 * Emit a file system security event.
 */
export function emitFileSystemEvent(params: {
  action: "access" | "denied" | "path_traversal" | "permission_changed" | "sensitive_file";
  path: string;
  source: string;
  blocked?: boolean;
  sessionKey?: string;
  context?: Record<string, unknown>;
}): SecurityEvent {
  return emitSecurityEvent({
    category: "file_system",
    severity:
      params.action === "path_traversal" || params.action === "sensitive_file" ? "high" : "info",
    action: `fs:${params.action}`,
    description: `File system ${params.action}: ${params.path}`,
    source: params.source,
    sessionKey: params.sessionKey,
    blocked: params.blocked,
    context: {
      path: params.path,
      ...params.context,
    },
  });
}
