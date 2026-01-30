/**
 * Environment variable handling.
 */

/**
 * Environment variable names used by moltbot-mini.
 */
export const ENV_VARS = {
  // State directory override
  STATE_DIR: 'MOLTBOT_MINI_STATE_DIR',

  // OpenAI API key (alternative to config file)
  OPENAI_API_KEY: 'OPENAI_API_KEY',

  // Gmail OAuth (alternative to config file)
  GMAIL_CLIENT_ID: 'GMAIL_CLIENT_ID',
  GMAIL_CLIENT_SECRET: 'GMAIL_CLIENT_SECRET',
} as const;

/**
 * Get environment variable value.
 */
export function getEnvVar(name: keyof typeof ENV_VARS): string | undefined {
  return process.env[ENV_VARS[name]];
}

/**
 * Check if running in CI environment.
 */
export function isCI(): boolean {
  return Boolean(process.env.CI);
}

/**
 * Check if running in debug mode.
 */
export function isDebug(): boolean {
  return process.env.DEBUG === '1' || process.env.DEBUG === 'true';
}
