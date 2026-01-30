/**
 * Configuration loading and management.
 */

import type { Config } from './types.js';
import { ConfigSchema } from './zod-schema.js';
import { getConfigPath, getStateDir, getCredentialsDir, getSessionsDir } from './config-paths.js';
import { atomicWriteSecure, ensureSecureDir, readSecureFile } from './io.js';

/**
 * Initialize the state directory structure.
 */
export function initializeStateDir(): void {
  ensureSecureDir(getStateDir());
  ensureSecureDir(getCredentialsDir());
  ensureSecureDir(getSessionsDir());
}

/**
 * Load configuration with validation.
 * Returns default config if file doesn't exist.
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();
  const content = readSecureFile(configPath);

  if (!content) {
    // Return default config
    return ConfigSchema.parse({});
  }

  const parsed = JSON.parse(content);

  // Validate with Zod
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Config validation errors:', result.error.format());
    throw new Error('Invalid configuration file');
  }

  return result.data;
}

/**
 * Save configuration with validation.
 */
export function saveConfig(config: Config): void {
  // Validate before saving
  const validated = ConfigSchema.parse(config);
  const data = JSON.stringify(validated, null, 2);
  atomicWriteSecure(getConfigPath(), data);
}

/**
 * Update specific config fields (deep merge).
 */
export function updateConfig(updates: Partial<Config>): Config {
  const current = loadConfig();

  const updated: Config = {
    gmail: { ...current.gmail, ...updates.gmail },
    openai: { ...current.openai, ...updates.openai },
    agent: { ...current.agent, ...updates.agent },
  };

  saveConfig(updated);
  return updated;
}

/**
 * Reset config to defaults.
 */
export function resetConfig(): Config {
  const config = ConfigSchema.parse({});
  saveConfig(config);
  return config;
}
