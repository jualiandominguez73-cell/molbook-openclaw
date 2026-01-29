/**
 * DingTalk Bot API Types
 * Based on: https://open.dingtalk.com/document/orgapp/robot-message-types-and-data-format
 */

// Re-export core types for convenience
export type {
  DingTalkAccountConfig,
  DingTalkConfig,
  DingTalkDmConfig,
  DingTalkGroupConfig,
} from "clawdbot/plugin-sdk";

// Inbound message types (received from DingTalk webhook callback)

export type DingTalkUser = {
  /** User ID in DingTalk */
  dingtalkId: string;
  /** Staff ID in enterprise */
  staffId?: string;
  /** User nickname */
  nick?: string;
};

export type DingTalkAtUser = {
  /** DingTalk ID of the mentioned user */
  dingtalkId: string;
  /** Staff ID of the mentioned user */
  staffId?: string;
};

/**
 * @deprecated Legacy webhook callback event from DingTalk
 * Use Stream mode instead (DingTalkStreamMessage)
 */
export type DingTalkCallbackEvent = {
  /** Message ID */
  msgId: string;
  /** Message type: text, richText, picture, audio, video, file */
  msgtype: string;
  /** Conversation ID */
  conversationId: string;
  /** Conversation type: "1" = single chat, "2" = group chat */
  conversationType: "1" | "2";
  /** Conversation title (group name for group chat) */
  conversationTitle?: string;
  /** Chat bot corp ID */
  chatbotCorpId: string;
  /** Chat bot user ID */
  chatbotUserId: string;
  /** Sender ID */
  senderId: string;
  /** Sender corp ID */
  senderCorpId?: string;
  /** Sender nickname */
  senderNick: string;
  /** Sender staff ID */
  senderStaffId?: string;
  /** Whether sender is admin */
  isAdmin?: boolean;
  /** Session webhook URL for replying */
  sessionWebhook: string;
  /** Session webhook expiration timestamp */
  sessionWebhookExpiredTime: number;
  /** Message creation timestamp */
  createAt: number;
  /** Robot code */
  robotCode?: string;
  /** Text content for text messages */
  text?: {
    content: string;
  };
  /** Content for rich text messages */
  content?: string;
  /** At users list */
  atUsers?: DingTalkAtUser[];
  /** Whether the robot was @mentioned */
  isInAtList?: boolean;
};

// Outbound message types (sent to DingTalk)

export type DingTalkTextMessage = {
  msgtype: "text";
  text: {
    content: string;
  };
  at?: {
    atMobiles?: string[];
    atUserIds?: string[];
    isAtAll?: boolean;
  };
};

export type DingTalkLinkMessage = {
  msgtype: "link";
  link: {
    title: string;
    text: string;
    messageUrl: string;
    picUrl?: string;
  };
};

export type DingTalkMarkdownMessage = {
  msgtype: "markdown";
  markdown: {
    title: string;
    text: string;
  };
  at?: {
    atMobiles?: string[];
    atUserIds?: string[];
    isAtAll?: boolean;
  };
};

export type DingTalkActionCardMessage = {
  msgtype: "actionCard";
  actionCard: {
    title: string;
    text: string;
    singleTitle?: string;
    singleURL?: string;
    btnOrientation?: "0" | "1";
    btns?: Array<{
      title: string;
      actionURL: string;
    }>;
  };
};

export type DingTalkFeedCardMessage = {
  msgtype: "feedCard";
  feedCard: {
    links: Array<{
      title: string;
      messageURL: string;
      picURL: string;
    }>;
  };
};

export type DingTalkOutboundMessage =
  | DingTalkTextMessage
  | DingTalkLinkMessage
  | DingTalkMarkdownMessage
  | DingTalkActionCardMessage
  | DingTalkFeedCardMessage;

// API response types

export type DingTalkApiResponse = {
  errcode: number;
  errmsg: string;
};

// Stream mode message types (from dingtalk-stream SDK)

export type DingTalkStreamMessage = {
  /** Platform of sender */
  senderPlatform?: string;
  /** Conversation ID */
  conversationId: string;
  /** At users list */
  atUsers?: Array<{
    dingtalkId: string;
    staffId?: string;
  }>;
  /** Chat bot corp ID */
  chatbotCorpId?: string;
  /** Message ID */
  msgId: string;
  /** Sender nickname */
  senderNick?: string;
  /** Whether sender is admin */
  isAdmin?: boolean;
  /** Sender staff ID (user ID) */
  senderStaffId: string;
  /** Session webhook URL for replying */
  sessionWebhook: string;
  /** Session webhook expiration timestamp */
  sessionWebhookExpiredTime?: number;
  /** Conversation type: "1" = single chat, "2" = group chat */
  conversationType?: "1" | "2";
  /** Conversation title (group name for group chat) */
  conversationTitle?: string;
  /** Text content */
  text?: {
    content: string;
  };
  /** Robot code */
  robotCode?: string;
  /** Message type: text, image, voice, file, link, markdown, etc. */
  msgtype: string;
  /** Whether robot was @mentioned (in the atUsers list) */
  isInAtList?: boolean;
  /** Sender corp ID */
  senderCorpId?: string;
  /** Message creation timestamp */
  createAt?: number;
};

// Local config type with additional legacy fields (for backward compatibility)
export type DingTalkLocalConfig = {
  accounts?: Record<string, unknown>;
  defaultAccount?: string;
  replyToMode?: "off" | "first" | "all";
};
