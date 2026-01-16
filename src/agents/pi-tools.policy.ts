import type { ClawdbotConfig } from "../config/config.js";
import { resolveAgentConfig, resolveAgentIdFromSessionKey } from "./agent-scope.js";
import type { AnyAgentTool } from "./pi-tools.types.js";
import type { SandboxToolPolicy } from "./sandbox.js";
import { expandToolGroups, normalizeToolName } from "./tool-policy.js";

const DEFAULT_SUBAGENT_TOOL_DENY = [
  // Session management - main agent orchestrates
  "sessions_list",
  "sessions_history",
  "sessions_send",
  "sessions_spawn",
  // System admin - dangerous from subagent
  "gateway",
  "agents_list",
  // Interactive setup - not a task
  "whatsapp_login",
  // Status/scheduling - main agent coordinates
  "session_status",
  "cron",
  // Memory - pass relevant info in spawn prompt instead
  "memory_search",
  "memory_get",
];

export function resolveSubagentToolPolicy(cfg?: ClawdbotConfig): SandboxToolPolicy {
  const configured = cfg?.tools?.subagents?.tools;
  const deny = [
    ...DEFAULT_SUBAGENT_TOOL_DENY,
    ...(Array.isArray(configured?.deny) ? configured.deny : []),
  ];
  const allow = Array.isArray(configured?.allow) ? configured.allow : undefined;
  return { allow, deny };
}

export function isToolAllowedByPolicyName(name: string, policy?: SandboxToolPolicy): boolean {
  if (!policy) return true;
  const deny = new Set(expandToolGroups(policy.deny));
  const allowRaw = expandToolGroups(policy.allow);
  const allow = allowRaw.length > 0 ? new Set(allowRaw) : null;
  const normalized = normalizeToolName(name);
  if (deny.has(normalized)) return false;
  if (allow) {
    if (allow.has(normalized)) return true;
    if (normalized === "apply_patch" && allow.has("exec")) return true;
    return false;
  }
  return true;
}

export function filterToolsByPolicy(tools: AnyAgentTool[], policy?: SandboxToolPolicy) {
  if (!policy) return tools;
  return tools.filter((tool) => isToolAllowedByPolicyName(tool.name, policy));
}

type ToolPolicyConfig = {
  allow?: string[];
  deny?: string[];
  profile?: string;
};

function pickToolPolicy(config?: ToolPolicyConfig): SandboxToolPolicy | undefined {
  if (!config) return undefined;
  const allow = Array.isArray(config.allow) ? config.allow : undefined;
  const deny = Array.isArray(config.deny) ? config.deny : undefined;
  if (!allow && !deny) return undefined;
  return { allow, deny };
}

function normalizeProviderKey(value: string): string {
  return value.trim().toLowerCase();
}

function resolveProviderToolPolicy(params: {
  byProvider?: Record<string, ToolPolicyConfig>;
  modelProvider?: string;
  modelId?: string;
}): ToolPolicyConfig | undefined {
  const provider = params.modelProvider?.trim();
  if (!provider || !params.byProvider) return undefined;

  const entries = Object.entries(params.byProvider);
  if (entries.length === 0) return undefined;

  const lookup = new Map<string, ToolPolicyConfig>();
  for (const [key, value] of entries) {
    const normalized = normalizeProviderKey(key);
    if (!normalized) continue;
    lookup.set(normalized, value);
  }

  const normalizedProvider = normalizeProviderKey(provider);
  const rawModelId = params.modelId?.trim().toLowerCase();
  const fullModelId =
    rawModelId && !rawModelId.includes("/") ? `${normalizedProvider}/${rawModelId}` : rawModelId;

  const candidates = [...(fullModelId ? [fullModelId] : []), normalizedProvider];

  for (const key of candidates) {
    const match = lookup.get(key);
    if (match) return match;
  }
  return undefined;
}

export function resolveEffectiveToolPolicy(params: {
  config?: ClawdbotConfig;
  sessionKey?: string;
  modelProvider?: string;
  modelId?: string;
}) {
  const agentId = params.sessionKey ? resolveAgentIdFromSessionKey(params.sessionKey) : undefined;
  const agentConfig =
    params.config && agentId ? resolveAgentConfig(params.config, agentId) : undefined;
  const agentTools = agentConfig?.tools;
  const globalTools = params.config?.tools;

  const profile = agentTools?.profile ?? globalTools?.profile;
  const providerPolicy = resolveProviderToolPolicy({
    byProvider: globalTools?.byProvider,
    modelProvider: params.modelProvider,
    modelId: params.modelId,
  });
  const agentProviderPolicy = resolveProviderToolPolicy({
    byProvider: agentTools?.byProvider,
    modelProvider: params.modelProvider,
    modelId: params.modelId,
  });
  return {
    agentId,
    globalPolicy: pickToolPolicy(globalTools),
    globalProviderPolicy: pickToolPolicy(providerPolicy),
    agentPolicy: pickToolPolicy(agentTools),
    agentProviderPolicy: pickToolPolicy(agentProviderPolicy),
    profile,
    providerProfile: agentProviderPolicy?.profile ?? providerPolicy?.profile,
  };
}

export function isToolAllowedByPolicies(
  name: string,
  policies: Array<SandboxToolPolicy | undefined>,
) {
  return policies.every((policy) => isToolAllowedByPolicyName(name, policy));
}

/**
 * Check if sender is allowed to execute tools in a WhatsApp group.
 * Returns true if:
 * - Not a WhatsApp group session
 * - No groupToolAllowFrom configured (all groupAllowFrom users can use tools)
 * - Sender is in groupToolAllowFrom
 */
export function isSenderAllowedForTools(params: {
  config?: ClawdbotConfig;
  sessionKey?: string;
  senderE164?: string;
  messageProvider?: string;
}): boolean {
  // Not WhatsApp or not a group - allow
  if (params.messageProvider !== "whatsapp") return true;
  if (!params.sessionKey?.includes(":group:")) return true;

  // No sender info - deny (safety)
  if (!params.senderE164) return false;

  const cfg = params.config;
  if (!cfg?.channels?.whatsapp) return true;

  const whatsappCfg = cfg.channels.whatsapp;
  const accountId = extractAccountIdFromSessionKey(params.sessionKey);

  // Check account-specific config first
  const accountCfg = accountId ? whatsappCfg.accounts?.[accountId] : undefined;
  const groupToolAllowFrom =
    (accountCfg && typeof accountCfg === "object" ? accountCfg.groupToolAllowFrom : undefined) ??
    whatsappCfg.groupToolAllowFrom;

  // If no groupToolAllowFrom, all groupAllowFrom users can use tools
  if (!groupToolAllowFrom || groupToolAllowFrom.length === 0) {
    return true;
  }

  // Normalize and check
  const senderE164 = params.senderE164;
  // Simple normalization - remove spaces and convert to lowercase
  const normalize = (num: string) => String(num).trim().toLowerCase().replace(/\s+/g, "");
  const normalizedSender = normalize(senderE164);
  const allowedSet = new Set(groupToolAllowFrom.map(normalize));

  return allowedSet.has(normalizedSender);
}

/**
 * Extract account ID from session key format: agent:agentId:whatsapp:accountId:...
 */
function extractAccountIdFromSessionKey(sessionKey?: string): string | undefined {
  if (!sessionKey) return undefined;
  const parts = sessionKey.split(":");
  // Format: agent:agentId:whatsapp:accountId:group:groupId
  if (parts.length >= 4 && parts[2] === "whatsapp") {
    return parts[3];
  }
  return undefined;
}
