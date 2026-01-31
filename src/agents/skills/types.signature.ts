/**
 * Cryptographic signature types for skill provenance verification.
 *
 * This module defines types for Ed25519 signatures on skills, enabling
 * users to verify skill authenticity and track provenance chains.
 */

/**
 * Role of a signer in the provenance chain.
 * - author: Original skill creator
 * - auditor: Security/code reviewer who verified the skill
 * - voucher: Community member who vouches for the skill
 */
export type SignerRole = "author" | "auditor" | "voucher";

/**
 * A single signature in the provenance chain.
 */
export type SkillSignature = {
  /** Role of this signer */
  role: SignerRole;

  /** Public key fingerprint (e.g., "a3:b4:c5:d6:e7:f8:90:12") */
  signer: string;

  /** Base64-encoded Ed25519 signature */
  signature: string;

  /** ISO 8601 timestamp when signed */
  timestamp: string;

  /** Optional human-readable signer name */
  signer_name?: string;

  /** Optional comment from signer */
  comment?: string;

  /** SHA-256 hash of signed content (for auditability) */
  signed_content_hash?: string;
};

/**
 * Complete signature block in skill frontmatter.
 */
export type SkillSignatureBlock = {
  /** Schema version */
  version: 1;

  /** Primary author signature (required for signed skills) */
  author: SkillSignature;

  /** Chain of additional signatures (auditors, vouchers) */
  chain?: SkillSignature[];
};

/**
 * Result of signature verification.
 */
export type SignatureVerificationResult = {
  /** Overall verification status */
  status: "valid" | "invalid" | "unsigned" | "unknown_signer" | "partial";

  /** Verification details for each signature */
  signatures: Array<{
    role: SignerRole;
    signer: string;
    signer_name?: string;
    valid: boolean;
    trusted: boolean;
    error?: string;
  }>;

  /** Human-readable summary */
  summary: string;

  /** Whether the author signature is valid */
  author_valid: boolean;

  /** Number of valid auditor signatures */
  auditor_count: number;

  /** Number of valid voucher signatures */
  voucher_count: number;
};

/**
 * Trust level for a key in the keyring.
 * - full: Fully trusted for all declared roles
 * - marginal: Partially trusted (may require additional signatures)
 * - none: Not trusted (key is blocked)
 */
export type KeyTrustLevel = "full" | "marginal" | "none";

/**
 * Trusted key entry in keyring.
 */
export type TrustedKey = {
  /** Public key fingerprint */
  fingerprint: string;

  /** Base64-encoded public key */
  public_key: string;

  /** Human-readable name */
  name: string;

  /** Trust level for this key */
  trust: KeyTrustLevel;

  /** What roles this key is trusted for */
  trusted_roles: SignerRole[];

  /** When this key was added (ISO 8601) */
  added_at: string;

  /** Optional expiration (ISO 8601) */
  expires_at?: string;

  /** Optional notes */
  notes?: string;
};

/**
 * Keyring containing trusted public keys.
 */
export type Keyring = {
  version: 1;
  keys: TrustedKey[];
};

/**
 * Signing request for CLI operations.
 */
export type SigningRequest = {
  skill_path: string;
  role: SignerRole;
  private_key_path?: string;
  comment?: string;
};

/**
 * Generated keypair result.
 */
export type GeneratedKeypair = {
  /** Base64-encoded public key */
  publicKey: string;

  /** Base64-encoded private key */
  privateKey: string;

  /** Key fingerprint (e.g., "a3:b4:c5:d6:e7:f8:90:12") */
  fingerprint: string;
};
