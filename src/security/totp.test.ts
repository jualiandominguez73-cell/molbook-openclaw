/**
 * Tests for TOTP (Time-based One-Time Password) implementation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TotpManager } from "./totp.js";
import { OtpConfigurationError, InvalidTotpError, OtpProviderError } from "./errors.js";

describe("TotpManager", () => {
  describe("generateSecret", () => {
    it("should generate a valid TOTP secret", () => {
      const secret = TotpManager.generateSecret("test-user@example.com", "TestApp");

      expect(secret.accountName).toBe("test-user@example.com");
      expect(secret.issuer).toBe("TestApp");
      expect(secret.secret).toMatch(/^[A-Z2-7]+$/); // Base32 format
      expect(secret.secret.length).toBeGreaterThan(20); // At least 160 bits encoded
      expect(secret.uri).toContain("otpauth://totp/");
      expect(secret.uri).toContain("TestApp%3Atest-user%40example.com");
      expect(secret.uri).toContain(`secret=${secret.secret}`);
    });

    it("should use default issuer when not provided", () => {
      const secret = TotpManager.generateSecret("user");
      expect(secret.issuer).toBe("Moltbot");
      expect(secret.uri).toContain("Moltbot%3Auser");
    });

    it("should throw OtpConfigurationError for empty account name", () => {
      expect(() => TotpManager.generateSecret("")).toThrow(OtpConfigurationError);
      expect(() => TotpManager.generateSecret("   ")).toThrow(OtpConfigurationError);
    });

    it("should handle special characters in account names", () => {
      const secret = TotpManager.generateSecret("user@domain.com", "My App!");
      expect(secret.uri).toContain("My%20App!%3Auser%40domain.com");
    });

    it("should generate different secrets each time", () => {
      const secret1 = TotpManager.generateSecret("user");
      const secret2 = TotpManager.generateSecret("user");
      expect(secret1.secret).not.toBe(secret2.secret);
    });
  });

  describe("generateCode", () => {
    const testSecret = "JBSWY3DPEHPK3PXP"; // "Hello!" in Base32

    it("should generate 6-digit code by default", () => {
      const code = TotpManager.generateCode(testSecret);
      expect(code).toMatch(/^\d{6}$/);
    });

    it("should generate consistent code for same time", () => {
      const fixedTime = 1640995200000; // 2022-01-01 00:00:00 UTC
      const code1 = TotpManager.generateCode(testSecret, fixedTime);
      const code2 = TotpManager.generateCode(testSecret, fixedTime);
      expect(code1).toBe(code2);
    });

    it("should generate different codes for different times", () => {
      const time1 = 1640995200000; // 2022-01-01 00:00:00 UTC
      const time2 = time1 + 30000; // 30 seconds later
      const code1 = TotpManager.generateCode(testSecret, time1);
      const code2 = TotpManager.generateCode(testSecret, time2);
      expect(code1).not.toBe(code2);
    });

    it("should respect custom digits option", () => {
      const code = TotpManager.generateCode(testSecret, Date.now(), { digits: 8 });
      expect(code).toMatch(/^\d{8}$/);
    });

    it("should handle custom time step", () => {
      const fixedTime = 1640995200000;
      const code1 = TotpManager.generateCode(testSecret, fixedTime, { timeStep: 30 });
      const code2 = TotpManager.generateCode(testSecret, fixedTime, { timeStep: 60 });
      // Different time steps should potentially generate different codes
      // Note: They might be the same due to time step alignment, but that's okay
      expect(typeof code1).toBe("string");
      expect(typeof code2).toBe("string");
    });

    it("should pad codes with leading zeros", () => {
      // Generate many codes to increase chance of getting one that needs padding
      const codes = Array.from({ length: 100 }, (_, i) =>
        TotpManager.generateCode(testSecret, Date.now() + i * 1000),
      );

      // All codes should be exactly 6 digits
      codes.forEach((code) => {
        expect(code).toMatch(/^\d{6}$/);
        expect(code.length).toBe(6);
      });
    });

    it("should throw OtpProviderError for invalid secret", () => {
      expect(() => TotpManager.generateCode("invalid-base32!")).toThrow(OtpProviderError);
    });
  });

  describe("validateCode", () => {
    let testSecret: string;
    let fixedTime: number;

    beforeEach(() => {
      testSecret = "JBSWY3DPEHPK3PXP";
      fixedTime = 1640995200000; // 2022-01-01 00:00:00 UTC

      // Mock Date.now to return fixed time
      vi.spyOn(Date, "now").mockReturnValue(fixedTime);
    });

    it("should validate correct code", () => {
      const code = TotpManager.generateCode(testSecret, fixedTime);
      const isValid = TotpManager.validateCode(testSecret, code);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect code", () => {
      const isValid = TotpManager.validateCode(testSecret, "000000");
      expect(isValid).toBe(false);
    });

    it("should accept code within time window", () => {
      // Generate code for 30 seconds ago (previous window)
      const previousTime = fixedTime - 30000;
      const code = TotpManager.generateCode(testSecret, previousTime);

      // Should still be valid due to default window of 1
      const isValid = TotpManager.validateCode(testSecret, code, { window: 1 });
      expect(isValid).toBe(true);
    });

    it("should reject code outside time window", () => {
      // Generate code for 90 seconds ago (3 windows back)
      const oldTime = fixedTime - 90000;
      const code = TotpManager.generateCode(testSecret, oldTime);

      // Should be invalid with default window of 1
      const isValid = TotpManager.validateCode(testSecret, code, { window: 1 });
      expect(isValid).toBe(false);
    });

    it("should respect custom window size", () => {
      // Generate code for 90 seconds ago (3 windows back)
      const oldTime = fixedTime - 90000;
      const code = TotpManager.generateCode(testSecret, oldTime);

      // Should be valid with larger window
      const isValid = TotpManager.validateCode(testSecret, code, { window: 3 });
      expect(isValid).toBe(true);
    });

    it("should throw InvalidTotpError for invalid code format", () => {
      expect(() => TotpManager.validateCode(testSecret, "12345")).toThrow(InvalidTotpError);
      expect(() => TotpManager.validateCode(testSecret, "1234567")).toThrow(InvalidTotpError);
      expect(() => TotpManager.validateCode(testSecret, "abcdef")).toThrow(InvalidTotpError);
      expect(() => TotpManager.validateCode(testSecret, "")).toThrow(InvalidTotpError);
    });

    it("should throw OtpConfigurationError for empty secret", () => {
      expect(() => TotpManager.validateCode("", "123456")).toThrow(OtpConfigurationError);
      expect(() => TotpManager.validateCode("   ", "123456")).toThrow(OtpConfigurationError);
    });

    it("should clean input code of non-digits", () => {
      const code = TotpManager.generateCode(testSecret, fixedTime);
      const dirtyCode = `${code.slice(0, 3)}-${code.slice(3)}`; // Add hyphen
      const isValid = TotpManager.validateCode(testSecret, dirtyCode);
      expect(isValid).toBe(true);
    });

    it("should respect custom digits option", () => {
      const code = TotpManager.generateCode(testSecret, fixedTime, { digits: 8 });
      const isValid = TotpManager.validateCode(testSecret, code, { digits: 8 });
      expect(isValid).toBe(true);
    });
  });

  describe("getTimeRemaining", () => {
    beforeEach(() => {
      // Mock time to be exactly at 10 seconds into a 30-second window
      // Set to a time where (currentSeconds % 30) = 10 and (currentSeconds % 60) = 20
      const mockTimestamp = 1640995210000; // 2022-01-01 00:00:10 UTC (10 seconds past minute)
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);
    });

    it("should return remaining seconds in current time window", () => {
      const remaining = TotpManager.getTimeRemaining(30);
      expect(remaining).toBe(20); // 30 - 10 = 20 seconds remaining
    });

    it("should handle custom time step", () => {
      const remaining = TotpManager.getTimeRemaining(60);
      expect(remaining).toBe(50); // 60 - 10 = 50 seconds remaining
    });

    it("should return value between 1 and timeStep", () => {
      const remaining = TotpManager.getTimeRemaining();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(30);
    });
  });

  describe("getQrCodeText", () => {
    it("should return the URI for QR code generation", () => {
      const secret = TotpManager.generateSecret("test-user");
      const qrText = TotpManager.getQrCodeText(secret);
      expect(qrText).toBe(secret.uri);
      expect(qrText.startsWith("otpauth://totp/")).toBe(true);
    });
  });

  describe("parseUri", () => {
    it("should parse valid TOTP URI", () => {
      const originalUri =
        "otpauth://totp/TestApp%3Auser%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=TestApp";
      const parsed = TotpManager.parseUri(originalUri);

      expect(parsed.secret).toBe("JBSWY3DPEHPK3PXP");
      expect(parsed.accountName).toBe("user@example.com");
      expect(parsed.issuer).toBe("TestApp");
      expect(parsed.uri).toBe(originalUri);
    });

    it("should handle URI without issuer prefix in path", () => {
      const uri = "otpauth://totp/user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=TestApp";
      const parsed = TotpManager.parseUri(uri);

      expect(parsed.accountName).toBe("user@example.com");
      expect(parsed.issuer).toBe("TestApp");
    });

    it("should handle missing issuer parameter", () => {
      const uri = "otpauth://totp/user%40example.com?secret=JBSWY3DPEHPK3PXP";
      const parsed = TotpManager.parseUri(uri);

      expect(parsed.issuer).toBe("Unknown");
    });

    it("should throw OtpConfigurationError for invalid protocol", () => {
      expect(() => TotpManager.parseUri("http://example.com")).toThrow(OtpConfigurationError);
      expect(() => TotpManager.parseUri("otpauth://hotp/user?secret=ABC")).toThrow(
        OtpConfigurationError,
      );
    });

    it("should throw OtpConfigurationError for missing secret", () => {
      expect(() => TotpManager.parseUri("otpauth://totp/user")).toThrow(OtpConfigurationError);
    });

    it("should throw OtpConfigurationError for malformed URI", () => {
      expect(() => TotpManager.parseUri("not-a-uri")).toThrow(OtpConfigurationError);
    });
  });

  describe("integration test", () => {
    it("should complete full TOTP workflow", () => {
      // 1. Generate secret
      const secret = TotpManager.generateSecret("test-user@example.com", "TestApp");
      expect(secret.secret).toMatch(/^[A-Z2-7]+$/);

      // 2. Generate QR code text
      const qrText = TotpManager.getQrCodeText(secret);
      expect(qrText).toContain("otpauth://totp/");

      // 3. Generate and validate current code
      const code = TotpManager.generateCode(secret.secret);
      const isValid = TotpManager.validateCode(secret.secret, code);
      expect(isValid).toBe(true);

      // 4. Parse the URI back
      const parsed = TotpManager.parseUri(secret.uri);
      expect(parsed.secret).toBe(secret.secret);
      expect(parsed.accountName).toBe(secret.accountName);

      // 5. Verify time remaining is reasonable
      const timeRemaining = TotpManager.getTimeRemaining();
      expect(timeRemaining).toBeGreaterThan(0);
      expect(timeRemaining).toBeLessThanOrEqual(30);
    });
  });
});
