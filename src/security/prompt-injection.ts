/**
 * Prompt Injection Detector
 * Detects and neutralizes prompt injection attempts
 */

import type { InjectionScanResult, InjectionPattern, SecurityEventSeverity } from "./types.js";
import { getAuditLogger } from "./audit-logger.js";

export interface PromptInjectionConfig {
  /** Enable detection */
  enabled: boolean;
  /** Action on detection */
  action: "block" | "warn" | "sanitize";
  /** Custom patterns */
  customPatterns?: InjectionPattern[];
  /** Minimum confidence to trigger */
  minConfidence: number;
  /** Enable heuristic detection */
  enableHeuristics: boolean;
  /** Enable audit logging */
  enableAudit: boolean;
}

const DEFAULT_CONFIG: PromptInjectionConfig = {
  enabled: true,
  action: "warn",
  minConfidence: 0.7,
  enableHeuristics: true,
  enableAudit: true,
};

// Common prompt injection patterns
const BUILTIN_PATTERNS: InjectionPattern[] = [
  {
    name: "ignore_instructions",
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    severity: "high",
    action: "block",
  },
  {
    name: "new_instructions",
    pattern: /new\s+instructions?:?\s*["\[]|your\s+new\s+(task|role|instruction)/i,
    severity: "high",
    action: "block",
  },
  {
    name: "role_override",
    pattern: /you\s+are\s+(now|no\s+longer)\s+a|pretend\s+(to\s+be|you'?re)/i,
    severity: "high",
    action: "block",
  },
  {
    name: "system_prompt_leak",
    pattern: /reveal\s+(your\s+)?(system\s+)?prompt|show\s+(me\s+)?(your\s+)?instructions/i,
    severity: "high",
    action: "block",
  },
  {
    name: "jailbreak_dan",
    pattern: /\bDAN\b|do\s+anything\s+now|developer\s+mode/i,
    severity: "critical",
    action: "block",
  },
  {
    name: "bypass_attempt",
    pattern: /bypass\s+(your\s+)?(safety|security|filter|restriction)/i,
    severity: "high",
    action: "block",
  },
  {
    name: "token_separator",
    pattern: /```system|<\|im_start\|>|<\|endoftext\|>|\[INST\]|\[\/INST\]/i,
    severity: "critical",
    action: "block",
  },
  {
    name: "hidden_text",
    pattern: /\u200b|\u200c|\u200d|\ufeff|[\u2060-\u206f]/,
    severity: "medium",
    action: "sanitize",
  },
  {
    name: "base64_encoded",
    pattern: /base64[:\s]+[A-Za-z0-9+/=]{50,}/i,
    severity: "medium",
    action: "warn",
  },
  {
    name: "script_injection",
    pattern: /<script|javascript:|on\w+\s*=|eval\s*\(/i,
    severity: "high",
    action: "block",
  },
  {
    name: "api_key_extraction",
    pattern: /(?:reveal|show|print|output|return)\s+(?:the\s+)?(?:api[_\s]?key|secret|token|password)/i,
    severity: "critical",
    action: "block",
  },
  {
    name: "sudo_mode",
    pattern: /(?:enable|activate)\s+(?:sudo|admin|root|superuser)\s+mode/i,
    severity: "high",
    action: "block",
  },
];

export class PromptInjectionDetector {
  private config: PromptInjectionConfig;
  private patterns: InjectionPattern[];

  constructor(config: Partial<PromptInjectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.patterns = [...BUILTIN_PATTERNS, ...(config.customPatterns || [])];
  }

  /**
   * Scan input for prompt injection
   */
  scan(
    input: string,
    context?: { userId?: string; sessionKey?: string }
  ): InjectionScanResult {
    if (!this.config.enabled) {
      return { safe: true, confidence: 1.0 };
    }

    const detectedPatterns: string[] = [];
    let maxSeverity: SecurityEventSeverity = "info";
    let shouldBlock = false;

    // Pattern matching
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(input)) {
        detectedPatterns.push(pattern.name);

        if (this.severityLevel(pattern.severity) < this.severityLevel(maxSeverity)) {
          maxSeverity = pattern.severity;
        }

        if (pattern.action === "block") {
          shouldBlock = true;
        }
      }
    }

    // Heuristic detection
    let heuristicScore = 0;
    if (this.config.enableHeuristics) {
      heuristicScore = this.runHeuristics(input);
    }

    // Calculate confidence
    const patternScore = detectedPatterns.length > 0 ? 0.8 : 0;
    const confidence = Math.min(1, patternScore + heuristicScore);

    const detected = confidence >= this.config.minConfidence;
    const safe = !detected || (this.config.action === "warn" && !shouldBlock);

    // Prepare result
    const result: InjectionScanResult = {
      safe,
      confidence,
      detectedPatterns: detectedPatterns.length > 0 ? detectedPatterns : undefined,
    };

    if (detected) {
      result.reason = `Detected patterns: ${detectedPatterns.join(", ")}`;

      // Sanitize if requested
      if (this.config.action === "sanitize") {
        result.sanitizedInput = this.sanitize(input);
      }
    }

    // Log detection
    if (this.config.enableAudit) {
      getAuditLogger().logPromptInjection({
        input,
        detected,
        confidence,
        userId: context?.userId,
        sessionKey: context?.sessionKey,
        patterns: detectedPatterns,
      });
    }

    return result;
  }

  /**
   * Run heuristic detection
   */
  private runHeuristics(input: string): number {
    let score = 0;

    // Excessive newlines (often used to hide injection)
    const newlineRatio = (input.match(/\n/g) || []).length / input.length;
    if (newlineRatio > 0.1) score += 0.1;

    // Multiple instruction-like phrases
    const instructionPhrases = input.match(/(?:you\s+(?:must|should|will)|please\s+(?:ignore|forget|remember))/gi);
    if (instructionPhrases && instructionPhrases.length > 2) score += 0.2;

    // Unusual capitalization (IMPORTANT, SYSTEM, etc.)
    const capsWords = input.match(/\b[A-Z]{5,}\b/g);
    if (capsWords && capsWords.length > 3) score += 0.1;

    // Quote manipulation
    const quoteImbalance = Math.abs(
      (input.match(/"/g) || []).length - (input.match(/"/g) || []).length
    );
    if (quoteImbalance > 2) score += 0.1;

    // Role-switching language
    if (/(?:from\s+now\s+on|starting\s+now|henceforth)/i.test(input)) {
      score += 0.15;
    }

    // Markdown/code block abuse
    const codeBlocks = (input.match(/```/g) || []).length;
    if (codeBlocks > 4) score += 0.1;

    return Math.min(0.5, score); // Cap heuristic contribution
  }

  /**
   * Sanitize input by removing detected patterns
   */
  sanitize(input: string): string {
    let sanitized = input;

    // Remove hidden characters
    sanitized = sanitized.replace(/[\u200b\u200c\u200d\ufeff\u2060-\u206f]/g, "");

    // Replace dangerous patterns with placeholder
    for (const pattern of this.patterns) {
      if (pattern.action === "sanitize" || pattern.action === "block") {
        sanitized = sanitized.replace(pattern.pattern, "[REDACTED]");
      }
    }

    return sanitized;
  }

  /**
   * Add a custom detection pattern
   */
  addPattern(pattern: InjectionPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove a pattern by name
   */
  removePattern(name: string): boolean {
    const index = this.patterns.findIndex((p) => p.name === name);
    if (index >= 0) {
      this.patterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get severity level as number (lower = more severe)
   */
  private severityLevel(severity: SecurityEventSeverity): number {
    switch (severity) {
      case "critical": return 0;
      case "high": return 1;
      case "medium": return 2;
      case "low": return 3;
      case "info": return 4;
      default: return 5;
    }
  }

  /**
   * Get all registered patterns
   */
  getPatterns(): InjectionPattern[] {
    return [...this.patterns];
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PromptInjectionConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Singleton instance
let defaultDetector: PromptInjectionDetector | null = null;

/**
 * Get or create the default prompt injection detector
 */
export function getPromptInjectionDetector(
  config?: Partial<PromptInjectionConfig>
): PromptInjectionDetector {
  if (!defaultDetector) {
    defaultDetector = new PromptInjectionDetector(config);
  }
  return defaultDetector;
}

/**
 * Quick scan function
 */
export function scanForInjection(
  input: string,
  context?: { userId?: string; sessionKey?: string }
): InjectionScanResult {
  return getPromptInjectionDetector().scan(input, context);
}
