/**
 * Security module types and interfaces
 */

// ============================================================================
// Security Event Types
// ============================================================================

export type SecurityEventSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface SecurityEvent {
  /** Event identifier */
  event: string;
  /** Severity level */
  severity: SecurityEventSeverity;
  /** User or session identifier */
  userId?: string;
  /** Session key */
  sessionKey?: string;
  /** IP address */
  ipAddress?: string;
  /** Event details */
  details: Record<string, unknown>;
  /** Additional context */
  context?: Record<string, unknown>;
}

export interface SecurityLogEntry extends SecurityEvent {
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Unique entry ID */
  entryId: string;
  /** HMAC signature for tamper detection */
  signature?: string;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Requests per hour */
  requestsPerHour: number;
  /** Requests per day */
  requestsPerDay: number;
  /** Burst allowance */
  burstSize: number;
  /** Adaptive throttling threshold */
  throttleThreshold: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Seconds until limit resets */
  retryAfter?: number;
  /** Current window usage */
  usage: {
    minute: number;
    hour: number;
    day: number;
  };
}

// ============================================================================
// Command Execution Types
// ============================================================================

export interface CommandPolicy {
  /** Allowed command patterns (glob) */
  allowlist: string[];
  /** Blocked command patterns (glob) */
  blocklist: string[];
  /** Environment variables to strip */
  denyEnvVars: string[];
  /** Commands requiring confirmation */
  requireConfirmation: string[];
  /** Maximum execution time (seconds) */
  maxExecutionTime: number;
  /** Allow network access */
  allowNetwork: boolean;
  /** Allow file writes outside workspace */
  allowExternalWrites: boolean;
}

export interface CommandAuthResult {
  /** Whether command is allowed */
  allowed: boolean;
  /** Reason for decision */
  reason?: string;
  /** Whether confirmation is required */
  requiresConfirmation: boolean;
  /** Sanitized command */
  sanitizedCommand?: string;
  /** Sanitized environment */
  sanitizedEnv?: Record<string, string>;
}

// ============================================================================
// Network Access Types
// ============================================================================

export interface NetworkPolicy {
  /** Allowed domains */
  allowedDomains: string[];
  /** Blocked IP ranges (CIDR) */
  blockedIpRanges: string[];
  /** Block private IPs */
  blockPrivateIPs: boolean;
  /** Block cloud metadata endpoints */
  blockCloudMetadata: boolean;
  /** Require TLS */
  requireTLS: boolean;
  /** DNS rebinding protection */
  dnsRebindingProtection: boolean;
}

export interface NetworkAccessResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason for decision */
  reason?: string;
  /** Resolved IP address */
  resolvedIP?: string;
  /** Whether TLS is valid */
  tlsValid?: boolean;
}

// ============================================================================
// Secrets Vault Types
// ============================================================================

export interface VaultConfig {
  /** Encryption algorithm */
  algorithm: "aes-256-gcm";
  /** Key derivation function */
  kdf: "argon2id" | "pbkdf2";
  /** Key rotation interval (days) */
  rotationIntervalDays: number;
  /** Use OS keychain */
  useKeychain: boolean;
}

export interface VaultEntry {
  /** Encrypted value */
  ciphertext: string;
  /** Initialization vector */
  iv: string;
  /** Authentication tag */
  authTag: string;
  /** Key version */
  keyVersion: number;
  /** Created timestamp */
  createdAt: number;
  /** Last accessed timestamp */
  lastAccessedAt?: number;
}

// ============================================================================
// Prompt Injection Types
// ============================================================================

export interface InjectionScanResult {
  /** Whether input is safe */
  safe: boolean;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Reason for detection */
  reason?: string;
  /** Detected patterns */
  detectedPatterns?: string[];
  /** Sanitized input (if available) */
  sanitizedInput?: string;
}

export interface InjectionPattern {
  /** Pattern name */
  name: string;
  /** Regex pattern */
  pattern: RegExp;
  /** Severity if matched */
  severity: SecurityEventSeverity;
  /** Action to take */
  action: "block" | "warn" | "sanitize";
}

// ============================================================================
// Session Access Control Types
// ============================================================================

export interface SessionACLEntry {
  /** Source session */
  fromSession: string;
  /** Target session */
  toSession: string;
  /** Allowed operations */
  operations: Array<"read" | "write" | "message">;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Capability token */
  capabilityToken?: string;
}

export interface ACLResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason for decision */
  reason?: string;
  /** Required capability */
  requiredCapability?: string;
}

// ============================================================================
// Security Configuration
// ============================================================================

export interface SecurityConfig {
  /** Enable security features */
  enabled: boolean;
  /** Rate limiting config */
  rateLimit: RateLimitConfig;
  /** Command execution policy */
  commandPolicy: CommandPolicy;
  /** Network access policy */
  networkPolicy: NetworkPolicy;
  /** Vault configuration */
  vault: VaultConfig;
  /** Audit log settings */
  audit: {
    enabled: boolean;
    logPath: string;
    retentionDays: number;
    signEntries: boolean;
  };
  /** Feature flags */
  features: {
    commandGuard: boolean;
    rateLimiting: boolean;
    ssrfProtection: boolean;
    promptInjectionDetection: boolean;
    sessionACL: boolean;
    secretsEncryption: boolean;
  };
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  requestsPerDay: 10000,
  burstSize: 10,
  throttleThreshold: 0.8,
};

export const DEFAULT_COMMAND_POLICY: CommandPolicy = {
  allowlist: ["*"],
  blocklist: [
    "rm -rf /",
    "rm -rf /*",
    ":(){ :|:& };:",
    "mkfs.*",
    "dd if=/dev/zero",
    "> /dev/sda",
  ],
  denyEnvVars: [
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "DYLD_INSERT_LIBRARIES",
    "NODE_OPTIONS",
    "BASH_ENV",
    "ENV",
    "PROMPT_COMMAND",
  ],
  requireConfirmation: [
    "rm -rf *",
    "sudo *",
    "chmod 777 *",
    "curl * | bash",
    "wget * | bash",
  ],
  maxExecutionTime: 300,
  allowNetwork: true,
  allowExternalWrites: false,
};

export const DEFAULT_NETWORK_POLICY: NetworkPolicy = {
  allowedDomains: [],
  blockedIpRanges: [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "169.254.0.0/16",
    "127.0.0.0/8",
    "::1/128",
    "fc00::/7",
    "fe80::/10",
  ],
  blockPrivateIPs: true,
  blockCloudMetadata: true,
  requireTLS: false,
  dnsRebindingProtection: true,
};
