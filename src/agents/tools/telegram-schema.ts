import { Type } from "@sinclair/typebox";

import { createReactionSchema } from "./reaction-schema.js";

export const TelegramToolSchema = Type.Union([
  createReactionSchema({
    ids: {
      chatId: Type.Union([Type.String(), Type.Number()]),
      messageId: Type.Union([Type.String(), Type.Number()]),
    },
    includeRemove: true,
  }),
  Type.Object({
    action: Type.Literal("sendMessage"),
    to: Type.String({ description: "Chat ID, @username, or t.me/username" }),
    content: Type.String({ description: "Message text to send" }),
    mediaUrl: Type.Optional(
      Type.String({ description: "URL of image/video/audio to attach" }),
    ),
    replyToMessageId: Type.Optional(
      Type.Union([Type.String(), Type.Number()], {
        description: "Message ID to reply to (for threading)",
      }),
    ),
    messageThreadId: Type.Optional(
      Type.Union([Type.String(), Type.Number()], {
        description: "Forum topic thread ID (for forum supergroups)",
      }),
    ),
  }),
]);
