// src/index.ts
import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";

// src/client/policy.ts
var PolicyEngine = class {
  policies;
  constructor(policies) {
    this.policies = policies;
  }
  /**
   * Evaluate a tool invocation against the policy set
   */
  evaluate(context) {
    let decision = {
      effect: "allow",
      shouldLog: true,
      shouldAlert: false
    };
    for (const rule of this.policies.policies) {
      if (this.ruleMatches(rule, context)) {
        decision = {
          effect: rule.effect,
          matchedRule: rule.name,
          reason: rule.description || rule.rationale,
          shouldLog: rule.log !== false,
          shouldAlert: !!rule.alert,
          alertSeverity: typeof rule.alert === "string" ? rule.alert : rule.alert ? "warning" : void 0
        };
        if (rule.effect === "deny") {
          break;
        }
      }
    }
    return decision;
  }
  /**
   * Check if a rule matches the current context
   */
  ruleMatches(rule, context) {
    const conditions = rule.conditions;
    if (!conditions) return false;
    if (conditions.tool) {
      const toolMatches = conditions.tool.includes(context.tool);
      if (rule.effect === "allow" && !toolMatches) return false;
      if (rule.effect === "deny" && !toolMatches) return false;
    }
    if (conditions.command_pattern && context.tool === "exec") {
      const command = String(context.args.command || "");
      const patternMatches = conditions.command_pattern.some((pattern) => {
        try {
          const regex = new RegExp(pattern);
          return regex.test(command);
        } catch {
          return command.includes(pattern);
        }
      });
      if (rule.effect === "deny" && !patternMatches) return false;
      if (rule.effect === "allow" && !patternMatches) return false;
    }
    if (conditions.domain) {
      const url = this.extractUrl(context);
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          const domainMatches = conditions.domain.some((d) => {
            if (d === "*") return true;
            return hostname === d || hostname.endsWith("." + d);
          });
          if (rule.effect === "deny" && conditions.domain.includes("*") && !conditions.domain.some((d) => d !== "*" && (hostname === d || hostname.endsWith("." + d)))) {
            return true;
          }
          if (!domainMatches) return false;
        } catch {
        }
      }
    }
    if (conditions.chat_id && context.source.chatId) {
      const chatMatches = conditions.chat_id.includes(context.source.chatId);
      if (rule.effect === "deny" && !chatMatches) return false;
      if (rule.effect === "allow" && !chatMatches) return false;
    }
    if (conditions.workspace) {
      const workspace = this.extractWorkspace(context);
      if (workspace) {
        const workspaceMatches = conditions.workspace.includes(workspace);
        if (rule.effect === "deny" && !workspaceMatches) return false;
        if (rule.effect === "allow" && !workspaceMatches) return false;
      }
    }
    return true;
  }
  /**
   * Extract URL from context args
   */
  extractUrl(context) {
    const args = context.args;
    return String(args.url || args.targetUrl || args.href || "") || null;
  }
  /**
   * Extract workspace identifier from context
   */
  extractWorkspace(context) {
    const args = context.args;
    const url = String(args.baseUrl || args.url || "");
    if (url.includes("mollified.app")) {
      const match = url.match(/(\w+)\.mollified\.app/);
      if (match) return match[0];
    }
    return null;
  }
  /**
   * Get the policy set metadata
   */
  getPolicyInfo() {
    return {
      agent: this.policies.agent,
      version: this.policies.version,
      ruleCount: this.policies.policies.length
    };
  }
};

// src/client/audit.ts
import { appendFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { randomUUID } from "crypto";
var AuditLogger = class {
  agentId;
  auditFile;
  apiUrl;
  apiKey;
  config;
  buffer = [];
  flushInterval;
  constructor(options) {
    this.agentId = options.agentId;
    this.auditFile = options.auditFile;
    this.apiUrl = options.apiUrl;
    this.apiKey = options.apiKey;
    this.config = {
      log_level: options.config?.log_level || "standard",
      retention_days: options.config?.retention_days || 90,
      sensitive_fields: options.config?.sensitive_fields || ["api_key", "token", "password", "secret"],
      redact_pii: options.config?.redact_pii ?? true
    };
    this.flushInterval = setInterval(() => this.flush(), 5e3);
  }
  /**
   * Log a tool invocation
   */
  async log(context, decision, result) {
    const event = {
      id: randomUUID(),
      timestamp: Date.now(),
      agentId: this.agentId,
      tool: context.tool,
      args: this.redactSensitive(context.args),
      source: context.source,
      decision,
      result
    };
    this.buffer.push(event);
    if (decision.effect === "deny" || decision.alertSeverity === "critical") {
      await this.flush();
    }
  }
  /**
   * Redact sensitive fields from args
   */
  redactSensitive(args) {
    const redacted = {};
    for (const [key, value] of Object.entries(args)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.config.sensitive_fields.some(
        (field) => lowerKey.includes(field.toLowerCase())
      );
      if (isSensitive) {
        redacted[key] = "[REDACTED]";
      } else if (typeof value === "string" && value.length > 500) {
        redacted[key] = value.substring(0, 500) + "...[truncated]";
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = this.redactSensitive(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }
  /**
   * Flush buffer to storage
   */
  async flush() {
    if (this.buffer.length === 0) return;
    const events = [...this.buffer];
    this.buffer = [];
    if (this.auditFile) {
      try {
        await mkdir(dirname(this.auditFile), { recursive: true });
        const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
        await appendFile(this.auditFile, lines);
      } catch (error) {
        console.error("[meshguard] Failed to write audit file:", error);
        this.buffer.unshift(...events);
      }
    }
    if (this.apiUrl && this.apiKey) {
      try {
        await fetch(`${this.apiUrl}/v1/audit/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({ events })
        });
      } catch (error) {
        console.error("[meshguard] Failed to submit audit to API:", error);
      }
    }
  }
  /**
   * Get recent events (for debugging)
   */
  getRecentEvents(limit = 10) {
    return this.buffer.slice(-limit);
  }
  /**
   * Cleanup on shutdown
   */
  async close() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
};

// src/client/alerts.ts
var AlertManager = class {
  options;
  agentId;
  constructor(agentId, options) {
    this.agentId = agentId;
    this.options = options;
  }
  /**
   * Send an alert for a policy violation
   */
  async alert(event) {
    const severity = event.decision.alertSeverity || "warning";
    const message = this.formatMessage(event, severity);
    if (this.options.telegram) {
      await this.sendTelegram(message, severity);
    }
    if (this.options.webhook) {
      await this.sendWebhook(event);
    }
  }
  /**
   * Format alert message
   */
  formatMessage(event, severity) {
    const emoji = {
      info: "\u2139\uFE0F",
      warning: "\u26A0\uFE0F",
      critical: "\u{1F6A8}"
    }[severity];
    const effectEmoji = event.decision.effect === "deny" ? "\u{1F6AB}" : "\u2705";
    let message = `${emoji} **MeshGuard Alert**

`;
    message += `**Agent:** ${event.agentId}
`;
    message += `**Tool:** ${event.tool}
`;
    message += `**Decision:** ${effectEmoji} ${event.decision.effect.toUpperCase()}
`;
    if (event.decision.matchedRule) {
      message += `**Rule:** ${event.decision.matchedRule}
`;
    }
    if (event.decision.reason) {
      message += `**Reason:** ${event.decision.reason}
`;
    }
    if (event.source.username) {
      message += `**Triggered by:** @${event.source.username}
`;
    }
    if (event.source.chatId) {
      message += `**Chat ID:** ${event.source.chatId}
`;
    }
    const argsStr = JSON.stringify(event.args);
    if (argsStr.length > 200) {
      message += `**Args:** ${argsStr.substring(0, 200)}...
`;
    } else {
      message += `**Args:** ${argsStr}
`;
    }
    message += `
_${new Date(event.timestamp).toISOString()}_`;
    return message;
  }
  /**
   * Send alert via Telegram
   */
  async sendTelegram(message, severity) {
    const { botToken, chatId } = this.options.telegram;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown",
            disable_notification: severity === "info"
          })
        }
      );
      if (!response.ok) {
        const error = await response.text();
        console.error("[meshguard] Telegram alert failed:", error);
      }
    } catch (error) {
      console.error("[meshguard] Telegram alert error:", error);
    }
  }
  /**
   * Send alert via webhook
   */
  async sendWebhook(event) {
    try {
      const response = await fetch(this.options.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "meshguard.alert",
          event,
          timestamp: Date.now()
        })
      });
      if (!response.ok) {
        console.error("[meshguard] Webhook alert failed:", response.status);
      }
    } catch (error) {
      console.error("[meshguard] Webhook alert error:", error);
    }
  }
};

// src/index.ts
var policyEngine = null;
var auditLogger = null;
var alertManager = null;
var config = null;
var pendingInvocations = /* @__PURE__ */ new Map();
async function init(extensionConfig) {
  if (!extensionConfig.enabled) {
    console.log("[meshguard] Extension disabled");
    return;
  }
  config = extensionConfig;
  console.log(`[meshguard] Initializing for agent: ${config.agentId}`);
  let policySet;
  if (config.policySet) {
    policySet = config.policySet;
  } else if (config.policyFile) {
    const content = await readFile(config.policyFile, "utf-8");
    policySet = parseYaml(content);
  } else {
    throw new Error("[meshguard] No policySet or policyFile configured");
  }
  policyEngine = new PolicyEngine(policySet);
  const policyInfo = policyEngine.getPolicyInfo();
  console.log(`[meshguard] Loaded ${policyInfo.ruleCount} policy rules for ${policyInfo.agent}`);
  auditLogger = new AuditLogger({
    agentId: config.agentId,
    auditFile: config.auditFile,
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    config: policySet.audit
  });
  if (config.alertTelegram) {
    alertManager = new AlertManager(config.agentId, {
      telegram: config.alertTelegram
    });
    console.log(`[meshguard] Alerts configured for Telegram chat ${config.alertTelegram.chatId}`);
  }
  console.log("[meshguard] Extension initialized");
}
async function beforeTool(toolName, args, source) {
  if (!policyEngine || !config) {
    return { allowed: true };
  }
  const context = {
    agentId: config.agentId,
    tool: toolName,
    args,
    source: source || {},
    timestamp: Date.now()
  };
  const decision = policyEngine.evaluate(context);
  const invocationId = `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  pendingInvocations.set(invocationId, {
    context,
    startTime: Date.now(),
    decision
  });
  args.__meshguardInvocationId = invocationId;
  if (decision.effect === "deny") {
    await auditLogger?.log(context, decision, { success: false, error: "Policy denied" });
    if (decision.shouldAlert && alertManager) {
      await alertManager.alert({
        id: invocationId,
        timestamp: context.timestamp,
        agentId: config.agentId,
        tool: toolName,
        args,
        source: context.source,
        decision
      });
    }
    return {
      allowed: false,
      reason: `[MeshGuard] Blocked by policy "${decision.matchedRule}": ${decision.reason || "Access denied"}`
    };
  }
  return { allowed: true };
}
async function afterTool(toolName, args, result) {
  if (!auditLogger || !config) return;
  const invocationId = args.__meshguardInvocationId;
  const pending = invocationId ? pendingInvocations.get(invocationId) : null;
  if (pending) {
    const duration_ms = Date.now() - pending.startTime;
    await auditLogger.log(pending.context, pending.decision, {
      success: result.success,
      error: result.error,
      duration_ms
    });
    pendingInvocations.delete(invocationId);
  }
}
async function shutdown() {
  await auditLogger?.close();
  console.log("[meshguard] Extension shutdown");
}
export {
  AlertManager,
  AuditLogger,
  PolicyEngine,
  afterTool,
  beforeTool,
  init,
  shutdown
};
