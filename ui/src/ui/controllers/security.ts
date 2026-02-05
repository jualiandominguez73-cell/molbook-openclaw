/**
 * Security monitoring controller for the dashboard.
 *
 * Fetches security events, alerts, and statistics from the gateway.
 */

import type { GatewayBrowserClient } from "../gateway.ts";

// Types matching the backend security events
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

export type SecurityEventSeverity = "critical" | "high" | "medium" | "low" | "info";

export type SecurityEvent = {
  id: string;
  timestamp: number;
  category: SecurityEventCategory;
  severity: SecurityEventSeverity;
  action: string;
  description: string;
  source: string;
  sessionKey?: string;
  agentId?: string;
  userId?: string;
  ipAddress?: string;
  channel?: string;
  context?: Record<string, unknown>;
  blocked?: boolean;
  relatedEvents?: string[];
};

export type SecurityEventStats = {
  totalEvents: number;
  byCategory: Partial<Record<SecurityEventCategory, number>>;
  bySeverity: Partial<Record<SecurityEventSeverity, number>>;
  blockedCount: number;
  timeRange: {
    start: number | null;
    end: number | null;
  };
};

export type SecuritySummary = {
  period: string;
  totalEvents: number;
  criticalCount: number;
  highCount: number;
  blockedCount: number;
  recentAlerts: SecurityEvent[];
  recentBlocked: SecurityEvent[];
  status: "healthy" | "warning" | "critical";
};

export type SecurityAuditFinding = {
  checkId: string;
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
  remediation?: string;
};

export type SecurityAuditReport = {
  status: "healthy" | "warning" | "critical";
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  findings: SecurityAuditFinding[];
};

export type SecurityState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  securityLoading: boolean;
  securityError: string | null;
  securitySummary: SecuritySummary | null;
  securityStats: SecurityEventStats | null;
  securityEvents: SecurityEvent[];
  securityAlerts: SecurityEvent[];
  securityBlocked: SecurityEvent[];
  securityAudit: SecurityAuditReport | null;
  securityAuditLoading: boolean;
  securityFilterCategory: SecurityEventCategory | "all";
  securityFilterSeverity: SecurityEventSeverity | "all";
  securityFilterTimeRange: "1h" | "24h" | "7d" | "30d" | "all";
  securityActiveTab: "summary" | "events" | "alerts" | "blocked" | "audit";
  securityEventsPage: number;
  securityEventsPerPage: number;
};

type RawSecuritySummaryResponse = {
  period?: string;
  totalEvents?: number;
  criticalCount?: number;
  highCount?: number;
  blockedCount?: number;
  recentAlerts?: SecurityEvent[];
  recentBlocked?: SecurityEvent[];
  status?: string;
};

type RawSecurityStatsResponse = {
  totalEvents?: number;
  byCategory?: Partial<Record<SecurityEventCategory, number>>;
  bySeverity?: Partial<Record<SecurityEventSeverity, number>>;
  blockedCount?: number;
  timeRange?: { start?: number | null; end?: number | null };
};

type RawSecurityEventsResponse = {
  events?: SecurityEvent[];
  count?: number;
};

type RawSecurityAuditResponse = {
  status?: string;
  totalFindings?: number;
  criticalCount?: number;
  warningCount?: number;
  infoCount?: number;
  findings?: SecurityAuditFinding[];
};

/**
 * Load security summary (24h overview).
 */
export async function loadSecuritySummary(state: SecurityState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.securityLoading) {
    return;
  }
  state.securityLoading = true;
  state.securityError = null;

  try {
    const raw = await state.client.request<RawSecuritySummaryResponse | undefined>(
      "security.summary",
      {},
    );
    if (!raw) {
      state.securitySummary = null;
      return;
    }
    state.securitySummary = {
      period: raw.period ?? "24h",
      totalEvents: raw.totalEvents ?? 0,
      criticalCount: raw.criticalCount ?? 0,
      highCount: raw.highCount ?? 0,
      blockedCount: raw.blockedCount ?? 0,
      recentAlerts: raw.recentAlerts ?? [],
      recentBlocked: raw.recentBlocked ?? [],
      status: (raw.status as SecuritySummary["status"]) ?? "healthy",
    };
  } catch (err) {
    state.securityError = String(err);
  } finally {
    state.securityLoading = false;
  }
}

/**
 * Load security statistics for a time range.
 */
export async function loadSecurityStats(state: SecurityState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }

  try {
    const params: Record<string, unknown> = {};
    const now = Date.now();

    switch (state.securityFilterTimeRange) {
      case "1h":
        params.startTime = now - 60 * 60 * 1000;
        break;
      case "24h":
        params.startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "7d":
        params.startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "30d":
        params.startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      // "all" - no startTime filter
    }

    const raw = await state.client.request<RawSecurityStatsResponse | undefined>(
      "security.events.stats",
      params,
    );
    if (!raw) {
      state.securityStats = null;
      return;
    }
    state.securityStats = {
      totalEvents: raw.totalEvents ?? 0,
      byCategory: raw.byCategory ?? {},
      bySeverity: raw.bySeverity ?? {},
      blockedCount: raw.blockedCount ?? 0,
      timeRange: {
        start: raw.timeRange?.start ?? null,
        end: raw.timeRange?.end ?? null,
      },
    };
  } catch (err) {
    state.securityError = String(err);
  }
}

/**
 * Load security events with filters.
 */
export async function loadSecurityEvents(state: SecurityState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  state.securityLoading = true;
  state.securityError = null;

  try {
    const params: Record<string, unknown> = {
      limit: state.securityEventsPerPage,
      offset: state.securityEventsPage * state.securityEventsPerPage,
    };

    const now = Date.now();
    switch (state.securityFilterTimeRange) {
      case "1h":
        params.startTime = now - 60 * 60 * 1000;
        break;
      case "24h":
        params.startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "7d":
        params.startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "30d":
        params.startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    if (state.securityFilterCategory !== "all") {
      params.categories = [state.securityFilterCategory];
    }
    if (state.securityFilterSeverity !== "all") {
      params.severities = [state.securityFilterSeverity];
    }

    const raw = await state.client.request<RawSecurityEventsResponse | undefined>(
      "security.events.query",
      params,
    );
    state.securityEvents = raw?.events ?? [];
  } catch (err) {
    state.securityError = String(err);
  } finally {
    state.securityLoading = false;
  }
}

/**
 * Load recent security alerts (high and critical).
 */
export async function loadSecurityAlerts(state: SecurityState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  state.securityLoading = true;
  state.securityError = null;

  try {
    const raw = await state.client.request<RawSecurityEventsResponse | undefined>(
      "security.alerts",
      { limit: 100 },
    );
    state.securityAlerts =
      raw?.events ?? (raw as unknown as { alerts?: SecurityEvent[] })?.alerts ?? [];
  } catch (err) {
    state.securityError = String(err);
  } finally {
    state.securityLoading = false;
  }
}

/**
 * Load blocked security events.
 */
export async function loadSecurityBlocked(state: SecurityState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  state.securityLoading = true;
  state.securityError = null;

  try {
    const raw = await state.client.request<RawSecurityEventsResponse | undefined>(
      "security.blocked",
      { limit: 100 },
    );
    state.securityBlocked = raw?.events ?? [];
  } catch (err) {
    state.securityError = String(err);
  } finally {
    state.securityLoading = false;
  }
}

/**
 * Run a security audit.
 */
export async function runSecurityAudit(state: SecurityState, deep = false): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  state.securityAuditLoading = true;
  state.securityError = null;

  try {
    const raw = await state.client.request<RawSecurityAuditResponse | undefined>("security.audit", {
      deep,
    });
    if (!raw) {
      state.securityAudit = null;
      return;
    }
    state.securityAudit = {
      status: (raw.status as SecurityAuditReport["status"]) ?? "healthy",
      totalFindings: raw.totalFindings ?? 0,
      criticalCount: raw.criticalCount ?? 0,
      warningCount: raw.warningCount ?? 0,
      infoCount: raw.infoCount ?? 0,
      findings: raw.findings ?? [],
    };
  } catch (err) {
    state.securityError = String(err);
  } finally {
    state.securityAuditLoading = false;
  }
}

/**
 * Load all security data for the current tab.
 */
export async function loadSecurityData(state: SecurityState): Promise<void> {
  switch (state.securityActiveTab) {
    case "summary":
      await Promise.all([loadSecuritySummary(state), loadSecurityStats(state)]);
      break;
    case "events":
      await loadSecurityEvents(state);
      break;
    case "alerts":
      await loadSecurityAlerts(state);
      break;
    case "blocked":
      await loadSecurityBlocked(state);
      break;
    case "audit":
      await runSecurityAudit(state, false);
      break;
  }
}

/**
 * Get severity color class.
 */
export function severityColor(severity: SecurityEventSeverity): string {
  switch (severity) {
    case "critical":
      return "var(--danger)";
    case "high":
      return "var(--danger)";
    case "medium":
      return "var(--warn)";
    case "low":
      return "var(--ok)";
    case "info":
      return "var(--muted)";
    default:
      return "var(--muted)";
  }
}

/**
 * Get category icon name.
 */
export function categoryIcon(category: SecurityEventCategory): string {
  switch (category) {
    case "authentication":
      return "lock";
    case "authorization":
      return "shield";
    case "access_control":
      return "eye";
    case "command_execution":
      return "monitor";
    case "network":
      return "globe";
    case "file_system":
      return "folder";
    case "configuration":
      return "settings";
    case "session":
      return "fileText";
    case "rate_limit":
      return "activity";
    case "injection":
      return "ban";
    case "anomaly":
      return "alertTriangle";
    case "audit":
      return "scrollText";
    default:
      return "shield";
  }
}

/**
 * Format timestamp for display.
 */
export function formatSecurityTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return "just now";
  }
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
