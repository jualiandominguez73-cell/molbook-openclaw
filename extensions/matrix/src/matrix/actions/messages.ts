import { resolveMatrixRoomId, sendMessageMatrix } from "../send.js";
import { downloadMatrixMedia } from "../monitor/media.js";
import { resolveActionClient } from "./client.js";
import { summarizeMatrixRawEvent } from "./summary.js";
import {
  EventType,
  MsgType,
  RelationType,
  type MatrixActionClientOpts,
  type MatrixMessageSummary,
  type MatrixRawEvent,
  type RoomMessageEventContent,
} from "./types.js";

export type MatrixThreadMessage = {
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
  msgtype?: string;
  mediaPath?: string;
  mediaType?: string;
};

export type MatrixThreadResult = {
  roomId: string;
  threadId: string;
  root: MatrixThreadMessage;
  replies: MatrixThreadMessage[];
};

export async function sendMatrixMessage(
  to: string,
  content: string,
  opts: MatrixActionClientOpts & {
    mediaUrl?: string;
    replyToId?: string;
    threadId?: string;
  } = {},
) {
  return await sendMessageMatrix(to, content, {
    mediaUrl: opts.mediaUrl,
    replyToId: opts.replyToId,
    threadId: opts.threadId,
    client: opts.client,
    timeoutMs: opts.timeoutMs,
  });
}

export async function editMatrixMessage(
  roomId: string,
  messageId: string,
  content: string,
  opts: MatrixActionClientOpts = {},
) {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Matrix edit requires content");
  }
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const newContent = {
      msgtype: MsgType.Text,
      body: trimmed,
    } satisfies RoomMessageEventContent;
    const payload: RoomMessageEventContent = {
      msgtype: MsgType.Text,
      body: `* ${trimmed}`,
      "m.new_content": newContent,
      "m.relates_to": {
        rel_type: RelationType.Replace,
        event_id: messageId,
      },
    };
    const eventId = await client.sendMessage(resolvedRoom, payload);
    return { eventId: eventId ?? null };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}

export async function deleteMatrixMessage(
  roomId: string,
  messageId: string,
  opts: MatrixActionClientOpts & { reason?: string } = {},
) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    await client.redactEvent(resolvedRoom, messageId, opts.reason);
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}

export async function readMatrixMessages(
  roomId: string,
  opts: MatrixActionClientOpts & {
    limit?: number;
    before?: string;
    after?: string;
  } = {},
): Promise<{
  messages: MatrixMessageSummary[];
  nextBatch?: string | null;
  prevBatch?: string | null;
}> {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const limit =
      typeof opts.limit === "number" && Number.isFinite(opts.limit)
        ? Math.max(1, Math.floor(opts.limit))
        : 20;
    const token = opts.before?.trim() || opts.after?.trim() || undefined;
    const dir = opts.after ? "f" : "b";
    // @vector-im/matrix-bot-sdk uses doRequest for room messages
    const res = (await client.doRequest(
      "GET",
      `/_matrix/client/v3/rooms/${encodeURIComponent(resolvedRoom)}/messages`,
      {
        dir,
        limit,
        from: token,
      },
    )) as { chunk: MatrixRawEvent[]; start?: string; end?: string };
    const messages = res.chunk
      .filter((event) => event.type === EventType.RoomMessage)
      .filter((event) => !event.unsigned?.redacted_because)
      .map(summarizeMatrixRawEvent);
    return {
      messages,
      nextBatch: res.end ?? null,
      prevBatch: res.start ?? null,
    };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}

type ThreadMessageContent = {
  msgtype?: string;
  body?: string;
  url?: string;
  file?: {
    url: string;
    key: { kty: string; key_ops: string[]; alg: string; k: string; ext: boolean };
    iv: string;
    hashes: Record<string, string>;
    v: string;
  };
  info?: { mimetype?: string; size?: number };
};

async function extractThreadMessage(
  client: ReturnType<typeof resolveActionClient> extends Promise<infer T> ? T : never,
  event: MatrixRawEvent,
  maxMediaBytes: number,
): Promise<MatrixThreadMessage | null> {
  if (event.unsigned?.redacted_because) {
    return null;
  }
  const content = event.content as ThreadMessageContent;
  const body = content?.body;
  if (typeof body !== "string" || !body.trim()) {
    return null;
  }

  let mediaPath: string | undefined;
  let mediaType: string | undefined;
  const mediaUrl = content.url ?? content.file?.url;
  if (mediaUrl?.startsWith("mxc://")) {
    try {
      const media = await downloadMatrixMedia({
        client: client.client,
        mxcUrl: mediaUrl,
        contentType: content.info?.mimetype,
        maxBytes: maxMediaBytes,
        file: content.file,
      });
      if (media) {
        mediaPath = media.path;
        mediaType = media.contentType;
      }
    } catch {
      // Media download failed, continue without it
    }
  }

  return {
    eventId: event.event_id,
    sender: event.sender,
    body: body.trim(),
    timestamp: event.origin_server_ts,
    msgtype: content.msgtype,
    mediaPath,
    mediaType,
  };
}

export async function readMatrixThread(
  roomId: string,
  threadId: string,
  opts: MatrixActionClientOpts & {
    limit?: number;
    maxMediaBytes?: number;
  } = {},
): Promise<MatrixThreadResult> {
  const actionClient = await resolveActionClient(opts);
  const { client, stopOnDone } = actionClient;
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const limit =
      typeof opts.limit === "number" && Number.isFinite(opts.limit)
        ? Math.max(1, Math.floor(opts.limit))
        : 50;
    const maxMediaBytes = opts.maxMediaBytes ?? 20 * 1024 * 1024; // 20MB default

    // Fetch thread root event
    const rootEvent = (await client.getEvent(resolvedRoom, threadId)) as MatrixRawEvent;
    const root = await extractThreadMessage(actionClient, rootEvent, maxMediaBytes);
    if (!root) {
      throw new Error(`Thread root ${threadId} not found or has no content`);
    }

    // Fetch thread replies using relations API
    const res = (await client.doRequest(
      "GET",
      `/_matrix/client/v1/rooms/${encodeURIComponent(resolvedRoom)}/relations/${encodeURIComponent(threadId)}/m.thread`,
      { dir: "f", limit },
    )) as { chunk: MatrixRawEvent[] };

    // Extract all replies with media
    const replies: MatrixThreadMessage[] = [];
    for (const event of res.chunk ?? []) {
      const msg = await extractThreadMessage(actionClient, event, maxMediaBytes);
      if (msg) {
        replies.push(msg);
      }
    }

    // Sort replies by timestamp (oldest first)
    replies.sort((a, b) => a.timestamp - b.timestamp);

    return {
      roomId: resolvedRoom,
      threadId,
      root,
      replies,
    };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
