/**
 * Claude Code Command Handler
 *
 * Handles the /claude command for starting and managing Claude Code sessions.
 *
 * Usage:
 *   /claude juzi              - Start session in juzi project
 *   /claude juzi @experimental - Start in worktree
 *   /claude status            - Show active sessions
 *   /claude cancel <token>    - Cancel a session
 *   /claude projects          - List known projects
 *   /claude register <name> <path> - Register project alias
 *   /claude unregister <name> - Remove project alias
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logVerbose } from "../../globals.js";
import {
  startSession,
  cancelSessionByToken,
  listSessions,
  getSessionState,
  getCompletedPhases,
  listKnownProjects,
  getConfiguredProjectBases,
} from "../../agents/claude-code/index.js";
import {
  createSessionBubble,
  updateSessionBubble,
  completeSessionBubble,
} from "../../agents/claude-code/bubble-service.js";
import { readConfigFileSnapshot, writeConfigFile } from "../../config/config.js";
import type { CommandHandler } from "./commands-types.js";

/**
 * Parse /claude command arguments.
 */
function parseClaudeCommand(commandBody: string): {
  hasCommand: boolean;
  action?: "start" | "status" | "cancel" | "list" | "projects" | "register" | "unregister";
  project?: string;
  token?: string;
  alias?: string;
  aliasPath?: string;
} {
  const match = commandBody.match(/^\/claude(?:\s+(.*))?$/i);
  if (!match) return { hasCommand: false };

  const args = match[1]?.trim() ?? "";

  // /claude status or /claude list
  if (args.toLowerCase() === "status" || args.toLowerCase() === "list") {
    return { hasCommand: true, action: "status" };
  }

  // /claude projects
  if (args.toLowerCase() === "projects") {
    return { hasCommand: true, action: "projects" };
  }

  // /claude cancel <token>
  const cancelMatch = args.match(/^cancel\s+(\S+)/i);
  if (cancelMatch) {
    return { hasCommand: true, action: "cancel", token: cancelMatch[1] };
  }

  // /claude register <name> <path>
  const registerMatch = args.match(/^register\s+(\S+)\s+(.+)$/i);
  if (registerMatch) {
    return {
      hasCommand: true,
      action: "register",
      alias: registerMatch[1],
      aliasPath: registerMatch[2].trim(),
    };
  }

  // /claude unregister <name>
  const unregisterMatch = args.match(/^unregister\s+(\S+)/i);
  if (unregisterMatch) {
    return { hasCommand: true, action: "unregister", alias: unregisterMatch[1] };
  }

  // /claude <project> [@worktree]
  if (args) {
    return { hasCommand: true, action: "start", project: args };
  }

  // /claude with no args shows help
  return { hasCommand: true, action: "status" };
}

/**
 * Format session list for display.
 */
function formatSessionList(): string {
  const sessions = listSessions();
  if (sessions.length === 0) {
    return "No active Claude Code sessions.";
  }

  const lines = ["**Active Claude Code Sessions:**", ""];
  for (const session of sessions) {
    const state = getSessionState(session);
    const tokenPrefix = session.resumeToken.slice(0, 8);
    lines.push(`- **${state.projectName}** (${tokenPrefix})`);
    lines.push(`  ${state.runtimeStr} · ${state.status}`);
  }

  return lines.join("\n");
}

/**
 * Format known projects list for display.
 */
function formatProjectsList(): string {
  const projects = listKnownProjects();
  const bases = getConfiguredProjectBases();

  const lines = ["**Known Projects:**", ""];

  // Show explicit aliases first
  const aliases = projects.filter((p) => p.source === "alias");
  if (aliases.length > 0) {
    lines.push("*Registered aliases:*");
    for (const proj of aliases) {
      lines.push(`  \`${proj.name}\` → ${proj.path}`);
    }
    lines.push("");
  }

  // Show discovered projects
  const discovered = projects.filter((p) => p.source === "discovered");
  if (discovered.length > 0) {
    lines.push("*Auto-discovered:*");
    for (const proj of discovered) {
      lines.push(`  \`${proj.name}\` → ${proj.path}`);
    }
    lines.push("");
  }

  // Show search directories
  lines.push("*Search directories:*");
  for (const base of bases) {
    const exists = fs.existsSync(base);
    lines.push(`  ${exists ? "✓" : "✗"} ${base}`);
  }

  return lines.join("\n");
}

/**
 * Expand ~ to home directory.
 */
function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  if (p === "~") {
    return os.homedir();
  }
  return p;
}

/**
 * Register a project alias in config.
 */
async function registerProjectAlias(alias: string, projectPath: string): Promise<string> {
  const expandedPath = expandPath(projectPath);

  // Validate the path exists
  if (!fs.existsSync(expandedPath)) {
    return `Path does not exist: ${expandedPath}`;
  }
  if (!fs.statSync(expandedPath).isDirectory()) {
    return `Path is not a directory: ${expandedPath}`;
  }

  // Read current config
  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;

  // Update claudeCode.projects
  const claudeCode = config.claudeCode ?? {};
  const projects = claudeCode.projects ?? {};
  projects[alias] = expandedPath;
  claudeCode.projects = projects;
  config.claudeCode = claudeCode;

  // Write back
  await writeConfigFile(config);

  return `Registered **${alias}** → ${expandedPath}`;
}

/**
 * Unregister a project alias from config.
 */
async function unregisterProjectAlias(alias: string): Promise<string> {
  // Read current config
  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;

  const claudeCode = config.claudeCode ?? {};
  const projects = claudeCode.projects ?? {};

  if (!(alias in projects)) {
    return `Alias not found: **${alias}**`;
  }

  delete projects[alias];
  claudeCode.projects = projects;
  config.claudeCode = claudeCode;

  await writeConfigFile(config);

  return `Unregistered alias: **${alias}**`;
}

export const handleClaudeCommand: CommandHandler = async (params, _allowTextCommands) => {
  const parsed = parseClaudeCommand(params.command.commandBodyNormalized);
  if (!parsed.hasCommand) return null;

  // Only authorized senders can use /claude
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /claude from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  // Handle status/list
  if (parsed.action === "status") {
    return {
      shouldContinue: false,
      reply: { text: formatSessionList() },
    };
  }

  // Handle cancel
  if (parsed.action === "cancel" && parsed.token) {
    const success = cancelSessionByToken(parsed.token);
    if (success) {
      return {
        shouldContinue: false,
        reply: { text: `Cancelled session: ${parsed.token}` },
      };
    }
    return {
      shouldContinue: false,
      reply: { text: `Session not found: ${parsed.token}` },
    };
  }

  // Handle projects list
  if (parsed.action === "projects") {
    return {
      shouldContinue: false,
      reply: { text: formatProjectsList() },
    };
  }

  // Handle register
  if (parsed.action === "register" && parsed.alias && parsed.aliasPath) {
    const result = await registerProjectAlias(parsed.alias, parsed.aliasPath);
    return {
      shouldContinue: false,
      reply: { text: result },
    };
  }

  // Handle unregister
  if (parsed.action === "unregister" && parsed.alias) {
    const result = await unregisterProjectAlias(parsed.alias);
    return {
      shouldContinue: false,
      reply: { text: result },
    };
  }

  // Handle start
  if (parsed.action === "start" && parsed.project) {
    // Extract chat info for bubble creation
    const fromField = params.ctx.From ?? params.command.from ?? "";
    const chatIdMatch = fromField.match(/telegram:(?:group:)?(-?\d+)/);
    const chatId = chatIdMatch?.[1];
    const threadId =
      typeof params.ctx.MessageThreadId === "number"
        ? params.ctx.MessageThreadId
        : typeof params.ctx.MessageThreadId === "string"
          ? parseInt(params.ctx.MessageThreadId, 10)
          : undefined;
    const accountId = params.ctx.AccountId;
    const isTelegram = params.command.channel === "telegram" || params.ctx.Surface === "telegram";

    // Track session ID for bubble updates
    let sessionId: string | undefined;

    const result = await startSession({
      project: parsed.project,
      permissionMode: "bypassPermissions",
      onStateChange: async (state) => {
        if (!sessionId) return;

        // Update bubble on state changes
        if (
          state.status === "completed" ||
          state.status === "cancelled" ||
          state.status === "failed"
        ) {
          // Session ended - show completion message
          const completedPhases = getCompletedPhases(params.workspaceDir);
          await completeSessionBubble({
            sessionId,
            state,
            completedPhases,
          });
        } else {
          // Session running - update bubble
          await updateSessionBubble({ sessionId, state });
        }
      },
    });

    if (!result.success) {
      return {
        shouldContinue: false,
        reply: { text: `Failed to start session: ${result.error}` },
      };
    }

    sessionId = result.sessionId;

    // Create bubble for Telegram
    if (isTelegram && chatId && result.sessionId && result.resumeToken) {
      const session = listSessions().find((s) => s.id === result.sessionId);
      if (session) {
        const state = getSessionState(session);
        await createSessionBubble({
          sessionId: result.sessionId,
          chatId,
          threadId: Number.isFinite(threadId) ? threadId : undefined,
          accountId,
          resumeToken: result.resumeToken,
          state,
        });

        // Return minimal confirmation since bubble shows the status
        return {
          shouldContinue: false,
          reply: {
            text: `Starting Claude Code for **${parsed.project}**...`,
          },
        };
      }
    }

    // Fallback for non-Telegram or if bubble creation failed
    return {
      shouldContinue: false,
      reply: {
        text: `Started Claude Code session for **${parsed.project}**\nSession ID: ${result.sessionId}\nResume token: \`${result.resumeToken}\``,
      },
    };
  }

  // No valid action
  return {
    shouldContinue: false,
    reply: {
      text: [
        "**Claude Code Commands:**",
        "",
        "`/claude <project>` - Start a session",
        "`/claude <project> @<worktree>` - Start in worktree",
        "`/claude status` - Show active sessions",
        "`/claude cancel <token>` - Cancel a session",
        "",
        "**Project Management:**",
        "`/claude projects` - List known projects",
        "`/claude register <name> <path>` - Register alias",
        "`/claude unregister <name>` - Remove alias",
      ].join("\n"),
    },
  };
};
