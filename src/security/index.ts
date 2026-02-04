/**
 * Security modules index
 * Re-exports all security utilities
 */

// Types
export * from "./types.js";

// Audit Logger
export {
  SecurityAuditLog,
  getAuditLogger,
  logSecurityEvent,
  type AuditLoggerConfig,
} from "./audit-logger.js";

// Rate Limiter
export {
  RateLimiter,
  getRateLimiter,
  rateLimitMiddleware,
} from "./rate-limiter.js";

// Command Execution Guard
export {
  CommandExecutionGuard,
  getCommandGuard,
  type CommandGuardConfig,
} from "./command-guard.js";

// Network Access Policy
export {
  NetworkAccessPolicy,
  getNetworkPolicy,
  type NetworkPolicyConfig,
} from "./network-policy.js";

// Secrets Vault
export {
  SecretsVault,
  getSecretsVault,
  type SecretsVaultConfig,
} from "./secrets-vault.js";

// Prompt Injection Detector
export {
  PromptInjectionDetector,
  getPromptInjectionDetector,
  scanForInjection,
  type PromptInjectionConfig,
} from "./prompt-injection.js";

// Session Access Control
export {
  SessionAccessControl,
  getSessionACL,
  type SessionACLConfig,
} from "./session-acl.js";
