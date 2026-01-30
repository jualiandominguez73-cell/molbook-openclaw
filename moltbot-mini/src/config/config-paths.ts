/**
 * Configuration file paths.
 *
 * Follows Moltbot pattern: ~/.moltbot-mini/ as state directory.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Get the state directory path.
 * Can be overridden via MOLTBOT_MINI_STATE_DIR environment variable.
 */
export function getStateDir(): string {
  return process.env.MOLTBOT_MINI_STATE_DIR || join(homedir(), '.moltbot-mini');
}

/**
 * Get the config file path.
 */
export function getConfigPath(): string {
  return join(getStateDir(), 'config.json');
}

/**
 * Get the credentials directory path.
 */
export function getCredentialsDir(): string {
  return join(getStateDir(), 'credentials');
}

/**
 * Get the credentials file path.
 */
export function getCredentialsPath(): string {
  return join(getCredentialsDir(), 'credentials.json');
}

/**
 * Get the sessions directory path.
 */
export function getSessionsDir(): string {
  return join(getStateDir(), 'sessions');
}

/**
 * Get the agents directory path.
 */
export function getAgentsDir(): string {
  return join(getStateDir(), 'agents');
}

/**
 * Get the Gmail tokens path.
 */
export function getGmailTokensPath(): string {
  return join(getCredentialsDir(), 'gmail-tokens.json');
}

/**
 * Get the Gmail OAuth credentials path.
 */
export function getGmailOAuthPath(): string {
  return join(getCredentialsDir(), 'gmail-oauth.json');
}
