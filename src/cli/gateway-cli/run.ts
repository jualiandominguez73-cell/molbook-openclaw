import fs from "node:fs";

import type { Command } from "commander";
import type { GatewayAuthMode } from "../../config/config.js";
import {
  CONFIG_PATH,
  loadConfig,
  readConfigFileSnapshot,
  resolveGatewayPort,
} from "../../config/config.js";
import { resolveGatewayAuth } from "../../gateway/auth.js";
import { startGatewayServer } from "../../gateway/server.js";
import type { GatewayWsLogStyle } from "../../gateway/ws-logging.js";
import { setGatewayWsLogStyle } from "../../gateway/ws-logging.js";
import { setVerbose } from "../../globals.js";
import { GatewayLockError } from "../../infra/gateway-lock.js";
import { formatPortDiagnostics, inspectPortUsage } from "../../infra/ports.js";
import { setConsoleSubsystemFilter, setConsoleTimestampPrefix } from "../../logging/console.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { defaultRuntime } from "../../runtime.js";
import { formatCliCommand } from "../command-format.js";
import { forceFreePortAndWait } from "../ports.js";
import { ensureDevGatewayConfig } from "./dev.js";
import { runGatewayLoop } from "./run-loop.js";
import {
  describeUnknownError,
  extractGatewayMiskeys,
  maybeExplainGatewayServiceStop,
  parsePort,
  toOptionString,
} from "./shared.js";

type GatewayRunOpts = {
  port?: unknown;
  bind?: unknown;
  token?: unknown;
  auth?: unknown;
  password?: unknown;
  tailscale?: unknown;
  tailscaleResetOnExit?: boolean;
  allowUnconfigured?: boolean;
  force?: boolean;
  verbose?: boolean;
  claudeCliLogs?: boolean;
  wsLog?: unknown;
  compact?: boolean;
  rawStream?: boolean;
  rawStreamPath?: unknown;
  dev?: boolean;
  reset?: boolean;
};

const gatewayLog = createSubsystemLogger("gateway");

async function runGatewayCommand(opts: GatewayRunOpts) {
  const isDevProfile = process.env.OPENCLAW_PROFILE?.trim().toLowerCase() === "dev";
  const devMode = Boolean(opts.dev) || isDevProfile;
  if (opts.reset && !devMode) {
    defaultRuntime.error("请配合 --dev 使用 --reset。");
    defaultRuntime.exit(1);
    return;
  }

  setConsoleTimestampPrefix(true);
  setVerbose(Boolean(opts.verbose));
  if (opts.claudeCliLogs) {
    setConsoleSubsystemFilter(["agent/claude-cli"]);
    process.env.OPENCLAW_CLAUDE_CLI_LOG_OUTPUT = "1";
  }
  const wsLogRaw = (opts.compact ? "compact" : opts.wsLog) as string | undefined;
  const wsLogStyle: GatewayWsLogStyle =
    wsLogRaw === "compact" ? "compact" : wsLogRaw === "full" ? "full" : "auto";
  if (
    wsLogRaw !== undefined &&
    wsLogRaw !== "auto" &&
    wsLogRaw !== "compact" &&
    wsLogRaw !== "full"
  ) {
    defaultRuntime.error('无效的 --ws-log (请使用 "auto", "full", "compact")');
    defaultRuntime.exit(1);
  }
  setGatewayWsLogStyle(wsLogStyle);

  if (opts.rawStream) {
    process.env.OPENCLAW_RAW_STREAM = "1";
  }
  const rawStreamPath = toOptionString(opts.rawStreamPath);
  if (rawStreamPath) {
    process.env.OPENCLAW_RAW_STREAM_PATH = rawStreamPath;
  }

  if (devMode) {
    await ensureDevGatewayConfig({ reset: Boolean(opts.reset) });
  }

  const cfg = loadConfig();
  const portOverride = parsePort(opts.port);
  if (opts.port !== undefined && portOverride === null) {
    defaultRuntime.error("无效端口");
    defaultRuntime.exit(1);
  }
  const port = portOverride ?? resolveGatewayPort(cfg);
  if (!Number.isFinite(port) || port <= 0) {
    defaultRuntime.error("无效端口");
    defaultRuntime.exit(1);
  }
  if (opts.force) {
    try {
      const { killed, waitedMs, escalatedToSigkill } = await forceFreePortAndWait(port, {
        timeoutMs: 2000,
        intervalMs: 100,
        sigtermTimeoutMs: 700,
      });
      if (killed.length === 0) {
        gatewayLog.info(`强制: 端口 ${port} 上无监听者`);
      } else {
        for (const proc of killed) {
          gatewayLog.info(
            `强制: 已终止 pid ${proc.pid}${proc.command ? ` (${proc.command})` : ""} (端口 ${port})`,
          );
        }
        if (escalatedToSigkill) {
          gatewayLog.info(`强制: 升级为 SIGKILL 以释放端口 ${port}`);
        }
        if (waitedMs > 0) {
          gatewayLog.info(`强制: 等待了 ${waitedMs}ms 以释放端口 ${port}`);
        }
      }
    } catch (err) {
      defaultRuntime.error(`强制: ${String(err)}`);
      defaultRuntime.exit(1);
      return;
    }
  }
  if (opts.token) {
    const token = toOptionString(opts.token);
    if (token) {
      process.env.OPENCLAW_GATEWAY_TOKEN = token;
    }
  }
  const authModeRaw = toOptionString(opts.auth);
  const authMode: GatewayAuthMode | null =
    authModeRaw === "token" || authModeRaw === "password" ? authModeRaw : null;
  if (authModeRaw && !authMode) {
    defaultRuntime.error('无效的 --auth (请使用 "token" 或 "password")');
    defaultRuntime.exit(1);
    return;
  }
  const tailscaleRaw = toOptionString(opts.tailscale);
  const tailscaleMode =
    tailscaleRaw === "off" || tailscaleRaw === "serve" || tailscaleRaw === "funnel"
      ? tailscaleRaw
      : null;
  if (tailscaleRaw && !tailscaleMode) {
    defaultRuntime.error('无效的 --tailscale (请使用 "off", "serve", 或 "funnel")');
    defaultRuntime.exit(1);
    return;
  }
  const passwordRaw = toOptionString(opts.password);
  const tokenRaw = toOptionString(opts.token);

  const snapshot = await readConfigFileSnapshot().catch(() => null);
  const configExists = snapshot?.exists ?? fs.existsSync(CONFIG_PATH);
  const mode = cfg.gateway?.mode;
  if (!opts.allowUnconfigured && mode !== "local") {
    if (!configExists) {
      defaultRuntime.error(
        `缺少配置。运行 \`${formatCliCommand("openclaw setup")}\` 或设置 gateway.mode=local (或传递 --allow-unconfigured)。`,
      );
    } else {
      defaultRuntime.error(
        `网关启动受阻: 设置 gateway.mode=local (当前: ${mode ?? "unset"}) 或传递 --allow-unconfigured。`,
      );
    }
    defaultRuntime.exit(1);
    return;
  }
  const bindRaw = toOptionString(opts.bind) ?? cfg.gateway?.bind ?? "loopback";
  const bind =
    bindRaw === "loopback" ||
    bindRaw === "lan" ||
    bindRaw === "auto" ||
    bindRaw === "custom" ||
    bindRaw === "tailnet"
      ? bindRaw
      : null;
  if (!bind) {
    defaultRuntime.error('无效的 --bind (请使用 "loopback", "lan", "tailnet", "auto", 或 "custom")');
    defaultRuntime.exit(1);
    return;
  }

  const miskeys = extractGatewayMiskeys(snapshot?.parsed);
  const authConfig = {
    ...cfg.gateway?.auth,
    ...(authMode ? { mode: authMode } : {}),
    ...(passwordRaw ? { password: passwordRaw } : {}),
    ...(tokenRaw ? { token: tokenRaw } : {}),
  };
  const resolvedAuth = resolveGatewayAuth({
    authConfig,
    env: process.env,
    tailscaleMode: tailscaleMode ?? cfg.gateway?.tailscale?.mode ?? "off",
  });
  const resolvedAuthMode = resolvedAuth.mode;
  const tokenValue = resolvedAuth.token;
  const passwordValue = resolvedAuth.password;
  const hasToken = typeof tokenValue === "string" && tokenValue.trim().length > 0;
  const hasPassword = typeof passwordValue === "string" && passwordValue.trim().length > 0;
  const hasSharedSecret =
    (resolvedAuthMode === "token" && hasToken) || (resolvedAuthMode === "password" && hasPassword);
  const authHints: string[] = [];
  if (miskeys.hasGatewayToken) {
    authHints.push('在配置中发现 "gateway.token"。请改用 "gateway.auth.token"。');
  }
  if (miskeys.hasRemoteToken) {
    authHints.push(
      '"gateway.remote.token" 用于远程 CLI 调用；它不启用本地网关认证。',
    );
  }
  if (resolvedAuthMode === "token" && !hasToken && !resolvedAuth.allowTailscale) {
    defaultRuntime.error(
      [
        "网关认证设置为令牌，但未配置令牌。",
        "设置 gateway.auth.token (或 OPENCLAW_GATEWAY_TOKEN)，或传递 --token。",
        ...authHints,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    defaultRuntime.exit(1);
    return;
  }
  if (resolvedAuthMode === "password" && !hasPassword) {
    defaultRuntime.error(
      [
        "网关认证设置为密码，但未配置密码。",
        "设置 gateway.auth.password (或 OPENCLAW_GATEWAY_PASSWORD)，或传递 --password。",
        ...authHints,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    defaultRuntime.exit(1);
    return;
  }
  if (bind !== "loopback" && !hasSharedSecret) {
    defaultRuntime.error(
      [
        `拒绝在无认证的情况下将网关绑定到 ${bind}。`,
        "设置 gateway.auth.token/password (或 OPENCLAW_GATEWAY_TOKEN/OPENCLAW_GATEWAY_PASSWORD) 或传递 --token/--password。",
        ...authHints,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    defaultRuntime.exit(1);
    return;
  }

  try {
    await runGatewayLoop({
      runtime: defaultRuntime,
      start: async () =>
        await startGatewayServer(port, {
          bind,
          auth:
            authMode || passwordRaw || tokenRaw || authModeRaw
              ? {
                  mode: authMode ?? undefined,
                  token: tokenRaw,
                  password: passwordRaw,
                }
              : undefined,
          tailscale:
            tailscaleMode || opts.tailscaleResetOnExit
              ? {
                  mode: tailscaleMode ?? undefined,
                  resetOnExit: Boolean(opts.tailscaleResetOnExit),
                }
              : undefined,
        }),
    });
  } catch (err) {
    if (
      err instanceof GatewayLockError ||
      (err && typeof err === "object" && (err as { name?: string }).name === "GatewayLockError")
    ) {
      const errMessage = describeUnknownError(err);
      defaultRuntime.error(
        `网关启动失败: ${errMessage}\n如果网关受监管，请使用以下命令停止: ${formatCliCommand("openclaw gateway stop")}`,
      );
      try {
        const diagnostics = await inspectPortUsage(port);
        if (diagnostics.status === "busy") {
          for (const line of formatPortDiagnostics(diagnostics)) {
            defaultRuntime.error(line);
          }
        }
      } catch {
        // ignore diagnostics failures
      }
      await maybeExplainGatewayServiceStop();
      defaultRuntime.exit(1);
      return;
    }
    defaultRuntime.error(`网关启动失败: ${String(err)}`);
    defaultRuntime.exit(1);
  }
}

export function addGatewayRunCommand(cmd: Command): Command {
  return cmd
    .option("--port <port>", "网关 WebSocket 端口")
    .option(
      "--bind <mode>",
      '绑定模式 ("loopback"|"lan"|"tailnet"|"auto"|"custom")。默认为配置 gateway.bind (或 loopback)。',
    )
    .option(
      "--token <token>",
      "connect.params.auth.token 所需的共享令牌 (默认: 如果设置了 OPENCLAW_GATEWAY_TOKEN env)",
    )
    .option("--auth <mode>", '网关认证模式 ("token"|"password")')
    .option("--password <password>", "auth mode=password 的密码")
    .option("--tailscale <mode>", 'Tailscale 暴露模式 ("off"|"serve"|"funnel")')
    .option(
      "--tailscale-reset-on-exit",
      "关闭时重置 Tailscale serve/funnel 配置",
      false,
    )
    .option(
      "--allow-unconfigured",
      "允许在配置中没有 gateway.mode=local 的情况下启动网关",
      false,
    )
    .option("--dev", "如果缺少则创建 dev 配置 + 工作区 (无 BOOTSTRAP.md)", false)
    .option(
      "--reset",
      "重置 dev 配置 + 凭据 + 会话 + 工作区 (需要 --dev)",
      false,
    )
    .option("--force", "在启动前终止目标端口上的任何现有监听器", false)
    .option("--verbose", "将详细日志记录到 stdout/stderr", false)
    .option(
      "--claude-cli-logs",
      "仅在控制台中显示 claude-cli 日志 (包括 stdout/stderr)",
      false,
    )
    .option("--ws-log <style>", 'WebSocket 日志样式 ("auto"|"full"|"compact")', "auto")
    .option("--compact", '"--ws-log compact" 的别名', false)
    .option("--raw-stream", "将原始模型流事件记录到 jsonl", false)
    .option("--raw-stream-path <path>", "原始流 jsonl 路径")
    .action(async (opts) => {
      await runGatewayCommand(opts);
    });
}
