import type { Command } from "commander";
import { collectOption } from "../helpers.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessagePermissionsCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message.command("permissions").description("获取频道权限"),
      ),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("permissions", opts);
    });
}

export function registerMessageSearchCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(message.command("search").description("搜索 Discord 消息"))
    .requiredOption("--guild-id <id>", "公会 ID")
    .requiredOption("--query <text>", "搜索查询")
    .option("--channel-id <id>", "频道 ID")
    .option("--channel-ids <id>", "频道 ID（重复）", collectOption, [] as string[])
    .option("--author-id <id>", "作者 ID")
    .option("--author-ids <id>", "作者 ID（重复）", collectOption, [] as string[])
    .option("--limit <n>", "结果限制")
    .action(async (opts) => {
      await helpers.runMessageAction("search", opts);
    });
}
