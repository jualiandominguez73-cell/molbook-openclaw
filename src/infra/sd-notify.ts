import { execFile } from "node:child_process";

/**
 * Send sd_notify READY=1 to systemd, signalling the service is fully started.
 * No-op when not running under a systemd Type=notify unit.
 */
export function sdNotifyReady(): void {
  if (!process.env.NOTIFY_SOCKET) {
    return;
  }
  execFile("systemd-notify", ["--ready"], { timeout: 5000 }, () => {});
}

/**
 * Send sd_notify WATCHDOG=1 heartbeat to systemd.
 * No-op when not running under a systemd WatchdogSec unit.
 */
export function sdNotifyWatchdog(): void {
  if (!process.env.NOTIFY_SOCKET) {
    return;
  }
  execFile("systemd-notify", ["WATCHDOG=1"], { timeout: 5000 }, () => {});
}
