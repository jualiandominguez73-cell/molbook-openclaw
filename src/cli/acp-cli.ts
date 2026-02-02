import type { Command } from "commander";

import { runAcpClientInteractive } from "../acp/client.js";
import { serveAcpGateway } from "../acp/server.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";

export function registerAcpCli(program: Command) {
  const acp = program.command("acp").description("运行由网关支持的 ACP 桥接");

  acp
    .option("--url <url>", "网关 WebSocket URL（配置时默认为 gateway.remote.url）")
    .option("--token <token>", "网关令牌（如需要）")
    .option("--password <password>", "网关密码（如需要）")
    .option("--session <key>", "默认会话键（例如 agent:main:main）")
    .option("--session-label <label>", "要解析的默认会话标签")
    .option("--require-existing", "如果会话键/标签不存在则失败", false)
    .option("--reset-session", "首次使用前重置会话键", false)
    .option("--no-prefix-cwd", "不要在提示符前添加工作目录", false)
    .option("--verbose, -v", "详细日志输出到 stderr", false)
    .addHelpText(
      "after",
      () => `\n${theme.muted("文档:")} ${formatDocsLink("/cli/acp", "docs.openclaw.ai/cli/acp")}\n`,
    )
    .action((opts) => {
      try {
        serveAcpGateway({
          gatewayUrl: opts.url as string | undefined,
          gatewayToken: opts.token as string | undefined,
          gatewayPassword: opts.password as string | undefined,
          defaultSessionKey: opts.session as string | undefined,
          defaultSessionLabel: opts.sessionLabel as string | undefined,
          requireExistingSession: Boolean(opts.requireExisting),
          resetSession: Boolean(opts.resetSession),
          prefixCwd: !opts.noPrefixCwd,
          verbose: Boolean(opts.verbose),
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  acp
    .command("client")
    .description("针对本地 ACP 桥接运行交互式 ACP 客户端")
    .option("--cwd <dir>", "ACP 会话的工作目录")
    .option("--server <command>", "ACP 服务端命令（默认：openclaw）")
    .option("--server-args <args...>", "ACP 服务端的额外参数")
    .option("--server-verbose", "启用 ACP 服务端的详细日志", false)
    .option("--verbose, -v", "详细客户端日志", false)
    .action(async (opts) => {
      try {
        await runAcpClientInteractive({
          cwd: opts.cwd as string | undefined,
          serverCommand: opts.server as string | undefined,
          serverArgs: opts.serverArgs as string[] | undefined,
          serverVerbose: Boolean(opts.serverVerbose),
          verbose: Boolean(opts.verbose),
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
