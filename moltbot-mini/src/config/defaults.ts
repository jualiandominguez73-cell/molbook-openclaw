/**
 * Default configuration values.
 */

import type { Config, GmailConfig, OpenAIConfig, AgentConfig } from './types.js';

export const DEFAULT_GMAIL_CONFIG: GmailConfig = {
  enabled: true,
  watchLabels: ['INBOX'],
  maxResults: 20,
  autoReply: {
    enabled: false,
    allowFrom: [],
  },
};

export const DEFAULT_OPENAI_CONFIG: OpenAIConfig = {
  model: 'gpt-4o',
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: `You are a helpful email assistant. You help users:
- Read and summarize emails
- Draft replies
- Search for emails
- Organize their inbox

Be concise and professional. When drafting emails, match the tone of the original sender.`,
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  name: 'Email Assistant',
  maxHistoryLength: 20,
};

export const DEFAULT_CONFIG: Config = {
  gmail: DEFAULT_GMAIL_CONFIG,
  openai: DEFAULT_OPENAI_CONFIG,
  agent: DEFAULT_AGENT_CONFIG,
};
