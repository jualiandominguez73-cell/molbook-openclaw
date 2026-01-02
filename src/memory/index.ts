/**
 * Memory subsystem - persistent semantic memory using Qdrant.
 */

export { createEmbeddingClient, type EmbeddingClient } from "./embedding.js";
export { type MemoryStore, QdrantMemoryStore } from "./qdrant.js";
export {
  createMemoryService,
  isMemoryEnabled,
  MemoryService,
  resetMemoryService,
} from "./service.js";
export type {
  ExtractedMemory,
  Memory,
  MemoryCategory,
  MemoryListOptions,
  MemorySaveInput,
  MemorySearchOptions,
  MemorySearchResult,
  MemorySource,
} from "./types.js";
