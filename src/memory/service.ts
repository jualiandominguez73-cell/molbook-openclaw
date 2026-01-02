/**
 * Memory service - coordinates Qdrant storage with embeddings.
 * Provides a high-level API for memory operations.
 */

import { loadConfig, type MemoryConfig } from "../config/config.js";
import { createEmbeddingClient } from "./embedding.js";
import { type MemoryStore, QdrantMemoryStore } from "./qdrant.js";
import type {
  Memory,
  MemoryCategory,
  MemoryListOptions,
  MemorySaveInput,
  MemorySearchOptions,
  MemorySearchResult,
  MemorySource,
} from "./types.js";

/** Singleton service instance */
let serviceInstance: MemoryService | null = null;
let initPromise: Promise<MemoryService | null> | null = null;

/** Main memory service class */
export class MemoryService {
  private readonly store: MemoryStore;
  private readonly config: MemoryConfig;

  constructor(store: MemoryStore, config: MemoryConfig) {
    this.store = store;
    this.config = config;
  }

  /**
   * Save a new memory.
   */
  async save(params: {
    content: string;
    category: MemoryCategory;
    source: MemorySource;
    sessionId?: string;
    senderId?: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  }): Promise<Memory> {
    const ttlMs = (this.config.ttlDays ?? 0) * 24 * 60 * 60 * 1000;

    const input: MemorySaveInput = {
      content: params.content,
      category: params.category,
      source: params.source,
      sessionId: params.sessionId,
      senderId: params.senderId ?? "global",
      confidence: params.confidence ?? 1.0,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : undefined,
      metadata: params.metadata,
    };

    return this.store.save(input);
  }

  /**
   * Search for memories by semantic similarity.
   */
  async search(
    query: string,
    opts?: {
      senderId?: string;
      category?: MemoryCategory;
      limit?: number;
      minScore?: number;
    },
  ): Promise<MemorySearchResult[]> {
    const searchOpts: MemorySearchOptions = {
      senderId: opts?.senderId,
      category: opts?.category,
      limit: opts?.limit ?? this.config.searchLimit ?? 5,
      minScore: opts?.minScore ?? 0.5,
    };

    return this.store.search(query, searchOpts);
  }

  /**
   * Get a specific memory by ID.
   */
  async get(id: string): Promise<Memory | null> {
    return this.store.get(id);
  }

  /**
   * Delete a memory by ID.
   */
  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * List memories with optional filters.
   */
  async list(opts?: MemoryListOptions): Promise<Memory[]> {
    return this.store.list({
      ...opts,
      limit: opts?.limit ?? 20,
    });
  }

  /**
   * Get memories for a specific sender.
   */
  async recall(
    senderId: string,
    opts?: {
      category?: MemoryCategory;
      limit?: number;
    },
  ): Promise<Memory[]> {
    return this.store.list({
      senderId,
      category: opts?.category,
      limit: opts?.limit ?? 20,
    });
  }

  /**
   * Clean up expired memories.
   */
  async cleanup(): Promise<number> {
    return this.store.deleteExpired();
  }
}

/**
 * Get or create the memory service singleton.
 * Returns null if memory is not enabled in config.
 */
export async function createMemoryService(): Promise<MemoryService | null> {
  // Return cached instance if available
  if (serviceInstance) return serviceInstance;

  // Return existing init promise to prevent duplicate initialization
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const config = loadConfig();
      const memConfig = config.memory;

      // Check if memory is enabled
      if (!memConfig?.enabled) {
        return null;
      }

      // Create embedding client
      const embedder = createEmbeddingClient(memConfig.embedding ?? {});

      // Create Qdrant store
      const store = new QdrantMemoryStore(memConfig.qdrant ?? {}, embedder);

      // Initialize store (creates collection if needed)
      await store.init();

      // Create and cache service
      serviceInstance = new MemoryService(store, memConfig);
      return serviceInstance;
    } catch (error) {
      console.error("Failed to initialize memory service:", error);
      return null;
    }
  })();

  return initPromise;
}

/**
 * Check if memory service is available and enabled.
 */
export function isMemoryEnabled(): boolean {
  const config = loadConfig();
  return config.memory?.enabled === true;
}

/**
 * Reset the memory service (for testing).
 */
export function resetMemoryService(): void {
  serviceInstance = null;
  initPromise = null;
}
