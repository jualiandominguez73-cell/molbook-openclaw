/**
 * Database client for multi-agent chat system.
 * Uses PostgreSQL with TimescaleDB for persistent storage.
 * Uses Redis for real-time features (caching, pub/sub, presence).
 */

import { EventEmitter } from "node:events";

// Types for database configuration
export type PostgresConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeout?: number;
};

export type RedisConfig = {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  tls?: boolean;
};

export type ChatDbConfig = {
  postgres: PostgresConfig;
  redis: RedisConfig;
};

// Default configuration
export const DEFAULT_POSTGRES_CONFIG: PostgresConfig = {
  host: process.env.CHAT_PG_HOST ?? "localhost",
  port: Number.parseInt(process.env.CHAT_PG_PORT ?? "5432", 10),
  database: process.env.CHAT_PG_DATABASE ?? "openclaw_chat",
  user: process.env.CHAT_PG_USER ?? "openclaw",
  password: process.env.CHAT_PG_PASSWORD ?? "",
  ssl: process.env.CHAT_PG_SSL === "true",
  maxConnections: 20,
  idleTimeout: 30000,
};

export const DEFAULT_REDIS_CONFIG: RedisConfig = {
  host: process.env.CHAT_REDIS_HOST ?? "localhost",
  port: Number.parseInt(process.env.CHAT_REDIS_PORT ?? "6379", 10),
  password: process.env.CHAT_REDIS_PASSWORD,
  db: Number.parseInt(process.env.CHAT_REDIS_DB ?? "0", 10),
  keyPrefix: "chat:",
  tls: process.env.CHAT_REDIS_TLS === "true",
};

// Redis key patterns
export const REDIS_KEYS = {
  // Presence
  presence: (agentId: string, channelId: string) => `presence:${channelId}:${agentId}`,
  presenceChannel: (channelId: string) => `presence:${channelId}:*`,
  typing: (channelId: string) => `typing:${channelId}`,

  // Caching
  channel: (channelId: string) => `channel:${channelId}`,
  channelMembers: (channelId: string) => `channel:${channelId}:members`,
  messageCache: (channelId: string) => `messages:${channelId}:recent`,

  // Pub/Sub channels
  pubsubChannel: (channelId: string) => `pubsub:channel:${channelId}`,
  pubsubGlobal: () => "pubsub:global",
  pubsubAgent: (agentId: string) => `pubsub:agent:${agentId}`,

  // Rate limiting
  rateLimit: (agentId: string, action: string) => `ratelimit:${action}:${agentId}`,

  // Sequences
  messageSeq: (channelId: string) => `seq:messages:${channelId}`,
} as const;

// TTL values in seconds
export const REDIS_TTL = {
  presence: 5 * 60, // 5 minutes
  typing: 10, // 10 seconds
  channelCache: 60 * 60, // 1 hour
  messageCache: 5 * 60, // 5 minutes for recent messages
  rateLimit: 60, // 1 minute
} as const;

/**
 * Abstract database client interface.
 * Implementations can use different PostgreSQL and Redis clients.
 */
export interface IChatDbClient extends EventEmitter {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // PostgreSQL operations
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
  transaction<T>(fn: (client: ITransactionClient) => Promise<T>): Promise<T>;

  // Redis operations
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<void>;

  // Redis hash operations
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, field: string): Promise<void>;

  // Redis set operations
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;

  // Redis sorted set operations (for typing indicators, rate limiting)
  zadd(key: string, score: number, member: string): Promise<number>;
  zrem(key: string, member: string): Promise<number>;
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;

  // Redis list operations (for message queues)
  lpush(key: string, ...values: string[]): Promise<number>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<void>;

  // Redis pub/sub
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, handler: (message: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  psubscribe(pattern: string, handler: (channel: string, message: string) => void): Promise<void>;
  punsubscribe(pattern: string): Promise<void>;

  // Atomic operations
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;

  // Schema management
  initializeSchema(): Promise<void>;
  getSchemaVersion(): Promise<number>;
}

export interface ITransactionClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
}

/**
 * Connection status types
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type ConnectionStatusUpdate = {
  postgres: ConnectionStatus;
  redis: ConnectionStatus;
  error?: Error;
};

/**
 * Singleton instance holder for the chat database client.
 * Use createChatDbClient() to create or get the instance.
 */
let chatDbClientInstance: IChatDbClient | null = null;

/**
 * Creates or returns the singleton chat database client.
 * The actual implementation is injected to allow different backends.
 */
export function setChatDbClient(client: IChatDbClient): void {
  chatDbClientInstance = client;
}

export function getChatDbClient(): IChatDbClient {
  if (!chatDbClientInstance) {
    throw new Error(
      "Chat database client not initialized. Call setChatDbClient() with an implementation first.",
    );
  }
  return chatDbClientInstance;
}

export function hasChatDbClient(): boolean {
  return chatDbClientInstance !== null;
}

/**
 * Helper to build parameterized queries safely.
 */
export function buildInsertQuery(
  table: string,
  data: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
  return { sql, params: values };
}

export function buildUpdateQuery(
  table: string,
  data: Record<string, unknown>,
  whereClause: string,
  whereParams: unknown[],
): { sql: string; params: unknown[] } {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  const params = [...values, ...whereParams];

  return { sql, params };
}

/**
 * JSON serialization helpers for PostgreSQL JSONB columns.
 */
export function toJsonb(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJsonb<T>(value: string | null | undefined): T | null {
  if (value == null) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Timestamp helpers for PostgreSQL TIMESTAMPTZ columns.
 */
export function toTimestamp(ms: number): Date {
  return new Date(ms);
}

export function fromTimestamp(value: Date | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return date.getTime();
}
