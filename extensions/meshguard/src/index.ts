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

import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { MeshGuardConfig, PolicySet, EvaluationContext, PolicyDecision } from "./types.js";
import { AlertManager } from "./client/alerts.js";
import { AuditLogger } from "./client/audit.js";
import { PolicyEngine } from "./client/policy.js";

// Extension state
let policyEngine: PolicyEngine | null = null;
let auditLogger: AuditLogger | null = null;
let alertManager: AlertManager | null = null;
let config: MeshGuardConfig | null = null;

// Track in-flight tool invocations for timing
const pendingInvocations = new Map<
  string,
  { context: EvaluationContext; startTime: number; decision: PolicyDecision }
>();

/**
 * Initialize the MeshGuard extension
 */
export async function init(extensionConfig: MeshGuardConfig): Promise<void> {
  if (!extensionConfig.enabled) {
    console.log("[meshguard] Extension disabled");
    return;
  }

  config = extensionConfig;
  console.log(`[meshguard] Initializing for agent: ${config.agentId}`);

  // Load policy set
  let policySet: PolicySet;
  if (config.policySet) {
    policySet = config.policySet;
  } else if (config.policyFile) {
    const content = await readFile(config.policyFile, "utf-8");
    policySet = parseYaml(content) as PolicySet;
  } else {
    throw new Error("[meshguard] No policySet or policyFile configured");
  }

  // Initialize components
  policyEngine = new PolicyEngine(policySet);
  const policyInfo = policyEngine.getPolicyInfo();
  console.log(`[meshguard] Loaded ${policyInfo.ruleCount} policy rules for ${policyInfo.agent}`);

  auditLogger = new AuditLogger({
    agentId: config.agentId,
    auditFile: config.auditFile,
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    config: policySet.audit,
  });

  if (config.alertTelegram) {
    alertManager = new AlertManager(config.agentId, {
      telegram: config.alertTelegram,
    });
    console.log(`[meshguard] Alerts configured for Telegram chat ${config.alertTelegram.chatId}`);
  }

  console.log("[meshguard] Extension initialized");
}

/**
 * Pre-tool hook: Evaluate policy before tool execution
 */
export async function beforeTool(
  toolName: string,
  args: Record<string, unknown>,
  source?: { channel?: string; chatId?: number; userId?: number; username?: string },
): Promise<{ allowed: boolean; reason?: string }> {
  if (!policyEngine || !config) {
    return { allowed: true }; // No policy = allow all
  }

  const context: EvaluationContext = {
    agentId: config.agentId,
    tool: toolName,
    args,
    source: source || {},
    timestamp: Date.now(),
  };

  const decision = policyEngine.evaluate(context);
  const invocationId = `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Store for afterTool
  pendingInvocations.set(invocationId, {
    context,
    startTime: Date.now(),
    decision,
  });

  // Attach invocationId to args for afterTool to retrieve
  (args as Record<string, unknown>).__meshguardInvocationId = invocationId;

  if (decision.effect === "deny") {
    // Log the denial
    await auditLogger?.log(context, decision, { success: false, error: "Policy denied" });

    // Send alert if configured
    if (decision.shouldAlert && alertManager) {
      await alertManager.alert({
        id: invocationId,
        timestamp: context.timestamp,
        agentId: config.agentId,
        tool: toolName,
        args,
        source: context.source,
        decision,
      });
    }

    return {
      allowed: false,
      reason: `[MeshGuard] Blocked by policy "${decision.matchedRule}": ${decision.reason || "Access denied"}`,
    };
  }

  return { allowed: true };
}

/**
 * Post-tool hook: Log result after tool execution
 */
export async function afterTool(
  toolName: string,
  args: Record<string, unknown>,
  result: { success: boolean; error?: string },
): Promise<void> {
  if (!auditLogger || !config) return;

  const invocationId = (args as Record<string, unknown>).__meshguardInvocationId as string;
  const pending = invocationId ? pendingInvocations.get(invocationId) : null;

  if (pending) {
    const duration_ms = Date.now() - pending.startTime;
    await auditLogger.log(pending.context, pending.decision, {
      success: result.success,
      error: result.error,
      duration_ms,
    });
    pendingInvocations.delete(invocationId);
  }
}

/**
 * Shutdown hook
 */
export async function shutdown(): Promise<void> {
  await auditLogger?.close();
  console.log("[meshguard] Extension shutdown");
}

// Export types
export type {
  MeshGuardConfig,
  PolicySet,
  PolicyRule,
  EvaluationContext,
  PolicyDecision,
} from "./types.js";

// Export components for advanced usage
export { PolicyEngine } from "./client/policy.js";
export { AuditLogger } from "./client/audit.js";
export { AlertManager } from "./client/alerts.js";
