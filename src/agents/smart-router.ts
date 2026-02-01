/**
 * Smart Query Router
 * 
 * Optimizes cost and responsiveness through:
 * - Prefix overrides (!flash, sonnet:, etc.)
 * - Rules-based pre-filter (instant, no API call)
 * - Category detection (keyword matching)
 * - Usage tracking with daily limits
 * - LLM router fallback (Gemini Flash Lite)
 * - Instant ack generation
 */

import {
  type RoutingConfig,
  type RoutingTier,
  type RouterResult,
  type RuleConfig,
  DEFAULT_CONFIG,
} from "./routing-config.js";
import { UsageTracker, getUsageTracker } from "./usage-tracker.js";

export interface SmartRouterOptions {
  config?: Partial<RoutingConfig>;
  usageTracker?: UsageTracker;
  llmRouter?: LLMRouterFunction;
}

export type LLMRouterFunction = (query: string) => Promise<{ tier: RoutingTier; ack?: string } | null>;

export class SmartRouter {
  private config: RoutingConfig;
  private usageTracker: UsageTracker;
  private llmRouter?: LLMRouterFunction;

  constructor(options: SmartRouterOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.usageTracker = options.usageTracker ?? getUsageTracker();
    this.llmRouter = options.llmRouter;
  }

  /**
   * Route a query to the appropriate model
   */
  async route(query: string): Promise<RouterResult> {
    // Handle empty input
    if (!query || query.trim().length === 0) {
      return {
        tier: "TIER2_STANDARD",
        model: this.getModelForTier("TIER2_STANDARD"),
        ack: "Looking into that...",
        source: "default:empty-input",
        error: "Empty query provided",
      };
    }

    const trimmedQuery = query.trim();

    // Phase 0: Prefix overrides
    const prefixResult = this.checkPrefixOverride(trimmedQuery);
    if (prefixResult) {
      return prefixResult;
    }

    // Phase 1: Rules-based pre-filter
    const ruleResult = this.checkRules(trimmedQuery);
    if (ruleResult) {
      return ruleResult;
    }

    // Phase 2: Category detection
    const categoryResult = this.detectCategory(trimmedQuery);
    if (categoryResult) {
      return categoryResult;
    }

    // Phase 3: LLM router fallback
    if (this.llmRouter) {
      const llmResult = await this.llmRoute(trimmedQuery);
      if (llmResult) {
        return llmResult;
      }
    }

    // Default fallback
    return this.createResult("TIER2_STANDARD", "default:no-match");
  }

  /**
   * Check for prefix overrides (!flash, sonnet:, etc.)
   */
  private checkPrefixOverride(query: string): RouterResult | null {
    const lowerQuery = query.toLowerCase();

    for (const [prefix, model] of Object.entries(this.config.prefixOverrides)) {
      if (lowerQuery.startsWith(prefix.toLowerCase())) {
        // Check quota
        if (this.isModelAtLimit(model)) {
          return {
            tier: "OVERRIDE",
            model,
            ack: null,
            source: `prefix:${prefix}`,
            error: "quota_exceeded",
          };
        }

        // Strip prefix from query
        const cleanQuery = query.slice(prefix.length).replace(/^[\s:：]+/, "").trim();

        return {
          tier: "OVERRIDE",
          model,
          ack: null,
          cleanQuery,
          source: `prefix:${prefix}`,
        };
      }
    }

    return null;
  }

  /**
   * Check rules-based patterns
   */
  private checkRules(query: string): RouterResult | null {
    const queryLength = query.length;

    for (const rule of this.config.rules) {
      // Skip rules
      if (rule.skip && rule.pattern) {
        const regex = new RegExp(rule.pattern, rule.flags);
        if (regex.test(query)) {
          return {
            tier: "TIER2_STANDARD",
            model: this.getModelForTier("TIER2_STANDARD"),
            ack: null,
            source: `rule:${rule.name}`,
            skip: true,
          };
        }
      }

      // Pattern rules
      if (rule.pattern && rule.tier) {
        const regex = new RegExp(rule.pattern, rule.flags);
        if (regex.test(query)) {
          const result = this.createResult(rule.tier, `rule:${rule.name}`);
          if (rule.directAnswer) {
            result.directAnswer = rule.directAnswer;
          }
          return result;
        }
      }

      // Length rules
      if (rule.maxLength !== undefined && queryLength <= rule.maxLength && rule.tier) {
        return this.createResult(rule.tier, `rule:${rule.name}`);
      }

      if (rule.minLength !== undefined && queryLength >= rule.minLength && rule.tier) {
        return this.createResult(rule.tier, `rule:${rule.name}`);
      }
    }

    return null;
  }

  /**
   * Detect category from keywords (with word boundary matching)
   */
  private detectCategory(query: string): RouterResult | null {
    const lowerQuery = query.toLowerCase();

    for (const [categoryName, categoryConfig] of Object.entries(this.config.categories)) {
      for (const pattern of categoryConfig.patterns) {
        // Word boundary matching to avoid false positives like "ui" in "build"
        const regex = new RegExp(`\\b${this.escapeRegex(pattern)}\\b`, "i");
        if (regex.test(lowerQuery)) {
          const result = this.createResult(categoryConfig.tier, `category:${categoryName}`);
          result.category = categoryName;
          return result;
        }
      }
    }

    return null;
  }

  /**
   * LLM-based routing for ambiguous queries
   */
  private async llmRoute(query: string): Promise<RouterResult | null> {
    if (!this.llmRouter) {
      return null;
    }

    try {
      const llmResult = await this.llmRouter(query);
      if (llmResult && llmResult.tier) {
        const result = this.createResult(llmResult.tier, "llm");
        if (llmResult.ack) {
          result.ack = llmResult.ack;
        }
        return result;
      }
    } catch (error) {
      console.warn("[SmartRouter] LLM routing failed:", error);
    }

    return null;
  }

  /**
   * Create a router result with model and ack from tier config
   */
  private createResult(tier: RoutingTier, source: string): RouterResult {
    const tierConfig = this.config.tiers[tier];
    let model = tierConfig?.model ?? "google/gemini-2.5-flash";

    // Check quota and fallback if needed
    if (model && this.isModelAtLimit(model)) {
      const fallbackModel = this.findAvailableFallback(tier);
      if (fallbackModel) {
        model = fallbackModel;
      }
    }

    return {
      tier,
      model: model ?? "google/gemini-2.5-flash",
      ack: tierConfig?.ack ?? null,
      source,
    };
  }

  /**
   * Check if a model has exceeded its daily limit
   */
  private isModelAtLimit(modelId: string): boolean {
    const limit = this.config.usageLimits[modelId]?.dailyLimit;
    if (!limit) {
      return false;
    }
    return this.usageTracker.isAtLimit(modelId, limit);
  }

  /**
   * Find an available fallback model
   */
  private findAvailableFallback(tier: RoutingTier): string | null {
    const fallbacks = this.config.tiers[tier]?.fallback ?? [];
    
    for (const fallback of fallbacks) {
      if (!this.isModelAtLimit(fallback)) {
        return fallback;
      }
    }

    return null;
  }

  /**
   * Get the model for a tier (with quota check)
   */
  private getModelForTier(tier: RoutingTier): string {
    const tierConfig = this.config.tiers[tier];
    const model = tierConfig?.model ?? "google/gemini-2.5-flash";
    
    if (model && this.isModelAtLimit(model)) {
      return this.findAvailableFallback(tier) ?? model;
    }
    
    return model ?? "google/gemini-2.5-flash";
  }

  /**
   * Record model usage after a successful call
   */
  incrementUsage(modelId: string): number {
    return this.usageTracker.increment(modelId);
  }

  /**
   * Get current usage for a model
   */
  getUsage(modelId: string): number {
    return this.usageTracker.getUsage(modelId);
  }

  /**
   * Strip routing prefix from a query (for passing to model)
   */
  cleanupPrompt(query: string): string {
    const lowerQuery = query.toLowerCase();

    for (const prefix of Object.keys(this.config.prefixOverrides)) {
      if (lowerQuery.startsWith(prefix.toLowerCase())) {
        return query.slice(prefix.length).replace(/^[\s:：]+/, "").trim();
      }
    }

    return query;
  }

  /**
   * Check if a platform supports edit-in-place acks
   */
  supportsEditInPlace(platform: string): boolean {
    return this.config.ackBehavior.editInPlace.includes(platform.toLowerCase());
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// Export singleton instance with default config
export const smartRouter = new SmartRouter();

// Export types
export type { RoutingConfig, RoutingTier, RouterResult } from "./routing-config.js";
