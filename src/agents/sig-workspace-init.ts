/**
 * Workspace signature initialization.
 *
 * Signs workspace files that have mutable sig file policies but no existing
 * signatures. This establishes the initial chain anchor so that subsequent
 * updates via update_and_sign can be validated.
 *
 * Called during first agent run for a session. Uses identity "workspace:init"
 * which is a bootstrap identity — authorizedIdentities in the file policy
 * constrains who can *update*, not who originally signed.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { loadSigConfig, signFileIfUnsigned, type SigConfig } from "./sig-adapter.js";

const log = createSubsystemLogger("agents/sig-workspace-init");

const INIT_IDENTITY = "workspace:init";

export interface WorkspaceInitResult {
  signed: string[];
  alreadySigned: string[];
  skipped: string[];
}

/**
 * Sign any workspace files that have sig file policies with mutable: true
 * but no existing signatures. Idempotent — safe to call on every session start.
 */
export async function initWorkspaceSignatures(
  projectRoot: string,
  config?: SigConfig | null,
): Promise<WorkspaceInitResult> {
  const sigConfig = config ?? (await loadSigConfig(projectRoot));
  if (!sigConfig?.files) {
    return { signed: [], alreadySigned: [], skipped: [] };
  }

  const result: WorkspaceInitResult = { signed: [], alreadySigned: [], skipped: [] };

  for (const [pattern, policy] of Object.entries(sigConfig.files)) {
    if (!policy.mutable) {
      continue;
    }

    // Only handle exact file paths (not globs) for workspace init
    if (pattern.includes("*")) {
      continue;
    }

    const signResult = await signFileIfUnsigned(projectRoot, pattern, INIT_IDENTITY);
    if (signResult.alreadySigned) {
      result.alreadySigned.push(pattern);
    } else if (signResult.signed) {
      result.signed.push(pattern);
      log.info(`Signed workspace file: ${pattern}`);
    } else {
      result.skipped.push(pattern);
      if (signResult.error) {
        log.debug(`Skipped ${pattern}: ${signResult.error}`);
      }
    }
  }

  return result;
}
