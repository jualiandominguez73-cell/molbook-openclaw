import { describe, expect, it } from "vitest";

import {
  buildSigningMessage,
  canonicalizeJson,
  computeFingerprint,
  derivePublicKey,
  generateKeypair,
  hashContent,
  signMessage,
  verifySignature,
} from "./crypto.js";

describe("generateKeypair", () => {
  it("generates valid keypair with fingerprint", async () => {
    const keypair = await generateKeypair();

    expect(keypair.publicKey).toBeTruthy();
    expect(keypair.privateKey).toBeTruthy();
    expect(keypair.fingerprint).toBeTruthy();

    // Public key should be 32 bytes base64-encoded
    const publicKeyBytes = Buffer.from(keypair.publicKey, "base64");
    expect(publicKeyBytes.length).toBe(32);

    // Private key should be 32 bytes base64-encoded
    const privateKeyBytes = Buffer.from(keypair.privateKey, "base64");
    expect(privateKeyBytes.length).toBe(32);

    // Fingerprint should be 8 colon-separated hex pairs
    expect(keypair.fingerprint).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/);
  });

  it("generates unique keypairs", async () => {
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();

    expect(keypair1.publicKey).not.toBe(keypair2.publicKey);
    expect(keypair1.privateKey).not.toBe(keypair2.privateKey);
    expect(keypair1.fingerprint).not.toBe(keypair2.fingerprint);
  });
});

describe("computeFingerprint", () => {
  it("computes consistent fingerprint from public key", () => {
    const publicKey = "dGVzdHB1YmxpY2tleWRhdGExMjM0NTY3ODkw"; // 32 bytes base64

    const fp1 = computeFingerprint(publicKey);
    const fp2 = computeFingerprint(publicKey);

    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/);
  });

  it("produces different fingerprints for different keys", () => {
    const key1 = "dGVzdHB1YmxpY2tleWRhdGExMjM0NTY3ODkw";
    const key2 = "YW5vdGhlcnB1YmxpY2tleWRhdGExMjM0NTY3";

    expect(computeFingerprint(key1)).not.toBe(computeFingerprint(key2));
  });
});

describe("signMessage and verifySignature", () => {
  it("signs and verifies a string message", async () => {
    const keypair = await generateKeypair();
    const message = "Hello, world!";

    const signature = await signMessage(message, keypair.privateKey);
    expect(signature).toBeTruthy();

    const isValid = await verifySignature(message, signature, keypair.publicKey);
    expect(isValid).toBe(true);
  });

  it("signs and verifies a Uint8Array message", async () => {
    const keypair = await generateKeypair();
    const message = new Uint8Array([1, 2, 3, 4, 5]);

    const signature = await signMessage(message, keypair.privateKey);
    const isValid = await verifySignature(message, signature, keypair.publicKey);
    expect(isValid).toBe(true);
  });

  it("rejects tampered message", async () => {
    const keypair = await generateKeypair();
    const originalMessage = "Original message";
    const tamperedMessage = "Tampered message";

    const signature = await signMessage(originalMessage, keypair.privateKey);
    const isValid = await verifySignature(tamperedMessage, signature, keypair.publicKey);
    expect(isValid).toBe(false);
  });

  it("rejects wrong public key", async () => {
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();
    const message = "Test message";

    const signature = await signMessage(message, keypair1.privateKey);
    const isValid = await verifySignature(message, signature, keypair2.publicKey);
    expect(isValid).toBe(false);
  });

  it("rejects invalid signature", async () => {
    const keypair = await generateKeypair();
    const message = "Test message";
    const invalidSignature = Buffer.from("invalid").toString("base64");

    const isValid = await verifySignature(message, invalidSignature, keypair.publicKey);
    expect(isValid).toBe(false);
  });

  it("produces deterministic signatures", async () => {
    const keypair = await generateKeypair();
    const message = "Same message";

    const sig1 = await signMessage(message, keypair.privateKey);
    const sig2 = await signMessage(message, keypair.privateKey);

    expect(sig1).toBe(sig2);
  });
});

describe("hashContent", () => {
  it("produces consistent SHA-256 hash", () => {
    const content = "Test content";

    const hash1 = hashContent(content);
    const hash2 = hashContent(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different content", () => {
    expect(hashContent("content1")).not.toBe(hashContent("content2"));
  });

  it("handles empty string", () => {
    const hash = hashContent("");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles unicode content", () => {
    const hash = hashContent("Hello, 世界! 🌍");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildSigningMessage", () => {
  it("builds message with all fields", () => {
    const message = buildSigningMessage({
      skillName: "test-skill",
      skillVersion: "1.2.3",
      permissionsJson: '{"network":["api.example.com"]}',
      contentHash: "abc123",
    });

    expect(message).toContain("name:test-skill");
    expect(message).toContain("version:1.2.3");
    expect(message).toContain('permissions:{"network":["api.example.com"]}');
    expect(message).toContain("content:abc123");
  });

  it("uses default version when not provided", () => {
    const message = buildSigningMessage({
      skillName: "test-skill",
      contentHash: "abc123",
    });

    expect(message).toContain("version:0.0.0");
    expect(message).toContain("permissions:{}");
  });

  it("produces consistent output for same input", () => {
    const params = {
      skillName: "skill",
      skillVersion: "1.0.0",
      permissionsJson: "{}",
      contentHash: "hash",
    };

    const msg1 = buildSigningMessage(params);
    const msg2 = buildSigningMessage(params);

    expect(msg1).toBe(msg2);
  });
});

describe("canonicalizeJson", () => {
  it("sorts object keys alphabetically", () => {
    const obj = { zebra: 1, apple: 2, mango: 3 };
    const canonical = canonicalizeJson(obj);

    expect(canonical).toBe('{"apple":2,"mango":3,"zebra":1}');
  });

  it("handles nested objects", () => {
    const obj = { b: { d: 1, c: 2 }, a: 3 };
    const canonical = canonicalizeJson(obj);

    expect(canonical).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it("handles arrays", () => {
    const obj = { items: [3, 1, 2] };
    const canonical = canonicalizeJson(obj);

    // Arrays preserve order
    expect(canonical).toBe('{"items":[3,1,2]}');
  });

  it("handles primitives", () => {
    expect(canonicalizeJson(null)).toBe("null");
    expect(canonicalizeJson(42)).toBe("42");
    expect(canonicalizeJson("hello")).toBe('"hello"');
    expect(canonicalizeJson(true)).toBe("true");
  });

  it("handles empty objects and arrays", () => {
    expect(canonicalizeJson({})).toBe("{}");
    expect(canonicalizeJson([])).toBe("[]");
  });

  it("produces consistent output regardless of key order", () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };

    expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2));
  });
});

describe("derivePublicKey", () => {
  it("derives correct public key from private key", async () => {
    const keypair = await generateKeypair();

    const derivedPublicKey = await derivePublicKey(keypair.privateKey);

    expect(derivedPublicKey).toBe(keypair.publicKey);
  });

  it("derived key can verify signatures", async () => {
    const keypair = await generateKeypair();
    const message = "Test message";

    const signature = await signMessage(message, keypair.privateKey);
    const derivedPublicKey = await derivePublicKey(keypair.privateKey);

    const isValid = await verifySignature(message, signature, derivedPublicKey);
    expect(isValid).toBe(true);
  });
});

describe("integration: full signing workflow", () => {
  it("signs and verifies a complete skill message", async () => {
    const keypair = await generateKeypair();

    // Build the message to sign
    const skillContent = "# Weather Skill\n\nGet weather data.";
    const permissions = { network: ["wttr.in"], exec: ["curl"] };

    const signingMessage = buildSigningMessage({
      skillName: "weather",
      skillVersion: "1.0.0",
      permissionsJson: canonicalizeJson(permissions),
      contentHash: hashContent(skillContent),
    });

    // Sign
    const signature = await signMessage(signingMessage, keypair.privateKey);

    // Verify
    const isValid = await verifySignature(signingMessage, signature, keypair.publicKey);
    expect(isValid).toBe(true);

    // Verify fingerprint matches
    const expectedFingerprint = computeFingerprint(keypair.publicKey);
    expect(keypair.fingerprint).toBe(expectedFingerprint);
  });

  it("detects content tampering", async () => {
    const keypair = await generateKeypair();

    const originalContent = "# Original Content";
    const tamperedContent = "# Tampered Content";

    const signingMessage = buildSigningMessage({
      skillName: "skill",
      contentHash: hashContent(originalContent),
    });

    const signature = await signMessage(signingMessage, keypair.privateKey);

    // Verify with tampered content hash
    const tamperedMessage = buildSigningMessage({
      skillName: "skill",
      contentHash: hashContent(tamperedContent),
    });

    const isValid = await verifySignature(tamperedMessage, signature, keypair.publicKey);
    expect(isValid).toBe(false);
  });

  it("detects permission tampering", async () => {
    const keypair = await generateKeypair();

    const originalPermissions = { network: ["safe.api.com"] };
    const tamperedPermissions = { network: ["malicious.site.com"] };

    const signingMessage = buildSigningMessage({
      skillName: "skill",
      permissionsJson: canonicalizeJson(originalPermissions),
      contentHash: "abc123",
    });

    const signature = await signMessage(signingMessage, keypair.privateKey);

    const tamperedMessage = buildSigningMessage({
      skillName: "skill",
      permissionsJson: canonicalizeJson(tamperedPermissions),
      contentHash: "abc123",
    });

    const isValid = await verifySignature(tamperedMessage, signature, keypair.publicKey);
    expect(isValid).toBe(false);
  });
});
