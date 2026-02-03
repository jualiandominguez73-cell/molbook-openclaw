/**
 * MeshGuard Types
 * AI Agent Governance for OpenClaw
 */
type PolicyEffect = 'allow' | 'deny' | 'approval_required';
type AlertSeverity = 'info' | 'warning' | 'critical';
interface PolicyCondition {
    tool?: string[];
    command_pattern?: string[];
    domain?: string[];
    chat_id?: number[];
    workspace?: string[];
    resource?: string[];
}
interface PolicyRule {
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
interface AuditConfig {
    log_level: 'minimal' | 'standard' | 'verbose';
    retention_days: number;
    sensitive_fields: string[];
    redact_pii: boolean;
}
interface AlertConfig {
    name: string;
    channels: ('telegram' | 'email' | 'webhook')[];
    recipients?: {
        telegram?: number[];
        email?: string[];
        webhook?: string[];
    };
    severity: AlertSeverity[];
}
interface PolicySet {
    agent: string;
    version: string;
    policies: PolicyRule[];
    audit?: AuditConfig;
    alerts?: AlertConfig[];
}
interface EvaluationContext {
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
interface PolicyDecision {
    effect: PolicyEffect;
    matchedRule?: string;
    reason?: string;
    shouldLog: boolean;
    shouldAlert: boolean;
    alertSeverity?: AlertSeverity;
}
interface AuditEvent {
    id: string;
    timestamp: number;
    agentId: string;
    tool: string;
    args: Record<string, unknown>;
    source: EvaluationContext['source'];
    decision: PolicyDecision;
    result?: {
        success: boolean;
        error?: string;
        duration_ms?: number;
    };
}
interface MeshGuardConfig {
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

/**
 * MeshGuard Policy Evaluation Engine
 *
 * Evaluates tool invocations against policy rules.
 * Supports pattern matching, domain allowlists, and chat boundaries.
 */

declare class PolicyEngine {
    private policies;
    constructor(policies: PolicySet);
    /**
     * Evaluate a tool invocation against the policy set
     */
    evaluate(context: EvaluationContext): PolicyDecision;
    /**
     * Check if a rule matches the current context
     */
    private ruleMatches;
    /**
     * Extract URL from context args
     */
    private extractUrl;
    /**
     * Extract workspace identifier from context
     */
    private extractWorkspace;
    /**
     * Get the policy set metadata
     */
    getPolicyInfo(): {
        agent: string;
        version: string;
        ruleCount: number;
    };
}

/**
 * MeshGuard Audit Logger
 *
 * Records all tool invocations and policy decisions.
 * Supports file-based logging with optional API submission.
 */

declare class AuditLogger {
    private agentId;
    private auditFile?;
    private apiUrl?;
    private apiKey?;
    private config;
    private buffer;
    private flushInterval?;
    constructor(options: {
        agentId: string;
        auditFile?: string;
        apiUrl?: string;
        apiKey?: string;
        config?: Partial<AuditConfig>;
    });
    /**
     * Log a tool invocation
     */
    log(context: EvaluationContext, decision: PolicyDecision, result?: {
        success: boolean;
        error?: string;
        duration_ms?: number;
    }): Promise<void>;
    /**
     * Redact sensitive fields from args
     */
    private redactSensitive;
    /**
     * Flush buffer to storage
     */
    flush(): Promise<void>;
    /**
     * Get recent events (for debugging)
     */
    getRecentEvents(limit?: number): AuditEvent[];
    /**
     * Cleanup on shutdown
     */
    close(): Promise<void>;
}

/**
 * MeshGuard Alert System
 *
 * Sends alerts for policy violations via Telegram and other channels.
 */

interface AlertOptions {
    telegram?: {
        botToken: string;
        chatId: number;
    };
    webhook?: string;
}
declare class AlertManager {
    private options;
    private agentId;
    constructor(agentId: string, options: AlertOptions);
    /**
     * Send an alert for a policy violation
     */
    alert(event: AuditEvent): Promise<void>;
    /**
     * Format alert message
     */
    private formatMessage;
    /**
     * Send alert via Telegram
     */
    private sendTelegram;
    /**
     * Send alert via webhook
     */
    private sendWebhook;
}

/**
 * MeshGuard Extension for OpenClaw
 *
 * AI Agent Governance - Policy enforcement, audit logging, and alerting.
 *
 * @example
 * // In openclaw.json
 * {
 *   "extensions": ["meshguard"],
 *   "meshguard": {
 *     "enabled": true,
 *     "agentId": "savestate-sally",
 *     "policyFile": "./policies/sally.yaml",
 *     "auditFile": "./audit/sally.jsonl",
 *     "alertTelegram": {
 *       "botToken": "${TELEGRAM_BOT_TOKEN}",
 *       "chatId": 1191367022
 *     }
 *   }
 * }
 */

/**
 * Initialize the MeshGuard extension
 */
declare function init(extensionConfig: MeshGuardConfig): Promise<void>;
/**
 * Pre-tool hook: Evaluate policy before tool execution
 */
declare function beforeTool(toolName: string, args: Record<string, unknown>, source?: {
    channel?: string;
    chatId?: number;
    userId?: number;
    username?: string;
}): Promise<{
    allowed: boolean;
    reason?: string;
}>;
/**
 * Post-tool hook: Log result after tool execution
 */
declare function afterTool(toolName: string, args: Record<string, unknown>, result: {
    success: boolean;
    error?: string;
}): Promise<void>;
/**
 * Shutdown hook
 */
declare function shutdown(): Promise<void>;

export { AlertManager, AuditLogger, type EvaluationContext, type MeshGuardConfig, type PolicyDecision, PolicyEngine, type PolicyRule, type PolicySet, afterTool, beforeTool, init, shutdown };
