/**
 * Multi-agent channel types for Slack-style chat system.
 * Supports public/private channels, DMs, and broadcast channels.
 */

export type AgentChannelType = "public" | "private" | "dm" | "broadcast";

export type AgentListeningMode =
  | "active" // Responds to all messages
  | "mention-only" // Responds only when mentioned
  | "observer" // Receives but doesn't respond
  | "coordinator"; // Routes to other agents

export type AgentChannelMemberRole = "owner" | "admin" | "member" | "observer";

export type AgentChannelMember = {
  agentId: string;
  role: AgentChannelMemberRole;
  listeningMode: AgentListeningMode;
  joinedAt: number;
  receiveBroadcasts?: boolean;
  customName?: string;
};

export type ExternalBindingPlatform = "slack" | "discord" | "telegram";

export type ExternalBindingDirection = "inbound" | "outbound" | "bidirectional";

export type ExternalBindingSyncOptions = {
  syncMessages: boolean;
  syncThreads: boolean;
  syncReactions: boolean;
  externalUserPrefix?: string; // e.g., "[Slack:username]"
};

export type ExternalBinding = {
  bindingId: string;
  platform: ExternalBindingPlatform;
  externalAccountId: string;
  externalTargetId: string;
  direction: ExternalBindingDirection;
  syncOptions: ExternalBindingSyncOptions;
  createdAt: number;
  enabled: boolean;
};

export type AgentChannel = {
  id: string; // "achan_{uuid}"
  type: AgentChannelType;
  name: string;
  topic?: string;
  description?: string;
  createdAt: number;
  createdBy: string;
  members: AgentChannelMember[];
  defaultAgentId?: string; // Agent that responds to messages without mention
  externalBindings?: ExternalBinding[];
  archived?: boolean;
  archivedAt?: number;
  archivedBy?: string;
  pinnedMessageIds?: string[];
  settings?: AgentChannelSettings;
};

export type AgentChannelSettings = {
  allowThreads?: boolean;
  allowReactions?: boolean;
  retentionDays?: number;
  maxMessageLength?: number;
  slowModeSeconds?: number;
};

export type CreateChannelParams = {
  name: string;
  type: AgentChannelType;
  topic?: string;
  description?: string;
  createdBy: string;
  defaultAgentId?: string;
  initialMembers?: Omit<AgentChannelMember, "joinedAt">[];
  settings?: AgentChannelSettings;
};

export type UpdateChannelParams = {
  name?: string;
  topic?: string;
  description?: string;
  defaultAgentId?: string;
  settings?: Partial<AgentChannelSettings>;
};

export type ChannelMemberUpdate = {
  role?: AgentChannelMemberRole;
  listeningMode?: AgentListeningMode;
  receiveBroadcasts?: boolean;
  customName?: string;
};

// Permission definitions for role-based access
export const CHANNEL_PERMISSIONS = {
  send_messages: "send_messages",
  create_threads: "create_threads",
  invite_agents: "invite_agents",
  kick_agents: "kick_agents",
  mute_agents: "mute_agents",
  set_topic: "set_topic",
  pin_messages: "pin_messages",
  archive_channel: "archive_channel",
  delete_messages: "delete_messages",
  manage_settings: "manage_settings",
} as const;

export type ChannelPermission = (typeof CHANNEL_PERMISSIONS)[keyof typeof CHANNEL_PERMISSIONS];

export const ROLE_PERMISSIONS: Record<AgentChannelMemberRole, ChannelPermission[] | "*"> = {
  owner: "*", // All permissions
  admin: [
    "send_messages",
    "create_threads",
    "invite_agents",
    "kick_agents",
    "mute_agents",
    "set_topic",
    "pin_messages",
    "delete_messages",
  ],
  member: ["send_messages", "create_threads"],
  observer: [], // Read-only
};

export function hasChannelPermission(
  role: AgentChannelMemberRole,
  permission: ChannelPermission,
): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms === "*") {
    return true;
  }
  return perms.includes(permission);
}

export function generateChannelId(): string {
  const uuid = crypto.randomUUID();
  return `achan_${uuid}`;
}
