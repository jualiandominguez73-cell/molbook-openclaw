/**
 * Base configuration types.
 */

/**
 * Top-level application configuration
 */
export interface Config {
  gmail: GmailConfig;
  openai: OpenAIConfig;
  agent: AgentConfig;
}

/**
 * Gmail channel configuration
 */
export interface GmailConfig {
  enabled: boolean;
  emailAddress?: string;
  watchLabels: string[];
  maxResults: number;
  autoReply: AutoReplyConfig;
}

/**
 * Auto-reply configuration
 */
export interface AutoReplyConfig {
  enabled: boolean;
  allowFrom: string[];
}

/**
 * OpenAI provider configuration
 */
export interface OpenAIConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  maxHistoryLength: number;
}
