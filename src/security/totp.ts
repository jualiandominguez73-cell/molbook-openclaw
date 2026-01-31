/**
 * TOTP (Time-based One-Time Password) implementation
 *
 * Provides functionality for generating TOTP secrets, creating QR codes,
 * and validating TOTP codes according to RFC 6238.
 */

import { createHmac, randomBytes } from "crypto";
import { OtpConfigurationError, InvalidTotpError, OtpProviderError } from "./errors.js";

export interface TotpSecret {
  /** Base32-encoded secret key */
  secret: string;
  /** Human-readable account name */
  accountName: string;
  /** Service issuer name */
  issuer: string;
  /** TOTP URI for QR code generation */
  uri: string;
}

export interface TotpValidationOptions {
  /** Number of time steps to check before/after current time (default: 1) */
  window?: number;
  /** TOTP time step in seconds (default: 30) */
  timeStep?: number;
  /** Number of digits in TOTP code (default: 6) */
  digits?: number;
}

const DEFAULT_VALIDATION_OPTIONS: Required<TotpValidationOptions> = {
  window: 1,
  timeStep: 30,
  digits: 6,
};

/**
 * Base32 encoding/decoding utilities for TOTP secrets
 */
class Base32 {
  private static readonly ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  private static readonly LOOKUP = Object.fromEntries(
    Base32.ALPHABET.split("").map((char, index) => [char, index]),
  );

  static encode(buffer: Buffer): string {
    let result = "";
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        bits -= 5;
        result += Base32.ALPHABET[(value >>> bits) & 31];
      }
    }

    if (bits > 0) {
      result += Base32.ALPHABET[(value << (5 - bits)) & 31];
    }

    return result;
  }

  static decode(str: string): Buffer {
    const upperStr = str.toUpperCase();

    // Check for invalid Base32 characters first
    for (const char of upperStr) {
      if (char !== "=" && !Base32.LOOKUP.hasOwnProperty(char)) {
        throw new Error(`Invalid Base32 character: ${char}`);
      }
    }

    const cleanStr = upperStr.replace(/=/g, ""); // Remove padding
    const result = [];
    let bits = 0;
    let value = 0;

    for (const char of cleanStr) {
      const charValue = Base32.LOOKUP[char];

      value = (value << 5) | charValue;
      bits += 5;

      if (bits >= 8) {
        bits -= 8;
        result.push((value >>> bits) & 255);
      }
    }

    return Buffer.from(result);
  }
}

export class TotpManager {
  /**
   * Generate a new TOTP secret for a user
   */
  static generateSecret(accountName: string, issuer = "Moltbot"): TotpSecret {
    if (!accountName?.trim()) {
      throw new OtpConfigurationError("Account name is required for TOTP secret generation");
    }

    // Generate 20 bytes (160 bits) of random data for the secret
    const secretBuffer = randomBytes(20);
    const secret = Base32.encode(secretBuffer);

    // Create TOTP URI according to Google Authenticator key URI format
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}%3A${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

    return {
      secret,
      accountName,
      issuer,
      uri,
    };
  }

  /**
   * Generate TOTP code for a given secret and time
   */
  static generateCode(secret: string, time?: number, options?: TotpValidationOptions): string {
    const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const timestamp = Math.floor((time || Date.now()) / 1000);
    const timeStep = Math.floor(timestamp / opts.timeStep);

    try {
      const secretBuffer = Base32.decode(secret);
      const timeBuffer = Buffer.alloc(8);

      // Write time step as big-endian 64-bit integer
      timeBuffer.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0);
      timeBuffer.writeUInt32BE(timeStep & 0xffffffff, 4);

      // HMAC-SHA1
      const hmac = createHmac("sha1", secretBuffer);
      hmac.update(timeBuffer);
      const hash = hmac.digest();

      // Dynamic truncation
      const offset = hash[hash.length - 1] & 0x0f;
      const truncatedHash = hash.readUInt32BE(offset) & 0x7fffffff;

      // Generate code
      const code = truncatedHash % Math.pow(10, opts.digits);
      return code.toString().padStart(opts.digits, "0");
    } catch (error) {
      throw new OtpProviderError(
        `Failed to generate TOTP code: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate a TOTP code against a secret
   */
  static validateCode(secret: string, code: string, options?: TotpValidationOptions): boolean {
    const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

    if (!secret?.trim()) {
      throw new OtpConfigurationError("TOTP secret is required for validation");
    }

    if (!code?.trim()) {
      throw new InvalidTotpError(`TOTP code must be exactly ${opts.digits} digits`);
    }

    // Clean the input code
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== opts.digits) {
      throw new InvalidTotpError(`TOTP code must be exactly ${opts.digits} digits`);
    }

    const now = Date.now();

    // Check current time window and adjacent windows
    for (let i = -opts.window; i <= opts.window; i++) {
      const testTime = now + i * opts.timeStep * 1000;
      const expectedCode = TotpManager.generateCode(secret, testTime, opts);

      if (constantTimeEqual(cleanCode, expectedCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the remaining seconds until the next TOTP code
   */
  static getTimeRemaining(timeStep = 30): number {
    const now = Math.floor(Date.now() / 1000);
    return timeStep - (now % timeStep);
  }

  /**
   * Generate a QR code-compatible data URI for a TOTP secret
   */
  static getQrCodeText(totpSecret: TotpSecret): string {
    return totpSecret.uri;
  }

  /**
   * Parse a TOTP URI to extract secret and metadata
   */
  static parseUri(uri: string): TotpSecret {
    try {
      const url = new URL(uri);

      if (url.protocol !== "otpauth:" || url.hostname !== "totp") {
        throw new Error("Invalid TOTP URI format");
      }

      const secret = url.searchParams.get("secret");
      const issuer = url.searchParams.get("issuer") || "Unknown";

      if (!secret) {
        throw new Error("Secret parameter missing from URI");
      }

      // Extract account name from pathname
      const pathParts = decodeURIComponent(url.pathname.slice(1)).split(":");
      const accountName = pathParts.length > 1 ? pathParts[1] : pathParts[0];

      return {
        secret,
        accountName,
        issuer,
        uri,
      };
    } catch (error) {
      throw new OtpConfigurationError(
        `Invalid TOTP URI: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
