import type { Command } from "commander";
import { healthCommand } from "../../commands/health.js";
import { sessionsCommand } from "../../commands/sessions.js";
import { statusCommand } from "../../commands/status.js";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";
import { parsePositiveIntOrUndefined } from "./helpers.js";

function resolveVerbose(opts: { verbose?: boolean; debug?: boolean }): boolean {
  return Boolean(opts.verbose || opts.debug);
}

function parseTimeoutMs(timeout: unknown): number | null | undefined {
  const parsed = parsePositiveIntOrUndefined(timeout);
  if (timeout !== undefined && parsed === undefined) {
    defaultRuntime.error("--timeout 必须是正整数（毫秒）");
    defaultRuntime.exit(1);
    return null;
  }
  return parsed;
}

export function registerStatusHealthSessionsCommands(program: Command) {
  program
    .command("status")
    .description("显示频道健康状态与近期会话收件人")
    .option("--json", "输出 JSON（而非文本）", false)
    .option("--all", "完整诊断（只读，可复制粘贴）", false)
    .option("--usage", "显示模型提供方用量/配额快照", false)
    .option("--deep", "探测频道（WhatsApp Web + Telegram + Discord + Slack + Signal）", false)
    .option("--timeout <ms>", "探测超时（毫秒）", "10000")
    .option("--verbose", "详细日志", false)
    .option("--debug", "--verbose 的别名", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例:")}\n${formatHelpExamples([
          ["openclaw status", "显示频道健康状态与会话概要。"],
          ["openclaw status --all", "完整诊断（只读）。"],
          ["openclaw status --json", "机器可读输出。"],
          ["openclaw status --usage", "显示模型提供方用量/配额快照。"],
          [
            "openclaw status --deep",
            "运行频道探测（WA + Telegram + Discord + Slack + Signal）。",
          ],
          ["openclaw status --deep --timeout 5000", "缩短探测超时。"],
        ])}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/status", "docs.openclaw.ai/cli/status")}\n`,
    )
    .action(async (opts) => {
      const verbose = resolveVerbose(opts);
      setVerbose(verbose);
      const timeout = parseTimeoutMs(opts.timeout);
      if (timeout === null) {
        return;
      }
      await runCommandWithRuntime(defaultRuntime, async () => {
        await statusCommand(
          {
            json: Boolean(opts.json),
            all: Boolean(opts.all),
            deep: Boolean(opts.deep),
            usage: Boolean(opts.usage),
            timeoutMs: timeout,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  program
    .command("health")
    .description("从运行中的网关获取健康信息")
    .option("--json", "输出 JSON（而非文本）", false)
    .option("--timeout <ms>", "连接超时（毫秒）", "10000")
    .option("--verbose", "详细日志", false)
    .option("--debug", "--verbose 的别名", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/health", "docs.openclaw.ai/cli/health")}\n`,
    )
    .action(async (opts) => {
      const verbose = resolveVerbose(opts);
      setVerbose(verbose);
      const timeout = parseTimeoutMs(opts.timeout);
      if (timeout === null) {
        return;
      }
      await runCommandWithRuntime(defaultRuntime, async () => {
        await healthCommand(
          {
            json: Boolean(opts.json),
            timeoutMs: timeout,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  program
    .command("sessions")
    .description("列出已存储的对话会话")
    .option("--json", "输出为 JSON", false)
    .option("--verbose", "详细日志", false)
    .option("--store <path>", "会话存储路径（默认：从配置解析）")
    .option("--active <minutes>", "仅显示最近 N 分钟内更新的会话")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例:")}\n${formatHelpExamples([
          ["openclaw sessions", "列出所有会话。"],
          ["openclaw sessions --active 120", "仅显示最近 2 小时。"],
          ["openclaw sessions --json", "机器可读输出。"],
          ["openclaw sessions --store ./tmp/sessions.json", "使用指定的会话存储文件。"],
        ])}\n\n${theme.muted(
          "当代理上报时，显示每个会话的 token 用量；设置 agents.defaults.contextTokens 以显示占模型上下文窗口的百分比。",
        )}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/sessions", "docs.openclaw.ai/cli/sessions")}\n`,
    )
    .action(async (opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionsCommand(
        {
          json: Boolean(opts.json),
          store: opts.store as string | undefined,
          active: opts.active as string | undefined,
        },
        defaultRuntime,
      );
    });
}
