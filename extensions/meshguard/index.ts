/**
 * MeshGuard Plugin for OpenClaw
 *
 * AI Agent Governance - Policy enforcement, audit logging, and alerting.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

// ============================================
// Types
// ============================================

type PolicyEffect = "allow" | "deny";
type AlertSeverity = "info" | "warning" | "critical";

interface PolicyCondition {
  tool?: string[];
  command_pattern?: string[];
  domain?: string[];
  chat_id?: number[];
  workspace?: string[];
}

interface PolicyRule {
  name: string;
  description?: string;
  resource: string;
  conditions?: PolicyCondition;
  effect: PolicyEffect;
  alert?: boolean | AlertSeverity;
  log?: boolean;
  rationale?: string;
}

interface PolicySet {
  agent: string;
  version: string;
  policies: PolicyRule[];
  audit?: {
    log_level: string;
    retention_days: number;
    sensitive_fields: string[];
    redact_pii: boolean;
  };
}

interface AuditEvent {
  id: string;
  timestamp: number;
  agentId: string;
  tool: string;
  args: Record<string, unknown>;
  decision: {
    effect: PolicyEffect;
    matchedRule?: string;
    reason?: string;
  };
  result?: {
    success: boolean;
    error?: string;
    duration_ms?: number;
  };
}

// ============================================
// Config Schema
// ============================================

const configSchema = z.object({
  enabled: z.boolean().default(true),
  agentId: z.string(),
  policyFile: z.string().optional(),
  auditFile: z.string().optional(),
  alertTelegram: z
    .object({
      botToken: z.string(),
      chatId: z.number(),
    })
    .optional(),
});

type MeshGuardConfig = z.infer<typeof configSchema>;

// ============================================
// Policy Engine
// ============================================

class PolicyEngine {
  constructor(private policies: PolicySet) {}

  evaluate(
    toolName: string,
    args: Record<string, unknown>,
  ): {
    effect: PolicyEffect;
    matchedRule?: string;
    reason?: string;
    shouldAlert: boolean;
    alertSeverity?: AlertSeverity;
  } {
    for (const rule of this.policies.policies) {
      if (this.ruleMatches(rule, toolName, args)) {
        return {
          effect: rule.effect,
          matchedRule: rule.name,
          reason: rule.description || rule.rationale,
          shouldAlert: !!rule.alert,
          alertSeverity:
            typeof rule.alert === "string" ? rule.alert : rule.alert ? "warning" : undefined,
        };
      }
    }
    return { effect: "allow", shouldAlert: false };
  }

  private ruleMatches(rule: PolicyRule, toolName: string, args: Record<string, unknown>): boolean {
    const conditions = rule.conditions;
    if (!conditions) return false;

    // Check tool match
    if (conditions.tool) {
      if (rule.effect === "allow" && !conditions.tool.includes(toolName)) return false;
      if (rule.effect === "deny" && !conditions.tool.includes(toolName)) return false;
    }

    // Check command patterns (for exec tool)
    if (conditions.command_pattern && toolName === "exec") {
      const command = String(args.command || "");
      const patternMatches = conditions.command_pattern.some((pattern) => {
        try {
          return new RegExp(pattern).test(command);
        } catch {
          return command.includes(pattern);
        }
      });
      if (rule.effect === "deny" && !patternMatches) return false;
    }

    // Check domain (for web requests)
    if (conditions.domain) {
      const url = String(args.url || args.targetUrl || "");
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          const matches = conditions.domain.some(
            (d) => d === "*" || hostname === d || hostname.endsWith("." + d),
          );
          if (!matches) return false;
        } catch {
          /* ignore invalid URLs */
        }
      }
    }

    return true;
  }
}

// ============================================
// Plugin
// ============================================

let policyEngine: PolicyEngine | null = null;
let config: MeshGuardConfig | null = null;
let sensitiveFields: string[] = [
  "api_key",
  "apiKey",
  "token",
  "password",
  "secret",
  "authorization",
];

function redactSensitive(args: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    const isSensitive = sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()));
    if (isSensitive) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 500) {
      redacted[key] = value.substring(0, 500) + "...[truncated]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

async function sendTelegramAlert(event: AuditEvent, severity: AlertSeverity): Promise<void> {
  if (!config?.alertTelegram) return;

  const { botToken, chatId } = config.alertTelegram;
  const emoji = { info: "ℹ️", warning: "⚠️", critical: "🚨" }[severity];

  const message = `${emoji} **MeshGuard Alert**

**Agent:** ${event.agentId}
**Tool:** ${event.tool}
**Decision:** 🚫 ${event.decision.effect.toUpperCase()}
**Rule:** ${event.decision.matchedRule || "unknown"}
**Reason:** ${event.decision.reason || "Policy violation"}

_${new Date(event.timestamp).toISOString()}_`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (error) {
    console.error("[meshguard] Telegram alert failed:", error);
  }
}

function logAudit(event: AuditEvent): void {
  if (!config?.auditFile) return;

  try {
    mkdirSync(dirname(config.auditFile), { recursive: true });
    appendFileSync(config.auditFile, JSON.stringify(event) + "\n");
  } catch (error) {
    console.error("[meshguard] Audit write failed:", error);
  }
}

const plugin = {
  id: "meshguard",
  name: "MeshGuard",
  description: "AI Agent Governance - Policy enforcement, audit logging, and alerting",
  configSchema,

  register(api: OpenClawPluginApi<MeshGuardConfig>) {
    config = api.config;

    if (!config.enabled) {
      console.log("[meshguard] Extension disabled");
      return;
    }

    console.log(`[meshguard] Initializing for agent: ${config.agentId}`);

    // Load policy file
    if (config.policyFile) {
      try {
        const content = readFileSync(config.policyFile, "utf-8");
        const policySet = parseYaml(content) as PolicySet;
        policyEngine = new PolicyEngine(policySet);

        if (policySet.audit?.sensitive_fields) {
          sensitiveFields = policySet.audit.sensitive_fields;
        }

        console.log(`[meshguard] Loaded ${policySet.policies.length} policy rules`);
      } catch (error) {
        console.error("[meshguard] Failed to load policy file:", error);
      }
    }

    // Register before_tool_call hook
    api.on("before_tool_call", async (event, ctx) => {
      if (!policyEngine || !config) return;

      const decision = policyEngine.evaluate(event.toolName, event.params);

      if (decision.effect === "deny") {
        const auditEvent: AuditEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
          agentId: config.agentId,
          tool: event.toolName,
          args: redactSensitive(event.params),
          decision: {
            effect: decision.effect,
            matchedRule: decision.matchedRule,
            reason: decision.reason,
          },
          result: { success: false, error: "Policy denied" },
        };

        logAudit(auditEvent);

        if (decision.shouldAlert) {
          await sendTelegramAlert(auditEvent, decision.alertSeverity || "warning");
        }

        return {
          block: true,
          blockReason: `[MeshGuard] Blocked by policy "${decision.matchedRule}": ${decision.reason || "Access denied"}`,
        };
      }
    });

    // Register after_tool_call hook for audit logging
    api.on("after_tool_call", (event, ctx) => {
      if (!policyEngine || !config?.auditFile) return;

      const decision = policyEngine.evaluate(event.toolName, event.params);

      const auditEvent: AuditEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        agentId: config.agentId,
        tool: event.toolName,
        args: redactSensitive(event.params),
        decision: {
          effect: decision.effect,
          matchedRule: decision.matchedRule,
          reason: decision.reason,
        },
        result: {
          success: !event.error,
          error: event.error,
          duration_ms: event.durationMs,
        },
      };

      logAudit(auditEvent);
    });

    console.log("[meshguard] Hooks registered");
  },
};

export default plugin;
