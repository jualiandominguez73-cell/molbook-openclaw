import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import type { OpenClawConfig } from "../config/config.js";
import { resolveArchiveKind } from "../infra/archive.js";
import {
  buildWorkspaceHookStatus,
  type HookStatusEntry,
  type HookStatusReport,
} from "../hooks/hooks-status.js";
import type { HookEntry } from "../hooks/types.js";
import { loadWorkspaceHookEntries } from "../hooks/workspace.js";
import { loadConfig, writeConfigFile } from "../config/io.js";
import {
  installHooksFromNpmSpec,
  installHooksFromPath,
  resolveHookInstallDir,
} from "../hooks/install.js";
import { recordHookInstall } from "../hooks/installs.js";
import { buildPluginStatusReport } from "../plugins/status.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";
import { formatCliCommand } from "./command-format.js";
import { resolveUserPath, shortenHomePath } from "../utils.js";

export type HooksListOptions = {
  json?: boolean;
  eligible?: boolean;
  verbose?: boolean;
};

export type HookInfoOptions = {
  json?: boolean;
};

export type HooksCheckOptions = {
  json?: boolean;
};

export type HooksUpdateOptions = {
  all?: boolean;
  dryRun?: boolean;
};

function mergeHookEntries(pluginEntries: HookEntry[], workspaceEntries: HookEntry[]): HookEntry[] {
  const merged = new Map<string, HookEntry>();
  for (const entry of pluginEntries) {
    merged.set(entry.hook.name, entry);
  }
  for (const entry of workspaceEntries) {
    merged.set(entry.hook.name, entry);
  }
  return Array.from(merged.values());
}

function buildHooksReport(config: OpenClawConfig): HookStatusReport {
  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  const workspaceEntries = loadWorkspaceHookEntries(workspaceDir, { config });
  const pluginReport = buildPluginStatusReport({ config, workspaceDir });
  const pluginEntries = pluginReport.hooks.map((hook) => hook.entry);
  const entries = mergeHookEntries(pluginEntries, workspaceEntries);
  return buildWorkspaceHookStatus(workspaceDir, { config, entries });
}

function formatHookStatus(hook: HookStatusEntry): string {
  if (hook.eligible) return theme.success("✓ 就绪");
  if (hook.disabled) return theme.warn("⏸ 已禁用");
  return theme.error("✗ 缺失");
}

function formatHookName(hook: HookStatusEntry): string {
  const emoji = hook.emoji ?? "🔗";
  return `${emoji} ${theme.command(hook.name)}`;
}

function formatHookSource(hook: HookStatusEntry): string {
  if (!hook.managedByPlugin) return hook.source;
  return `plugin:${hook.pluginId ?? "未知"}`;
}

function formatHookMissingSummary(hook: HookStatusEntry): string {
  const missing: string[] = [];
  if (hook.missing.bins.length > 0) {
    missing.push(`二进制: ${hook.missing.bins.join(", ")}`);
  }
  if (hook.missing.anyBins.length > 0) {
    missing.push(`任一二进制: ${hook.missing.anyBins.join(", ")}`);
  }
  if (hook.missing.env.length > 0) {
    missing.push(`环境变量: ${hook.missing.env.join(", ")}`);
  }
  if (hook.missing.config.length > 0) {
    missing.push(`配置: ${hook.missing.config.join(", ")}`);
  }
  if (hook.missing.os.length > 0) {
    missing.push(`系统: ${hook.missing.os.join(", ")}`);
  }
  return missing.join("; ");
}

async function readInstalledPackageVersion(dir: string): Promise<string | undefined> {
  try {
    const raw = await fsp.readFile(path.join(dir, "package.json"), "utf-8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Format the hooks list output
 */
export function formatHooksList(report: HookStatusReport, opts: HooksListOptions): string {
  const hooks = opts.eligible ? report.hooks.filter((h) => h.eligible) : report.hooks;

  if (opts.json) {
    const jsonReport = {
      workspaceDir: report.workspaceDir,
      managedHooksDir: report.managedHooksDir,
      hooks: hooks.map((h) => ({
        name: h.name,
        description: h.description,
        emoji: h.emoji,
        eligible: h.eligible,
        disabled: h.disabled,
        source: h.source,
        pluginId: h.pluginId,
        events: h.events,
        homepage: h.homepage,
        missing: h.missing,
        managedByPlugin: h.managedByPlugin,
      })),
    };
    return JSON.stringify(jsonReport, null, 2);
  }

  if (hooks.length === 0) {
    const message = opts.eligible
      ? `未找到符合条件的钩子。运行 \`${formatCliCommand("openclaw hooks list")}\` 查看所有钩子。`
      : "未找到钩子。";
    return message;
  }

  const eligible = hooks.filter((h) => h.eligible);
  const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
  const rows = hooks.map((hook) => {
    const missing = formatHookMissingSummary(hook);
    return {
      Status: formatHookStatus(hook),
      Hook: formatHookName(hook),
      Description: theme.muted(hook.description),
      Source: formatHookSource(hook),
      Missing: missing ? theme.warn(missing) : "",
    };
  });

  const columns = [
    { key: "Status", header: "状态", minWidth: 10 },
    { key: "Hook", header: "钩子", minWidth: 18, flex: true },
    { key: "Description", header: "描述", minWidth: 24, flex: true },
    { key: "Source", header: "来源", minWidth: 12, flex: true },
  ];
  if (opts.verbose) {
    columns.push({ key: "Missing", header: "缺失项", minWidth: 18, flex: true });
  }

  const lines: string[] = [];
  lines.push(
    `${theme.heading("钩子列表")} ${theme.muted(`(${eligible.length}/${hooks.length} 就绪)`)}`,
  );
  lines.push(
    renderTable({
      width: tableWidth,
      columns,
      rows,
    }).trimEnd(),
  );
  return lines.join("\n");
}

/**
 * Format detailed info for a single hook
 */
export function formatHookInfo(
  report: HookStatusReport,
  hookName: string,
  opts: HookInfoOptions,
): string {
  const hook = report.hooks.find((h) => h.name === hookName || h.hookKey === hookName);

  if (!hook) {
    if (opts.json) {
      return JSON.stringify({ error: "not found", hook: hookName }, null, 2);
    }
    return `未找到钩子 "${hookName}"。运行 \`${formatCliCommand("openclaw hooks list")}\` 查看可用钩子。`;
  }

  if (opts.json) {
    return JSON.stringify(hook, null, 2);
  }

  const lines: string[] = [];
  const emoji = hook.emoji ?? "🔗";
  const status = hook.eligible
    ? theme.success("✓ 就绪")
    : hook.disabled
      ? theme.warn("⏸ 已禁用")
      : theme.error("✗ 缺少依赖");

  lines.push(`${emoji} ${theme.heading(hook.name)} ${status}`);
  lines.push("");
  lines.push(hook.description);
  lines.push("");

  // Details
  lines.push(theme.heading("详情:"));
  if (hook.managedByPlugin) {
    lines.push(`${theme.muted("  来源:")} ${hook.source} (${hook.pluginId ?? "unknown"})`);
  } else {
    lines.push(`${theme.muted("  来源:")} ${hook.source}`);
  }
  lines.push(`${theme.muted("  路径:")} ${shortenHomePath(hook.filePath)}`);
  lines.push(`${theme.muted("  处理程序:")} ${shortenHomePath(hook.handlerPath)}`);
  if (hook.homepage) {
    lines.push(`${theme.muted("  主页:")} ${hook.homepage}`);
  }
  if (hook.events.length > 0) {
    lines.push(`${theme.muted("  事件:")} ${hook.events.join(", ")}`);
  }
  if (hook.managedByPlugin) {
    lines.push(theme.muted("  由插件管理; 无法通过 hooks CLI 启用/禁用。"));
  }

  // Requirements
  const hasRequirements =
    hook.requirements.bins.length > 0 ||
    hook.requirements.anyBins.length > 0 ||
    hook.requirements.env.length > 0 ||
    hook.requirements.config.length > 0 ||
    hook.requirements.os.length > 0;

  if (hasRequirements) {
    lines.push("");
    lines.push(theme.heading("要求:"));
    if (hook.requirements.bins.length > 0) {
      const binsStatus = hook.requirements.bins.map((bin) => {
        const missing = hook.missing.bins.includes(bin);
        return missing ? theme.error(`✗ ${bin}`) : theme.success(`✓ ${bin}`);
      });
      lines.push(`${theme.muted("  二进制文件:")} ${binsStatus.join(", ")}`);
    }
    if (hook.requirements.anyBins.length > 0) {
      const anyBinsStatus =
        hook.missing.anyBins.length > 0
          ? theme.error(`✗ (任一: ${hook.requirements.anyBins.join(", ")})`)
          : theme.success(`✓ (任一: ${hook.requirements.anyBins.join(", ")})`);
      lines.push(`${theme.muted("  任一二进制:")} ${anyBinsStatus}`);
    }
    if (hook.requirements.env.length > 0) {
      const envStatus = hook.requirements.env.map((env) => {
        const missing = hook.missing.env.includes(env);
        return missing ? theme.error(`✗ ${env}`) : theme.success(`✓ ${env}`);
      });
      lines.push(`${theme.muted("  环境变量:")} ${envStatus.join(", ")}`);
    }
    if (hook.requirements.config.length > 0) {
      const configStatus = hook.configChecks.map((check) => {
        return check.satisfied ? theme.success(`✓ ${check.path}`) : theme.error(`✗ ${check.path}`);
      });
      lines.push(`${theme.muted("  配置:")} ${configStatus.join(", ")}`);
    }
    if (hook.requirements.os.length > 0) {
      const osStatus =
        hook.missing.os.length > 0
          ? theme.error(`✗ (${hook.requirements.os.join(", ")})`)
          : theme.success(`✓ (${hook.requirements.os.join(", ")})`);
      lines.push(`${theme.muted("  操作系统:")} ${osStatus}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format check output
 */
export function formatHooksCheck(report: HookStatusReport, opts: HooksCheckOptions): string {
  if (opts.json) {
    const eligible = report.hooks.filter((h) => h.eligible);
    const notEligible = report.hooks.filter((h) => !h.eligible);
    return JSON.stringify(
      {
        total: report.hooks.length,
        eligible: eligible.length,
        notEligible: notEligible.length,
        hooks: {
          eligible: eligible.map((h) => h.name),
          notEligible: notEligible.map((h) => ({
            name: h.name,
            missing: h.missing,
          })),
        },
      },
      null,
      2,
    );
  }

  const eligible = report.hooks.filter((h) => h.eligible);
  const notEligible = report.hooks.filter((h) => !h.eligible);

  const lines: string[] = [];
  lines.push(theme.heading("钩子状态"));
  lines.push("");
  lines.push(`${theme.muted("钩子总数:")} ${report.hooks.length}`);
  lines.push(`${theme.success("就绪:")} ${eligible.length}`);
  lines.push(`${theme.warn("未就绪:")} ${notEligible.length}`);

  if (notEligible.length > 0) {
    lines.push("");
    lines.push(theme.heading("未就绪的钩子:"));
    for (const hook of notEligible) {
      const reasons = [];
      if (hook.disabled) reasons.push("已禁用");
      if (hook.missing.bins.length > 0) reasons.push(`二进制: ${hook.missing.bins.join(", ")}`);
      if (hook.missing.anyBins.length > 0)
        reasons.push(`任一二进制: ${hook.missing.anyBins.join(", ")}`);
      if (hook.missing.env.length > 0) reasons.push(`环境变量: ${hook.missing.env.join(", ")}`);
      if (hook.missing.config.length > 0) reasons.push(`配置: ${hook.missing.config.join(", ")}`);
      if (hook.missing.os.length > 0) reasons.push(`系统: ${hook.missing.os.join(", ")}`);
      lines.push(`  ${hook.emoji ?? "🔗"} ${hook.name} - ${reasons.join("; ")}`);
    }
  }

  return lines.join("\n");
}

export async function enableHook(hookName: string): Promise<void> {
  const config = loadConfig();
  const report = buildHooksReport(config);
  const hook = report.hooks.find((h) => h.name === hookName);

  if (!hook) {
    throw new Error(`未找到钩子 "${hookName}"`);
  }

  if (hook.managedByPlugin) {
    throw new Error(
      `钩子 "${hookName}" 由插件 "${hook.pluginId ?? "未知"}" 管理，无法启用/禁用。`,
    );
  }

  if (!hook.eligible) {
    throw new Error(`钩子 "${hookName}" 不符合条件 (缺失要求)`);
  }

  // Update config
  const entries = { ...config.hooks?.internal?.entries };
  entries[hookName] = { ...entries[hookName], enabled: true };

  const nextConfig = {
    ...config,
    hooks: {
      ...config.hooks,
      internal: {
        ...config.hooks?.internal,
        enabled: true,
        entries,
      },
    },
  };

  await writeConfigFile(nextConfig);
  defaultRuntime.log(
    `${theme.success("✓")} 已启用钩子: ${hook.emoji ?? "🔗"} ${theme.command(hookName)}`,
  );
}

export async function disableHook(hookName: string): Promise<void> {
  const config = loadConfig();
  const report = buildHooksReport(config);
  const hook = report.hooks.find((h) => h.name === hookName);

  if (!hook) {
    throw new Error(`未找到钩子 "${hookName}"`);
  }

  if (hook.managedByPlugin) {
    throw new Error(
      `钩子 "${hookName}" 由插件 "${hook.pluginId ?? "未知"}" 管理，无法启用/禁用。`,
    );
  }

  // Update config
  const entries = { ...config.hooks?.internal?.entries };
  entries[hookName] = { ...entries[hookName], enabled: false };

  const nextConfig = {
    ...config,
    hooks: {
      ...config.hooks,
      internal: {
        ...config.hooks?.internal,
        entries,
      },
    },
  };

  await writeConfigFile(nextConfig);
  defaultRuntime.log(
    `${theme.warn("⏸")} 已禁用钩子: ${hook.emoji ?? "🔗"} ${theme.command(hookName)}`,
  );
}

export function registerHooksCli(program: Command): void {
  const hooks = program
    .command("hooks")
    .description("管理内部代理钩子")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/hooks", "docs.openclaw.ai/cli/hooks")}\n`,
    );

  hooks
    .command("list")
    .description("列出所有钩子")
    .option("--eligible", "仅显示符合条件的钩子", false)
    .option("--json", "以 JSON 格式输出", false)
    .option("-v, --verbose", "显示更多详情包括缺失的要求", false)
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const report = buildHooksReport(config);
        defaultRuntime.log(formatHooksList(report, opts));
      } catch (err) {
        defaultRuntime.error(
          `${theme.error("错误:")} ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  hooks
    .command("info <name>")
    .description("显示钩子详细信息")
    .option("--json", "以 JSON 格式输出", false)
    .action(async (name, opts) => {
      try {
        const config = loadConfig();
        const report = buildHooksReport(config);
        defaultRuntime.log(formatHookInfo(report, name, opts));
      } catch (err) {
        defaultRuntime.error(
          `${theme.error("错误:")} ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  hooks
    .command("check")
    .description("检查钩子资格状态")
    .option("--json", "以 JSON 格式输出", false)
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const report = buildHooksReport(config);
        defaultRuntime.log(formatHooksCheck(report, opts));
      } catch (err) {
        defaultRuntime.error(
          `${theme.error("错误:")} ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  hooks
    .command("enable <name>")
    .description("启用钩子")
    .action(async (name) => {
      try {
        await enableHook(name);
      } catch (err) {
        defaultRuntime.error(
          `${theme.error("错误:")} ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  hooks
    .command("disable <name>")
    .description("禁用钩子")
    .action(async (name) => {
      try {
        await disableHook(name);
      } catch (err) {
        defaultRuntime.error(
          `${theme.error("错误:")} ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  hooks
    .command("install")
    .description("安装钩子包 (路径, 归档, 或 npm 规范)")
    .argument("<path-or-spec>", "钩子包路径或 npm 包规范")
    .option("-l, --link", "链接本地路径而不是复制", false)
    .action(async (raw: string, opts: { link?: boolean }) => {
      try {
        const resolved = resolveUserPath(raw);
        const cfg = loadConfig();

        if (fs.existsSync(resolved)) {
          if (opts.link) {
            const stat = fs.statSync(resolved);
            if (!stat.isDirectory()) {
              defaultRuntime.error("链接的钩子路径必须是目录。");
              process.exit(1);
            }

            const existing = cfg.hooks?.internal?.load?.extraDirs ?? [];
            const merged = Array.from(new Set([...existing, resolved]));
            const probe = await installHooksFromPath({ path: resolved, dryRun: true });
            if (!probe.ok) {
              defaultRuntime.error(probe.error);
              process.exit(1);
            }

            let next: OpenClawConfig = {
              ...cfg,
              hooks: {
                ...cfg.hooks,
                internal: {
                  ...cfg.hooks?.internal,
                  enabled: true,
                  load: {
                    ...cfg.hooks?.internal?.load,
                    extraDirs: merged,
                  },
                },
              },
            };

            for (const hookName of probe.hooks) {
              next = {
                ...next,
                hooks: {
                  ...next.hooks,
                  internal: {
                    ...next.hooks?.internal,
                    entries: {
                      ...next.hooks?.internal?.entries,
                      [hookName]: {
                        ...(next.hooks?.internal?.entries?.[hookName] as object | undefined),
                        enabled: true,
                      },
                    },
                  },
                },
              };
            }

            next = recordHookInstall(next, {
              hookId: probe.hookPackId,
              source: "path",
              sourcePath: resolved,
              installPath: resolved,
              version: probe.version,
              hooks: probe.hooks,
            });

            await writeConfigFile(next);
            defaultRuntime.log(`已链接钩子路径: ${shortenHomePath(resolved)}`);
            defaultRuntime.log(`重启网关以加载钩子。`);
            return;
          }

          const result = await installHooksFromPath({
            path: resolved,
            logger: {
              info: (msg) => defaultRuntime.log(msg),
              warn: (msg) => defaultRuntime.log(theme.warn(msg)),
            },
          });
          if (!result.ok) {
            defaultRuntime.error(result.error);
            process.exit(1);
          }

          let next: OpenClawConfig = {
            ...cfg,
            hooks: {
              ...cfg.hooks,
              internal: {
                ...cfg.hooks?.internal,
                enabled: true,
                entries: {
                  ...cfg.hooks?.internal?.entries,
                },
              },
            },
          };

          for (const hookName of result.hooks) {
            next = {
              ...next,
              hooks: {
                ...next.hooks,
                internal: {
                  ...next.hooks?.internal,
                  entries: {
                    ...next.hooks?.internal?.entries,
                    [hookName]: {
                      ...(next.hooks?.internal?.entries?.[hookName] as object | undefined),
                      enabled: true,
                    },
                  },
                },
              },
            };
          }

          const source: "archive" | "path" = resolveArchiveKind(resolved) ? "archive" : "path";

          next = recordHookInstall(next, {
            hookId: result.hookPackId,
            source,
            sourcePath: resolved,
            installPath: result.targetDir,
            version: result.version,
            hooks: result.hooks,
          });

          await writeConfigFile(next);
          defaultRuntime.log(`已安装钩子: ${result.hooks.join(", ")}`);
          defaultRuntime.log(`重启网关以加载钩子。`);
          return;
        }

        if (opts.link) {
          defaultRuntime.error("只能链接本地路径。");
          process.exit(1);
        }

        const looksLikePath =
          raw.startsWith(".") ||
          raw.startsWith("~") ||
          path.isAbsolute(raw) ||
          raw.endsWith(".zip") ||
          raw.endsWith(".tgz") ||
          raw.endsWith(".tar.gz") ||
          raw.endsWith(".tar");
        if (looksLikePath) {
          defaultRuntime.error(`未找到路径: ${resolved}`);
          process.exit(1);
        }

        const result = await installHooksFromNpmSpec({
          spec: raw,
          logger: {
            info: (msg) => defaultRuntime.log(msg),
            warn: (msg) => defaultRuntime.log(theme.warn(msg)),
          },
        });
        if (!result.ok) {
          defaultRuntime.error(result.error);
          process.exit(1);
        }

        let next: OpenClawConfig = {
          ...cfg,
          hooks: {
            ...cfg.hooks,
            internal: {
              ...cfg.hooks?.internal,
              enabled: true,
              entries: {
                ...cfg.hooks?.internal?.entries,
              },
            },
          },
        };

        for (const hookName of result.hooks) {
          next = {
            ...next,
            hooks: {
              ...next.hooks,
              internal: {
                ...next.hooks?.internal,
                entries: {
                  ...next.hooks?.internal?.entries,
                  [hookName]: {
                    ...(next.hooks?.internal?.entries?.[hookName] as object | undefined),
                    enabled: true,
                  },
                },
              },
            },
          };
        }

        next = recordHookInstall(next, {
          hookId: result.hookPackId,
          source: "npm",
          spec: raw,
          installPath: result.targetDir,
          version: result.version,
          hooks: result.hooks,
        });
        await writeConfigFile(next);
        defaultRuntime.log(`已安装钩子: ${result.hooks.join(", ")}`);
        defaultRuntime.log(`重启网关以加载钩子。`);
      } catch (err) {
        defaultRuntime.error(
          `${theme.error("错误:")} ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  hooks
    .command("update")
    .description("更新已安装的钩子 (仅限 npm 安装)")
    .argument("[id]", "钩子包 ID (省略则使用 --all)")
    .option("--all", "更新所有跟踪的钩子", false)
    .option("--dry-run", "显示将要进行的更改而不写入", false)
    .action(async (id: string | undefined, opts: HooksUpdateOptions) => {
      const cfg = loadConfig();
      const installs = cfg.hooks?.internal?.installs ?? {};
      const targets = opts.all ? Object.keys(installs) : id ? [id] : [];

      if (targets.length === 0) {
        defaultRuntime.error("请提供钩子 ID 或使用 --all。");
        process.exit(1);
      }

      let nextCfg = cfg;
      let updatedCount = 0;

      for (const hookId of targets) {
        const record = installs[hookId];
        if (!record) {
          defaultRuntime.log(theme.warn(`未找到 "${hookId}" 的安装记录。`));
          continue;
        }
        if (record.source !== "npm") {
          defaultRuntime.log(theme.warn(`跳过 "${hookId}" (来源: ${record.source})。`));
          continue;
        }
        if (!record.spec) {
          defaultRuntime.log(theme.warn(`跳过 "${hookId}" (缺少 npm 规范)。`));
          continue;
        }

        const installPath = record.installPath ?? resolveHookInstallDir(hookId);
        const currentVersion = await readInstalledPackageVersion(installPath);

        if (opts.dryRun) {
          const probe = await installHooksFromNpmSpec({
            spec: record.spec,
            mode: "update",
            dryRun: true,
            expectedHookPackId: hookId,
            logger: {
              info: (msg) => defaultRuntime.log(msg),
              warn: (msg) => defaultRuntime.log(theme.warn(msg)),
            },
          });
          if (!probe.ok) {
            defaultRuntime.log(theme.error(`无法检查 ${hookId}: ${probe.error}`));
            continue;
          }

          const nextVersion = probe.version ?? "unknown";
          const currentLabel = currentVersion ?? "unknown";
          if (currentVersion && probe.version && currentVersion === probe.version) {
            defaultRuntime.log(`${hookId} 已是最新 (${currentLabel})。`);
          } else {
            defaultRuntime.log(`将更新 ${hookId}: ${currentLabel} → ${nextVersion}。`);
          }
          continue;
        }

        const result = await installHooksFromNpmSpec({
          spec: record.spec,
          mode: "update",
          expectedHookPackId: hookId,
          logger: {
            info: (msg) => defaultRuntime.log(msg),
            warn: (msg) => defaultRuntime.log(theme.warn(msg)),
          },
        });
        if (!result.ok) {
          defaultRuntime.log(theme.error(`无法更新 ${hookId}: ${result.error}`));
          continue;
        }

        const nextVersion = result.version ?? (await readInstalledPackageVersion(result.targetDir));
        nextCfg = recordHookInstall(nextCfg, {
          hookId,
          source: "npm",
          spec: record.spec,
          installPath: result.targetDir,
          version: nextVersion,
          hooks: result.hooks,
        });
        updatedCount += 1;

        const currentLabel = currentVersion ?? "unknown";
        const nextLabel = nextVersion ?? "unknown";
        if (currentVersion && nextVersion && currentVersion === nextVersion) {
          defaultRuntime.log(`${hookId} 已经是 ${currentLabel}。`);
        } else {
          defaultRuntime.log(`已更新 ${hookId}: ${currentLabel} → ${nextLabel}。`);
        }
      }

      if (updatedCount > 0) {
        await writeConfigFile(nextCfg);
        defaultRuntime.log("重启网关以加载钩子。");
      }
    });

  hooks.action(async () => {
    try {
      const config = loadConfig();
      const report = buildHooksReport(config);
      defaultRuntime.log(formatHooksList(report, {}));
    } catch (err) {
      defaultRuntime.error(
        `${theme.error("错误:")} ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });
}
