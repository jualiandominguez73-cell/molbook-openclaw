/**
 * Safe Executor Configuration
 */

import * as nodeFs from "node:fs";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";

export type RateLimitingConfig = {
  maxRequestsPerMinute?: number;
  maxConcurrent?: number;
  cooldownMs?: number;
};

export type SafeExecutorConfig = {
  /** Whether the safe executor is enabled */
  enabled: boolean;
  /** Bot's own user IDs (for self-message rejection) */
  selfIds: string[];
  /** Default working directory for skill execution */
  workdir: string;
  /** Allowed hosts for fetch capability */
  allowedHosts?: string[];
  /** Rate limiting configuration */
  rateLimiting?: RateLimitingConfig;
};

const DEFAULT_RATE_LIMITING: RateLimitingConfig = {
  maxRequestsPerMinute: 10,
  maxConcurrent: 2,
  cooldownMs: 30000,
};

export const DEFAULT_SAFE_EXECUTOR_CONFIG: SafeExecutorConfig = {
  enabled: false,
  selfIds: [],
  workdir: process.cwd(),
  allowedHosts: [],
  rateLimiting: DEFAULT_RATE_LIMITING,
};

const CONFIG_PATH = nodePath.join(nodeOs.homedir(), ".openclaw", "safe-executor.json");

export function loadSafeExecutorConfig(): SafeExecutorConfig {
  try {
    if (nodeFs.existsSync(CONFIG_PATH)) {
      const raw = nodeFs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      // Deep merge rateLimiting to preserve defaults
      const rateLimiting = {
        ...DEFAULT_RATE_LIMITING,
        ...parsed.rateLimiting,
      };
      return {
        ...DEFAULT_SAFE_EXECUTOR_CONFIG,
        ...parsed,
        rateLimiting,
      };
    }
  } catch {
    // Ignore errors, use defaults
  }
  return DEFAULT_SAFE_EXECUTOR_CONFIG;
}
