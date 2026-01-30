import { Type } from "@sinclair/typebox";
import { homedir } from "node:os";
import { join } from "node:path";

export type MemoryConfig = {
  embedding: {
    provider: "openai" | "minimax" | "custom" | "ollama";
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
  dbPath?: string;
  autoCapture?: boolean;
  autoRecall?: boolean;
};

export const MEMORY_CATEGORIES = ["preference", "fact", "decision", "entity", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

const DEFAULT_MODEL = "nomic-embed-text";
const DEFAULT_DB_PATH = join(homedir(), ".clawdbot", "memory", "lancedb");

const EMBEDDING_DIMENSIONS: Record<string, number> = {
  // OpenAI models
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
  // Zhipu AI models
  "embedding-2": 1024,
  "embedding-3": 1024,
  // MiniMax models (assuming 1536 for compatibility)
  "minimax-embedding": 1536,
  // Ollama models
  "nomic-embed-text": 768,
  "mxbai-embed-large": 1024,
};

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

export function vectorDimsForModel(model: string): number {
  const dims = EMBEDDING_DIMENSIONS[model];
  if (!dims) {
    throw new Error(`Unsupported embedding model: ${model}`);
  }
  return dims;
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function resolveEmbeddingModel(embedding: Record<string, unknown>): string {
  const model = typeof embedding.model === "string" ? embedding.model : DEFAULT_MODEL;
  vectorDimsForModel(model);
  return model;
}

export const memoryConfigSchema = {
  safeParse(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { success: false, error: { issues: [{ path: [], message: "memory config required" }] } };
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ["embedding", "dbPath", "autoCapture", "autoRecall"], "memory config");

    const embedding = cfg.embedding as Record<string, unknown> | undefined;
    if (!embedding) {
      return { success: false, error: { issues: [{ path: ["embedding"], message: "embedding config is required" }] } };
    }
    assertAllowedKeys(embedding, ["apiKey", "model", "baseUrl", "provider"], "embedding config");

    const provider = (typeof embedding.provider === "string" ? embedding.provider : "openai") as MemoryConfig["embedding"]["provider"];

    // For non-custom providers, apiKey is required
    if (provider !== "custom" && provider !== "ollama" && typeof embedding.apiKey !== "string") {
      return { success: false, error: { issues: [{ path: ["embedding"], message: "embedding.apiKey is required for this provider" }] } };
    }

    const model = resolveEmbeddingModel(embedding);
    const baseUrl = typeof embedding.baseUrl === "string" ? embedding.baseUrl : undefined;
    const apiKey = embedding.apiKey ? resolveEnvVars(embedding.apiKey as string) : undefined;

    return {
      success: true,
      data: {
        embedding: {
          provider,
          model,
          ...(apiKey && { apiKey }),
          ...(baseUrl && { baseUrl }),
        },
        dbPath: typeof cfg.dbPath === "string" ? cfg.dbPath : DEFAULT_DB_PATH,
        autoCapture: cfg.autoCapture !== false,
        autoRecall: cfg.autoRecall !== false,
      },
    };
  },
  parse(value: unknown): MemoryConfig {
    const result = this.safeParse(value);
    if (!result.success) {
      throw new Error(result.error?.issues?.[0]?.message || "invalid config");
    }
    return result.data as MemoryConfig;
  },
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      embedding: {
        type: "object",
        additionalProperties: false,
        properties: {
          apiKey: { type: "string" },
          model: { type: "string" },
          baseUrl: { type: "string" },
          provider: { type: "string", enum: ["openai", "minimax", "custom", "ollama"] },
        },
      },
      dbPath: { type: "string" },
      autoCapture: { type: "boolean" },
      autoRecall: { type: "boolean" },
    },
    required: ["embedding"],
  },
  uiHints: {
    "embedding.apiKey": {
      label: "API Key",
      sensitive: true,
      placeholder: "sk-proj-... (not needed for Ollama)",
      help: "API key for embedding provider (optional for Ollama/custom)",
    },
    "embedding.model": {
      label: "Embedding Model",
      placeholder: DEFAULT_MODEL,
      help: "Embedding model: nomic-embed-text (Ollama), text-embedding-3-small (OpenAI), embedding-3 (Zhipu AI)",
    },
    "embedding.baseUrl": {
      label: "Base URL",
      placeholder: "http://localhost:11434/v1 (Ollama)",
      help: "Base URL for embedding API",
    },
    dbPath: {
      label: "Database Path",
      placeholder: "~/.clawdbot/memory/lancedb",
      advanced: true,
    },
    autoCapture: {
      label: "Auto-Capture",
      help: "Automatically capture important information from conversations",
    },
    autoRecall: {
      label: "Auto-Recall",
      help: "Automatically inject relevant memories into context",
    },
  },
};
