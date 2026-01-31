/**
 * Tests for OTP Verification State Manager
 */

import { describe, it, expect, beforeEach } from "vitest";
import { OtpVerificationManager } from "./otp.js";
import type { MoltbotConfig } from "../config/config.js";
import {
  VerificationExpiredError,
  StrictModeViolationError,
  OtpConfigurationError,
} from "./errors.js";

describe("OtpVerificationManager", () => {
  let manager: OtpVerificationManager;
  let config: MoltbotConfig;

  beforeEach(() => {
    config = {
      security: {
        otpVerification: {
          enabled: true,
          intervalHours: 24,
          strictMode: false,
          gracePeriodMinutes: 15,
        },
      },
    } as MoltbotConfig;

    manager = new OtpVerificationManager(config);
  });

  describe("constructor", () => {
    it("should throw OtpConfigurationError if no OTP config provided", () => {
      const emptyConfig = {} as MoltbotConfig;
      expect(() => new OtpVerificationManager(emptyConfig)).toThrow(OtpConfigurationError);
    });

    it("should use defaults for missing config values", () => {
      const minimalConfig = {
        security: {
          otpVerification: {},
        },
      } as MoltbotConfig;

      const mgr = new OtpVerificationManager(minimalConfig);
      expect(mgr.isUserVerified("test-user")).toBe(true); // enabled: false by default
    });
  });

  describe("getVerificationState", () => {
    it("should return initial state for new user", () => {
      const state = manager.getVerificationState("test-user");
      expect(state).toEqual({
        userId: "test-user",
        lastVerifiedAt: null,
        inGracePeriod: false,
        gracePeriodExpiresAt: null,
      });
    });

    it("should return copy of state to prevent mutation", () => {
      const state1 = manager.getVerificationState("test-user");
      const state2 = manager.getVerificationState("test-user");
      expect(state1).not.toBe(state2); // Different objects
      expect(state1).toEqual(state2); // Same content
    });
  });

  describe("isUserVerified", () => {
    it("should return true if OTP verification is disabled", () => {
      const disabledConfig = {
        security: {
          otpVerification: { enabled: false },
        },
      } as MoltbotConfig;

      const mgr = new OtpVerificationManager(disabledConfig);
      expect(mgr.isUserVerified("any-user")).toBe(true);
    });

    it("should return false for never-verified user", () => {
      expect(manager.isUserVerified("new-user")).toBe(false);
    });

    it("should return true for recently verified user", () => {
      manager.markUserVerified("test-user");
      expect(manager.isUserVerified("test-user")).toBe(true);
    });

    it("should return false for expired verification", () => {
      // Mark user verified in the past (25 hours ago with 24h interval)
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 25);

      // Directly set the verification state with expired time
      const state = {
        userId: "test-user",
        lastVerifiedAt: pastTime,
        inGracePeriod: false,
        gracePeriodExpiresAt: null,
      };
      (manager as any).verificationStates.set("test-user", state);

      expect(manager.isUserVerified("test-user")).toBe(false);
    });

    it("should return true during grace period", () => {
      // Set up user with expired verification but in grace period
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 25);

      const gracePeriodEnd = new Date();
      gracePeriodEnd.setMinutes(gracePeriodEnd.getMinutes() + 10);

      // Directly set the verification state
      const state = {
        userId: "test-user",
        lastVerifiedAt: pastTime,
        inGracePeriod: true,
        gracePeriodExpiresAt: gracePeriodEnd,
      };
      (manager as any).verificationStates.set("test-user", state);

      expect(manager.isUserVerified("test-user")).toBe(true);
    });
  });

  describe("markUserVerified", () => {
    it("should update user verification state", () => {
      const beforeTime = new Date();
      manager.markUserVerified("test-user");
      const afterTime = new Date();

      const state = manager.getVerificationState("test-user");
      expect(state.lastVerifiedAt).toBeTruthy();
      expect(state.lastVerifiedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(state.lastVerifiedAt!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(state.inGracePeriod).toBe(false);
      expect(state.gracePeriodExpiresAt).toBe(null);
    });

    it("should clear grace period when user reverifies", () => {
      // Set up grace period first
      manager.markUserVerified("test-user");
      const state = manager.getVerificationState("test-user");
      state.inGracePeriod = true;
      state.gracePeriodExpiresAt = new Date();

      // Reverify
      manager.markUserVerified("test-user");
      const newState = manager.getVerificationState("test-user");
      expect(newState.inGracePeriod).toBe(false);
      expect(newState.gracePeriodExpiresAt).toBe(null);
    });
  });

  describe("enforceVerification", () => {
    it("should not throw if OTP verification is disabled", () => {
      const disabledConfig = {
        security: {
          otpVerification: { enabled: false },
        },
      } as MoltbotConfig;

      const mgr = new OtpVerificationManager(disabledConfig);
      expect(() => mgr.enforceVerification("any-user")).not.toThrow();
    });

    it("should not throw for verified user", () => {
      manager.markUserVerified("test-user");
      expect(() => manager.enforceVerification("test-user")).not.toThrow();
    });

    it("should throw VerificationExpiredError in non-strict mode", () => {
      expect(() => manager.enforceVerification("unverified-user")).toThrow(
        VerificationExpiredError,
      );
    });

    it("should throw StrictModeViolationError in strict mode", () => {
      const strictConfig = {
        security: {
          otpVerification: {
            enabled: true,
            strictMode: true,
          },
        },
      } as MoltbotConfig;

      const mgr = new OtpVerificationManager(strictConfig);
      expect(() => mgr.enforceVerification("unverified-user")).toThrow(StrictModeViolationError);
    });

    it("should start grace period for expired previously-verified user", () => {
      // Set up user with expired verification
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 25);

      // Directly set the verification state with expired time
      const state = {
        userId: "test-user",
        lastVerifiedAt: pastTime,
        inGracePeriod: false,
        gracePeriodExpiresAt: null,
      };
      (manager as any).verificationStates.set("test-user", state);

      // Should start grace period and not throw
      expect(() => manager.enforceVerification("test-user")).not.toThrow();

      const updatedState = manager.getVerificationState("test-user");
      expect(updatedState.inGracePeriod).toBe(true);
      expect(updatedState.gracePeriodExpiresAt).toBeTruthy();
    });
  });

  describe("getTimeUntilExpiration", () => {
    it("should return null if OTP verification disabled", () => {
      const disabledConfig = {
        security: {
          otpVerification: { enabled: false },
        },
      } as MoltbotConfig;

      const mgr = new OtpVerificationManager(disabledConfig);
      expect(mgr.getTimeUntilExpiration("any-user")).toBe(null);
    });

    it("should return null for never-verified user", () => {
      expect(manager.getTimeUntilExpiration("new-user")).toBe(null);
    });

    it("should return null for expired verification", () => {
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 25);

      // Directly set the verification state with expired time
      const state = {
        userId: "test-user",
        lastVerifiedAt: pastTime,
        inGracePeriod: false,
        gracePeriodExpiresAt: null,
      };
      (manager as any).verificationStates.set("test-user", state);

      expect(manager.getTimeUntilExpiration("test-user")).toBe(null);
    });

    it("should return time in milliseconds for valid verification", () => {
      manager.markUserVerified("test-user");
      const timeUntilExpiration = manager.getTimeUntilExpiration("test-user");

      expect(timeUntilExpiration).toBeTruthy();
      expect(timeUntilExpiration!).toBeGreaterThan(0);

      // Should be close to 24 hours (allowing for test execution time)
      const expectedMs = 24 * 60 * 60 * 1000;
      expect(timeUntilExpiration!).toBeGreaterThan(expectedMs - 1000);
      expect(timeUntilExpiration!).toBeLessThan(expectedMs + 1000);
    });
  });

  describe("utility methods", () => {
    it("should clear all states", () => {
      manager.markUserVerified("user1");
      manager.markUserVerified("user2");

      expect(manager.getAllStates()).toHaveLength(2);

      manager.clearAllStates();
      expect(manager.getAllStates()).toHaveLength(0);
    });

    it("should get all states", () => {
      manager.markUserVerified("user1");
      manager.markUserVerified("user2");

      const states = manager.getAllStates();
      expect(states).toHaveLength(2);
      expect(states.map((s) => s.userId).sort()).toEqual(["user1", "user2"]);
    });
  });
});
