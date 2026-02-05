/**
 * Security Agent Tools for OpenClaw.
 *
 * Provides tools that the cybersecurity agent can use to monitor
 * and analyze system security events.
 */

import { Type } from "@sinclair/typebox";
import { loadConfig } from "../config/config.js";
import { runSecurityAudit } from "../security/audit.js";
import {
  querySecurityEvents,
  getSecurityEventStats,
  getRecentSecurityAlerts,
  getBlockedEvents,
  getSessionSecurityEvents,
  getEventsByIpAddress,
  type SecurityEventQueryOptions,
} from "../security/events-store.js";
import { type SecurityEventCategory, type SecurityEventSeverity } from "../security/events.js";
import {
  type AnyAgentTool,
  jsonResult,
  readStringParam,
  readNumberParam,
  readStringArrayParam,
} from "./tools/common.js";

// Valid categories and severities for validation
const VALID_CATEGORIES = new Set<SecurityEventCategory>([
  "authentication",
  "authorization",
  "access_control",
  "command_execution",
  "network",
  "file_system",
  "configuration",
  "session",
  "rate_limit",
  "injection",
  "anomaly",
  "audit",
]);

const VALID_SEVERITIES = new Set<SecurityEventSeverity>([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

/**
 * Tool to query security events with filters.
 */
export function createSecurityEventsQueryTool(): AnyAgentTool {
  return {
    label: "Security",
    name: "security_events_query",
    description: `Query security events from the system log with optional filters.
Returns a list of security events matching the specified criteria.

Use this tool to:
- Search for events by category (authentication, injection, command_execution, etc.)
- Filter by severity level (critical, high, medium, low, info)
- Find events for a specific session, user, or IP address
- Search for events within a time range
- Find blocked/prevented security threats`,
    parameters: Type.Object({
      startTime: Type.Optional(Type.Number({ description: "Start timestamp (Unix milliseconds)" })),
      endTime: Type.Optional(Type.Number({ description: "End timestamp (Unix milliseconds)" })),
      categories: Type.Optional(
        Type.Array(Type.String(), { description: "Filter by event categories" }),
      ),
      severities: Type.Optional(
        Type.Array(Type.String(), { description: "Filter by severity levels" }),
      ),
      sessionKey: Type.Optional(Type.String({ description: "Filter by session key" })),
      userId: Type.Optional(Type.String({ description: "Filter by user/sender ID" })),
      ipAddress: Type.Optional(Type.String({ description: "Filter by IP address" })),
      channel: Type.Optional(
        Type.String({ description: "Filter by channel (telegram, discord, etc.)" }),
      ),
      action: Type.Optional(
        Type.String({ description: "Filter by action (supports * prefix matching)" }),
      ),
      blockedOnly: Type.Optional(
        Type.Boolean({ description: "Only return blocked/prevented events" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum events to return (default: 100, max: 500)" }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const options: SecurityEventQueryOptions = {
        startTime: readNumberParam(params, "startTime"),
        endTime: readNumberParam(params, "endTime"),
        sessionKey: readStringParam(params, "sessionKey"),
        userId: readStringParam(params, "userId"),
        ipAddress: readStringParam(params, "ipAddress"),
        channel: readStringParam(params, "channel"),
        action: readStringParam(params, "action"),
        blockedOnly: params.blockedOnly === true,
        limit: Math.min(readNumberParam(params, "limit") ?? 100, 500),
        sortOrder: "desc",
      };

      // Validate and filter categories
      const rawCategories = readStringArrayParam(params, "categories");
      if (rawCategories) {
        options.categories = rawCategories.filter((c) =>
          VALID_CATEGORIES.has(c as SecurityEventCategory),
        ) as SecurityEventCategory[];
      }

      // Validate and filter severities
      const rawSeverities = readStringArrayParam(params, "severities");
      if (rawSeverities) {
        options.severities = rawSeverities.filter((s) =>
          VALID_SEVERITIES.has(s as SecurityEventSeverity),
        ) as SecurityEventSeverity[];
      }

      const events = await querySecurityEvents(options);

      return jsonResult({
        count: events.length,
        events: events.map((e) => ({
          id: e.id,
          timestamp: new Date(e.timestamp).toISOString(),
          category: e.category,
          severity: e.severity,
          action: e.action,
          description: e.description,
          source: e.source,
          blocked: e.blocked,
          sessionKey: e.sessionKey,
          userId: e.userId,
          ipAddress: e.ipAddress,
          channel: e.channel,
        })),
      });
    },
  };
}

/**
 * Tool to get security event statistics.
 */
export function createSecurityStatsTool(): AnyAgentTool {
  return {
    label: "Security",
    name: "security_stats",
    description: `Get statistics about security events.

Returns aggregated counts of events by category and severity, total blocked events,
and the time range of events. Use this to get a high-level overview of security status.`,
    parameters: Type.Object({
      startTime: Type.Optional(Type.Number({ description: "Start timestamp (Unix milliseconds)" })),
      endTime: Type.Optional(Type.Number({ description: "End timestamp (Unix milliseconds)" })),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const stats = await getSecurityEventStats({
        startTime: readNumberParam(params, "startTime"),
        endTime: readNumberParam(params, "endTime"),
      });

      return jsonResult({
        totalEvents: stats.totalEvents,
        blockedCount: stats.blockedCount,
        byCategory: stats.byCategory,
        bySeverity: stats.bySeverity,
        timeRange: {
          start: stats.timeRange.start ? new Date(stats.timeRange.start).toISOString() : null,
          end: stats.timeRange.end ? new Date(stats.timeRange.end).toISOString() : null,
        },
      });
    },
  };
}

/**
 * Tool to get recent security alerts.
 */
export function createSecurityAlertsTool(): AnyAgentTool {
  return {
    label: "Security",
    name: "security_alerts",
    description: `Get recent security alerts (high and critical severity events).

Returns the most recent high-priority security events that may require attention.
Use this to check if there are any active security threats or incidents.`,
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({ description: "Maximum alerts to return (default: 50, max: 200)" }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const limit = Math.min(readNumberParam(params, "limit") ?? 50, 200);
      const alerts = await getRecentSecurityAlerts(limit);

      return jsonResult({
        count: alerts.length,
        alerts: alerts.map((e) => ({
          id: e.id,
          timestamp: new Date(e.timestamp).toISOString(),
          severity: e.severity,
          category: e.category,
          action: e.action,
          description: e.description,
          source: e.source,
          blocked: e.blocked,
          context: e.context,
        })),
      });
    },
  };
}

/**
 * Tool to get blocked security events.
 */
export function createSecurityBlockedTool(): AnyAgentTool {
  return {
    label: "Security",
    name: "security_blocked",
    description: `Get blocked/prevented security events.

Returns events where a potential attack or unauthorized action was blocked.
Use this to analyze attack patterns and verify that security controls are working.`,
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({ description: "Maximum events to return (default: 50, max: 200)" }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const limit = Math.min(readNumberParam(params, "limit") ?? 50, 200);
      const events = await getBlockedEvents(limit);

      return jsonResult({
        count: events.length,
        blockedEvents: events.map((e) => ({
          id: e.id,
          timestamp: new Date(e.timestamp).toISOString(),
          severity: e.severity,
          category: e.category,
          action: e.action,
          description: e.description,
          source: e.source,
          context: e.context,
        })),
      });
    },
  };
}

/**
 * Tool to investigate a specific session's security events.
 */
export function createSecuritySessionTool(): AnyAgentTool {
  return {
    label: "Security",
    name: "security_session_investigate",
    description: `Investigate security events for a specific session.

Use this to analyze all security-related events for a particular session key.
Helpful for understanding what happened during a suspicious session.`,
    parameters: Type.Object({
      sessionKey: Type.String({ description: "The session key to investigate" }),
      limit: Type.Optional(
        Type.Number({ description: "Maximum events to return (default: 100, max: 500)" }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const sessionKey = readStringParam(params, "sessionKey", { required: true });
      const limit = Math.min(readNumberParam(params, "limit") ?? 100, 500);
      const events = await getSessionSecurityEvents(sessionKey, limit);

      return jsonResult({
        sessionKey,
        count: events.length,
        events: events.map((e) => ({
          id: e.id,
          timestamp: new Date(e.timestamp).toISOString(),
          severity: e.severity,
          category: e.category,
          action: e.action,
          description: e.description,
          source: e.source,
          blocked: e.blocked,
          context: e.context,
        })),
      });
    },
  };
}

/**
 * Tool to investigate events from a specific IP address.
 */
export function createSecurityIpInvestigateTool(): AnyAgentTool {
  return {
    label: "Security",
    name: "security_ip_investigate",
    description: `Investigate security events from a specific IP address.

Use this to analyze activity from a suspicious IP address.
Helpful for detecting attack patterns or compromised clients.`,
    parameters: Type.Object({
      ipAddress: Type.String({ description: "The IP address to investigate" }),
      limit: Type.Optional(
        Type.Number({ description: "Maximum events to return (default: 100, max: 500)" }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const ipAddress = readStringParam(params, "ipAddress", { required: true });
      const limit = Math.min(readNumberParam(params, "limit") ?? 100, 500);
      const events = await getEventsByIpAddress(ipAddress, limit);

      return jsonResult({
        ipAddress,
        count: events.length,
        events: events.map((e) => ({
          id: e.id,
          timestamp: new Date(e.timestamp).toISOString(),
          severity: e.severity,
          category: e.category,
          action: e.action,
          description: e.description,
          source: e.source,
          blocked: e.blocked,
          sessionKey: e.sessionKey,
          userId: e.userId,
        })),
      });
    },
  };
}

/**
 * Tool to run a security audit.
 */
export function createSecurityAuditTool(): AnyAgentTool {
  return {
    label: "Security",
    name: "security_audit",
    description: `Run a security audit on the current system configuration.

Returns a list of security findings categorized by severity (critical, warn, info).
Use this to identify potential security misconfigurations or vulnerabilities.`,
    parameters: Type.Object({
      deep: Type.Optional(
        Type.Boolean({ description: "Perform deep probe (checks live connectivity)" }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const deep = params.deep === true;

      const cfg = loadConfig();
      const report = await runSecurityAudit({
        config: cfg,
        deep,
      });

      const formatFindings = (findings: typeof report.findings) =>
        findings.map((f) => ({
          checkId: f.checkId,
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          remediation: f.remediation,
        }));

      return jsonResult({
        status: report.findings.some((f) => f.severity === "critical")
          ? "critical"
          : report.findings.some((f) => f.severity === "warn")
            ? "warning"
            : "healthy",
        totalFindings: report.findings.length,
        criticalCount: report.findings.filter((f) => f.severity === "critical").length,
        warningCount: report.findings.filter((f) => f.severity === "warn").length,
        infoCount: report.findings.filter((f) => f.severity === "info").length,
        findings: formatFindings(report.findings),
      });
    },
  };
}

/**
 * Tool to get a security summary.
 */
export function createSecuritySummaryTool(): AnyAgentTool {
  return {
    label: "Security",
    name: "security_summary",
    description: `Get a quick security status summary for the last 24 hours.

Returns an overview including total events, critical/high counts, blocked events,
and recent alerts. Use this for a quick health check of system security.`,
    parameters: Type.Object({}),
    execute: async () => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const [stats, recentAlerts, blockedEvents] = await Promise.all([
        getSecurityEventStats({ startTime: oneDayAgo }),
        getRecentSecurityAlerts(5),
        getBlockedEvents(5),
      ]);

      const criticalCount = stats.bySeverity.critical ?? 0;
      const highCount = stats.bySeverity.high ?? 0;

      return jsonResult({
        period: "24h",
        status: criticalCount > 0 ? "critical" : highCount > 0 ? "warning" : "healthy",
        totalEvents: stats.totalEvents,
        criticalCount,
        highCount,
        blockedCount: stats.blockedCount,
        byCategory: stats.byCategory,
        recentAlerts: recentAlerts.map((e) => ({
          timestamp: new Date(e.timestamp).toISOString(),
          severity: e.severity,
          description: e.description,
        })),
        recentBlocked: blockedEvents.map((e) => ({
          timestamp: new Date(e.timestamp).toISOString(),
          category: e.category,
          description: e.description,
        })),
      });
    },
  };
}

/**
 * Get all security agent tools.
 */
export function listSecurityAgentTools(): AnyAgentTool[] {
  return [
    createSecurityEventsQueryTool(),
    createSecurityStatsTool(),
    createSecurityAlertsTool(),
    createSecurityBlockedTool(),
    createSecuritySessionTool(),
    createSecurityIpInvestigateTool(),
    createSecurityAuditTool(),
    createSecuritySummaryTool(),
  ];
}
