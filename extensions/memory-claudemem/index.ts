/**
 * claude-mem Moltbot Plugin
 *
 * Integrates claude-mem memory system using the official hook CLI.
 * All operations go through the worker-service.cjs hook interface
 * to ensure proper UI broadcasts and consistency with Claude Code.
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { writeFile, readdir, stat, mkdir } from "fs/promises";
import { join, basename } from "path";
import { homedir, tmpdir } from "os";
import { spawn } from "child_process";
import { existsSync } from "fs";

/**
 * Find the latest claude-mem version in the plugin cache.
 * Returns the path to worker-service.cjs or null if not found.
 */
async function findWorkerServicePath(): Promise<string | null> {
  const cacheDir = join(homedir(), ".claude/plugins/cache/thedotmack/claude-mem");
  
  if (!existsSync(cacheDir)) {
    return null;
  }

  try {
    const entries = await readdir(cacheDir);
    
    // Get version directories with their modification times
    const versionDirs: { version: string; mtime: number }[] = [];
    for (const entry of entries) {
      const fullPath = join(cacheDir, entry);
      const workerPath = join(fullPath, "scripts/worker-service.cjs");
      if (existsSync(workerPath)) {
        const stats = await stat(fullPath);
        versionDirs.push({ version: entry, mtime: stats.mtimeMs });
      }
    }

    if (versionDirs.length === 0) {
      return null;
    }

    // Sort by modification time (newest first)
    versionDirs.sort((a, b) => b.mtime - a.mtime);
    
    return join(cacheDir, versionDirs[0].version, "scripts/worker-service.cjs");
  } catch {
    return null;
  }
}

// Will be initialized on plugin load
let WORKER_SERVICE_PATH: string | null = null;

/**
 * Get the cwd to use for claude-mem hooks.
 * Claude-mem derives project name from cwd basename, so if we have a custom
 * project name, we need to use a directory with that name.
 */
async function getHookCwd(workspaceDir: string, project: string): Promise<string> {
  const workspaceName = basename(workspaceDir);
  
  // If project matches workspace name, use workspace directly
  if (project === workspaceName) {
    return workspaceDir;
  }
  
  // Create a temp directory with the project name for claude-mem to use
  const projectDir = join(tmpdir(), "claude-mem-projects", project);
  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true });
  }
  return projectDir;
}

interface ClaudeMemConfig {
  syncMemoryFile: boolean;
  project: string;
}

const DEFAULT_CONFIG: Omit<ClaudeMemConfig, "project"> = {
  syncMemoryFile: true,
};

/**
 * Call the claude-mem hook CLI with JSON piped to stdin.
 * Returns the parsed JSON output (or null on failure).
 */
function callHook(
  hookName: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    if (!WORKER_SERVICE_PATH) {
      console.error(`[claude-mem] hook ${hookName} failed: worker-service.cjs not found`);
      resolve(null);
      return;
    }
    try {
      const proc = spawn("bun", [WORKER_SERVICE_PATH, "hook", "claude-code", hookName], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      proc.stdin.write(JSON.stringify(data));
      proc.stdin.end();

      proc.on("close", (code) => {
        if (code !== 0) {
          console.error(`[claude-mem] hook ${hookName} failed (code ${code}): ${stderr}`);
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve(null);
        }
      });

      proc.on("error", (err) => {
        console.error(`[claude-mem] hook ${hookName} error:`, err);
        resolve(null);
      });

      // Timeout after 30s
      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, 30000);
    } catch (err) {
      console.error(`[claude-mem] hook ${hookName} spawn error:`, err);
      resolve(null);
    }
  });
}

/**
 * Fire-and-forget hook call (doesn't wait for output).
 */
function callHookFireAndForget(hookName: string, data: Record<string, unknown>): void {
  if (!WORKER_SERVICE_PATH) {
    console.error(`[claude-mem] hook ${hookName} failed: worker-service.cjs not found`);
    return;
  }
  try {
    const proc = spawn("bun", [WORKER_SERVICE_PATH, "hook", "claude-code", hookName], {
      stdio: ["pipe", "ignore", "ignore"],
      detached: true,
    });

    proc.stdin.write(JSON.stringify(data));
    proc.stdin.end();
    proc.unref();
  } catch (err) {
    console.error(`[claude-mem] hook ${hookName} fire-and-forget error:`, err);
  }
}

export default function (api: ClawdbotPluginApi) {
  // Find the latest claude-mem worker service (sync check)
  const cacheDir = join(homedir(), ".claude/plugins/cache/thedotmack/claude-mem");
  if (!existsSync(cacheDir)) {
    api.logger.warn?.("claude-mem: plugin cache not found - plugin disabled");
    return;
  }
  
  // Find latest version synchronously
  try {
    const entries = require("fs").readdirSync(cacheDir);
    let latestVersion: string | null = null;
    let latestMtime = 0;
    
    for (const entry of entries) {
      const fullPath = join(cacheDir, entry);
      const workerPath = join(fullPath, "scripts/worker-service.cjs");
      if (existsSync(workerPath)) {
        const stats = require("fs").statSync(fullPath);
        if (stats.mtimeMs > latestMtime) {
          latestMtime = stats.mtimeMs;
          latestVersion = entry;
        }
      }
    }
    
    if (latestVersion) {
      WORKER_SERVICE_PATH = join(cacheDir, latestVersion, "scripts/worker-service.cjs");
    }
  } catch (err) {
    api.logger.warn?.("claude-mem: failed to find worker service", err);
  }
  
  if (!WORKER_SERVICE_PATH) {
    api.logger.warn?.("claude-mem: worker-service.cjs not found - plugin disabled");
    return;
  }

  api.logger.debug?.(`claude-mem: using worker at ${WORKER_SERVICE_PATH}`);

  const workspaceDir = api.workspaceDir || process.cwd();
  const defaultProject = basename(workspaceDir);

  const userConfig = api.pluginConfig as Partial<ClaudeMemConfig>;
  const config: ClaudeMemConfig = {
    ...DEFAULT_CONFIG,
    project: defaultProject,
    ...userConfig,
  };

  api.logger.info(`claude-mem: initializing (project: ${config.project})`);

  // Get the cwd to use for hooks (handles custom project names)
  // Create temp dir synchronously if needed
  let hookCwd = workspaceDir;
  if (config.project !== defaultProject) {
    const projectDir = join(tmpdir(), "claude-mem-projects", config.project);
    if (!existsSync(projectDir)) {
      require("fs").mkdirSync(projectDir, { recursive: true });
    }
    hookCwd = projectDir;
  }
  api.logger.debug?.(`claude-mem: using hook cwd: ${hookCwd}`);

  // Track contentSessionId per moltbot session
  const sessionIds = new Map<string, string>();
  // Track whether we've synced MEMORY.md for each session
  const syncedSessions = new Set<string>();

  function getContentSessionId(sessionKey: string | undefined): string {
    const key = sessionKey || "default";
    if (!sessionIds.has(key)) {
      sessionIds.set(key, `moltbot-${key}-${Date.now()}`);
    }
    return sessionIds.get(key)!;
  }

  // before_agent_start → sync MEMORY.md (once per session) + record prompt
  api.on("before_agent_start", async (event, ctx) => {
    const sessionKey = ctx.sessionKey || "default";
    const contentSessionId = getContentSessionId(ctx.sessionKey);

    // Sync MEMORY.md once per session (on first agent start)
    if (config.syncMemoryFile && !syncedSessions.has(sessionKey)) {
      syncedSessions.add(sessionKey);
      try {
        const result = await callHook("context", { cwd: hookCwd });
        if (result) {
          const context =
            (result as any)?.hookSpecificOutput?.additionalContext ||
            (result as any)?.additionalContext;

          if (context && typeof context === "string") {
            const memoryPath = join(workspaceDir, "MEMORY.md");
            await writeFile(memoryPath, context, "utf-8");
            api.logger.info?.(`claude-mem: updated MEMORY.md`);
          }
        }
      } catch (error) {
        api.logger.warn?.("claude-mem: failed to sync MEMORY.md", error);
      }
    }

    // Record prompt via session-init hook
    if (!event.prompt || event.prompt.length < 10) return;

    const result = await callHook("session-init", {
      session_id: contentSessionId,
      prompt: event.prompt,
      cwd: hookCwd,
    });

    if (result) {
      api.logger.debug?.(`claude-mem: prompt recorded for session ${contentSessionId}`);
    }
  });

  // tool_result_persist → hook claude-code observation (record tool call)
  api.on("tool_result_persist", (event, ctx) => {
    const toolName = event.toolName;
    if (!toolName) return;

    // Skip memory tools to prevent recursion
    const skipTools = new Set([
      "memory_search",
      "memory_status",
      "memory_record",
      "mcp__plugin_claude-mem_mcp-search__search",
      "mcp__plugin_claude-mem_mcp-search__timeline",
      "mcp__plugin_claude-mem_mcp-search__get_observations",
    ]);
    if (skipTools.has(toolName)) return;

    const contentSessionId = getContentSessionId(ctx.sessionKey);

    // Extract tool result text
    const message = event.message;
    const content = message?.content;
    let resultText: string | undefined;

    if (Array.isArray(content)) {
      const textBlock = content.find(
        (c: any) => c.type === "tool_result" || c.type === "text"
      );
      if (textBlock && "text" in textBlock) {
        resultText = String(textBlock.text).slice(0, 1000);
      }
    }

    // Fire-and-forget observation recording
    callHookFireAndForget("observation", {
      session_id: contentSessionId,
      tool_name: toolName,
      tool_input: event.params || {},
      tool_response: resultText || "",
      cwd: hookCwd,
    });
  });

  // agent_end → hook claude-code summarize (generate session summary)
  api.on("agent_end", async (_event, ctx) => {
    const contentSessionId = getContentSessionId(ctx.sessionKey);

    // Fire-and-forget summary generation
    callHookFireAndForget("summarize", {
      session_id: contentSessionId,
      cwd: hookCwd,
    });
  });

  // gateway_start → sync MEMORY.md when Moltbot starts
  api.on("gateway_start", async () => {
    if (!config.syncMemoryFile) return;
    
    try {
      const result = await callHook("context", { cwd: hookCwd });
      if (result) {
        const context =
          (result as any)?.hookSpecificOutput?.additionalContext ||
          (result as any)?.additionalContext;

        if (context && typeof context === "string") {
          const memoryPath = join(workspaceDir, "MEMORY.md");
          await writeFile(memoryPath, context, "utf-8");
          api.logger.info?.(`claude-mem: synced MEMORY.md on gateway start`);
        }
      }
    } catch (error) {
      api.logger.warn?.("claude-mem: failed to sync MEMORY.md on gateway start", error);
    }
  });

  api.logger.info("claude-mem: plugin registered (using hook CLI)");
}
