import { MESSAGE_ACTION_TARGET_MODE } from "./message-action-spec.js";

export const CHANNEL_TARGET_DESCRIPTION =
  "收件人/频道：WhatsApp/Signal 的 E.164，Telegram 聊天 ID/@username，Discord/Slack 频道/用户，或 iMessage 句柄/chat_id";

export const CHANNEL_TARGETS_DESCRIPTION =
  "收件人/频道目标（格式同 --target）；当目录可用时接受 ID 或名称。";

export function applyTargetToParams(params: {
  action: string;
  args: Record<string, unknown>;
}): void {
  const target = typeof params.args.target === "string" ? params.args.target.trim() : "";
  const hasLegacyTo = typeof params.args.to === "string";
  const hasLegacyChannelId = typeof params.args.channelId === "string";
  const mode =
    MESSAGE_ACTION_TARGET_MODE[params.action as keyof typeof MESSAGE_ACTION_TARGET_MODE] ?? "none";

  if (mode !== "none") {
    if (hasLegacyTo || hasLegacyChannelId) {
      throw new Error("请使用 `target` 代替 `to`/`channelId`。");
    }
  } else if (hasLegacyTo) {
    throw new Error("对于接受目的地的操作，请使用 `target`。");
  }

  if (!target) return;
  if (mode === "channelId") {
    params.args.channelId = target;
    return;
  }
  if (mode === "to") {
    params.args.to = target;
    return;
  }
  throw new Error(`操作 ${params.action} 不接受目标。`);
}
