/**
 * Adapter for sig functions that are in-flight (update chains, file policies).
 *
 * Exports the functions OpenClaw needs from sig's upcoming API. When the real
 * sig package update lands, these become passthroughs or get removed.
 */

import type { ContentStore } from "@disreguard/sig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SigFilePolicy {
  mutable: boolean;
  authorizedIdentities?: string[];
  requireSignedSource?: boolean;
}

export interface SigFilesConfig {
  [pattern: string]: SigFilePolicy;
}

export interface SigConfig {
  version: number;
  templates?: { engine?: string };
  sign?: { identity?: string };
  files?: SigFilesConfig;
}

export interface UpdateProvenance {
  sourceType: "signed_message" | "signed_template";
  sourceId?: string;
  sourceIdentity?: string;
  sourceHash?: string;
  reason: string;
}

export interface UpdateAndSignOptions {
  identity: string;
  provenance: UpdateProvenance;
  contentStore?: ContentStore;
}

export interface UpdateAndSignResult {
  approved: boolean;
  denied?: boolean;
  reason?: string;
  file?: string;
  hash?: string;
  chainLength?: number;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Load the sig config from `.sig/config.json` in the project root.
 * Returns null if the config doesn't exist or can't be parsed.
 */
export async function loadSigConfig(projectRoot: string): Promise<SigConfig | null> {
  try {
    const raw = await readFile(join(projectRoot, ".sig", "config.json"), "utf-8");
    return JSON.parse(raw) as SigConfig;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// File policy resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the file policy for a given path against the sig config.
 * Supports exact matches and basic glob patterns (trailing `*`).
 * Returns null if no policy matches.
 */
export function resolveFilePolicy(
  config: SigConfig | null,
  relativePath: string,
): SigFilePolicy | null {
  if (!config?.files) {
    return null;
  }

  // Normalize path separators
  const normalized = relativePath.replace(/\\/g, "/");

  // Try exact match first
  if (config.files[normalized]) {
    return config.files[normalized];
  }

  // Try glob patterns (simple trailing wildcard: "dir/*.ext")
  for (const [pattern, policy] of Object.entries(config.files)) {
    if (pattern.includes("*")) {
      const regex = globToRegex(pattern);
      if (regex.test(normalized)) {
        return policy;
      }
    }
  }

  return null;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

// ---------------------------------------------------------------------------
// Update and sign (stub)
// ---------------------------------------------------------------------------

/**
 * Update a file and sign the new version with provenance tracking.
 *
 * Stub: validates policy and provenance, writes the file, but does not
 * perform real cryptographic operations. Will be replaced by sig's
 * `updateAndSign` when the package update lands.
 */
export async function updateAndSign(
  projectRoot: string,
  file: string,
  content: string,
  options: UpdateAndSignOptions,
): Promise<UpdateAndSignResult> {
  const config = await loadSigConfig(projectRoot);
  const policy = resolveFilePolicy(config, file);

  if (!policy) {
    return {
      approved: false,
      denied: true,
      reason: `No file policy found for '${file}'. Cannot update without a policy.`,
      file,
    };
  }

  if (!policy.mutable) {
    return {
      approved: false,
      denied: true,
      reason: `File '${file}' is immutable (mutable: false). Cannot update.`,
      file,
    };
  }

  // Check authorized identities
  if (policy.authorizedIdentities && policy.authorizedIdentities.length > 0) {
    const authorized = policy.authorizedIdentities.some((pattern) => {
      if (pattern.endsWith("*")) {
        return options.identity.startsWith(pattern.slice(0, -1));
      }
      return options.identity === pattern;
    });
    if (!authorized) {
      return {
        approved: false,
        denied: true,
        reason: `Identity '${options.identity}' is not authorized to update '${file}'.`,
        file,
      };
    }
  }

  // Check signed source requirement
  if (policy.requireSignedSource && options.provenance.sourceType === "signed_message") {
    if (!options.provenance.sourceId) {
      return {
        approved: false,
        denied: true,
        reason: `File '${file}' requires a signed source. Provide a sourceId referencing a signed owner message.`,
        file,
      };
    }
    // Verify the source exists in the ContentStore
    if (options.contentStore) {
      const verification = options.contentStore.verify(options.provenance.sourceId);
      if (!verification.verified) {
        return {
          approved: false,
          denied: true,
          reason: `Source verification failed for '${options.provenance.sourceId}': ${verification.error ?? "unknown error"}`,
          file,
        };
      }
    }
  }

  // Stub: write the file (real sig will also update signatures and chain)
  const { writeFile } = await import("node:fs/promises");
  const filePath = join(projectRoot, file);
  await writeFile(filePath, content, "utf-8");

  return {
    approved: true,
    file,
    hash: "stub-hash",
    chainLength: 1,
  };
}

// ---------------------------------------------------------------------------
// Initial signing (stub)
// ---------------------------------------------------------------------------

import { stat } from "node:fs/promises";

/**
 * Sign a file for the first time (bootstrap / workspace init).
 * Stub: just checks the file exists. Real sig will create the signature.
 */
export async function signFileIfUnsigned(
  projectRoot: string,
  file: string,
  _identity: string,
): Promise<{ signed: boolean; alreadySigned: boolean; error?: string }> {
  const filePath = join(projectRoot, file);
  try {
    await stat(filePath);
  } catch {
    return { signed: false, alreadySigned: false, error: `File not found: ${file}` };
  }

  // Stub: check if a signature already exists
  const sigPath = join(projectRoot, ".sig", "sigs", `${file}.sig.json`);
  try {
    await stat(sigPath);
    return { signed: false, alreadySigned: true };
  } catch {
    // No signature — in real sig, we'd call signFile here.
    // Stub: pretend we signed it.
    return { signed: true, alreadySigned: false };
  }
}
