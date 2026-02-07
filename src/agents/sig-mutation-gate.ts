/**
 * Mutation gate for sig-protected files.
 *
 * Intercepts write/edit tool calls targeting files with sig file policies
 * (mutable: true) and blocks them, directing the agent to use update_and_sign
 * instead. This ensures all modifications to protected files go through
 * provenance validation.
 *
 * Runs in the before-tool-call hook pipeline, after the verification gate
 * and before plugin hooks. Both gates are deterministic orchestrator-level
 * code that cannot be bypassed by prompt injection.
 */

import { resolveFilePolicy, type SigConfig } from "@disreguard/sig";
import { resolve, relative } from "node:path";

export type MutationGateResult = { blocked: false } | { blocked: true; reason: string };

/** Tools that write files and should be checked against file policies. */
const MUTATION_GATED_TOOLS = new Set(["write", "edit"]);

/**
 * Regex to extract file paths from apply_patch content.
 * Matches: *** Add File: <path>, *** Update File: <path>, *** Delete File: <path>
 */
const PATCH_FILE_PATH_RE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;

/** Extract all file paths referenced in an apply_patch input string. */
export function extractPatchPaths(input: string): string[] {
  const paths: string[] = [];
  for (const match of input.matchAll(PATCH_FILE_PATH_RE)) {
    const p = match[1].trim();
    if (p) paths.push(p);
  }
  return paths;
}

/**
 * Check whether a tool call targets a sig-protected mutable file.
 * If so, block it and instruct the agent to use update_and_sign.
 *
 * Applies to `write`, `edit`, and `apply_patch`. For write/edit the target
 * path is read from the tool params. For apply_patch, file paths are parsed
 * from the patch content markers.
 */
export function checkMutationGate(
  toolName: string,
  toolArgs: unknown,
  projectRoot: string | undefined,
  sigConfig: SigConfig | null | undefined,
): MutationGateResult {
  const normalized = toolName.trim().toLowerCase();

  if (!projectRoot || !sigConfig?.files) {
    return { blocked: false };
  }

  const args = toolArgs as Record<string, unknown> | undefined;
  if (!args) {
    return { blocked: false };
  }

  // apply_patch: extract paths from patch content and check each
  if (normalized === "apply_patch") {
    const input = typeof args.input === "string" ? args.input : "";
    const paths = extractPatchPaths(input);
    return checkPathsAgainstPolicies(paths, projectRoot, sigConfig);
  }

  if (!MUTATION_GATED_TOOLS.has(normalized)) {
    return { blocked: false };
  }

  // Extract target path — handle both raw and normalized param names
  const targetPath =
    typeof args.path === "string"
      ? args.path
      : typeof args.file_path === "string"
        ? args.file_path
        : typeof args.filePath === "string"
          ? args.filePath
          : undefined;

  if (!targetPath) {
    return { blocked: false };
  }

  return checkPathAgainstPolicy(targetPath, projectRoot, sigConfig);
}

/** Check a single path against sig file policies. */
function checkPathAgainstPolicy(
  targetPath: string,
  projectRoot: string,
  sigConfig: SigConfig,
): MutationGateResult {
  const absolutePath = resolve(projectRoot, targetPath);
  const relativePath = relative(projectRoot, absolutePath);

  // Don't check paths outside the project root
  if (relativePath.startsWith("..")) {
    return { blocked: false };
  }

  const policy = resolveFilePolicy(sigConfig, relativePath);
  if (!policy.mutable) {
    return { blocked: false };
  }

  // File is protected and mutable — block direct writes
  const requiresSignedSource = policy.requireSignedSource !== false;
  const sourceNote = requiresSignedSource
    ? " Required: sourceType must be 'signed_message' with a valid sourceId referencing a signed owner message that authorized this change."
    : "";

  return {
    blocked: true,
    reason: `${relativePath} is protected by a sig file policy. Use the update_and_sign tool to modify it.${sourceNote}`,
  };
}

/** Check multiple paths; block if any match a mutable policy. */
function checkPathsAgainstPolicies(
  paths: string[],
  projectRoot: string,
  sigConfig: SigConfig,
): MutationGateResult {
  for (const p of paths) {
    const result = checkPathAgainstPolicy(p, projectRoot, sigConfig);
    if (result.blocked) return result;
  }
  return { blocked: false };
}
