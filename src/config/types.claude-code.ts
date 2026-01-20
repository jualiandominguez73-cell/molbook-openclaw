/**
 * Configuration types for Claude Code integration.
 */

export type ClaudeCodeConfig = {
  /**
   * Additional directories to scan for projects.
   * These are searched in order, before the hardcoded defaults.
   *
   * Example:
   * ```yaml
   * claudeCode:
   *   projectDirs:
   *     - ~/work/clients
   *     - ~/repos
   * ```
   */
  projectDirs?: string[];

  /**
   * Explicit project aliases mapping names to paths.
   * These take priority over auto-discovered projects.
   *
   * Example:
   * ```yaml
   * claudeCode:
   *   projects:
   *     acme: /work/clients/acme/main-app
   *     exp: ~/Documents/agent/juzi/.worktrees/experimental
   * ```
   */
  projects?: Record<string, string>;

  /**
   * Default permission mode for Claude Code sessions.
   * - "default": Normal permission prompts
   * - "acceptEdits": Auto-accept file edits
   * - "bypassPermissions": Skip all permission prompts (dangerous)
   */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";

  /**
   * Default model for Claude Code sessions.
   */
  model?: string;
};
