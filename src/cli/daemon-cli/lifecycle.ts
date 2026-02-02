import { resolveIsNixMode } from "../../config/paths.js";
import { resolveGatewayService } from "../../daemon/service.js";
import { isSystemdUserServiceAvailable } from "../../daemon/systemd.js";
import { renderSystemdUnavailableHints } from "../../daemon/systemd-hints.js";
import { isWSL } from "../../infra/wsl.js";
import { defaultRuntime } from "../../runtime.js";
import { buildDaemonServiceSnapshot, createNullWriter, emitDaemonActionJson } from "./response.js";
import { renderGatewayServiceStartHints } from "./shared.js";
import type { DaemonLifecycleOptions } from "./types.js";

export async function runDaemonUninstall(opts: DaemonLifecycleOptions = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = (payload: {
    ok: boolean;
    result?: string;
    message?: string;
    error?: string;
    service?: {
      label: string;
      loaded: boolean;
      loadedText: string;
      notLoadedText: string;
    };
  }) => {
    if (!json) return;
    emitDaemonActionJson({ action: "uninstall", ...payload });
  };
  const fail = (message: string) => {
    if (json) emit({ ok: false, error: message });
    else defaultRuntime.error(message);
    defaultRuntime.exit(1);
  };

  if (resolveIsNixMode(process.env)) {
    fail("检测到 Nix 模式；服务卸载已禁用。");
    return;
  }

  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch {
    loaded = false;
  }
  if (loaded) {
    try {
      await service.stop({ env: process.env, stdout });
    } catch {
      // Best-effort stop; final loaded check gates success.
    }
  }
  try {
    await service.uninstall({ env: process.env, stdout });
  } catch (err) {
    fail(`网关卸载失败: ${String(err)}`);
    return;
  }

  loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch {
    loaded = false;
  }
  if (loaded) {
    fail("卸载后网关服务仍处于加载状态。");
    return;
  }
  emit({
    ok: true,
    result: "uninstalled",
    service: buildDaemonServiceSnapshot(service, loaded),
  });
}

export async function runDaemonStart(opts: DaemonLifecycleOptions = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = (payload: {
    ok: boolean;
    result?: string;
    message?: string;
    error?: string;
    hints?: string[];
    service?: {
      label: string;
      loaded: boolean;
      loadedText: string;
      notLoadedText: string;
    };
  }) => {
    if (!json) return;
    emitDaemonActionJson({ action: "start", ...payload });
  };
  const fail = (message: string, hints?: string[]) => {
    if (json) emit({ ok: false, error: message, hints });
    else defaultRuntime.error(message);
    defaultRuntime.exit(1);
  };

  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch (err) {
    fail(`Gateway service check failed: ${String(err)}`);
    return;
  }
  if (!loaded) {
    let hints = renderGatewayServiceStartHints();
    if (process.platform === "linux") {
      const systemdAvailable = await isSystemdUserServiceAvailable().catch(() => false);
      if (!systemdAvailable) {
        hints = [...hints, ...renderSystemdUnavailableHints({ wsl: await isWSL() })];
      }
    }
    emit({
      ok: true,
      result: "not-loaded",
      message: `网关服务 ${service.notLoadedText}。`,
      hints,
      service: buildDaemonServiceSnapshot(service, loaded),
    });
    if (!json) {
      defaultRuntime.log(`网关服务 ${service.notLoadedText}。`);
      for (const hint of hints) {
        defaultRuntime.log(`启动命令: ${hint}`);
      }
    }
    return;
  }
  try {
    await service.restart({ env: process.env, stdout });
  } catch (err) {
    const hints = renderGatewayServiceStartHints();
    fail(`网关启动失败: ${String(err)}`, hints);
    return;
  }

  let started = true;
  try {
    started = await service.isLoaded({ env: process.env });
  } catch {
    started = true;
  }
  emit({
    ok: true,
    result: "started",
    service: buildDaemonServiceSnapshot(service, started),
  });
}

export async function runDaemonStop(opts: DaemonLifecycleOptions = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = (payload: {
    ok: boolean;
    result?: string;
    message?: string;
    error?: string;
    service?: {
      label: string;
      loaded: boolean;
      loadedText: string;
      notLoadedText: string;
    };
  }) => {
    if (!json) return;
    emitDaemonActionJson({ action: "stop", ...payload });
  };
  const fail = (message: string) => {
    if (json) emit({ ok: false, error: message });
    else defaultRuntime.error(message);
    defaultRuntime.exit(1);
  };

  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch (err) {
    fail(`网关服务检查失败: ${String(err)}`);
    return;
  }
  if (!loaded) {
    emit({
      ok: true,
      result: "not-loaded",
      message: `网关服务 ${service.notLoadedText}。`,
      service: buildDaemonServiceSnapshot(service, loaded),
    });
    if (!json) {
      defaultRuntime.log(`网关服务 ${service.notLoadedText}。`);
    }
    return;
  }
  try {
    await service.stop({ env: process.env, stdout });
  } catch (err) {
    fail(`网关停止失败: ${String(err)}`);
    return;
  }

  let stopped = false;
  try {
    stopped = await service.isLoaded({ env: process.env });
  } catch {
    stopped = false;
  }
  emit({
    ok: true,
    result: "stopped",
    service: buildDaemonServiceSnapshot(service, stopped),
  });
}

/**
 * Restart the gateway service service.
 * @returns `true` if restart succeeded, `false` if the service was not loaded.
 * Throws/exits on check or restart failures.
 */
export async function runDaemonRestart(opts: DaemonLifecycleOptions = {}): Promise<boolean> {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = (payload: {
    ok: boolean;
    result?: string;
    message?: string;
    error?: string;
    hints?: string[];
    service?: {
      label: string;
      loaded: boolean;
      loadedText: string;
      notLoadedText: string;
    };
  }) => {
    if (!json) return;
    emitDaemonActionJson({ action: "restart", ...payload });
  };
  const fail = (message: string, hints?: string[]) => {
    if (json) emit({ ok: false, error: message, hints });
    else defaultRuntime.error(message);
    defaultRuntime.exit(1);
  };

  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch (err) {
    fail(`网关服务检查失败: ${String(err)}`);
    return false;
  }
  if (!loaded) {
    let hints = renderGatewayServiceStartHints();
    if (process.platform === "linux") {
      const systemdAvailable = await isSystemdUserServiceAvailable().catch(() => false);
      if (!systemdAvailable) {
        hints = [...hints, ...renderSystemdUnavailableHints({ wsl: await isWSL() })];
      }
    }
    emit({
      ok: true,
      result: "not-loaded",
      message: `网关服务 ${service.notLoadedText}。`,
      hints,
      service: buildDaemonServiceSnapshot(service, loaded),
    });
    if (!json) {
      defaultRuntime.log(`网关服务 ${service.notLoadedText}。`);
      for (const hint of hints) {
        defaultRuntime.log(`启动命令: ${hint}`);
      }
    }
    return false;
  }
  try {
    await service.restart({ env: process.env, stdout });
    let restarted = true;
    try {
      restarted = await service.isLoaded({ env: process.env });
    } catch {
      restarted = true;
    }
    emit({
      ok: true,
      result: "restarted",
      service: buildDaemonServiceSnapshot(service, restarted),
    });
    return true;
  } catch (err) {
    const hints = renderGatewayServiceStartHints();
    fail(`网关重启失败: ${String(err)}`, hints);
    return false;
  }
}
