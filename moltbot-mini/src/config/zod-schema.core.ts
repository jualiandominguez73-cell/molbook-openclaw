/**
 * Core Zod schemas for configuration validation.
 */

import { z } from 'zod';

/**
 * Auto-reply configuration schema
 */
export const AutoReplyConfigSchema = z.object({
  enabled: z.boolean().default(false),
  allowFrom: z.array(z.string()).default([]),
});

/**
 * Gmail configuration schema
 */
export const GmailConfigSchema = z.object({
  enabled: z.boolean().default(true),
  emailAddress: z.string().email().optional(),
  watchLabels: z.array(z.string()).default(['INBOX']),
  maxResults: z.number().min(1).max(100).default(20),
  autoReply: AutoReplyConfigSchema.default({}),
});

/**
 * OpenAI configuration schema
 */
export const OpenAIConfigSchema = z.object({
  model: z.string().default('gpt-4o'),
  maxTokens: z.number().min(100).max(128000).default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().default(`You are a helpful email assistant. You help users:
- Read and summarize emails
- Draft replies
- Search for emails
- Organize their inbox

Be concise and professional. When drafting emails, match the tone of the original sender.`),
});

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z.object({
  name: z.string().default('Email Assistant'),
  maxHistoryLength: z.number().min(1).max(100).default(20),
});

/**
 * Main configuration schema
 */
export const ConfigSchema = z.object({
  gmail: GmailConfigSchema.default({}),
  openai: OpenAIConfigSchema.default({}),
  agent: AgentConfigSchema.default({}),
});
