import type { MsgContext } from "../../auto-reply/templating.js";
import type { SessionScope } from "./types.js";
import {
  buildAgentMainSessionKey,
  DEFAULT_AGENT_ID,
  normalizeMainKey,
} from "../../routing/session-key.js";
import { normalizeE164 } from "../../utils.js";
import { resolveGroupSessionKey } from "./group.js";

// Decide which session bucket to use (per-sender vs global).
export function deriveSessionKey(scope: SessionScope, ctx: MsgContext) {
  if (scope === "global") {
    return "global";
  }
  const resolvedGroup = resolveGroupSessionKey(ctx);
  if (resolvedGroup) {
    return resolvedGroup.key;
  }
  const from = ctx.From ? normalizeE164(ctx.From) : "";
  return from || "unknown";
}

/**
 * Resolve the session key with a canonical direct-chat bucket (default: "main").
 * All non-group direct chats collapse to this bucket; groups stay isolated.
 */
export function resolveSessionKey(scope: SessionScope, ctx: MsgContext, mainKey?: string) {
  const explicit = ctx.SessionKey?.trim();
  if (explicit) {
    // Apply the same canonicalization logic as resolveSessionStoreKey
    const explicitLower = explicit.toLowerCase();

    // If it's already in canonical format, return as-is
    if (
      explicitLower.startsWith("agent:") ||
      explicitLower === "global" ||
      explicitLower === "unknown"
    ) {
      return explicitLower;
    }

    // Check if it's a main key alias
    const canonicalMainKey = normalizeMainKey(mainKey);
    if (explicitLower === "main" || explicitLower === canonicalMainKey) {
      return buildAgentMainSessionKey({
        agentId: DEFAULT_AGENT_ID,
        mainKey: canonicalMainKey,
      });
    }

    // For non-group sessions, use the explicit key as the session identifier
    const isGroup = explicitLower.includes(":group:") || explicitLower.includes(":channel:");
    if (!isGroup) {
      return `agent:${DEFAULT_AGENT_ID}:${explicitLower}`;
    }

    // For group sessions, add agent prefix
    return `agent:${DEFAULT_AGENT_ID}:${explicitLower}`;
  }

  const raw = deriveSessionKey(scope, ctx);
  if (scope === "global") {
    return raw;
  }
  const canonicalMainKey = normalizeMainKey(mainKey);
  const canonical = buildAgentMainSessionKey({
    agentId: DEFAULT_AGENT_ID,
    mainKey: canonicalMainKey,
  });
  const isGroup = raw.includes(":group:") || raw.includes(":channel:");
  if (!isGroup) {
    return canonical;
  }
  return `agent:${DEFAULT_AGENT_ID}:${raw}`;
}
