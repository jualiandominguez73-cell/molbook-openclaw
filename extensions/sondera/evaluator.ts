/**
 * Sondera Cedar Policy Evaluator
 *
 * Pure TypeScript implementation using @cedar-policy/cedar-wasm
 * No Python dependencies required.
 */

import * as cedar from "@cedar-policy/cedar-wasm/nodejs";

export type PolicyDecision = "ALLOW" | "DENY";

export interface EvaluationResult {
  decision: PolicyDecision;
  reason?: string;
  policyIds?: string[];
}

export interface EvaluationContext {
  params?: Record<string, unknown>;
  response?: unknown;
}

interface ParsedPolicies {
  /** Policies as Record for Cedar */
  policies: Record<string, string>;
  /** Mapping from Cedar's internal IDs (policy0, policy1...) to our @id names */
  internalIdToName: Map<string, string>;
}

/**
 * Parse Cedar policy text into individual policies with their @id annotations.
 * Returns policies for Cedar and a mapping from internal IDs to @id names.
 */
function parsePolicies(policyText: string): ParsedPolicies {
  const policies: Record<string, string> = {};
  const internalIdToName = new Map<string, string>();
  let policyCounter = 0;

  // Match @id("...") annotation followed by permit/forbid policy
  // The regex captures: @id annotation (optional), permit/forbid keyword, and the full policy body
  const policyRegex = /(?:@id\s*\(\s*"([^"]+)"\s*\)\s*)?(permit|forbid)\s*\(\s*principal\s*,\s*action\s*,\s*resource\s*\)\s*(?:when\s*\{[^}]*\})?\s*;/g;

  let match;
  while ((match = policyRegex.exec(policyText)) !== null) {
    const policyId = match[1] || `policy${policyCounter}`;
    // Extract the full policy text (including @id if present)
    const fullMatch = match[0];
    // Store just the permit/forbid part (without @id) as that's what Cedar expects
    const policyBody = fullMatch.replace(/@id\s*\([^)]*\)\s*/, '').trim();
    policies[policyId] = policyBody;
    // Map Cedar's internal ID to our @id name
    internalIdToName.set(`policy${policyCounter}`, policyId);
    policyCounter++;
  }

  return { policies, internalIdToName };
}

/**
 * Cedar Policy Evaluator for Sondera guardrails.
 */
/**
 * Count the number of @id annotations in a Cedar policy file.
 * This gives an accurate rule count without instantiating an evaluator.
 */
export function countPolicyRules(policyText: string): number {
  const idRegex = /@id\s*\(\s*"[^"]+"\s*\)/g;
  const matches = policyText.match(idRegex);
  return matches?.length ?? 0;
}

export class CedarEvaluator {
  private policies: Record<string, string>;
  private internalIdToName: Map<string, string>;

  constructor(policyText: string) {
    const parsed = parsePolicies(policyText);
    this.policies = parsed.policies;
    this.internalIdToName = parsed.internalIdToName;
  }

  /**
   * Get the number of policies loaded in this evaluator.
   */
  get ruleCount(): number {
    return Object.keys(this.policies).length;
  }

  /**
   * Translate Cedar's internal policy IDs to our @id names.
   */
  private translatePolicyIds(internalIds: string[] | undefined): string[] {
    if (!internalIds) return [];
    return internalIds.map(id => this.internalIdToName.get(id) || id);
  }

  /**
   * Evaluate a tool call against the Cedar policy.
   *
   * @param toolName - Name of the tool being called
   * @param context - Context containing params (PRE_TOOL) or response (POST_TOOL)
   * @returns Evaluation result with decision and reason
   */
  evaluate(toolName: string, context: EvaluationContext): EvaluationResult {
    try {
      // Build the authorization request
      const request = {
        principal: { type: "User", id: "openclaw-agent" },
        action: { type: "Sondera::Action", id: toolName },
        resource: { type: "Resource", id: "cli" },
        context: context,
      };

      // Call Cedar WASM to evaluate
      const result = cedar.isAuthorized({
        principal: request.principal,
        action: request.action,
        resource: request.resource,
        context: request.context,
        policies: {
          staticPolicies: this.policies,
        },
        entities: [],
      });

      // Handle API response format: { type: "success"|"failure", response?: { decision, diagnostics } }
      if (result.type === "failure") {
        // Policy parsing or evaluation error - fail closed (DENY for security)
        const errorMsgs = result.errors?.map((e: { message: string }) => e.message).join("; ") || "Unknown error";
        console.error(`[Sondera] Cedar evaluation failed for "${toolName}": ${errorMsgs}`);
        return {
          decision: "DENY",
          reason: `Policy error (blocked for safety): ${errorMsgs}`,
        };
      }

      // Success - extract decision from response
      const decision = result.response?.decision;
      const diagnostics = result.response?.diagnostics;

      // Translate internal IDs to @id names
      const policyNames = this.translatePolicyIds(diagnostics?.reason);

      // Fail-closed: only explicit "allow" permits, everything else denies
      if (decision === "allow") {
        return {
          decision: "ALLOW",
          reason: policyNames.join(", "),
        };
      } else {
        // "deny", undefined, or any other state -> DENY (fail-closed)
        return {
          decision: "DENY",
          reason: policyNames.join(", ") || "Denied by policy (no permit rule matched)",
          policyIds: policyNames,
        };
      }
    } catch (err) {
      // On evaluation error, fail closed (DENY for security)
      console.error(`[Sondera] Cedar evaluation error for "${toolName}": ${err instanceof Error ? err.message : String(err)}`);
      return {
        decision: "DENY",
        reason: `Policy error (blocked for safety): ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Evaluate a PRE_TOOL stage (before tool execution).
   */
  evaluatePreTool(toolName: string, params: Record<string, unknown>): EvaluationResult {
    return this.evaluate(toolName, { params });
  }

  /**
   * Evaluate a POST_TOOL stage (after tool execution, for result redaction).
   * Only redacts if a SPECIFIC redaction policy matched.
   */
  evaluatePostTool(toolName: string, response: unknown): EvaluationResult {
    const result = this.evaluate(`${toolName}_result`, { response });

    // Only redact if a specific redaction policy matched
    // Filter out default policies - we only want explicit redaction rules
    if (result.decision === "DENY") {
      const specificPolicies = (result.policyIds || []).filter(
        id => id !== "default-allow"
      );

      if (specificPolicies.length === 0) {
        // No specific redaction policy matched, allow result through
        return {
          decision: "ALLOW",
          reason: "No redaction policy matched",
        };
      }

      // A specific redaction policy matched, redact the result
      return {
        ...result,
        policyIds: specificPolicies,
        reason: specificPolicies.join(", "),
      };
    }

    return result;
  }
}
