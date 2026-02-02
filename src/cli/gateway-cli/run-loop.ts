import type { startGatewayServer } from "../../gateway/server.js";
import { acquireGatewayLock } from "../../infra/gateway-lock.js";
import {
  consumeGatewaySigusr1RestartAuthorization,
  isGatewaySigusr1RestartExternallyAllowed,
} from "../../infra/restart.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { defaultRuntime } from "../../runtime.js";

const gatewayLog = createSubsystemLogger("gateway");

type GatewayRunSignalAction = "stop" | "restart";

export async function runGatewayLoop(params: {
  start: () => Promise<Awaited<ReturnType<typeof startGatewayServer>>>;
  runtime: typeof defaultRuntime;
}) {
  const lock = await acquireGatewayLock();
  let server: Awaited<ReturnType<typeof startGatewayServer>> | null = null;
  let shuttingDown = false;
  let restartResolver: (() => void) | null = null;

  const cleanupSignals = () => {
    process.removeListener("SIGTERM", onSigterm);
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGUSR1", onSigusr1);
  };

  const request = (action: GatewayRunSignalAction, signal: string) => {
    if (shuttingDown) {
      gatewayLog.info(`在关闭期间收到 ${signal}；忽略`);
      return;
    }
    shuttingDown = true;
    const isRestart = action === "restart";
    gatewayLog.info(`收到 ${signal}；${isRestart ? "正在重启" : "正在关闭"}`);

    const forceExitTimer = setTimeout(() => {
      gatewayLog.error("关闭超时；退出时未完全清理");
      cleanupSignals();
      params.runtime.exit(0);
    }, 5000);

    void (async () => {
      try {
        await server?.close({
          reason: isRestart ? "网关正在重启" : "网关正在停止",
          restartExpectedMs: isRestart ? 1500 : null,
        });
      } catch (err) {
        gatewayLog.error(`关闭错误: ${String(err)}`);
      } finally {
        clearTimeout(forceExitTimer);
        server = null;
        if (isRestart) {
          shuttingDown = false;
          restartResolver?.();
        } else {
          cleanupSignals();
          params.runtime.exit(0);
        }
      }
    })();
  };

  const onSigterm = () => {
    gatewayLog.info("收到 SIGTERM 信号");
    request("stop", "SIGTERM");
  };
  const onSigint = () => {
    gatewayLog.info("收到 SIGINT 信号");
    request("stop", "SIGINT");
  };
  const onSigusr1 = () => {
    gatewayLog.info("收到 SIGUSR1 信号");
    const authorized = consumeGatewaySigusr1RestartAuthorization();
    if (!authorized && !isGatewaySigusr1RestartExternallyAllowed()) {
      gatewayLog.warn(
        "忽略 SIGUSR1 重启 (未授权；启用 commands.restart 或使用 gateway 工具)。",
      );
      return;
    }
    request("restart", "SIGUSR1");
  };

  process.on("SIGTERM", onSigterm);
  process.on("SIGINT", onSigint);
  process.on("SIGUSR1", onSigusr1);

  try {
    // Keep process alive; SIGUSR1 triggers an in-process restart (no supervisor required).
    // SIGTERM/SIGINT still exit after a graceful shutdown.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      server = await params.start();
      await new Promise<void>((resolve) => {
        restartResolver = resolve;
      });
    }
  } finally {
    await lock?.release();
    cleanupSignals();
  }
}
