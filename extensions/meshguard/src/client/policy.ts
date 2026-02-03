/**
 * MeshGuard Policy Evaluation Engine
 *
 * Evaluates tool invocations against policy rules.
 * Supports pattern matching, domain allowlists, and chat boundaries.
 */

import type {
  PolicySet,
  PolicyRule,
  EvaluationContext,
  PolicyDecision,
  PolicyEffect,
} from "../types.js";

export class PolicyEngine {
  private policies: PolicySet;

  constructor(policies: PolicySet) {
    this.policies = policies;
  }

  /**
   * Evaluate a tool invocation against the policy set
   */
  evaluate(context: EvaluationContext): PolicyDecision {
    // Default: allow with logging
    let decision: PolicyDecision = {
      effect: "allow",
      shouldLog: true,
      shouldAlert: false,
    };

    // Check each policy rule
    for (const rule of this.policies.policies) {
      if (this.ruleMatches(rule, context)) {
        decision = {
          effect: rule.effect,
          matchedRule: rule.name,
          reason: rule.description || rule.rationale,
          shouldLog: rule.log !== false,
          shouldAlert: !!rule.alert,
          alertSeverity:
            typeof rule.alert === "string" ? rule.alert : rule.alert ? "warning" : undefined,
        };

        // If deny, stop checking (deny takes precedence)
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
  private ruleMatches(rule: PolicyRule, context: EvaluationContext): boolean {
    const conditions = rule.conditions;
    if (!conditions) return false;

    // Check tool match
    if (conditions.tool) {
      const toolMatches = conditions.tool.includes(context.tool);
      // For allow rules, tool must be in list
      // For deny rules with tool conditions, tool must be in list
      if (rule.effect === "allow" && !toolMatches) return false;
      if (rule.effect === "deny" && !toolMatches) return false;
    }

    // Check command patterns (for exec tool)
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

    // Check domain (for web_fetch, browser, http requests)
    if (conditions.domain) {
      const url = this.extractUrl(context);
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          const domainMatches = conditions.domain.some((d) => {
            if (d === "*") return true;
            return hostname === d || hostname.endsWith("." + d);
          });
          if (
            rule.effect === "deny" &&
            conditions.domain.includes("*") &&
            !conditions.domain.some(
              (d) => d !== "*" && (hostname === d || hostname.endsWith("." + d)),
            )
          ) {
            // Deny all except specific domains - check if NOT in allowlist
            return true;
          }
          if (!domainMatches) return false;
        } catch {
          // Invalid URL, skip domain check
        }
      }
    }

    // Check chat ID (for message, telegram actions)
    if (conditions.chat_id && context.source.chatId) {
      const chatMatches = conditions.chat_id.includes(context.source.chatId);
      if (rule.effect === "deny" && !chatMatches) return false;
      if (rule.effect === "allow" && !chatMatches) return false;
    }

    // Check workspace (for CRM, file access)
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
  private extractUrl(context: EvaluationContext): string | null {
    const args = context.args;
    return String(args.url || args.targetUrl || args.href || "") || null;
  }

  /**
   * Extract workspace identifier from context
   */
  private extractWorkspace(context: EvaluationContext): string | null {
    const args = context.args;
    // Check for Twenty CRM workspace in URL
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
  getPolicyInfo(): { agent: string; version: string; ruleCount: number } {
    return {
      agent: this.policies.agent,
      version: this.policies.version,
      ruleCount: this.policies.policies.length,
    };
  }
}
