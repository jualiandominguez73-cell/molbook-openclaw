import { z } from "zod";

const GrayswanStageSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.union([z.literal("block"), z.literal("monitor")]).optional(),
    violationThreshold: z.number().min(0).max(1).optional(),
    blockMode: z.union([z.literal("replace"), z.literal("append")]).optional(),
    blockOnMutation: z.boolean().optional(),
    blockOnIpi: z.boolean().optional(),
    includeHistory: z.boolean().optional(),
  })
  .strict()
  .optional();

const GrayswanStagesSchema = z
  .object({
    beforeRequest: GrayswanStageSchema,
    beforeToolCall: GrayswanStageSchema,
    afterToolCall: GrayswanStageSchema,
    afterResponse: GrayswanStageSchema,
  })
  .strict()
  .optional();

const GrayswanSchema = z
  .object({
    enabled: z.boolean().optional(),
    apiKey: z.string().optional(),
    apiBase: z.string().optional(),
    policyId: z.string().optional(),
    categories: z.record(z.string(), z.string()).optional(),
    reasoningMode: z
      .union([z.literal("off"), z.literal("hybrid"), z.literal("thinking")])
      .optional(),
    violationThreshold: z.number().min(0).max(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
    failOpen: z.boolean().optional(),
    stages: GrayswanStagesSchema,
  })
  .strict()
  .optional();

export const GuardrailsSchema = z
  .object({
    grayswan: GrayswanSchema,
  })
  .strict()
  .optional();
