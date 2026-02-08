import type { Client } from "@larksuiteoapi/node-sdk";
import { normalizeMentionAllForCard } from "./mention.js";

const STREAM_UPDATE_INTERVAL_MS = 500;
const STREAMING_ELEMENT_ID = "streaming_content";

type StreamingCardState = {
  cardId: string;
  messageId: string;
  sequence: number;
  currentText: string;
};

type SendOpts = {
  receiveIdType?: "open_id" | "user_id" | "union_id" | "email" | "chat_id";
  replyToId?: string | null;
  isGroup?: boolean;
  threadId?: string | null;
};

function buildStreamingCardJson(): string {
  return JSON.stringify({
    schema: "2.0",
    config: {
      streaming_mode: true,
      summary: { content: "[Generating...]" },
      streaming_config: {
        print_frequency_ms: { default: 50 },
        print_step: { default: 2 },
        print_strategy: "fast",
      },
    },
    body: {
      elements: [
        {
          tag: "markdown",
          content: "⏳ Thinking...",
          element_id: STREAMING_ELEMENT_ID,
        },
      ],
    },
  });
}

export class FeishuStreamingSession {
  private client: Client;
  private state: StreamingCardState | null = null;
  private updateQueue: Promise<void> = Promise.resolve();
  private closed = false;
  private lastUpdateAt = 0;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingText: string | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  async start(
    receiveId: string,
    receiveIdType: "open_id" | "user_id" | "union_id" | "email" | "chat_id" = "chat_id",
    opts?: SendOpts,
  ): Promise<void> {
    if (this.state) {
      return;
    }

    const createRes = await this.client.cardkit.v1.card.create({
      data: {
        type: "card_json",
        data: buildStreamingCardJson(),
      },
    });

    if (createRes.code !== 0 || !createRes.data?.card_id) {
      throw new Error(`Failed to create streaming card: ${createRes.msg}`);
    }

    const cardId = createRes.data.card_id;
    const content = JSON.stringify({ type: "card", data: { card_id: cardId } });

    const shouldReply =
      opts?.isGroup === true &&
      typeof opts.replyToId === "string" &&
      opts.replyToId.trim().length > 0;
    const replyMessageId = shouldReply ? opts!.replyToId!.trim() : undefined;

    let messageId: string;
    if (replyMessageId) {
      const res = await this.client.im.message.reply({
        path: { message_id: replyMessageId },
        data: {
          content,
          msg_type: "interactive",
          reply_in_thread: Boolean(opts?.threadId),
        },
      });
      if (res.code !== 0 || !res.data?.message_id) {
        throw new Error(`Failed to send streaming card: ${res.msg}`);
      }
      messageId = res.data.message_id;
    } else {
      const res = await this.client.im.message.create({
        params: { receive_id_type: receiveIdType },
        data: { receive_id: receiveId, msg_type: "interactive", content },
      });
      if (res.code !== 0 || !res.data?.message_id) {
        throw new Error(`Failed to send streaming card: ${res.msg}`);
      }
      messageId = res.data.message_id;
    }

    this.state = { cardId, messageId, sequence: 1, currentText: "" };
  }

  async update(text: string): Promise<void> {
    if (!this.state || this.closed) {
      return;
    }
    const mergedText = this.mergeText(text);
    if (!mergedText || mergedText === this.state.currentText) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastUpdateAt;
    if (elapsed >= STREAM_UPDATE_INTERVAL_MS) {
      this.clearPendingUpdate();
      this.lastUpdateAt = now;
      await this.queueUpdate(mergedText);
      return;
    }

    this.pendingText = mergedText;
    if (!this.pendingTimer) {
      const delay = Math.max(0, STREAM_UPDATE_INTERVAL_MS - elapsed);
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        const nextText = this.pendingText;
        this.pendingText = null;
        if (!nextText || this.closed) {
          return;
        }
        this.lastUpdateAt = Date.now();
        void this.queueUpdate(nextText);
      }, delay);
    }
  }

  async close(finalText?: string, summary?: string): Promise<boolean> {
    if (!this.state || this.closed) {
      return false;
    }
    this.closed = true;

    const pending = this.pendingText;
    this.pendingText = null;
    this.clearPendingUpdate();
    await this.updateQueue;

    const mergedFinal = typeof finalText === "string" ? this.mergeText(finalText) : undefined;
    const text = mergedFinal ?? pending ?? this.state.currentText;

    this.state.currentText = text ?? "";
    this.state.sequence += 1;

    try {
      if (text) {
        await this.client.cardkit.v1.cardElement.content({
          path: { card_id: this.state.cardId, element_id: STREAMING_ELEMENT_ID },
          data: {
            content: normalizeMentionAllForCard(text),
            sequence: this.state.sequence,
          },
        });
      }

      this.state.sequence += 1;
      const summaryText = summary ?? truncateForSummary(text);
      await this.client.cardkit.v1.card.settings({
        path: { card_id: this.state.cardId },
        data: {
          settings: JSON.stringify({
            config: {
              streaming_mode: false,
              summary: { content: normalizeMentionAllForCard(summaryText) },
            },
          }),
          sequence: this.state.sequence,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  isActive(): boolean {
    return this.state !== null && !this.closed;
  }

  getMessageId(): string | null {
    return this.state?.messageId ?? null;
  }

  getCurrentText(): string {
    return this.state?.currentText ?? "";
  }

  private clearPendingUpdate(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private queueUpdate(text: string): Promise<void> {
    if (!this.state || this.closed) {
      return this.updateQueue;
    }

    this.updateQueue = this.updateQueue.then(async () => {
      if (!this.state || this.closed) {
        return;
      }

      this.state.currentText = text;
      this.state.sequence += 1;

      try {
        await this.client.cardkit.v1.cardElement.content({
          path: { card_id: this.state.cardId, element_id: STREAMING_ELEMENT_ID },
          data: {
            content: normalizeMentionAllForCard(text),
            sequence: this.state.sequence,
          },
        });
      } catch {
        // Streaming update failures are non-fatal; next update will retry
      }
    });
    return this.updateQueue;
  }

  private mergeText(next: string): string {
    if (!this.state) {
      return next;
    }
    const prev = this.state.currentText;
    if (!prev) {
      return next;
    }
    if (next.startsWith(prev)) {
      return next;
    }
    return prev + next;
  }
}

function truncateForSummary(text: string, maxLength: number = 50): string {
  if (!text) {
    return "";
  }
  const cleaned = text.replace(/\n/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength - 3) + "...";
}
