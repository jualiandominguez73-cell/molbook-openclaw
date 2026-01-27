import fs from "node:fs";
import path from "node:path";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import type { ChannelPluginCatalogEntry } from "../../channels/plugins/catalog.js";
import type { ClawdbotConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { recordPluginInstall } from "../../plugins/installs.js";
import { enablePluginInConfig } from "../../plugins/enable.js";
import { loadClawdbotPlugins } from "../../plugins/loader.js";
import { installPluginFromNpmSpec } from "../../plugins/install.js";
import { runCommandWithTimeout } from "../../process/exec.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { WizardPrompter } from "../../wizard/prompts.js";

type InstallChoice = "npm" | "local" | "skip";

type InstallResult = {
  cfg: ClawdbotConfig;
  installed: boolean;
};

type EnsureLocalDepsResult = {
  ok: boolean;
  error?: string;
};

/**
 * Detect which package manager to use for a plugin directory.
 * Prefers pnpm if pnpm-lock.yaml exists, then npm if package-lock.json exists,
 * otherwise defaults to pnpm (as the clawdbot monorepo uses pnpm).
 */
function detectPackageManager(pluginDir: string): "pnpm" | "npm" {
  if (fs.existsSync(path.join(pluginDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(pluginDir, "pnpm-workspace.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(pluginDir, "package-lock.json"))) return "npm";
  // Check parent directories for pnpm workspace (monorepo setup)
  let cursor = path.dirname(pluginDir);
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cursor, "pnpm-workspace.yaml"))) return "pnpm";
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return "pnpm";
}

/**
 * Ensure dependencies are installed for a local plugin.
 * This is necessary because local plugins in development may not have
 * node_modules populated, especially when using pnpm workspaces.
 */
async function ensureLocalPluginDependencies(params: {
  pluginDir: string;
  runtime: RuntimeEnv;
  timeoutMs?: number;
}): Promise<EnsureLocalDepsResult> {
  const { pluginDir, runtime, timeoutMs = 120_000 } = params;

  // Check if package.json exists
  const packageJsonPath = path.join(pluginDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return { ok: true }; // No package.json, nothing to install
  }

  // Check if dependencies are needed
  let packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  } catch {
    return { ok: true }; // Can't parse, skip dep check
  }

  const hasDeps =
    Object.keys(packageJson.dependencies ?? {}).length > 0 ||
    Object.keys(packageJson.devDependencies ?? {}).length > 0;

  if (!hasDeps) {
    return { ok: true }; // No dependencies to install
  }

  // Check if node_modules exists and has content
  const nodeModulesPath = path.join(pluginDir, "node_modules");
  const hasNodeModules =
    fs.existsSync(nodeModulesPath) && fs.readdirSync(nodeModulesPath).length > 0;

  if (hasNodeModules) {
    return { ok: true }; // Dependencies already installed
  }

  // Install dependencies
  const pm = detectPackageManager(pluginDir);
  runtime.log?.(`Installing dependencies for local plugin (${pm})...`);

  const installCmd = pm === "pnpm" ? ["pnpm", "install"] : ["npm", "install", "--omit=dev"];

  try {
    const result = await runCommandWithTimeout(installCmd, {
      timeoutMs,
      cwd: pluginDir,
    });

    if (result.code !== 0) {
      const errorMsg = result.stderr.trim() || result.stdout.trim() || "unknown error";
      return { ok: false, error: `${pm} install failed: ${errorMsg}` };
    }

    runtime.log?.(`Dependencies installed successfully.`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `${pm} install failed: ${String(err)}` };
  }
}

function hasGitWorkspace(workspaceDir?: string): boolean {
  const candidates = new Set<string>();
  candidates.add(path.join(process.cwd(), ".git"));
  if (workspaceDir && workspaceDir !== process.cwd()) {
    candidates.add(path.join(workspaceDir, ".git"));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return true;
  }
  return false;
}

function resolveLocalPath(
  entry: ChannelPluginCatalogEntry,
  workspaceDir: string | undefined,
  allowLocal: boolean,
): string | null {
  if (!allowLocal) return null;
  const raw = entry.install.localPath?.trim();
  if (!raw) return null;
  const candidates = new Set<string>();
  candidates.add(path.resolve(process.cwd(), raw));
  if (workspaceDir && workspaceDir !== process.cwd()) {
    candidates.add(path.resolve(workspaceDir, raw));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function addPluginLoadPath(cfg: ClawdbotConfig, pluginPath: string): ClawdbotConfig {
  const existing = cfg.plugins?.load?.paths ?? [];
  const merged = Array.from(new Set([...existing, pluginPath]));
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      load: {
        ...cfg.plugins?.load,
        paths: merged,
      },
    },
  };
}

async function promptInstallChoice(params: {
  entry: ChannelPluginCatalogEntry;
  localPath?: string | null;
  defaultChoice: InstallChoice;
  prompter: WizardPrompter;
}): Promise<InstallChoice> {
  const { entry, localPath, prompter, defaultChoice } = params;
  const localOptions: Array<{ value: InstallChoice; label: string; hint?: string }> = localPath
    ? [
        {
          value: "local",
          label: "Use local plugin path",
          hint: localPath,
        },
      ]
    : [];
  const options: Array<{ value: InstallChoice; label: string; hint?: string }> = [
    { value: "npm", label: `Download from npm (${entry.install.npmSpec})` },
    ...localOptions,
    { value: "skip", label: "Skip for now" },
  ];
  const initialValue: InstallChoice =
    defaultChoice === "local" && !localPath ? "npm" : defaultChoice;
  return await prompter.select<InstallChoice>({
    message: `Install ${entry.meta.label} plugin?`,
    options,
    initialValue,
  });
}

function resolveInstallDefaultChoice(params: {
  cfg: ClawdbotConfig;
  entry: ChannelPluginCatalogEntry;
  localPath?: string | null;
}): InstallChoice {
  const { cfg, entry, localPath } = params;
  const updateChannel = cfg.update?.channel;
  if (updateChannel === "dev") {
    return localPath ? "local" : "npm";
  }
  if (updateChannel === "stable" || updateChannel === "beta") {
    return "npm";
  }
  const entryDefault = entry.install.defaultChoice;
  if (entryDefault === "local") return localPath ? "local" : "npm";
  if (entryDefault === "npm") return "npm";
  return localPath ? "local" : "npm";
}

export async function ensureOnboardingPluginInstalled(params: {
  cfg: ClawdbotConfig;
  entry: ChannelPluginCatalogEntry;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  workspaceDir?: string;
}): Promise<InstallResult> {
  const { entry, prompter, runtime, workspaceDir } = params;
  let next = params.cfg;
  const allowLocal = hasGitWorkspace(workspaceDir);
  const localPath = resolveLocalPath(entry, workspaceDir, allowLocal);
  const defaultChoice = resolveInstallDefaultChoice({
    cfg: next,
    entry,
    localPath,
  });
  const choice = await promptInstallChoice({
    entry,
    localPath,
    defaultChoice,
    prompter,
  });

  if (choice === "skip") {
    return { cfg: next, installed: false };
  }

  if (choice === "local" && localPath) {
    // Ensure dependencies are installed before loading the plugin
    const depsResult = await ensureLocalPluginDependencies({
      pluginDir: localPath,
      runtime,
    });

    if (!depsResult.ok) {
      await prompter.note(`Failed to install dependencies: ${depsResult.error}`, "Plugin setup");
      return { cfg: next, installed: false };
    }

    next = addPluginLoadPath(next, localPath);
    next = enablePluginInConfig(next, entry.id).config;
    return { cfg: next, installed: true };
  }

  const result = await installPluginFromNpmSpec({
    spec: entry.install.npmSpec,
    logger: {
      info: (msg) => runtime.log?.(msg),
      warn: (msg) => runtime.log?.(msg),
    },
  });

  if (result.ok) {
    next = enablePluginInConfig(next, result.pluginId).config;
    next = recordPluginInstall(next, {
      pluginId: result.pluginId,
      source: "npm",
      spec: entry.install.npmSpec,
      installPath: result.targetDir,
      version: result.version,
    });
    return { cfg: next, installed: true };
  }

  await prompter.note(
    `Failed to install ${entry.install.npmSpec}: ${result.error}`,
    "Plugin install",
  );

  if (localPath) {
    const fallback = await prompter.confirm({
      message: `Use local plugin path instead? (${localPath})`,
      initialValue: true,
    });
    if (fallback) {
      // Ensure dependencies are installed before loading the plugin
      const depsResult = await ensureLocalPluginDependencies({
        pluginDir: localPath,
        runtime,
      });

      if (!depsResult.ok) {
        await prompter.note(`Failed to install dependencies: ${depsResult.error}`, "Plugin setup");
        return { cfg: next, installed: false };
      }

      next = addPluginLoadPath(next, localPath);
      next = enablePluginInConfig(next, entry.id).config;
      return { cfg: next, installed: true };
    }
  }

  runtime.error?.(`Plugin install failed: ${result.error}`);
  return { cfg: next, installed: false };
}

export function reloadOnboardingPluginRegistry(params: {
  cfg: ClawdbotConfig;
  runtime: RuntimeEnv;
  workspaceDir?: string;
}): void {
  const workspaceDir =
    params.workspaceDir ?? resolveAgentWorkspaceDir(params.cfg, resolveDefaultAgentId(params.cfg));
  const log = createSubsystemLogger("plugins");
  loadClawdbotPlugins({
    config: params.cfg,
    workspaceDir,
    cache: false,
    logger: {
      info: (msg) => log.info(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg),
      debug: (msg) => log.debug(msg),
    },
  });
}
