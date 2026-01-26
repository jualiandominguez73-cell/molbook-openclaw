import type { ModelDefinitionConfig } from "../config/types.js";

export const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
export const FIREWORKS_API_BASE_URL = "https://api.fireworks.ai";
export const FIREWORKS_ACCOUNT_ID = "fireworks";
export const FIREWORKS_DEFAULT_MODEL_ID = "accounts/fireworks/models/deepseek-v3p2";
export const FIREWORKS_DEFAULT_MODEL_REF = `fireworks/${FIREWORKS_DEFAULT_MODEL_ID}`;

// Fireworks uses pay-per-token pricing; rates vary by model.
// Set to 0 as a default; override in models.json for accurate costs.
export const FIREWORKS_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

/**
 * Static catalog of Fireworks AI serverless models.
 *
 * This catalog serves as a fallback when the Fireworks API is unreachable.
 * Only includes LLM models (no image generation), non-deprecated models,
 * and models that support serverless inference.
 *
 * Model IDs use the full format: accounts/fireworks/models/<model>
 */
export const FIREWORKS_MODEL_CATALOG = [
  // DeepSeek models
  {
    id: "accounts/fireworks/models/deepseek-r1-0528",
    name: "DeepSeek R1 05/28",
    reasoning: true,
    input: ["text"] as const,
    contextWindow: 163840,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/deepseek-v3-0324",
    name: "DeepSeek V3 03-24",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 163840,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/deepseek-v3p1",
    name: "DeepSeek V3.1",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 163840,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/deepseek-v3p1-terminus",
    name: "DeepSeek V3.1 Terminus",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 163840,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/deepseek-v3p2",
    name: "DeepSeek V3.2",
    reasoning: true,
    input: ["text"] as const,
    contextWindow: 163840,
    maxTokens: 8192,
  },

  // GLM models
  {
    id: "accounts/fireworks/models/glm-4p6",
    name: "GLM-4.6",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 202752,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/glm-4p7",
    name: "GLM-4.7",
    reasoning: true,
    input: ["text"] as const,
    contextWindow: 202752,
    maxTokens: 8192,
  },

  // OpenAI gpt-oss models
  {
    id: "accounts/fireworks/models/gpt-oss-120b",
    name: "OpenAI gpt-oss-120b",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/gpt-oss-20b",
    name: "OpenAI gpt-oss-20b",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 131072,
    maxTokens: 8192,
  },

  // Kimi models
  {
    id: "accounts/fireworks/models/kimi-k2-instruct-0905",
    name: "Kimi K2 Instruct 0905",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 262144,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    reasoning: true,
    input: ["text"] as const,
    // API returns 0 but description says 256k
    contextWindow: 256000,
    maxTokens: 8192,
  },

  // Llama models
  {
    id: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    name: "Llama 3.3 70B Instruct",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 131072,
    maxTokens: 8192,
  },

  // MiniMax models
  {
    id: "accounts/fireworks/models/minimax-m2",
    name: "MiniMax-M2",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 196608,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/minimax-m2p1",
    name: "MiniMax-M2.1",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 204800,
    maxTokens: 8192,
  },

  // Qwen text models
  {
    id: "accounts/fireworks/models/qwen3-235b-a22b",
    name: "Qwen3 235B A22B",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
    name: "Qwen3 235B A22B Instruct 2507",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 262144,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/qwen3-235b-a22b-thinking-2507",
    name: "Qwen3 235B A22B Thinking 2507",
    reasoning: true,
    input: ["text"] as const,
    contextWindow: 262144,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/qwen3-8b",
    name: "Qwen3 8B",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 40960,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/qwen3-coder-480b-a35b-instruct",
    name: "Qwen3 Coder 480B A35B Instruct",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 262144,
    maxTokens: 8192,
  },

  // Qwen vision models
  {
    id: "accounts/fireworks/models/qwen2p5-vl-32b-instruct",
    name: "Qwen2.5-VL 32B Instruct",
    reasoning: false,
    input: ["text", "image"] as const,
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/qwen3-vl-235b-a22b-instruct",
    name: "Qwen3 VL 235B A22B Instruct",
    reasoning: false,
    input: ["text", "image"] as const,
    contextWindow: 262144,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/qwen3-vl-235b-a22b-thinking",
    name: "Qwen3 VL 235B A22B Thinking",
    reasoning: true,
    input: ["text", "image"] as const,
    contextWindow: 262144,
    maxTokens: 8192,
  },
  {
    id: "accounts/fireworks/models/qwen3-vl-30b-a3b-thinking",
    name: "Qwen3 VL 30B A3B Thinking",
    reasoning: true,
    input: ["text", "image"] as const,
    contextWindow: 262144,
    maxTokens: 8192,
  },
] as const;

export type FireworksCatalogEntry = (typeof FIREWORKS_MODEL_CATALOG)[number];

/**
 * Build a ModelDefinitionConfig from a Fireworks catalog entry.
 */
export function buildFireworksModelDefinition(entry: FireworksCatalogEntry): ModelDefinitionConfig {
  return {
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: [...entry.input],
    cost: FIREWORKS_DEFAULT_COST,
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
  };
}

// Fireworks API response types
interface FireworksModel {
  name: string; // Full resource name: accounts/fireworks/models/<id>
  displayName?: string;
  description?: string;
  contextLength?: number;
  kind?: string; // HF_BASE_MODEL, FLUMINA_BASE_MODEL, etc.
  supportsImageInput?: boolean;
  supportsTools?: boolean;
  supportsServerless?: boolean;
  deprecationDate?: { year: number; month: number; day: number } | null;
}

interface FireworksModelsResponse {
  models: FireworksModel[];
  nextPageToken?: string;
}

function isDeprecated(
  deprecationDate?: { year: number; month: number; day: number } | null,
): boolean {
  if (!deprecationDate) return false;
  const { year, month, day } = deprecationDate;
  const depDate = new Date(year, month - 1, day);
  return depDate < new Date();
}

function isLlmModel(model: FireworksModel): boolean {
  // Skip image generation models (FLUX, etc.) - they use FLUMINA_BASE_MODEL kind
  // and have contextLength of 0
  if (model.kind === "FLUMINA_BASE_MODEL") return false;
  if (!model.contextLength || model.contextLength === 0) return false;
  return true;
}

/**
 * Discover serverless LLM models from Fireworks API with fallback to static catalog.
 */
export async function discoverFireworksModels(params?: {
  apiKey?: string;
}): Promise<ModelDefinitionConfig[]> {
  // Skip API discovery in test environment
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return FIREWORKS_MODEL_CATALOG.map(buildFireworksModelDefinition);
  }

  const apiKey = params?.apiKey ?? process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    console.warn("[fireworks-models] No API key available, using static catalog");
    return FIREWORKS_MODEL_CATALOG.map(buildFireworksModelDefinition);
  }

  try {
    const allModels: FireworksModel[] = [];
    let pageToken: string | undefined;

    // Paginate through results
    do {
      const url = new URL(`${FIREWORKS_API_BASE_URL}/v1/accounts/${FIREWORKS_ACCOUNT_ID}/models`);
      url.searchParams.set("filter", "supports_serverless=true");
      url.searchParams.set("pageSize", "200");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn(
          `[fireworks-models] Failed to list models: HTTP ${response.status}, using static catalog`,
        );
        return FIREWORKS_MODEL_CATALOG.map(buildFireworksModelDefinition);
      }

      const data = (await response.json()) as FireworksModelsResponse;
      allModels.push(...(data.models ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Filter and build model definitions
    const catalogById = new Map<string, FireworksCatalogEntry>(
      FIREWORKS_MODEL_CATALOG.map((m) => [m.id, m]),
    );
    const models: ModelDefinitionConfig[] = [];

    for (const apiModel of allModels) {
      // Skip deprecated models
      if (isDeprecated(apiModel.deprecationDate)) continue;
      // Skip non-LLM models (image gen, etc.)
      if (!isLlmModel(apiModel)) continue;

      // Use the full name as the ID (accounts/fireworks/models/<model>)
      const id = apiModel.name;
      const catalogEntry = catalogById.get(id);

      if (catalogEntry) {
        // Use catalog metadata for known models
        models.push(buildFireworksModelDefinition(catalogEntry));
      } else {
        // Create definition for newly discovered models not in catalog
        const isReasoning =
          id.toLowerCase().includes("r1") ||
          id.toLowerCase().includes("thinking") ||
          id.toLowerCase().includes("reasoning") ||
          (apiModel.description?.toLowerCase().includes("reasoning") ?? false);

        models.push({
          id,
          name: apiModel.displayName ?? id.replace(/^accounts\/fireworks\/models\//, ""),
          reasoning: isReasoning,
          input: apiModel.supportsImageInput ? ["text", "image"] : ["text"],
          cost: FIREWORKS_DEFAULT_COST,
          contextWindow: apiModel.contextLength ?? 128000,
          maxTokens: 8192,
        });
      }
    }

    return models.length > 0 ? models : FIREWORKS_MODEL_CATALOG.map(buildFireworksModelDefinition);
  } catch (error) {
    console.warn(`[fireworks-models] Discovery failed: ${String(error)}, using static catalog`);
    return FIREWORKS_MODEL_CATALOG.map(buildFireworksModelDefinition);
  }
}
