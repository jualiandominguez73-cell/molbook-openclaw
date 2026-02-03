/**
 * Types for external channel bindings (Slack, Discord, Telegram).
 * Enables bidirectional sync between agent channels and external platforms.
 */

export type ExternalPlatform = "slack" | "discord" | "telegram";

export type BindingDirection = "inbound" | "outbound" | "bidirectional";

export type SyncStatus = "active" | "paused" | "error" | "disconnected";

export type ExternalMessage = {
  externalId: string;
  platform: ExternalPlatform;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
  threadId?: string;
  attachments?: ExternalAttachment[];
  replyToId?: string;
  edited?: boolean;
  deleted?: boolean;
};

export type ExternalAttachment = {
  type: "image" | "file" | "video" | "audio";
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
};

export type ExternalUser = {
  externalId: string;
  platform: ExternalPlatform;
  username: string;
  displayName?: string;
  avatarUrl?: string;
};

export type ExternalChannelInfo = {
  externalId: string;
  platform: ExternalPlatform;
  name: string;
  type: "channel" | "group" | "dm";
  memberCount?: number;
};

export type SyncOptions = {
  syncMessages: boolean;
  syncThreads: boolean;
  syncReactions: boolean;
  syncEdits: boolean;
  syncDeletes: boolean;
  /** Prefix for external user messages, e.g., "[Slack:username]" */
  externalUserPrefix?: string;
  /** Filter for message types to sync */
  messageFilter?: (message: ExternalMessage) => boolean;
  /** Transform message content before syncing */
  contentTransform?: (content: string, direction: "inbound" | "outbound") => string;
  /** Sync history on binding creation */
  syncHistory?: boolean;
  /** Number of historical messages to sync */
  historySyncLimit?: number;
};

export type ChannelBinding = {
  bindingId: string;
  agentChannelId: string;
  platform: ExternalPlatform;
  externalAccountId: string;
  externalChannelId: string;
  direction: BindingDirection;
  syncOptions: SyncOptions;
  status: SyncStatus;
  lastSyncAt?: number;
  lastError?: string;
  syncCursor?: string;
  createdAt: number;
  updatedAt?: number;
};

export type BindingEvent =
  | { type: "message.received"; binding: ChannelBinding; message: ExternalMessage }
  | { type: "message.sent"; binding: ChannelBinding; messageId: string; externalId: string }
  | { type: "message.edited"; binding: ChannelBinding; message: ExternalMessage }
  | { type: "message.deleted"; binding: ChannelBinding; externalId: string }
  | {
      type: "reaction.added";
      binding: ChannelBinding;
      messageId: string;
      emoji: string;
      userId: string;
    }
  | {
      type: "reaction.removed";
      binding: ChannelBinding;
      messageId: string;
      emoji: string;
      userId: string;
    }
  | { type: "thread.created"; binding: ChannelBinding; parentId: string; threadId: string }
  | { type: "sync.started"; binding: ChannelBinding }
  | { type: "sync.completed"; binding: ChannelBinding; messageCount: number }
  | { type: "sync.error"; binding: ChannelBinding; error: string }
  | {
      type: "status.changed";
      binding: ChannelBinding;
      oldStatus: SyncStatus;
      newStatus: SyncStatus;
    };

export type CreateBindingParams = {
  agentChannelId: string;
  platform: ExternalPlatform;
  externalAccountId: string;
  externalChannelId: string;
  direction?: BindingDirection;
  syncOptions?: Partial<SyncOptions>;
};

export type MessageMapping = {
  internalId: string;
  externalId: string;
  platform: ExternalPlatform;
  bindingId: string;
  createdAt: number;
};

// Platform-specific credentials
export type SlackCredentials = {
  botToken: string;
  userToken?: string;
  signingSecret?: string;
  appId?: string;
  teamId?: string;
};

export type DiscordCredentials = {
  botToken: string;
  applicationId?: string;
  guildId?: string;
};

export type TelegramCredentials = {
  botToken: string;
  apiId?: number;
  apiHash?: string;
};

export type PlatformCredentials =
  | { platform: "slack"; credentials: SlackCredentials }
  | { platform: "discord"; credentials: DiscordCredentials }
  | { platform: "telegram"; credentials: TelegramCredentials };

/**
 * Interface for platform adapters.
 */
export interface IPlatformAdapter {
  platform: ExternalPlatform;

  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Channel operations
  getChannel(channelId: string): Promise<ExternalChannelInfo | null>;
  listChannels(): Promise<ExternalChannelInfo[]>;

  // Message operations
  sendMessage(
    channelId: string,
    content: string,
    options?: {
      threadId?: string;
      replyToId?: string;
    },
  ): Promise<string>; // Returns external message ID

  editMessage(channelId: string, messageId: string, content: string): Promise<void>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;

  // Reactions
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  removeReaction(channelId: string, messageId: string, emoji: string): Promise<void>;

  // History
  getMessages(
    channelId: string,
    options?: {
      before?: string;
      after?: string;
      limit?: number;
    },
  ): Promise<ExternalMessage[]>;

  // Event handling
  onMessage(handler: (message: ExternalMessage) => void): void;
  onMessageEdit(handler: (message: ExternalMessage) => void): void;
  onMessageDelete(handler: (channelId: string, messageId: string) => void): void;
  onReaction(
    handler: (
      channelId: string,
      messageId: string,
      emoji: string,
      userId: string,
      added: boolean,
    ) => void,
  ): void;
}
