import type { Command } from "commander";
import { callGateway } from "../../gateway/call.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../../utils/message-channel.js";
import { withProgress } from "../progress.js";

export type GatewayRpcOpts = {
  url?: string;
  token?: string;
  password?: string;
  timeout?: string;
  expectFinal?: boolean;
  json?: boolean;
};

export const gatewayCallOpts = (cmd: Command) =>
  cmd
    .option(
      "--url <url>",
      "网关 WebSocket URL (默认为配置中的 gateway.remote.url)",
    )
    .option("--token <token>", "网关令牌 (如需)")
    .option("--password <password>", "网关密码 (密码认证)")
    .option("--timeout <ms>", "超时时间 (ms)", "10000")
    .option("--expect-final", "等待最终响应 (agent)", false)
    .option("--json", "输出 JSON", false);

export const callGatewayCli = async (method: string, opts: GatewayRpcOpts, params?: unknown) =>
  withProgress(
    {
      label: `网关 ${method}`,
      indeterminate: true,
      enabled: opts.json !== true,
    },
    async () =>
      await callGateway({
        url: opts.url,
        token: opts.token,
        password: opts.password,
        method,
        params,
        expectFinal: Boolean(opts.expectFinal),
        timeoutMs: Number(opts.timeout ?? 10_000),
        clientName: GATEWAY_CLIENT_NAMES.CLI,
        mode: GATEWAY_CLIENT_MODES.CLI,
      }),
  );
