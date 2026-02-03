/**
 * Message types for multi-agent channel system.
 * Supports threads, reactions, and rich content.
 */

export type MessageAuthorType = "agent" | "user" | "system" | "external";

export type MessageContentType = "text" | "code" | "image" | "file" | "embed" | "action";

export type MessageContentBlock =
  | { type: "text"; text: string }
  | { type: "code"; language?: string; code: string }
  | { type: "image"; url: string; alt?: string; width?: number; height?: number }
  | { type: "file"; url: string; name: string; size?: number; mimeType?: string }
  | { type: "embed"; title?: string; description?: string; url?: string; color?: string }
  | { type: "action"; actionId: string; label: string; style?: "primary" | "secondary" | "danger" };

export type MessageReaction = {
  emoji: string;
  count: number;
  reactedBy: string[]; // agent/user IDs
};

export type MessageMention = {
  type: "agent" | "user" | "channel" | "all";
  id: string;
  displayName?: string;
  startIndex: number;
  endIndex: number;
};

export type ChannelMessage = {
  id: string; // "cmsg_{uuid}"
  channelId: string;
  authorId: string;
  authorType: MessageAuthorType;
  authorName?: string;
  content: string; // Raw text content
  contentBlocks?: MessageContentBlock[];
  threadId?: string; // If part of a thread
  parentMessageId?: string; // If reply to a specific message
  mentions?: MessageMention[];
  reactions?: MessageReaction[];
  createdAt: number;
  updatedAt?: number;
  editedAt?: number;
  deletedAt?: number;
  seq: number; // Sequence number within channel for ordering
  metadata?: Record<string, unknown>;
  externalSourceId?: string; // If synced from external platform
  externalPlatform?: string;
};

export type CreateMessageParams = {
  channelId: string;
  authorId: string;
  authorType: MessageAuthorType;
  authorName?: string;
  content: string;
  contentBlocks?: MessageContentBlock[];
  threadId?: string;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
  externalSourceId?: string;
  externalPlatform?: string;
};

export type UpdateMessageParams = {
  content?: string;
  contentBlocks?: MessageContentBlock[];
  metadata?: Record<string, unknown>;
};

export type MessageQuery = {
  channelId: string;
  threadId?: string;
  beforeSeq?: number;
  afterSeq?: number;
  limit?: number;
  includeDeleted?: boolean;
  authorId?: string;
  authorType?: MessageAuthorType;
};

export type MessageSearchParams = {
  channelIds?: string[];
  query: string;
  authorId?: string;
  beforeDate?: number;
  afterDate?: number;
  limit?: number;
  offset?: number;
};

export type MessageSearchResult = {
  message: ChannelMessage;
  highlights: string[];
  score: number;
};

export function generateMessageId(): string {
  const uuid = crypto.randomUUID();
  return `cmsg_${uuid}`;
}

export function extractMentions(text: string): MessageMention[] {
  const mentions: MessageMention[] = [];
  const patterns = [
    // @agent:id format
    { regex: /@agent:([a-zA-Z0-9_-]+)/g, type: "agent" as const },
    // @AgentName format (capitalized word)
    { regex: /@([A-Z][a-zA-Z0-9_-]*)/g, type: "agent" as const },
    // @user:id format
    { regex: /@user:([a-zA-Z0-9_-]+)/g, type: "user" as const },
    // @channel format
    { regex: /@channel\b/gi, type: "channel" as const },
    // @all format
    { regex: /@all\b/gi, type: "all" as const },
    // @here format (like Slack)
    { regex: /@here\b/gi, type: "all" as const },
  ];

  for (const { regex, type } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      mentions.push({
        type,
        id: match[1] ?? type,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  // Sort by position and deduplicate overlapping mentions
  mentions.sort((a, b) => a.startIndex - b.startIndex);
  const deduped: MessageMention[] = [];
  for (const m of mentions) {
    const last = deduped[deduped.length - 1];
    if (!last || m.startIndex >= last.endIndex) {
      deduped.push(m);
    }
  }

  return deduped;
}
