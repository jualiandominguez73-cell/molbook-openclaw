import type { Command } from "commander";
import { DEFAULT_CHAT_CHANNEL } from "../../channels/registry.js";
import { agentCliCommand } from "../../commands/agent-via-gateway.js";
import {
  agentsAddCommand,
  agentsDeleteCommand,
  agentsListCommand,
  agentsSetIdentityCommand,
} from "../../commands/agents.js";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { hasExplicitOptions } from "../command-options.js";
import { formatHelpExamples } from "../help-format.js";
import { createDefaultDeps } from "../deps.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { collectOption } from "./helpers.js";

export function registerAgentCommands(program: Command, args: { agentChannelOptions: string }) {
  program
    .command("agent")
    .description("通过网关运行一次代理回合（嵌入式请用 --local）")
    .requiredOption("-m, --message <text>", "发送给代理的消息正文")
    .option("-t, --to <number>", "收件人号码（E.164，用于生成会话键）")
    .option("--session-id <id>", "使用显式 session id")
    .option("--agent <id>", "代理 ID（覆盖路由绑定）")
    .option("--thinking <level>", "思考等级：off | minimal | low | medium | high")
    .option("--verbose <on|off>", "为该会话持久化代理详细日志级别")
    .option(
      "--channel <channel>",
      `投递频道：${args.agentChannelOptions}（默认：${DEFAULT_CHAT_CHANNEL}）`,
    )
    .option("--reply-to <target>", "覆盖投递目标（与会话路由分离）")
    .option("--reply-channel <channel>", "覆盖投递频道（与路由分离）")
    .option("--reply-account <id>", "覆盖投递账号 ID")
    .option(
      "--local",
      "在本地运行嵌入式代理（需要在当前 shell 中提供模型提供方 API 密钥）",
      false,
    )
    .option("--deliver", "将代理回复回投到所选频道", false)
    .option("--json", "以 JSON 输出结果", false)
    .option(
      "--timeout <seconds>",
      "覆盖代理命令超时（秒，默认 600 或配置值）",
    )
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("示例:")}
${formatHelpExamples([
  ['openclaw agent --to +15555550123 --message "status update"', "开始一个新会话。"],
  ['openclaw agent --agent ops --message "Summarize logs"', "使用指定代理。"],
  [
    'openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium',
    "指定会话并显式设置思考等级。",
  ],
  [
    'openclaw agent --to +15555550123 --message "Trace logs" --verbose on --json',
    "启用详细日志并输出 JSON。",
  ],
  ['openclaw agent --to +15555550123 --message "Summon reply" --deliver', "投递回复。"],
  [
    'openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"',
    "将回复投递到不同的频道/目标。",
  ],
])}

${theme.muted("文档:")} ${formatDocsLink("/cli/agent", "docs.openclaw.ai/cli/agent")}`,
    )
    .action(async (opts) => {
      const verboseLevel = typeof opts.verbose === "string" ? opts.verbose.toLowerCase() : "";
      setVerbose(verboseLevel === "on");
      // Build default deps (keeps parity with other commands; future-proofing).
      const deps = createDefaultDeps();
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentCliCommand(opts, defaultRuntime, deps);
      });
    });

  const agents = program
    .command("agents")
    .description("管理隔离代理（工作区 + 认证 + 路由）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/agents", "docs.openclaw.ai/cli/agents")}\n`,
    );

  agents
    .command("list")
    .description("列出已配置的代理")
    .option("--json", "输出 JSON（而非文本）", false)
    .option("--bindings", "包含路由绑定", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsListCommand(
          { json: Boolean(opts.json), bindings: Boolean(opts.bindings) },
          defaultRuntime,
        );
      });
    });

  agents
    .command("add [name]")
    .description("新增一个隔离代理")
    .option("--workspace <dir>", "新代理的工作区目录")
    .option("--model <id>", "该代理使用的模型 ID")
    .option("--agent-dir <dir>", "该代理的状态目录")
    .option("--bind <channel[:accountId]>", "路由频道绑定（可重复指定）", collectOption, [])
    .option("--non-interactive", "禁用交互提示；需要 --workspace", false)
    .option("--json", "输出 JSON 总结", false)
    .action(async (name, opts, command) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const hasFlags = hasExplicitOptions(command, [
          "workspace",
          "model",
          "agentDir",
          "bind",
          "nonInteractive",
        ]);
        await agentsAddCommand(
          {
            name: typeof name === "string" ? name : undefined,
            workspace: opts.workspace as string | undefined,
            model: opts.model as string | undefined,
            agentDir: opts.agentDir as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            nonInteractive: Boolean(opts.nonInteractive),
            json: Boolean(opts.json),
          },
          defaultRuntime,
          { hasFlags },
        );
      });
    });

  agents
    .command("set-identity")
    .description("更新代理身份信息（name/theme/emoji/avatar）")
    .option("--agent <id>", "要更新的代理 ID")
    .option("--workspace <dir>", "用于定位代理与 IDENTITY.md 的工作区目录")
    .option("--identity-file <path>", "要读取的 IDENTITY.md 显式路径")
    .option("--from-identity", "从 IDENTITY.md 读取值", false)
    .option("--name <name>", "身份名称")
    .option("--theme <theme>", "身份主题")
    .option("--emoji <emoji>", "身份表情")
    .option("--avatar <value>", "身份头像（工作区路径、http(s) URL 或 data URI）")
    .option("--json", "输出 JSON 总结", false)
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("示例:")}
${formatHelpExamples([
  ['openclaw agents set-identity --agent main --name "OpenClaw" --emoji "🦞"', "设置名称与表情。"],
  ["openclaw agents set-identity --agent main --avatar avatars/openclaw.png", "设置头像路径。"],
  [
    "openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity",
    "从 IDENTITY.md 加载。",
  ],
  [
    "openclaw agents set-identity --identity-file ~/.openclaw/workspace/IDENTITY.md --agent main",
    "使用指定的 IDENTITY.md。",
  ],
])}
`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsSetIdentityCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            identityFile: opts.identityFile as string | undefined,
            fromIdentity: Boolean(opts.fromIdentity),
            name: opts.name as string | undefined,
            theme: opts.theme as string | undefined,
            emoji: opts.emoji as string | undefined,
            avatar: opts.avatar as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("delete <id>")
    .description("删除代理并清理工作区/状态")
    .option("--force", "跳过确认", false)
    .option("--json", "输出 JSON 总结", false)
    .action(async (id, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsDeleteCommand(
          {
            id: String(id),
            force: Boolean(opts.force),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents.action(async () => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      await agentsListCommand({}, defaultRuntime);
    });
  });
}
