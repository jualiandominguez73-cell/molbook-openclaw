/**
 * Memory system types for Clawdis persistent memory (Qdrant + embeddings).
 */

/** Category of a memory entry */
export type MemoryCategory =
  | "preference" // User preferences (likes coffee, prefers dark mode)
  | "fact" // Facts about users/world (birthday, location)
  | "contact" // Contact information
  | "reminder" // Reminders and todos
  | "context" // Important context (ongoing projects)
  | "custom"; // User-defined category

/** How the memory was created */
export type MemorySource =
  | "agent" // Explicitly saved by agent via tool
  | "auto" // Auto-extracted from conversation
  | "user"; // User requested save

/** A single memory entry */
export type Memory = {
  /** Unique identifier (UUID) */
  id: string;
  /** The memory content text */
  content: string;
  /** Classification category */
  category: MemoryCategory;
  /** How it was created */
  source: MemorySource;
  /** Session it came from (optional) */
  sessionId?: string;
  /** Who it relates to - E.164 phone or "global" */
  senderId: string;
  /** Confidence score 0-1 (mainly for auto-extracted) */
  confidence: number;
  /** Creation timestamp (Unix ms) */
  createdAt: number;
  /** Last update timestamp (Unix ms) */
  updatedAt: number;
  /** Optional expiry timestamp (Unix ms) */
  expiresAt?: number;
  /** Extra metadata */
  metadata?: Record<string, unknown>;
};

/** Memory with similarity score from search */
export type MemorySearchResult = Memory & {
  /** Similarity score 0-1 */
  score: number;
};

/** Options for searching memories */
export type MemorySearchOptions = {
  /** Max results to return */
  limit?: number;
  /** Filter by category */
  category?: MemoryCategory;
  /** Filter by sender */
  senderId?: string;
  /** Minimum similarity score threshold */
  minScore?: number;
};

/** Options for listing memories */
export type MemoryListOptions = {
  /** Filter by sender */
  senderId?: string;
  /** Filter by category */
  category?: MemoryCategory;
  /** Max results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
};

/** Input for saving a new memory */
export type MemorySaveInput = {
  content: string;
  category: MemoryCategory;
  source: MemorySource;
  sessionId?: string;
  senderId?: string;
  confidence?: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
};

/** Extracted memory from conversation analysis */
export type ExtractedMemory = {
  content: string;
  category: MemoryCategory;
  confidence: number;
  reason: string;
};
