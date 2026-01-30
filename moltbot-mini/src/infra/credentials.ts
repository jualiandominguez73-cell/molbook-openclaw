/**
 * Secure credential storage.
 *
 * Security principles:
 * - File permissions: 0o600 (owner read/write only)
 * - Atomic writes: temp file + rename to prevent corruption
 * - Secrets not kept in memory longer than needed
 */

import { getCredentialsPath } from '../config/config-paths.js';
import { atomicWriteSecure, readSecureFile } from '../config/io.js';

/**
 * Credential store structure.
 */
export interface CredentialStore {
  openaiApiKey?: string;
  gmail?: GmailCredentials;
}

/**
 * Gmail OAuth credentials and tokens.
 */
export interface GmailCredentials {
  oauth?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
  };
}

/**
 * Load credentials from secure storage.
 */
export function loadCredentials(): CredentialStore {
  const content = readSecureFile(getCredentialsPath());

  if (!content) {
    return {};
  }

  return JSON.parse(content) as CredentialStore;
}

/**
 * Save credentials to secure storage.
 */
export function saveCredentials(credentials: CredentialStore): void {
  const data = JSON.stringify(credentials, null, 2);
  atomicWriteSecure(getCredentialsPath(), data);
}

/**
 * Update specific credential fields.
 */
export function updateCredentials(updates: Partial<CredentialStore>): void {
  const current = loadCredentials();
  const updated = { ...current, ...updates };

  // Deep merge for gmail credentials
  if (updates.gmail) {
    updated.gmail = {
      ...current.gmail,
      ...updates.gmail,
    };
  }

  saveCredentials(updated);
}

/**
 * Check if OpenAI API key is configured.
 */
export function hasOpenAIKey(): boolean {
  const creds = loadCredentials();
  return Boolean(creds.openaiApiKey);
}

/**
 * Get OpenAI API key.
 */
export function getOpenAIKey(): string | undefined {
  // Check environment variable first
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  const creds = loadCredentials();
  return creds.openaiApiKey;
}

/**
 * Set OpenAI API key.
 */
export function setOpenAIKey(key: string): void {
  updateCredentials({ openaiApiKey: key });
}

/**
 * Check if Gmail OAuth is configured.
 */
export function hasGmailOAuth(): boolean {
  const creds = loadCredentials();
  return Boolean(creds.gmail?.oauth?.clientId && creds.gmail?.oauth?.clientSecret);
}

/**
 * Check if Gmail has valid tokens.
 */
export function hasGmailTokens(): boolean {
  const creds = loadCredentials();
  return Boolean(creds.gmail?.tokens?.accessToken && creds.gmail?.tokens?.refreshToken);
}

/**
 * Get Gmail OAuth credentials.
 */
export function getGmailOAuth(): GmailCredentials['oauth'] | undefined {
  // Check environment variables first
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
    return {
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      redirectUri: 'http://localhost',
    };
  }

  const creds = loadCredentials();
  return creds.gmail?.oauth;
}

/**
 * Set Gmail OAuth credentials.
 */
export function setGmailOAuth(oauth: GmailCredentials['oauth']): void {
  const current = loadCredentials();
  updateCredentials({
    gmail: {
      ...current.gmail,
      oauth,
    },
  });
}

/**
 * Get Gmail tokens.
 */
export function getGmailTokens(): GmailCredentials['tokens'] | undefined {
  const creds = loadCredentials();
  return creds.gmail?.tokens;
}

/**
 * Set Gmail tokens.
 */
export function setGmailTokens(tokens: GmailCredentials['tokens']): void {
  const current = loadCredentials();
  updateCredentials({
    gmail: {
      ...current.gmail,
      tokens,
    },
  });
}

/**
 * Clear Gmail tokens.
 */
export function clearGmailTokens(): void {
  const current = loadCredentials();
  if (current.gmail) {
    updateCredentials({
      gmail: {
        ...current.gmail,
        tokens: undefined,
      },
    });
  }
}
