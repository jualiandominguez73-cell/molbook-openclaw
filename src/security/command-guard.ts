/**
 * Command Execution Guard
 * Enforces strict allowlisting and capability-based access control for shell commands
 */

import { minimatch } from "minimatch";
import type { CommandPolicy, CommandAuthResult } from "./types.js";
import { DEFAULT_COMMAND_POLICY } from "./types.js";
import { getAuditLogger } from "./audit-logger.js";

export interface CommandGuardConfig {
  /** Command policy */
  policy: CommandPolicy;
  /** Enable audit logging */
  enableAudit: boolean;
  /** Confirmation callback */
  onConfirmation?: (command: string) => Promise<boolean>;
}

const DEFAULT_CONFIG: CommandGuardConfig = {
  policy: DEFAULT_COMMAND_POLICY,
  enableAudit: true,
};

export class CommandExecutionGuard {
  private config: CommandGuardConfig;

  constructor(config: Partial<CommandGuardConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      policy: { ...DEFAULT_COMMAND_POLICY, ...config.policy },
    };
  }

  /**
   * Authorize a command execution
   */
  async authorize(
    command: string,
    env: Record<string, string> = {},
    context?: { userId?: string; sessionKey?: string }
  ): Promise<CommandAuthResult> {
    const { policy } = this.config;

    // Check blocklist first (highest priority)
    const blockMatch = this.matchesAnyPattern(command, policy.blocklist);
    if (blockMatch) {
      this.logDecision(command, false, `Blocked by pattern: ${blockMatch}`, context);
      return {
        allowed: false,
        reason: `Command blocked: matches dangerous pattern "${blockMatch}"`,
        requiresConfirmation: false,
      };
    }

    // Check allowlist
    const allowMatch = this.matchesAnyPattern(command, policy.allowlist);
    if (!allowMatch && policy.allowlist.length > 0 && !policy.allowlist.includes("*")) {
      this.logDecision(command, false, "Not in allowlist", context);
      return {
        allowed: false,
        reason: "Command not in allowlist",
        requiresConfirmation: false,
      };
    }

    // Sanitize environment variables
    const sanitizedEnv = this.sanitizeEnv(env);
    const removedVars = Object.keys(env).filter((k) => !(k in sanitizedEnv));

    if (removedVars.length > 0) {
      getAuditLogger().info("env_vars_sanitized", {
        command,
        removedVars,
        ...context,
      });
    }

    // Check if confirmation is required
    const confirmMatch = this.matchesAnyPattern(command, policy.requireConfirmation);
    if (confirmMatch) {
      if (this.config.onConfirmation) {
        const confirmed = await this.config.onConfirmation(command);
        if (!confirmed) {
          this.logDecision(command, false, "User declined confirmation", context);
          return {
            allowed: false,
            reason: "Command requires confirmation - user declined",
            requiresConfirmation: true,
          };
        }
      } else {
        // No confirmation handler, require explicit confirmation
        return {
          allowed: false,
          reason: `Command requires confirmation: matches pattern "${confirmMatch}"`,
          requiresConfirmation: true,
          sanitizedCommand: command,
          sanitizedEnv,
        };
      }
    }

    // All checks passed
    this.logDecision(command, true, undefined, context);

    return {
      allowed: true,
      requiresConfirmation: false,
      sanitizedCommand: command,
      sanitizedEnv,
    };
  }

  /**
   * Sanitize environment variables
   */
  sanitizeEnv(env: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const { denyEnvVars } = this.config.policy;

    for (const [key, value] of Object.entries(env)) {
      // Check if env var is in deny list
      const isDenied = denyEnvVars.some((pattern) => {
        if (pattern.includes("*")) {
          return minimatch(key, pattern, { nocase: true });
        }
        return key.toUpperCase() === pattern.toUpperCase();
      });

      if (!isDenied) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if command matches any pattern
   */
  private matchesAnyPattern(command: string, patterns: string[]): string | null {
    for (const pattern of patterns) {
      if (this.matchesPattern(command, pattern)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Check if command matches a pattern
   */
  private matchesPattern(command: string, pattern: string): boolean {
    // Exact match
    if (command === pattern) return true;

    // Glob pattern
    if (pattern.includes("*")) {
      return minimatch(command, pattern, { nocase: true });
    }

    // Prefix match (command starts with pattern)
    if (command.startsWith(pattern)) return true;

    // Contains match (for dangerous substrings)
    if (command.includes(pattern)) return true;

    return false;
  }

  /**
   * Log authorization decision
   */
  private logDecision(
    command: string,
    allowed: boolean,
    reason: string | undefined,
    context?: { userId?: string; sessionKey?: string }
  ): void {
    if (!this.config.enableAudit) return;

    getAuditLogger().logCommandExecution({
      command,
      allowed,
      reason,
      userId: context?.userId,
      sessionKey: context?.sessionKey,
    });
  }

  /**
   * Parse command to extract the base command name
   */
  parseCommand(fullCommand: string): { base: string; args: string[] } {
    const parts = fullCommand.trim().split(/\s+/);
    const base = parts[0] || "";
    const args = parts.slice(1);

    return { base, args };
  }

  /**
   * Check if command uses pipes or redirects
   */
  hasPipesOrRedirects(command: string): boolean {
    return /[|><]/.test(command);
  }

  /**
   * Check if command runs in background
   */
  runsInBackground(command: string): boolean {
    return command.trim().endsWith("&");
  }

  /**
   * Get policy configuration
   */
  getPolicy(): CommandPolicy {
    return { ...this.config.policy };
  }

  /**
   * Update policy configuration
   */
  updatePolicy(updates: Partial<CommandPolicy>): void {
    this.config.policy = { ...this.config.policy, ...updates };
  }
}

// Singleton instance
let defaultGuard: CommandExecutionGuard | null = null;

/**
 * Get or create the default command guard
 */
export function getCommandGuard(config?: Partial<CommandGuardConfig>): CommandExecutionGuard {
  if (!defaultGuard) {
    defaultGuard = new CommandExecutionGuard(config);
  }
  return defaultGuard;
}
