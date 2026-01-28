import { z } from "zod";

import {
  BlockStreamingCoalesceSchema,
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  requireOpenAllowFrom,
} from "clawdbot/plugin-sdk";

const FeishuConfigSchemaBase = z
  .object({
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    appId: z.string().optional(),
    appSecret: z.string().optional(),
    verificationToken: z.string().optional(),
    encryptKey: z.string().optional(),
    eventMode: z.enum(["webhook", "long-connection"]).optional(),
    webhookPath: z.string().optional(),
    webhookUrl: z.string().optional(),
    allowBots: z.boolean().optional(),
    requireMention: z.boolean().optional(),
    markdown: MarkdownConfigSchema,
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groupPolicy: GroupPolicySchema.optional().default("allowlist"),
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    textChunkLimit: z.number().int().positive().optional(),
    chunkMode: z.enum(["length", "newline"]).optional(),
    blockStreaming: z.boolean().optional(),
    blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  })
  .strict();

export const FeishuConfigSchema = FeishuConfigSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.feishu.dmPolicy="open" requires channels.feishu.allowFrom to include "*"',
  });
});
