/**
 * Security Audit Logger
 * Centralized security event logging for forensics and monitoring
 */

import { createHmac, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SecurityEvent, SecurityLogEntry, SecurityEventSeverity } from "./types.js";

export interface AuditLoggerConfig {
  /** Log file path */
  logPath: string;
  /** HMAC signing key (for tamper detection) */
  signingKey?: string;
  /** Enable entry signing */
  signEntries: boolean;
  /** Maximum file size before rotation (bytes) */
  maxFileSize: number;
  /** Number of rotated files to keep */
  maxFiles: number;
  /** Console logging level */
  consoleLevel: SecurityEventSeverity | "none";
}

const DEFAULT_CONFIG: AuditLoggerConfig = {
  logPath: "./security-audit.log",
  signEntries: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  consoleLevel: "high",
};

const SEVERITY_LEVELS: Record<SecurityEventSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export class SecurityAuditLog {
  private config: AuditLoggerConfig;
  private initialized: boolean = false;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the audit logger
   */
  initialize(): void {
    if (this.initialized) return;

    const logDir = dirname(this.config.logPath);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    this.initialized = true;
  }

  /**
   * Log a security event
   */
  log(event: SecurityEvent): SecurityLogEntry {
    this.initialize();

    const entry: SecurityLogEntry = {
      ...event,
      timestamp: Date.now(),
      entryId: randomUUID(),
    };

    // Sign entry if configured
    if (this.config.signEntries && this.config.signingKey) {
      entry.signature = this.signEntry(entry);
    }

    // Write to file
    this.writeEntry(entry);

    // Console output for high-severity events
    if (this.shouldLogToConsole(event.severity)) {
      this.logToConsole(entry);
    }

    return entry;
  }

  /**
   * Log a critical security event
   */
  critical(event: string, details: Record<string, unknown>, context?: Record<string, unknown>): SecurityLogEntry {
    return this.log({
      event,
      severity: "critical",
      details,
      context,
    });
  }

  /**
   * Log a high-severity security event
   */
  high(event: string, details: Record<string, unknown>, context?: Record<string, unknown>): SecurityLogEntry {
    return this.log({
      event,
      severity: "high",
      details,
      context,
    });
  }

  /**
   * Log a medium-severity security event
   */
  medium(event: string, details: Record<string, unknown>, context?: Record<string, unknown>): SecurityLogEntry {
    return this.log({
      event,
      severity: "medium",
      details,
      context,
    });
  }

  /**
   * Log a low-severity security event
   */
  low(event: string, details: Record<string, unknown>, context?: Record<string, unknown>): SecurityLogEntry {
    return this.log({
      event,
      severity: "low",
      details,
      context,
    });
  }

  /**
   * Log an informational security event
   */
  info(event: string, details: Record<string, unknown>, context?: Record<string, unknown>): SecurityLogEntry {
    return this.log({
      event,
      severity: "info",
      details,
      context,
    });
  }

  /**
   * Log command execution attempt
   */
  logCommandExecution(params: {
    command: string;
    allowed: boolean;
    userId?: string;
    sessionKey?: string;
    reason?: string;
  }): SecurityLogEntry {
    return this.log({
      event: params.allowed ? "command_allowed" : "command_blocked",
      severity: params.allowed ? "info" : "high",
      userId: params.userId,
      sessionKey: params.sessionKey,
      details: {
        command: params.command,
        allowed: params.allowed,
        reason: params.reason,
      },
    });
  }

  /**
   * Log rate limit event
   */
  logRateLimit(params: {
    userId?: string;
    ipAddress?: string;
    endpoint: string;
    allowed: boolean;
    remaining: number;
  }): SecurityLogEntry {
    return this.log({
      event: params.allowed ? "rate_limit_check" : "rate_limit_exceeded",
      severity: params.allowed ? "info" : "medium",
      userId: params.userId,
      ipAddress: params.ipAddress,
      details: {
        endpoint: params.endpoint,
        allowed: params.allowed,
        remaining: params.remaining,
      },
    });
  }

  /**
   * Log network access attempt
   */
  logNetworkAccess(params: {
    url: string;
    allowed: boolean;
    userId?: string;
    sessionKey?: string;
    reason?: string;
    resolvedIP?: string;
  }): SecurityLogEntry {
    return this.log({
      event: params.allowed ? "network_access_allowed" : "network_access_blocked",
      severity: params.allowed ? "info" : "high",
      userId: params.userId,
      sessionKey: params.sessionKey,
      details: {
        url: params.url,
        allowed: params.allowed,
        reason: params.reason,
        resolvedIP: params.resolvedIP,
      },
    });
  }

  /**
   * Log prompt injection detection
   */
  logPromptInjection(params: {
    input: string;
    detected: boolean;
    confidence: number;
    userId?: string;
    sessionKey?: string;
    patterns?: string[];
  }): SecurityLogEntry {
    return this.log({
      event: params.detected ? "prompt_injection_detected" : "prompt_injection_scan",
      severity: params.detected ? "high" : "info",
      userId: params.userId,
      sessionKey: params.sessionKey,
      details: {
        inputPreview: params.input.slice(0, 200),
        detected: params.detected,
        confidence: params.confidence,
        patterns: params.patterns,
      },
    });
  }

  /**
   * Log session access attempt
   */
  logSessionAccess(params: {
    fromSession: string;
    toSession: string;
    operation: string;
    allowed: boolean;
    reason?: string;
  }): SecurityLogEntry {
    return this.log({
      event: params.allowed ? "session_access_allowed" : "session_access_denied",
      severity: params.allowed ? "info" : "medium",
      sessionKey: params.fromSession,
      details: {
        fromSession: params.fromSession,
        toSession: params.toSession,
        operation: params.operation,
        allowed: params.allowed,
        reason: params.reason,
      },
    });
  }

  /**
   * Log authentication event
   */
  logAuth(params: {
    event: "login" | "logout" | "token_refresh" | "auth_failed";
    userId?: string;
    ipAddress?: string;
    method?: string;
    success: boolean;
    reason?: string;
  }): SecurityLogEntry {
    return this.log({
      event: `auth_${params.event}`,
      severity: params.success ? "info" : "high",
      userId: params.userId,
      ipAddress: params.ipAddress,
      details: {
        method: params.method,
        success: params.success,
        reason: params.reason,
      },
    });
  }

  /**
   * Sign a log entry with HMAC
   */
  private signEntry(entry: SecurityLogEntry): string {
    if (!this.config.signingKey) return "";

    const payload = JSON.stringify({
      timestamp: entry.timestamp,
      entryId: entry.entryId,
      event: entry.event,
      severity: entry.severity,
      details: entry.details,
    });

    return createHmac("sha256", this.config.signingKey)
      .update(payload)
      .digest("hex");
  }

  /**
   * Verify a log entry signature
   */
  verifyEntry(entry: SecurityLogEntry): boolean {
    if (!entry.signature || !this.config.signingKey) return false;

    const expectedSignature = this.signEntry({
      ...entry,
      signature: undefined,
    });

    return entry.signature === expectedSignature;
  }

  /**
   * Write entry to log file
   */
  private writeEntry(entry: SecurityLogEntry): void {
    try {
      // Check for rotation
      this.maybeRotate();

      // Append entry
      const line = JSON.stringify(entry) + "\n";
      appendFileSync(this.config.logPath, line, { mode: 0o600 });
    } catch (err) {
      // Fallback to stderr if file write fails
      console.error("[SecurityAuditLog] Failed to write to file:", err);
      console.error("[SecurityAuditLog] Entry:", JSON.stringify(entry));
    }
  }

  /**
   * Check and perform log rotation if needed
   */
  private maybeRotate(): void {
    if (!existsSync(this.config.logPath)) return;

    try {
      const stats = statSync(this.config.logPath);
      if (stats.size < this.config.maxFileSize) return;

      // Rotate files
      for (let i = this.config.maxFiles - 1; i >= 1; i--) {
        const older = `${this.config.logPath}.${i}`;
        const newer = i === 1 ? this.config.logPath : `${this.config.logPath}.${i - 1}`;

        if (existsSync(newer)) {
          if (existsSync(older)) {
            // Delete oldest if at limit
          }
          renameSync(newer, older);
        }
      }
    } catch (err) {
      console.error("[SecurityAuditLog] Rotation failed:", err);
    }
  }

  /**
   * Check if event should be logged to console
   */
  private shouldLogToConsole(severity: SecurityEventSeverity): boolean {
    if (this.config.consoleLevel === "none") return false;
    return SEVERITY_LEVELS[severity] <= SEVERITY_LEVELS[this.config.consoleLevel];
  }

  /**
   * Log entry to console
   */
  private logToConsole(entry: SecurityLogEntry): void {
    const prefix = `[SECURITY:${entry.severity.toUpperCase()}]`;
    const timestamp = new Date(entry.timestamp).toISOString();
    const message = `${prefix} ${timestamp} ${entry.event}`;

    switch (entry.severity) {
      case "critical":
      case "high":
        console.error(message, entry.details);
        break;
      case "medium":
        console.warn(message, entry.details);
        break;
      default:
        console.log(message, entry.details);
    }
  }
}

// Singleton instance
let defaultLogger: SecurityAuditLog | null = null;

/**
 * Get or create the default audit logger
 */
export function getAuditLogger(config?: Partial<AuditLoggerConfig>): SecurityAuditLog {
  if (!defaultLogger) {
    defaultLogger = new SecurityAuditLog(config);
  }
  return defaultLogger;
}

/**
 * Log a security event using the default logger
 */
export function logSecurityEvent(event: SecurityEvent): SecurityLogEntry {
  return getAuditLogger().log(event);
}
