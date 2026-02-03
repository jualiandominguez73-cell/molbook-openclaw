/**
 * HTTP client for LightRAG API
 * @see https://github.com/HKUDS/LightRAG
 */

export const DEFAULT_LIGHTRAG_ENDPOINT = "http://localhost:8001";
export const DEFAULT_LIGHTRAG_TIMEOUT_MS = 30_000;

export type LightRAGMode = "naive" | "local" | "global" | "hybrid";

export type LightRAGQueryParams = {
  query: string;
  mode?: LightRAGMode;
  topK?: number;
  includeSources?: boolean;
};

export type LightRAGQueryResponse = {
  answer: string;
  sources?: string[];
  entities?: string[];
  confidence?: number;
};

export type LightRAGEntity = {
  name: string;
  type?: string;
  count?: number;
};

export type LightRAGStats = {
  totalDocuments?: number;
  totalEntities?: number;
  totalRelationships?: number;
  lastIndexed?: string;
};

export type LightRAGClientOptions = {
  endpoint?: string;
  timeout?: number;
};

export class LightRAGClient {
  private readonly endpoint: string;
  private readonly timeout: number;

  constructor(options: LightRAGClientOptions = {}) {
    this.endpoint = options.endpoint?.replace(/\/$/, "") || DEFAULT_LIGHTRAG_ENDPOINT;
    this.timeout = options.timeout ?? DEFAULT_LIGHTRAG_TIMEOUT_MS;
  }

  /**
   * Health check for LightRAG service
   */
  async health(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const url = `${this.endpoint}/health`;
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Query the LightRAG knowledge base
   */
  async query(params: LightRAGQueryParams): Promise<LightRAGQueryResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.endpoint}/query`;
      const body = {
        query: params.query,
        mode: params.mode ?? "hybrid",
        top_k: params.topK ?? 5,
        include_sources: params.includeSources ?? true,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`lightrag query failed: ${res.status} ${text}`);
      }

      const data = (await res.json()) as {
        answer?: string;
        sources?: string[];
        entities?: string[];
        confidence?: number;
      };

      return {
        answer: data.answer ?? "",
        sources: data.sources,
        entities: data.entities,
        confidence: data.confidence,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`lightrag query timeout after ${this.timeout}ms`);
      }
      throw err;
    }
  }

  /**
   * Get list of entities from the knowledge graph
   */
  async getEntities(): Promise<LightRAGEntity[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.endpoint}/graph/entities`;
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`lightrag get entities failed: ${res.status} ${text}`);
      }

      const data = (await res.json()) as {
        entities?: Array<{
          name?: string;
          type?: string;
          count?: number;
        }>;
      };

      return (data.entities ?? []).map((e) => ({
        name: e.name ?? "",
        type: e.type,
        count: e.count,
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`lightrag get entities timeout after ${this.timeout}ms`);
      }
      throw err;
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getStats(): Promise<LightRAGStats> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.endpoint}/stats`;
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`lightrag get stats failed: ${res.status} ${text}`);
      }

      const data = (await res.json()) as {
        total_documents?: number;
        total_entities?: number;
        total_relationships?: number;
        last_indexed?: string;
      };

      return {
        totalDocuments: data.total_documents,
        totalEntities: data.total_entities,
        totalRelationships: data.total_relationships,
        lastIndexed: data.last_indexed,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`lightrag get stats timeout after ${this.timeout}ms`);
      }
      throw err;
    }
  }
}

/**
 * Create a LightRAG client with the given options
 */
export function createLightRAGClient(options: LightRAGClientOptions = {}): LightRAGClient {
  return new LightRAGClient(options);
}
