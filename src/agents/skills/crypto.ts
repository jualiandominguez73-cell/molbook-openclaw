/**
 * Cryptographic utilities for skill signature operations.
 *
 * Uses Ed25519 for signing and verification. Ed25519 was chosen for:
 * - Fast signature generation and verification
 * - Small signatures (64 bytes) and keys (32 bytes)
 * - Deterministic signatures (same input always produces same output)
 * - No configuration footguns (unlike RSA key sizes, EC curve choices)
 */

import { createHash } from "node:crypto";

import * as ed from "@noble/ed25519";

import type { GeneratedKeypair } from "./types.signature.js";

// Configure ed25519 to use Node.js crypto for SHA-512
// This is required for synchronous operations
ed.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
  const hash = createHash("sha512");
  for (const msg of messages) {
    hash.update(msg);
  }
  return new Uint8Array(hash.digest());
};

/**
 * Generate a new Ed25519 keypair.
 */
export async function generateKeypair(): Promise<GeneratedKeypair> {
  const privateKeyBytes = ed.utils.randomSecretKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);

  const publicKey = Buffer.from(publicKeyBytes).toString("base64");
  const privateKey = Buffer.from(privateKeyBytes).toString("base64");
  const fingerprint = computeFingerprint(publicKey);

  return { publicKey, privateKey, fingerprint };
}

/**
 * Compute fingerprint from a base64-encoded public key.
 *
 * Fingerprint format: First 16 hex chars of SHA-256(public_key), colon-separated pairs.
 * Example: "a3:b4:c5:d6:e7:f8:90:12"
 */
export function computeFingerprint(publicKeyBase64: string): string {
  const publicKeyBytes = Buffer.from(publicKeyBase64, "base64");
  const hash = createHash("sha256").update(publicKeyBytes).digest("hex");

  // First 16 chars, formatted as colon-separated pairs
  const pairs: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    pairs.push(hash.slice(i, i + 2));
  }
  return pairs.join(":");
}

/**
 * Sign a message with a private key.
 *
 * @param message - The message to sign (string or Uint8Array)
 * @param privateKeyBase64 - Base64-encoded Ed25519 private key
 * @returns Base64-encoded signature
 */
export async function signMessage(
  message: string | Uint8Array,
  privateKeyBase64: string,
): Promise<string> {
  const privateKey = Buffer.from(privateKeyBase64, "base64");
  const messageBytes = typeof message === "string" ? new TextEncoder().encode(message) : message;

  const signature = await ed.signAsync(messageBytes, privateKey);
  return Buffer.from(signature).toString("base64");
}

/**
 * Verify a signature against a message and public key.
 *
 * @param message - The original message
 * @param signatureBase64 - Base64-encoded signature
 * @param publicKeyBase64 - Base64-encoded public key
 * @returns true if signature is valid, false otherwise
 */
export async function verifySignature(
  message: string | Uint8Array,
  signatureBase64: string,
  publicKeyBase64: string,
): Promise<boolean> {
  try {
    const publicKey = Buffer.from(publicKeyBase64, "base64");
    const signature = Buffer.from(signatureBase64, "base64");
    const messageBytes = typeof message === "string" ? new TextEncoder().encode(message) : message;

    return await ed.verifyAsync(signature, messageBytes, publicKey);
  } catch {
    return false;
  }
}

/**
 * Compute SHA-256 hash of content.
 *
 * @param content - Content to hash
 * @returns Hex-encoded hash
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Build the canonical message to sign for a skill.
 *
 * The signing message includes:
 * - Skill name
 * - Skill version (defaults to "0.0.0" if not provided)
 * - Canonicalized permissions JSON
 * - SHA-256 hash of skill content
 *
 * This ensures changing any of these invalidates the signature.
 */
export function buildSigningMessage(params: {
  skillName: string;
  skillVersion?: string;
  permissionsJson?: string;
  contentHash: string;
}): string {
  const parts = [
    `name:${params.skillName}`,
    `version:${params.skillVersion ?? "0.0.0"}`,
    `permissions:${params.permissionsJson ?? "{}"}`,
    `content:${params.contentHash}`,
  ];
  return parts.join("\n");
}

/**
 * Canonicalize a JSON object for consistent signing.
 *
 * Ensures the same object always produces the same JSON string
 * by sorting keys alphabetically.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalizeJson(item)).join(",") + "]";
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalizeJson(value)}`;
  });
  return "{" + pairs.join(",") + "}";
}

/**
 * Derive public key from private key.
 *
 * @param privateKeyBase64 - Base64-encoded private key
 * @returns Base64-encoded public key
 */
export async function derivePublicKey(privateKeyBase64: string): Promise<string> {
  const privateKey = Buffer.from(privateKeyBase64, "base64");
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKey);
  return Buffer.from(publicKeyBytes).toString("base64");
}
