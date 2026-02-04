/**
 * Secrets Vault
 * Encrypts secrets at rest, manages key rotation
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  createHash,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { VaultConfig, VaultEntry } from "./types.js";
import { getAuditLogger } from "./audit-logger.js";

export interface SecretsVaultConfig {
  /** Vault file path */
  vaultPath: string;
  /** Encryption configuration */
  encryption: VaultConfig;
  /** Master key (derived from password or keychain) */
  masterKey?: Buffer;
}

const DEFAULT_CONFIG: SecretsVaultConfig = {
  vaultPath: "./.secrets/vault.json",
  encryption: {
    algorithm: "aes-256-gcm",
    kdf: "pbkdf2",
    rotationIntervalDays: 90,
    useKeychain: false,
  },
};

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

interface VaultData {
  version: number;
  salt: string;
  keyVersion: number;
  entries: Record<string, VaultEntry>;
  metadata: {
    createdAt: number;
    lastRotatedAt: number;
  };
}

export class SecretsVault {
  private config: SecretsVaultConfig;
  private vaultData: VaultData | null = null;
  private derivedKey: Buffer | null = null;
  private unlocked: boolean = false;

  constructor(config: Partial<SecretsVaultConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      encryption: { ...DEFAULT_CONFIG.encryption, ...config.encryption },
    };

    if (config.masterKey) {
      this.derivedKey = config.masterKey;
      this.unlocked = true;
    }
  }

  /**
   * Initialize vault with a master password
   */
  async initialize(masterPassword: string): Promise<void> {
    const vaultDir = dirname(this.config.vaultPath);
    if (!existsSync(vaultDir)) {
      mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
    }

    if (existsSync(this.config.vaultPath)) {
      // Load existing vault
      await this.unlock(masterPassword);
    } else {
      // Create new vault
      const salt = randomBytes(SALT_LENGTH);
      this.derivedKey = this.deriveKey(masterPassword, salt);
      this.vaultData = {
        version: 1,
        salt: salt.toString("hex"),
        keyVersion: 1,
        entries: {},
        metadata: {
          createdAt: Date.now(),
          lastRotatedAt: Date.now(),
        },
      };
      this.unlocked = true;
      await this.save();

      getAuditLogger().info("vault_created", {
        vaultPath: this.config.vaultPath,
      });
    }
  }

  /**
   * Unlock vault with master password
   */
  async unlock(masterPassword: string): Promise<void> {
    if (!existsSync(this.config.vaultPath)) {
      throw new Error("Vault does not exist. Call initialize() first.");
    }

    const data = JSON.parse(readFileSync(this.config.vaultPath, "utf-8")) as VaultData;
    const salt = Buffer.from(data.salt, "hex");
    this.derivedKey = this.deriveKey(masterPassword, salt);
    this.vaultData = data;
    this.unlocked = true;

    getAuditLogger().info("vault_unlocked", {
      vaultPath: this.config.vaultPath,
      keyVersion: data.keyVersion,
    });
  }

  /**
   * Lock vault (clear derived key from memory)
   */
  lock(): void {
    this.derivedKey = null;
    this.unlocked = false;

    getAuditLogger().info("vault_locked", {
      vaultPath: this.config.vaultPath,
    });
  }

  /**
   * Store a secret
   */
  async set(key: string, value: string): Promise<void> {
    this.ensureUnlocked();

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.derivedKey!, iv);

    let encrypted = cipher.update(value, "utf-8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    const entry: VaultEntry = {
      ciphertext: encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      keyVersion: this.vaultData!.keyVersion,
      createdAt: Date.now(),
    };

    this.vaultData!.entries[key] = entry;
    await this.save();

    getAuditLogger().info("secret_stored", {
      key,
      keyVersion: entry.keyVersion,
    });
  }

  /**
   * Retrieve a secret
   */
  async get(key: string): Promise<string | null> {
    this.ensureUnlocked();

    const entry = this.vaultData!.entries[key];
    if (!entry) {
      return null;
    }

    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.derivedKey!,
        Buffer.from(entry.iv, "hex")
      );
      decipher.setAuthTag(Buffer.from(entry.authTag, "hex"));

      let decrypted = decipher.update(entry.ciphertext, "hex", "utf-8");
      decrypted += decipher.final("utf-8");

      // Update last accessed time
      entry.lastAccessedAt = Date.now();
      await this.save();

      return decrypted;
    } catch (err) {
      getAuditLogger().high("secret_decryption_failed", {
        key,
        error: String(err),
      });
      throw new Error(`Failed to decrypt secret: ${key}`);
    }
  }

  /**
   * Delete a secret
   */
  async delete(key: string): Promise<boolean> {
    this.ensureUnlocked();

    if (!(key in this.vaultData!.entries)) {
      return false;
    }

    delete this.vaultData!.entries[key];
    await this.save();

    getAuditLogger().info("secret_deleted", { key });

    return true;
  }

  /**
   * Check if a secret exists
   */
  has(key: string): boolean {
    this.ensureUnlocked();
    return key in this.vaultData!.entries;
  }

  /**
   * List all secret keys
   */
  list(): string[] {
    this.ensureUnlocked();
    return Object.keys(this.vaultData!.entries);
  }

  /**
   * Rotate the master key
   */
  async rotate(newMasterPassword: string): Promise<void> {
    this.ensureUnlocked();

    // Decrypt all values with old key
    const decrypted: Record<string, string> = {};
    for (const key of Object.keys(this.vaultData!.entries)) {
      const value = await this.get(key);
      if (value !== null) {
        decrypted[key] = value;
      }
    }

    // Generate new salt and key
    const newSalt = randomBytes(SALT_LENGTH);
    const newKey = this.deriveKey(newMasterPassword, newSalt);
    const oldKeyVersion = this.vaultData!.keyVersion;

    // Update vault with new key
    this.derivedKey = newKey;
    this.vaultData!.salt = newSalt.toString("hex");
    this.vaultData!.keyVersion += 1;
    this.vaultData!.metadata.lastRotatedAt = Date.now();
    this.vaultData!.entries = {};

    // Re-encrypt all values with new key
    for (const [key, value] of Object.entries(decrypted)) {
      await this.set(key, value);
    }

    getAuditLogger().info("vault_rotated", {
      oldKeyVersion,
      newKeyVersion: this.vaultData!.keyVersion,
      entriesRotated: Object.keys(decrypted).length,
    });
  }

  /**
   * Encrypt arbitrary data
   */
  encrypt(data: unknown): Buffer {
    this.ensureUnlocked();

    const plaintext = JSON.stringify(data);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.derivedKey!, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf-8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: iv (16) + authTag (16) + ciphertext
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt arbitrary data
   */
  decrypt<T = unknown>(ciphertext: Buffer): T {
    this.ensureUnlocked();

    const iv = ciphertext.subarray(0, IV_LENGTH);
    const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.derivedKey!, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf-8")) as T;
  }

  /**
   * Derive encryption key from password
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    // Using scrypt for key derivation (more secure than PBKDF2)
    return scryptSync(password, salt, KEY_LENGTH, {
      N: 16384, // CPU/memory cost
      r: 8, // Block size
      p: 1, // Parallelization
    });
  }

  /**
   * Ensure vault is unlocked
   */
  private ensureUnlocked(): void {
    if (!this.unlocked || !this.derivedKey || !this.vaultData) {
      throw new Error("Vault is locked. Call unlock() first.");
    }
  }

  /**
   * Save vault to disk
   */
  private async save(): Promise<void> {
    const vaultDir = dirname(this.config.vaultPath);
    if (!existsSync(vaultDir)) {
      mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
    }

    writeFileSync(
      this.config.vaultPath,
      JSON.stringify(this.vaultData, null, 2),
      { mode: 0o600 }
    );
  }

  /**
   * Check if vault exists
   */
  exists(): boolean {
    return existsSync(this.config.vaultPath);
  }

  /**
   * Check if vault is unlocked
   */
  isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * Get vault metadata
   */
  getMetadata(): { keyVersion: number; createdAt: number; lastRotatedAt: number } | null {
    if (!this.vaultData) return null;
    return {
      keyVersion: this.vaultData.keyVersion,
      createdAt: this.vaultData.metadata.createdAt,
      lastRotatedAt: this.vaultData.metadata.lastRotatedAt,
    };
  }
}

// Singleton instance
let defaultVault: SecretsVault | null = null;

/**
 * Get or create the default secrets vault
 */
export function getSecretsVault(config?: Partial<SecretsVaultConfig>): SecretsVault {
  if (!defaultVault) {
    defaultVault = new SecretsVault(config);
  }
  return defaultVault;
}
