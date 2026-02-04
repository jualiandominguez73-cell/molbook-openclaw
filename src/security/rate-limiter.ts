/**
 * Rate Limiter Middleware
 * Prevents resource exhaustion via request flooding
 */

import type { RateLimitConfig, RateLimitResult } from "./types.js";
import { DEFAULT_RATE_LIMIT_CONFIG } from "./types.js";
import { getAuditLogger } from "./audit-logger.js";

interface RateLimitBucket {
  /** Request counts per window */
  minute: number;
  hour: number;
  day: number;
  /** Window start timestamps */
  minuteStart: number;
  hourStart: number;
  dayStart: number;
  /** Burst tokens available */
  burstTokens: number;
  /** Last refill time for burst tokens */
  lastRefill: number;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export class RateLimiter {
  private config: RateLimitConfig;
  private buckets: Map<string, RateLimitBucket> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Check if a request is allowed
   */
  checkLimit(key: string, weight: number = 1): RateLimitResult {
    const now = Date.now();
    const bucket = this.getOrCreateBucket(key, now);

    // Reset windows if expired
    this.resetExpiredWindows(bucket, now);

    // Refill burst tokens
    this.refillBurstTokens(bucket, now);

    // Check limits
    const minuteAllowed = bucket.minute + weight <= this.config.requestsPerMinute;
    const hourAllowed = bucket.hour + weight <= this.config.requestsPerHour;
    const dayAllowed = bucket.day + weight <= this.config.requestsPerDay;

    // Check burst (allows temporary spikes)
    const burstAllowed = bucket.burstTokens >= weight;

    const allowed = minuteAllowed && hourAllowed && dayAllowed;

    if (allowed) {
      // Consume from all windows
      bucket.minute += weight;
      bucket.hour += weight;
      bucket.day += weight;

      // Consume burst tokens if over soft limit
      if (bucket.minute > this.config.requestsPerMinute * this.config.throttleThreshold) {
        bucket.burstTokens = Math.max(0, bucket.burstTokens - weight);
      }
    }

    const result: RateLimitResult = {
      allowed,
      remaining: Math.max(0, this.config.requestsPerMinute - bucket.minute),
      usage: {
        minute: bucket.minute,
        hour: bucket.hour,
        day: bucket.day,
      },
    };

    // Calculate retry-after if blocked
    if (!allowed) {
      if (!minuteAllowed) {
        result.retryAfter = Math.ceil((bucket.minuteStart + MINUTE_MS - now) / 1000);
      } else if (!hourAllowed) {
        result.retryAfter = Math.ceil((bucket.hourStart + HOUR_MS - now) / 1000);
      } else if (!dayAllowed) {
        result.retryAfter = Math.ceil((bucket.dayStart + DAY_MS - now) / 1000);
      }
    }

    return result;
  }

  /**
   * Check rate limit and log the attempt
   */
  checkAndLog(params: {
    key: string;
    userId?: string;
    ipAddress?: string;
    endpoint: string;
    weight?: number;
  }): RateLimitResult {
    const result = this.checkLimit(params.key, params.weight);

    getAuditLogger().logRateLimit({
      userId: params.userId,
      ipAddress: params.ipAddress,
      endpoint: params.endpoint,
      allowed: result.allowed,
      remaining: result.remaining,
    });

    return result;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): { minute: number; hour: number; day: number } {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return {
        minute: this.config.requestsPerMinute,
        hour: this.config.requestsPerHour,
        day: this.config.requestsPerDay,
      };
    }

    this.resetExpiredWindows(bucket, Date.now());

    return {
      minute: Math.max(0, this.config.requestsPerMinute - bucket.minute),
      hour: Math.max(0, this.config.requestsPerHour - bucket.hour),
      day: Math.max(0, this.config.requestsPerDay - bucket.day),
    };
  }

  /**
   * Reset limits for a key
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Get or create a rate limit bucket
   */
  private getOrCreateBucket(key: string, now: number): RateLimitBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        minute: 0,
        hour: 0,
        day: 0,
        minuteStart: now,
        hourStart: now,
        dayStart: now,
        burstTokens: this.config.burstSize,
        lastRefill: now,
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  /**
   * Reset windows that have expired
   */
  private resetExpiredWindows(bucket: RateLimitBucket, now: number): void {
    if (now - bucket.minuteStart >= MINUTE_MS) {
      bucket.minute = 0;
      bucket.minuteStart = now;
    }

    if (now - bucket.hourStart >= HOUR_MS) {
      bucket.hour = 0;
      bucket.hourStart = now;
    }

    if (now - bucket.dayStart >= DAY_MS) {
      bucket.day = 0;
      bucket.dayStart = now;
    }
  }

  /**
   * Refill burst tokens over time
   */
  private refillBurstTokens(bucket: RateLimitBucket, now: number): void {
    const elapsed = now - bucket.lastRefill;
    const refillRate = this.config.burstSize / (MINUTE_MS / 1000); // tokens per ms
    const tokensToAdd = elapsed * refillRate / 1000;

    bucket.burstTokens = Math.min(
      this.config.burstSize,
      bucket.burstTokens + tokensToAdd
    );
    bucket.lastRefill = now;
  }

  /**
   * Start cleanup interval for stale buckets
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = DAY_MS * 2; // Remove buckets inactive for 2 days

      for (const [key, bucket] of this.buckets) {
        if (now - bucket.dayStart > staleThreshold) {
          this.buckets.delete(key);
        }
      }
    }, HOUR_MS);

    // Don't prevent process exit
    this.cleanupInterval.unref();
  }

  /**
   * Stop the rate limiter
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get statistics
   */
  getStats(): { bucketCount: number; config: RateLimitConfig } {
    return {
      bucketCount: this.buckets.size,
      config: this.config,
    };
  }
}

// Singleton instance
let defaultLimiter: RateLimiter | null = null;

/**
 * Get or create the default rate limiter
 */
export function getRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  if (!defaultLimiter) {
    defaultLimiter = new RateLimiter(config);
  }
  return defaultLimiter;
}

/**
 * Express/Koa-style middleware factory
 */
export function rateLimitMiddleware(config?: Partial<RateLimitConfig>) {
  const limiter = new RateLimiter(config);

  return async (
    req: { ip?: string; userId?: string; path?: string },
    res: { status: (code: number) => void; setHeader: (key: string, value: string) => void; json: (data: unknown) => void },
    next: () => void | Promise<void>
  ) => {
    const key = req.userId || req.ip || "anonymous";
    const result = limiter.checkAndLog({
      key,
      userId: req.userId,
      ipAddress: req.ip,
      endpoint: req.path || "/",
    });

    res.setHeader("X-RateLimit-Limit", String(limiter.getStats().config.requestsPerMinute));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfter || 60));
      res.status(429);
      res.json({
        error: "Too Many Requests",
        retryAfter: result.retryAfter,
      });
      return;
    }

    await next();
  };
}
