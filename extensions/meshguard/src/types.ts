/**
 * MeshGuard Types
 * AI Agent Governance for OpenClaw
 */

// Policy effect outcomes
export type PolicyEffect = "allow" | "deny" | "approval_required";
export type AlertSeverity = "info" | "warning" | "critical";

// Policy condition types
export interface PolicyCondition {
  tool?: string[];
  command_pattern?: string[];
  domain?: string[];
  chat_id?: number[];
  workspace?: string[];
  resource?: string[];
}

// Individual policy rule
export interface PolicyRule {
  name: string;
  description?: string;
  resource: string;
  conditions?: PolicyCondition;
  actions?: string[];
  effect: PolicyEffect;
  alert?: boolean | AlertSeverity;
  log?: boolean;
  rationale?: string;
}

// Audit configuration
export interface AuditConfig {
  log_level: "minimal" | "standard" | "verbose";
  retention_days: number;
  sensitive_fields: string[];
  redact_pii: boolean;
}

// Alert configuration
export interface AlertConfig {
  name: string;
  channels: ("telegram" | "email" | "webhook")[];
  recipients?: {
    telegram?: number[];
    email?: string[];
    webhook?: string[];
  };
  severity: AlertSeverity[];
}

// Complete policy set for an agent
export interface PolicySet {
  agent: string;
  version: string;
  policies: PolicyRule[];
  audit?: AuditConfig;
  alerts?: AlertConfig[];
}

// Evaluation context passed to policy engine
export interface EvaluationContext {
  agentId: string;
  tool: string;
  args: Record<string, unknown>;
  source: {
    channel?: string;
    chatId?: number;
    userId?: number;
    username?: string;
  };
  timestamp: number;
}

// Policy evaluation result
export interface PolicyDecision {
  effect: PolicyEffect;
  matchedRule?: string;
  reason?: string;
  shouldLog: boolean;
  shouldAlert: boolean;
  alertSeverity?: AlertSeverity;
}

// Audit event
export interface AuditEvent {
  id: string;
  timestamp: number;
  agentId: string;
  tool: string;
  args: Record<string, unknown>;
  source: EvaluationContext["source"];
  decision: PolicyDecision;
  result?: {
    success: boolean;
    error?: string;
    duration_ms?: number;
  };
}

// Extension configuration
export interface MeshGuardConfig {
  enabled: boolean;
  agentId: string;
  policyFile?: string;
  policySet?: PolicySet;
  apiKey?: string;
  apiUrl?: string;
  auditFile?: string;
  alertTelegram?: {
    botToken: string;
    chatId: number;
  };
}
