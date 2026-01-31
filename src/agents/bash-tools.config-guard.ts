/**
 * Config File Write Guard
 *
 * Prevents agents from directly writing to protected config files via shell commands.
 * Forces all config changes through config.patch tool which validates against the Zod schema.
 *
 * Design: Speed bump, not fortress. Blocks obvious bypass attempts and guides agents to
 * the correct tool. Cannot catch all possible bypasses (shell is Turing-complete).
 *
 * See: ~/clawd-morgan/reviews/REVIEW-exec-config-guard.md
 *      ~/clawd-lux/reviews/DA-exec-config-guard.md
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logWarn, logInfo } from "../logger.js";

export type ConfigGuardResult = {
  blocked: boolean;
  reason?: string;
  matchedPath?: string;
  matchedPattern?: string;
};

export type ConfigGuardOptions = {
  /** Paths to protect (will be normalized and resolved) */
  protectedPaths: string[];
  /** Agent ID for audit logging */
  agentId?: string;
  /** Session ID for audit logging */
  sessionId?: string;
  /** Current working directory for path resolution */
  cwd?: string;
};

/**
 * Default protected paths (can be overridden via config)
 */
export const DEFAULT_PROTECTED_PATHS = [
  "~/.clawdbot/moltbot.json",
  "~/.clawdbot/exec-approvals.json",
];

/**
 * Expand home directory shorthand (~) to absolute path
 */
function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Normalize and canonicalize a path
 * - Expands ~ to home directory
 * - Resolves relative paths
 * - Resolves symlinks (if path exists)
 * - Normalizes path separators
 */
function canonicalizePath(filepath: string, cwd: string = process.cwd()): string {
  let normalized = expandHome(filepath);

  // Resolve relative paths
  if (!path.isAbsolute(normalized)) {
    normalized = path.resolve(cwd, normalized);
  } else {
    normalized = path.resolve(normalized);
  }

  // Try to resolve symlinks if path exists
  // If path doesn't exist yet, we can't resolve symlinks, but we can still match
  try {
    return fs.realpathSync(normalized);
  } catch {
    // Path doesn't exist yet - return normalized path
    return normalized;
  }
}

/**
 * Extract potential file paths from command redirects
 * Handles: >, >>, |>, etc.
 * Returns normalized paths found in redirect targets
 */
function extractRedirectTargets(command: string, cwd: string): string[] {
  const targets: string[] = [];

  // Pattern for output redirects: >, >>, &>, &>>, |&
  // Captures: > file, >> file, > "file", > 'file', > $VAR (though we can't resolve vars)
  // This is imperfect but catches common cases
  const redirectPattern = /(>>?|&>>?)\s+([^\s;|&<>'"]+|"[^"]+"|'[^']+')/g;

  let match;
  while ((match = redirectPattern.exec(command)) !== null) {
    let target = match[2].trim();

    // Remove quotes if present
    if (
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
    ) {
      target = target.slice(1, -1);
    }

    // Skip if it looks like a file descriptor (e.g., >& 2)
    if (/^\d+$/.test(target)) {
      continue;
    }

    // Skip if it contains obvious variable expansions or command substitutions
    // We can't resolve these, but they're less likely to be accidental
    if (target.includes("$") || target.includes("`") || target.includes("$(")) {
      // Still try to extract literal path if possible
      const literalPath = target.replace(/\$\{[^}]+\}/g, "").replace(/\$\w+/g, "");
      if (literalPath && !literalPath.includes("$")) {
        try {
          targets.push(canonicalizePath(literalPath, cwd));
        } catch {
          // Invalid path, skip
        }
      }
      continue;
    }

    try {
      targets.push(canonicalizePath(target, cwd));
    } catch {
      // Invalid path, skip
    }
  }

  return targets;
}

/**
 * Extract paths that might be written by file manipulation commands
 * Handles: cp, mv, tee, dd
 */
function extractFileCommandTargets(command: string, cwd: string): string[] {
  const targets: string[] = [];

  // Pattern: command ... <target>
  // This is simplified - real shell parsing is complex
  // We look for: cp/mv source target, tee file, dd of=file

  // cp/mv patterns: cp src dest, mv src dest
  const cpMvPattern =
    /\b(cp|mv)\b[^|;&]*?(?:^|\s)([^\s;|&<>'"]+|"[^"]+"|'[^']+')(?=\s*(?:;|&|\||$))/g;
  let match;

  while ((match = cpMvPattern.exec(command)) !== null) {
    let target = match[2].trim();

    // Remove quotes
    if (
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
    ) {
      target = target.slice(1, -1);
    }

    // Skip variables/substitutions
    if (target.includes("$") || target.includes("`")) {
      continue;
    }

    try {
      targets.push(canonicalizePath(target, cwd));
    } catch {
      // Invalid path, skip
    }
  }

  // tee pattern: tee file
  const teePattern = /\btee\b[^|;&]*?(?:^|\s)([^\s;|&<>'"]+|"[^"]+"|'[^']+')(?=\s*(?:;|&|\||$))/g;

  while ((match = teePattern.exec(command)) !== null) {
    let target = match[1].trim();

    // Remove quotes
    if (
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
    ) {
      target = target.slice(1, -1);
    }

    // Skip flags
    if (target.startsWith("-")) {
      continue;
    }

    // Skip variables/substitutions
    if (target.includes("$") || target.includes("`")) {
      continue;
    }

    try {
      targets.push(canonicalizePath(target, cwd));
    } catch {
      // Invalid path, skip
    }
  }

  // dd pattern: dd of=file
  const ddPattern = /\bdd\b[^|;&]*?\bof=([^\s;|&<>'"]+|"[^"]+"|'[^']+')/g;

  while ((match = ddPattern.exec(command)) !== null) {
    let target = match[1].trim();

    // Remove quotes
    if (
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
    ) {
      target = target.slice(1, -1);
    }

    // Skip variables/substitutions
    if (target.includes("$") || target.includes("`")) {
      continue;
    }

    try {
      targets.push(canonicalizePath(target, cwd));
    } catch {
      // Invalid path, skip
    }
  }

  return targets;
}

/**
 * Check for in-place editor patterns
 * Handles: sed -i, awk -i, perl -pi, perl -i
 */
function checkInPlaceEditors(
  command: string,
  protectedPaths: Set<string>,
  cwd: string,
): ConfigGuardResult {
  // Pattern: (sed|awk|perl) ... -i ... <file>
  const inPlacePattern =
    /\b(sed|awk|perl|ruby)\b[^|;&]*?-[pi]*i[^|;&]*?([^\s;|&<>'"]+|"[^"]+"|'[^']+')(?=\s*(?:;|&|\||$))?/g;

  let match;
  while ((match = inPlacePattern.exec(command)) !== null) {
    const editor = match[1];
    const potentialPath = match[2]?.trim();

    if (!potentialPath) {
      continue;
    }

    let target = potentialPath;

    // Remove quotes
    if (
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
    ) {
      target = target.slice(1, -1);
    }

    // Skip flags
    if (target.startsWith("-")) {
      continue;
    }

    // Skip variables/substitutions (can't resolve them)
    if (target.includes("$") || target.includes("`")) {
      // But still check if protected path appears literally in command
      for (const protectedPath of protectedPaths) {
        if (
          command.includes(protectedPath.replace(os.homedir(), "~")) ||
          command.includes(protectedPath)
        ) {
          return {
            blocked: true,
            reason: "in-place editor with protected path",
            matchedPath: protectedPath,
            matchedPattern: `${editor} -i`,
          };
        }
      }
      continue;
    }

    try {
      const canonicalTarget = canonicalizePath(target, cwd);
      if (protectedPaths.has(canonicalTarget)) {
        return {
          blocked: true,
          reason: "in-place editor",
          matchedPath: canonicalTarget,
          matchedPattern: `${editor} -i`,
        };
      }
    } catch {
      // Invalid path, skip
    }
  }

  return { blocked: false };
}

/**
 * Check for text editor commands that write files
 * Handles: ex, vim, ed, emacs
 */
function checkTextEditors(
  command: string,
  protectedPaths: Set<string>,
  cwd: string,
): ConfigGuardResult {
  const editorPattern =
    /\b(ex|vim|vi|ed|emacs)\b[^|;&]*?([^\s;|&<>'"]+|"[^"]+"|'[^']+')(?=\s*(?:;|&|\||$))?/g;

  let match;
  while ((match = editorPattern.exec(command)) !== null) {
    const editor = match[1];
    const potentialPath = match[2]?.trim();

    if (!potentialPath) {
      continue;
    }

    let target = potentialPath;

    // Remove quotes
    if (
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
    ) {
      target = target.slice(1, -1);
    }

    // Skip flags
    if (target.startsWith("-")) {
      continue;
    }

    // Skip variables/substitutions
    if (target.includes("$") || target.includes("`")) {
      // But still check if protected path appears literally
      for (const protectedPath of protectedPaths) {
        if (
          command.includes(protectedPath.replace(os.homedir(), "~")) ||
          command.includes(protectedPath)
        ) {
          return {
            blocked: true,
            reason: "text editor with protected path",
            matchedPath: protectedPath,
            matchedPattern: editor,
          };
        }
      }
      continue;
    }

    try {
      const canonicalTarget = canonicalizePath(target, cwd);
      if (protectedPaths.has(canonicalTarget)) {
        return {
          blocked: true,
          reason: "text editor",
          matchedPath: canonicalTarget,
          matchedPattern: editor,
        };
      }
    } catch {
      // Invalid path, skip
    }
  }

  return { blocked: false };
}

/**
 * Check for scripting language file write operations
 * Handles: python -c "open().write()", node -e "fs.writeFile()", etc.
 */
function checkScriptWrites(command: string, protectedPaths: Set<string>): ConfigGuardResult {
  // Pattern: python/node/ruby/perl -c/-e with file write operations
  const scriptPattern =
    /\b(python\d?|node|ruby|perl)\b[^|;&]*?(-c|-e)\s*(['"]).*?\b(open|write|writefile|writefilesync)\b.*?\3/gi;

  if (scriptPattern.test(command)) {
    // If we see script file operations, check if any protected path appears literally
    for (const protectedPath of protectedPaths) {
      const homeTilde = protectedPath.replace(os.homedir(), "~");
      if (command.includes(protectedPath) || command.includes(homeTilde)) {
        return {
          blocked: true,
          reason: "script file write operation",
          matchedPath: protectedPath,
          matchedPattern: "script write",
        };
      }
    }
  }

  return { blocked: false };
}

/**
 * Extract the effective cwd from a command that may start with `cd <dir>`.
 * Handles patterns like:
 *   cd /some/dir && echo 'x' > file
 *   cd /some/dir; echo 'x' > file
 *   cd ~/dir && cmd1 && echo 'x' > file
 *
 * Returns the resolved directory if a leading `cd` is found, otherwise returns
 * the original cwd unchanged.
 */
function extractEffectiveCwd(command: string, cwd: string): string {
  // Match: cd <dir> followed by && or ;
  // Captures the directory argument to cd
  const cdPattern = /^\s*cd\s+([^\s;|&]+|"[^"]+"|'[^']+')\s*(?:&&|;)/;
  const match = cdPattern.exec(command);
  if (!match) return cwd;

  let dir = match[1].trim();
  // Remove quotes
  if ((dir.startsWith('"') && dir.endsWith('"')) || (dir.startsWith("'") && dir.endsWith("'"))) {
    dir = dir.slice(1, -1);
  }

  // Skip if it contains variables we can't resolve
  if (dir.includes("$") || dir.includes("`")) return cwd;

  try {
    return canonicalizePath(dir, cwd);
  } catch {
    return cwd;
  }
}

/**
 * Build a set of protected basenames from protected paths.
 * e.g. ~/.clawdbot/moltbot.json → "moltbot.json"
 */
function getProtectedBasenames(protectedPaths: Set<string>): Set<string> {
  const basenames = new Set<string>();
  for (const p of protectedPaths) {
    basenames.add(path.basename(p));
  }
  return basenames;
}

/**
 * Check if a write target's basename matches any protected filename.
 * This catches relative-path bypasses where `cd` changes directory
 * before writing to a bare filename like `moltbot.json`.
 */
function checkBasenameMatch(
  targets: string[],
  protectedBasenames: Set<string>,
  protectedPathsSet: Set<string>,
  pattern: string,
): ConfigGuardResult {
  for (const target of targets) {
    const basename = path.basename(target);
    if (protectedBasenames.has(basename)) {
      // Find the matching protected path for the error message
      let matchedPath = target;
      for (const p of protectedPathsSet) {
        if (path.basename(p) === basename) {
          matchedPath = p;
          break;
        }
      }
      return {
        blocked: true,
        reason: "basename match on protected config filename",
        matchedPath,
        matchedPattern: pattern,
      };
    }
  }
  return { blocked: false };
}

/**
 * Main guard function: Check if a command attempts to write to protected config files
 */
export function checkCommandForProtectedPaths(
  command: string,
  options: ConfigGuardOptions,
): ConfigGuardResult {
  const { protectedPaths: rawProtectedPaths, agentId, sessionId, cwd = process.cwd() } = options;

  // Detect effective cwd if command starts with `cd <dir> &&` or `cd <dir>;`
  const effectiveCwd = extractEffectiveCwd(command, cwd);

  // Canonicalize all protected paths (resolve symlinks, expand ~, etc.)
  const protectedPathsSet = new Set<string>();
  for (const rawPath of rawProtectedPaths) {
    try {
      const canonical = canonicalizePath(rawPath, cwd);
      protectedPathsSet.add(canonical);
    } catch (err) {
      logWarn(`config-guard: Failed to canonicalize protected path "${rawPath}": ${err}`);
      // Still add the expanded path as a fallback
      protectedPathsSet.add(path.resolve(expandHome(rawPath)));
    }
  }

  // Build set of protected basenames for bare-filename matching
  const protectedBasenames = getProtectedBasenames(protectedPathsSet);

  // Check 1: In-place editors (sed -i, awk -i, perl -pi, etc.)
  const inPlaceResult = checkInPlaceEditors(command, protectedPathsSet, effectiveCwd);
  if (inPlaceResult.blocked) {
    auditLog(command, inPlaceResult, agentId, sessionId);
    return inPlaceResult;
  }

  // Check 2: Text editors (vim, ex, ed, emacs)
  const textEditorResult = checkTextEditors(command, protectedPathsSet, effectiveCwd);
  if (textEditorResult.blocked) {
    auditLog(command, textEditorResult, agentId, sessionId);
    return textEditorResult;
  }

  // Check 3: Script writes (python -c, node -e with write operations)
  const scriptResult = checkScriptWrites(command, protectedPathsSet);
  if (scriptResult.blocked) {
    auditLog(command, scriptResult, agentId, sessionId);
    return scriptResult;
  }

  // Check 4: Output redirects (>, >>)
  // Try with both original cwd and effective cwd (after cd)
  const redirectTargets = extractRedirectTargets(command, effectiveCwd);
  for (const target of redirectTargets) {
    if (protectedPathsSet.has(target)) {
      const result: ConfigGuardResult = {
        blocked: true,
        reason: "output redirect",
        matchedPath: target,
        matchedPattern: ">",
      };
      auditLog(command, result, agentId, sessionId);
      return result;
    }
  }

  // Check 4b: Basename match on redirect targets (catches relative path bypasses)
  const redirectBasenameResult = checkBasenameMatch(
    redirectTargets,
    protectedBasenames,
    protectedPathsSet,
    ">",
  );
  if (redirectBasenameResult.blocked) {
    auditLog(command, redirectBasenameResult, agentId, sessionId);
    return redirectBasenameResult;
  }

  // Check 5: File manipulation commands (cp, mv, tee, dd)
  const fileCommandTargets = extractFileCommandTargets(command, effectiveCwd);
  for (const target of fileCommandTargets) {
    if (protectedPathsSet.has(target)) {
      const result: ConfigGuardResult = {
        blocked: true,
        reason: "file manipulation command",
        matchedPath: target,
        matchedPattern: "cp/mv/tee/dd",
      };
      auditLog(command, result, agentId, sessionId);
      return result;
    }
  }

  // Check 5b: Basename match on file command targets
  const fileBasenameResult = checkBasenameMatch(
    fileCommandTargets,
    protectedBasenames,
    protectedPathsSet,
    "cp/mv/tee/dd",
  );
  if (fileBasenameResult.blocked) {
    auditLog(command, fileBasenameResult, agentId, sessionId);
    return fileBasenameResult;
  }

  return { blocked: false };
}

/**
 * Audit log: Record blocked attempts
 * Lux requirement: Log every blocked attempt with command, agent, timestamp, pattern
 */
function auditLog(
  command: string,
  result: ConfigGuardResult,
  agentId?: string,
  sessionId?: string,
): void {
  const timestamp = new Date().toISOString();
  const logMessage = [
    "🛡️  CONFIG GUARD BLOCKED:",
    `timestamp=${timestamp}`,
    agentId ? `agent=${agentId}` : null,
    sessionId ? `session=${sessionId}` : null,
    `reason="${result.reason}"`,
    `path="${result.matchedPath}"`,
    `pattern="${result.matchedPattern}"`,
    `command="${command.substring(0, 200)}${command.length > 200 ? "..." : ""}"`,
  ]
    .filter(Boolean)
    .join(" ");

  logWarn(logMessage);
}

/**
 * Build a helpful error message for blocked commands
 * Lux requirement: Clear error messages directing agents to config.patch
 */
export function buildGuardErrorMessage(command: string, result: ConfigGuardResult): string {
  const displayPath = result.matchedPath?.replace(os.homedir(), "~") ?? "protected config file";

  return [
    "❌ Exec blocked: Command attempts to write to protected config file.",
    "",
    `Protected path: ${displayPath}`,
    `Attempted operation: ${result.reason}`,
    `Pattern: ${result.matchedPattern}`,
    `Command: ${command.substring(0, 150)}${command.length > 150 ? "..." : ""}`,
    "",
    "✅ Use the config.patch tool instead:",
    "   - Validates against schema (prevents crashes)",
    "   - Atomic updates with rollback",
    "   - Records config history",
    "",
    "Example:",
    '  config.patch --raw \'{"agents": {"list": [...]}}\'',
    "",
    "Need help? Ask the user or check AGENTS.md for config.patch examples.",
  ].join("\n");
}
