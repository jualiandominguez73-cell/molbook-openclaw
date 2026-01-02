/**
 * Memory tool for Clawdis agent - persistent semantic memory.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-ai";
import { type TSchema, Type } from "@sinclair/typebox";
import { createMemoryService, isMemoryEnabled } from "../memory/index.js";
import type { MemoryCategory } from "../memory/types.js";

type AnyAgentTool = AgentTool<TSchema, unknown>;

function jsonResult(payload: unknown): AgentToolResult<unknown> {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    details: payload,
  };
}

const MemoryCategorySchema = Type.Union([
  Type.Literal("preference"),
  Type.Literal("fact"),
  Type.Literal("contact"),
  Type.Literal("reminder"),
  Type.Literal("context"),
  Type.Literal("custom"),
]);

const MemoryToolSchema = Type.Union([
  Type.Object({
    action: Type.Literal("save"),
    content: Type.String({
      description: "The memory to save - be specific and self-contained",
    }),
    category: Type.Optional(MemoryCategorySchema),
    senderId: Type.Optional(
      Type.String({
        description: "Who this memory relates to (E.164 phone or 'global')",
      }),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  }),
  Type.Object({
    action: Type.Literal("search"),
    query: Type.String({ description: "What to search for" }),
    senderId: Type.Optional(Type.String()),
    category: Type.Optional(MemoryCategorySchema),
    limit: Type.Optional(Type.Number({ default: 5 })),
  }),
  Type.Object({
    action: Type.Literal("recall"),
    senderId: Type.String({ description: "Get all memories for a sender" }),
    category: Type.Optional(MemoryCategorySchema),
    limit: Type.Optional(Type.Number({ default: 20 })),
  }),
  Type.Object({
    action: Type.Literal("delete"),
    id: Type.String({ description: "Memory ID to delete" }),
  }),
  Type.Object({
    action: Type.Literal("list"),
    senderId: Type.Optional(Type.String()),
    category: Type.Optional(MemoryCategorySchema),
    limit: Type.Optional(Type.Number({ default: 20 })),
  }),
]);

/**
 * Create the memory tool for agent use.
 */
export function createMemoryTool(): AnyAgentTool {
  return {
    label: "Memory",
    name: "clawdis_memory",
    description: `Save and recall persistent memories across sessions. Use this to:
- Save important facts about users (birthdays, preferences, names, relationships)
- Remember context from previous conversations
- Store reminders and notes
- Search for relevant past context

Categories:
- preference: User preferences (likes/dislikes, habits, style)
- fact: Facts about people/world (birthday, location, job)
- contact: Contact information
- reminder: Reminders and todos
- context: Important ongoing context (projects, plans)
- custom: Other memories

Best practices:
- Be specific: "Artur prefers dark mode" not "user likes dark"
- Include context: "Artur's mom Solange lives in Brazil"
- Use appropriate category
- Search before asking user for repeated info`,
    parameters: MemoryToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = params.action as string;

      // Check if memory is enabled
      if (!isMemoryEnabled()) {
        return jsonResult({
          error: "not_configured",
          message: "Memory system is not enabled in configuration",
        });
      }

      // Get or create memory service
      const service = await createMemoryService();
      if (!service) {
        return jsonResult({
          error: "initialization_failed",
          message:
            "Failed to initialize memory service (check Qdrant connection)",
        });
      }

      switch (action) {
        case "save": {
          const content = params.content as string;
          if (!content?.trim()) {
            return jsonResult({
              error: "validation",
              message: "content required",
            });
          }

          const memory = await service.save({
            content: content.trim(),
            category: (params.category as MemoryCategory) ?? "fact",
            source: "agent",
            senderId: params.senderId as string | undefined,
            metadata: params.metadata as Record<string, unknown> | undefined,
          });

          return jsonResult({
            saved: true,
            id: memory.id,
            content: memory.content,
            category: memory.category,
            senderId: memory.senderId,
          });
        }

        case "search": {
          const query = params.query as string;
          if (!query?.trim()) {
            return jsonResult({
              error: "validation",
              message: "query required",
            });
          }

          const results = await service.search(query.trim(), {
            senderId: params.senderId as string | undefined,
            category: params.category as MemoryCategory | undefined,
            limit: (params.limit as number) ?? 5,
          });

          return jsonResult({
            query,
            count: results.length,
            memories: results.map((m) => ({
              id: m.id,
              content: m.content,
              category: m.category,
              senderId: m.senderId,
              score: m.score.toFixed(3),
              createdAt: new Date(m.createdAt).toISOString(),
            })),
          });
        }

        case "recall": {
          const senderId = params.senderId as string;
          if (!senderId?.trim()) {
            return jsonResult({
              error: "validation",
              message: "senderId required",
            });
          }

          const memories = await service.recall(senderId.trim(), {
            category: params.category as MemoryCategory | undefined,
            limit: (params.limit as number) ?? 20,
          });

          return jsonResult({
            senderId,
            count: memories.length,
            memories: memories.map((m) => ({
              id: m.id,
              content: m.content,
              category: m.category,
              createdAt: new Date(m.createdAt).toISOString(),
            })),
          });
        }

        case "delete": {
          const id = params.id as string;
          if (!id?.trim()) {
            return jsonResult({ error: "validation", message: "id required" });
          }

          const deleted = await service.delete(id.trim());
          return jsonResult({ deleted, id });
        }

        case "list": {
          const memories = await service.list({
            senderId: params.senderId as string | undefined,
            category: params.category as MemoryCategory | undefined,
            limit: (params.limit as number) ?? 20,
          });

          return jsonResult({
            count: memories.length,
            memories: memories.map((m) => ({
              id: m.id,
              content: m.content,
              category: m.category,
              senderId: m.senderId,
              createdAt: new Date(m.createdAt).toISOString(),
            })),
          });
        }

        default:
          return jsonResult({ error: "unknown_action", action });
      }
    },
  };
}
