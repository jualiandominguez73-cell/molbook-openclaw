import fs from "node:fs";

import { logVerbose } from "../../globals.js";
import { resolveConfigPath } from "../../config/paths.js";
import { parseConfigJson5, validateConfigObjectWithPlugins } from "../../config/config.js";
import { scheduleGatewaySigusr1Restart, triggerClawdbotRestart } from "../../infra/restart.js";
import type { CommandHandler } from "./commands-types.js";

const CONFIG_BACKUP_COUNT = 5;

type BackupInfo = {
  index: number;
  path: string;
  exists: boolean;
  mtime?: Date;
  size?: number;
  valid?: boolean;
  error?: string;
};

function getBackupPath(configPath: string, index: number): string {
  if (index === 0) return `${configPath}.bak`;
  return `${configPath}.bak.${index}`;
}

async function listBackups(configPath: string): Promise<BackupInfo[]> {
  const backups: BackupInfo[] = [];

  for (let i = 0; i < CONFIG_BACKUP_COUNT; i += 1) {
    const backupPath = getBackupPath(configPath, i);
    const info: BackupInfo = { index: i, path: backupPath, exists: false };

    try {
      const stat = await fs.promises.stat(backupPath);
      info.exists = true;
      info.mtime = stat.mtime;
      info.size = stat.size;

      // Validate the backup
      const raw = await fs.promises.readFile(backupPath, "utf-8");
      const parsed = parseConfigJson5(raw);
      if (!parsed.ok) {
        info.valid = false;
        info.error = "Invalid JSON5";
      } else {
        const validated = validateConfigObjectWithPlugins(parsed.parsed);
        info.valid = validated.ok;
        if (!validated.ok) {
          info.error = validated.issues[0]?.message ?? "Validation failed";
        }
      }
    } catch {
      // File doesn't exist or can't be read
    }

    backups.push(info);
  }

  return backups;
}

function formatBackupList(backups: BackupInfo[]): string {
  const available = backups.filter((b) => b.exists);
  if (available.length === 0) {
    return "⚠️ No config backups found.";
  }

  const lines = ["📂 Available config backups:"];
  for (const backup of available) {
    const age = backup.mtime ? formatAge(backup.mtime) : "unknown";
    const status = backup.valid ? "✓" : `✗ ${backup.error ?? "invalid"}`;
    lines.push(`  ${backup.index}: ${age} ago [${status}]`);
  }
  lines.push("");
  lines.push("Usage: /restore_config <index>");

  return lines.join("\n");
}

function formatAge(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ${diffHour % 24}h`;
  if (diffHour > 0) return `${diffHour}h ${diffMin % 60}m`;
  if (diffMin > 0) return `${diffMin}m`;
  return `${diffSec}s`;
}

async function restoreBackup(
  configPath: string,
  backupIndex: number,
): Promise<{ ok: boolean; error?: string }> {
  const backupPath = getBackupPath(configPath, backupIndex);

  try {
    // Check backup exists
    await fs.promises.access(backupPath, fs.constants.R_OK);
  } catch {
    return { ok: false, error: `Backup ${backupIndex} not found` };
  }

  try {
    // Read and validate backup
    const raw = await fs.promises.readFile(backupPath, "utf-8");
    const parsed = parseConfigJson5(raw);
    if (!parsed.ok) {
      return { ok: false, error: `Backup ${backupIndex} has invalid JSON5` };
    }

    const validated = validateConfigObjectWithPlugins(parsed.parsed);
    if (!validated.ok) {
      const issue = validated.issues[0];
      return {
        ok: false,
        error: `Backup ${backupIndex} invalid: ${issue?.message ?? "validation failed"}`,
      };
    }

    // Copy backup to config (atomic via tmp file)
    const tmpPath = `${configPath}.restore.tmp`;
    await fs.promises.copyFile(backupPath, tmpPath);

    // Backup current config before overwriting
    try {
      await fs.promises.copyFile(configPath, `${configPath}.bak`); // Backup current config to index 0
    } catch {
      // Best effort - current config might not exist or be corrupt
    }

    await fs.promises.rename(tmpPath, configPath);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function triggerRestart(): { ok: boolean; method: string; detail?: string } {
  const hasSigusr1Listener = process.listenerCount("SIGUSR1") > 0;
  if (hasSigusr1Listener) {
    scheduleGatewaySigusr1Restart({ reason: "/restart-from-backup" });
    return { ok: true, method: "SIGUSR1" };
  }
  return triggerClawdbotRestart();
}

export const handleRestoreConfigCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;

  const normalized = params.command.commandBodyNormalized;
  if (!normalized.startsWith("/restore_config")) return null;

  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /restore_config from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  // Use same permission as /restart
  if (params.cfg.commands?.restart !== true) {
    return {
      shouldContinue: false,
      reply: {
        text: "⚠️ /restore_config requires restart permission. Set commands.restart=true to enable.",
      },
    };
  }

  const configPath = resolveConfigPath();
  const args = normalized.slice("/restore_config".length).trim();

  // No args: list backups
  if (!args) {
    const backups = await listBackups(configPath);
    return {
      shouldContinue: false,
      reply: { text: formatBackupList(backups) },
    };
  }

  // Parse backup index
  const backupIndex = parseInt(args, 10);
  if (!Number.isFinite(backupIndex) || backupIndex < 0 || backupIndex >= CONFIG_BACKUP_COUNT) {
    return {
      shouldContinue: false,
      reply: { text: `⚠️ Invalid backup index. Use 0-${CONFIG_BACKUP_COUNT - 1}.` },
    };
  }

  // Restore from backup
  const result = await restoreBackup(configPath, backupIndex);
  if (!result.ok) {
    return {
      shouldContinue: false,
      reply: { text: `⚠️ Restore failed: ${result.error}` },
    };
  }

  // Trigger restart
  const restartResult = triggerRestart();
  if (!restartResult.ok) {
    return {
      shouldContinue: false,
      reply: {
        text: `⚙️ Config restored from backup ${backupIndex}, but restart failed (${restartResult.method}). Please restart manually.`,
      },
    };
  }

  return {
    shouldContinue: false,
    reply: {
      text: `⚙️ Restoring config from backup ${backupIndex} and restarting via ${restartResult.method}; back in a few seconds.`,
    },
  };
};

// Alias for backward compatibility
export const handleRestartFromBackupCommand = handleRestoreConfigCommand;
