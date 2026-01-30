/**
 * Contextual RAG - On-demand instruction and schema loading
 *
 * This module provides a RAG-style approach to system prompt construction,
 * dramatically reducing token consumption by loading context only when needed.
 *
 * @example
 * // Instead of 17,000 tokens upfront:
 * // - Tool schemas: 8,000 tokens
 * // - Instructions: 3,500 tokens
 * // - Bootstrap: 5,000 tokens
 *
 * // RAG approach sends ~2,000 tokens initially:
 * // - Tool index: 500 tokens
 * // - Instruction index: 200 tokens
 * // - Minimal bootstrap: 500 tokens
 * // - Core rules: 300 tokens
 * // + RAG tools for on-demand loading
 *
 * // Result: 88% reduction in initial tokens!
 */

export {
  type ContextChunk,
  INSTRUCTION_CHUNKS,
  searchChunks,
  getChunkById,
  getChunksByCategory,
  buildChunkIndex,
} from "./chunks.js";

export {
  createGetContextTool,
  createGetToolSchemaTool,
  executeGetContext,
  executeGetToolSchema,
  registerToolSchema,
  registerToolSchemas,
  clearToolSchemaRegistry,
  buildToolIndex,
  type GetContextParams,
  type GetToolSchemaParams,
} from "./tools.js";
