import type { Command } from "commander";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageSendCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers
        .withRequiredMessageTarget(
          message
            .command("send")
            .description("发送一条消息")
            .option("-m, --message <text>", "消息正文（除非设置了 --media 否则必填）"),
        )
        .option(
          "--media <path-or-url>",
          "附加媒体（图像/音频/视频/文档）。接受本地路径或 URL。",
        )
        .option(
          "--buttons <json>",
          "Telegram 内联键盘按钮的 JSON（按钮行数组）",
        )
        .option("--card <json>", "自适应卡片 JSON 对象（当频道支持时）")
        .option("--reply-to <id>", "回复的消息 ID")
        .option("--thread-id <id>", "线程 ID（Telegram 论坛线程）")
        .option("--gif-playback", "将视频媒体视为 GIF 播放（仅限 WhatsApp）。", false)
        .option("--silent", "静默发送消息不通知（仅限 Telegram）", false),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("send", opts);
    });
}
