/**
 * MeshGuard Audit Logger
 *
 * Records all tool invocations and policy decisions.
 * Supports file-based logging with optional API submission.
 */

import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditEvent, EvaluationContext, PolicyDecision, AuditConfig } from "../types.js";

export class AuditLogger {
  private agentId: string;
  private auditFile?: string;
  private apiUrl?: string;
  private apiKey?: string;
  private config: AuditConfig;
  private buffer: AuditEvent[] = [];
  private flushInterval?: ReturnType<typeof setInterval>;

  constructor(options: {
    agentId: string;
    auditFile?: string;
    apiUrl?: string;
    apiKey?: string;
    config?: Partial<AuditConfig>;
  }) {
    this.agentId = options.agentId;
    this.auditFile = options.auditFile;
    this.apiUrl = options.apiUrl;
    this.apiKey = options.apiKey;
    this.config = {
      log_level: options.config?.log_level || "standard",
      retention_days: options.config?.retention_days || 90,
      sensitive_fields: options.config?.sensitive_fields || [
        "api_key",
        "token",
        "password",
        "secret",
      ],
      redact_pii: options.config?.redact_pii ?? true,
    };

    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  /**
   * Log a tool invocation
   */
  async log(
    context: EvaluationContext,
    decision: PolicyDecision,
    result?: { success: boolean; error?: string; duration_ms?: number },
  ): Promise<void> {
    const event: AuditEvent = {
      id: randomUUID(),
      timestamp: Date.now(),
      agentId: this.agentId,
      tool: context.tool,
      args: this.redactSensitive(context.args),
      source: context.source,
      decision,
      result,
    };

    this.buffer.push(event);

    // Immediate flush for denials or critical alerts
    if (decision.effect === "deny" || decision.alertSeverity === "critical") {
      await this.flush();
    }
  }

  /**
   * Redact sensitive fields from args
   */
  private redactSensitive(args: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.config.sensitive_fields.some((field) =>
        lowerKey.includes(field.toLowerCase()),
      );

      if (isSensitive) {
        redacted[key] = "[REDACTED]";
      } else if (typeof value === "string" && value.length > 500) {
        // Truncate long strings
        redacted[key] = value.substring(0, 500) + "...[truncated]";
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = this.redactSensitive(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Flush buffer to storage
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    // Write to file
    if (this.auditFile) {
      try {
        await mkdir(dirname(this.auditFile), { recursive: true });
        const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
        await appendFile(this.auditFile, lines);
      } catch (error) {
        console.error("[meshguard] Failed to write audit file:", error);
        // Re-add events to buffer
        this.buffer.unshift(...events);
      }
    }

    // Submit to API
    if (this.apiUrl && this.apiKey) {
      try {
        await fetch(`${this.apiUrl}/v1/audit/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ events }),
        });
      } catch (error) {
        console.error("[meshguard] Failed to submit audit to API:", error);
      }
    }
  }

  /**
   * Get recent events (for debugging)
   */
  getRecentEvents(limit = 10): AuditEvent[] {
    return this.buffer.slice(-limit);
  }

  /**
   * Cleanup on shutdown
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}
