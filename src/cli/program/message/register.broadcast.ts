import type { Command } from "commander";
import { CHANNEL_TARGETS_DESCRIPTION } from "../../../infra/outbound/channel-target.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageBroadcastCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      message.command("broadcast").description("向多个目标广播消息"),
    )
    .requiredOption("--targets <target...>", CHANNEL_TARGETS_DESCRIPTION)
    .option("--message <text>", "要发送的消息")
    .option("--media <url>", "媒体 URL")
    .action(async (options: Record<string, unknown>) => {
      await helpers.runMessageAction("broadcast", options);
    });
}
