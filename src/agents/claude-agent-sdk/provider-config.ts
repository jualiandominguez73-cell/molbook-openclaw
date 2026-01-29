/**
 * Provider configuration builders for the Claude Agent SDK.
 *
 * Supports multiple authentication methods:
 * - Anthropic API key (ANTHROPIC_API_KEY) - when explicitly configured in moltbot.json
 * - Claude Code SDK native auth (default) - inherits parent env, SDK handles credential resolution
 * - z.AI subscription (via ANTHROPIC_AUTH_TOKEN)
 * - OpenRouter (Anthropic-compatible API)
 * - AWS Bedrock
 * - Google Vertex AI
 *
 * For SDK native auth, we inherit the full parent process environment and let the SDK
 * handle credential resolution. If the user has ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN
 * set in their environment, the SDK will use them. Otherwise, it uses its native
 * keychain-based OAuth flow.
 */

import type { SdkProviderConfig, SdkProviderEnv } from "./types.js";

/**
 * Build provider config for direct Anthropic API access.
 */
export function buildAnthropicSdkProvider(apiKey: string): SdkProviderConfig {
  return {
    name: "Anthropic",
    env: {
      ANTHROPIC_API_KEY: apiKey,
    },
  };
}

/**
 * Build provider config for Claude Code SDK native auth.
 *
 * This returns a minimal config with no env overrides, allowing the SDK to:
 * - Inherit any ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN from parent process
 * - Use its internal credential resolution (keychain → OAuth) if no env vars are set
 *
 * We don't try to be "smart" about unsetting env vars - if the user has auth
 * env vars set in their system environment, that's their configuration choice.
 */
export function buildClaudeCliSdkProvider(): SdkProviderConfig {
  return {
    name: "Claude CLI (SDK native)",
    env: {},
  };
}

/**
 * Build provider config for z.AI subscription access.
 *
 * z.AI uses Anthropic-compatible API with a different base URL.
 */
export function buildZaiSdkProvider(
  authToken: string,
  options?: {
    baseUrl?: string;
    defaultModel?: string;
    haikuModel?: string;
    sonnetModel?: string;
    opusModel?: string;
  },
): SdkProviderConfig {
  const env: SdkProviderEnv = {
    ANTHROPIC_AUTH_TOKEN: authToken,
  };

  // Set base URL if provided (z.AI may use a custom endpoint)
  if (options?.baseUrl) {
    env.ANTHROPIC_BASE_URL = options.baseUrl;
  }

  // Set model tier defaults for z.AI
  if (options?.haikuModel) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = options.haikuModel;
  }
  if (options?.sonnetModel) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = options.sonnetModel;
  }
  if (options?.opusModel) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = options.opusModel;
  }

  return {
    name: "z.AI",
    env,
    model: options?.defaultModel,
  };
}

/**
 * Build provider config for OpenRouter (Anthropic-compatible).
 *
 * OpenRouter requires explicit model names since their model IDs differ
 * from Anthropic's native IDs.
 */
export function buildOpenRouterSdkProvider(
  apiKey: string,
  options?: {
    baseUrl?: string;
    defaultModel?: string;
    haikuModel?: string;
    sonnetModel?: string;
    opusModel?: string;
  },
): SdkProviderConfig {
  const env: SdkProviderEnv = {
    ANTHROPIC_BASE_URL: options?.baseUrl ?? "https://openrouter.ai/api/v1",
    ANTHROPIC_API_KEY: apiKey,
  };

  // OpenRouter uses different model naming - set explicit model IDs
  // Default OpenRouter model names for Anthropic models:
  // - anthropic/claude-3-5-haiku-20241022
  // - anthropic/claude-sonnet-4-20250514
  // - anthropic/claude-opus-4-20250514
  if (options?.haikuModel) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = options.haikuModel;
  }
  if (options?.sonnetModel) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = options.sonnetModel;
  }
  if (options?.opusModel) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = options.opusModel;
  }

  return {
    name: "OpenRouter (Anthropic-compatible)",
    env,
    model: options?.defaultModel,
  };
}

/**
 * Build provider config for AWS Bedrock.
 *
 * AWS credentials should be configured via standard AWS mechanisms
 * (environment variables, shared credentials file, IAM role, etc.).
 */
export function buildBedrockSdkProvider(): SdkProviderConfig {
  return {
    name: "AWS Bedrock",
    env: {
      CLAUDE_CODE_USE_BEDROCK: "1",
    },
  };
}

/**
 * Build provider config for Google Vertex AI.
 *
 * Google Cloud credentials should be configured via standard GCP mechanisms
 * (GOOGLE_APPLICATION_CREDENTIALS, default credentials, etc.).
 */
export function buildVertexSdkProvider(): SdkProviderConfig {
  return {
    name: "Google Vertex AI",
    env: {
      CLAUDE_CODE_USE_VERTEX: "1",
    },
  };
}

/**
 * Resolve provider configuration based on available credentials.
 *
 * Priority order:
 * 1. Explicit API key from moltbot config (options.apiKey)
 * 2. Explicit auth token from moltbot config (options.authToken) - for z.AI, etc.
 * 3. SDK native auth (default) - inherits parent env, SDK handles credential resolution
 *
 * The SDK will inherit the full parent process environment. If auth env vars
 * (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN) are set in the parent process,
 * the SDK will use them. Otherwise, it falls back to its native credential
 * resolution (keychain → OAuth).
 */
export function resolveProviderConfig(options?: {
  apiKey?: string;
  authToken?: string;
  baseUrl?: string;
  useCliCredentials?: boolean;
}): SdkProviderConfig {
  // 1. Explicit API key from moltbot config takes precedence
  if (options?.apiKey) {
    const config = buildAnthropicSdkProvider(options.apiKey);
    if (options.baseUrl && config.env) {
      config.env.ANTHROPIC_BASE_URL = options.baseUrl;
    }
    return config;
  }

  // 2. Explicit auth token from moltbot config (for z.AI, custom endpoints, etc.)
  if (options?.authToken) {
    const env: SdkProviderEnv = {
      ANTHROPIC_AUTH_TOKEN: options.authToken,
    };
    if (options.baseUrl) {
      env.ANTHROPIC_BASE_URL = options.baseUrl;
    }
    return {
      name: "Anthropic (auth token)",
      env,
    };
  }

  // 3. Default: SDK native auth
  // Let the SDK use its internal credential resolution (keychain → OAuth flow).
  // We inherit the full parent process env - if the user has ANTHROPIC_API_KEY or
  // ANTHROPIC_AUTH_TOKEN set, that's their configuration choice.
  const cliConfig = buildClaudeCliSdkProvider();
  if (options?.baseUrl && cliConfig.env) {
    cliConfig.env.ANTHROPIC_BASE_URL = options.baseUrl;
  }
  return cliConfig;
}
