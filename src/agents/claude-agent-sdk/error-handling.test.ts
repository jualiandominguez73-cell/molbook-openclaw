import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import {
  classifyError,
  isRetryableError,
  describeErrorKind,
  withRetry,
  CcsdkError,
  isCcsdkError,
  toCcsdkError,
  DEFAULT_RETRY_OPTIONS,
} from "./error-handling.js";
import type { RetryOptions } from "./error-handling.js";

describe("error-handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Mock Math.random to eliminate jitter in retry backoff delays.
    // The withRetry function adds 0-20% random jitter to delays, which causes
    // tests using exact timer advancement to timeout when jitter > 0.
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("classifyError", () => {
    describe("rate limit errors", () => {
      it("classifies HTTP 429 status as rate_limit", () => {
        expect(classifyError({ status: 429 })).toBe("rate_limit");
      });

      it("classifies rate limit message patterns", () => {
        expect(classifyError({ message: "Rate limit exceeded" })).toBe("rate_limit");
        expect(classifyError({ message: "Too many requests" })).toBe("rate_limit");
        expect(classifyError({ message: "Resource has been exhausted" })).toBe("rate_limit");
        expect(classifyError({ message: "Server overloaded" })).toBe("rate_limit");
        expect(classifyError({ message: "Request throttled" })).toBe("rate_limit");
      });
    });

    describe("context overflow errors", () => {
      it("classifies context window errors", () => {
        expect(classifyError({ message: "Context window exceeded" })).toBe("context_overflow");
        expect(classifyError({ message: "context length too long" })).toBe("context_overflow");
        expect(classifyError({ message: "Context overflow error" })).toBe("context_overflow");
      });

      it("classifies token limit errors", () => {
        expect(classifyError({ message: "Exceeds maximum token limit" })).toBe("context_overflow");
        expect(classifyError({ message: "Maximum context size reached" })).toBe("context_overflow");
        expect(classifyError({ message: "Prompt too long for model" })).toBe("context_overflow");
      });
    });

    describe("auth failure errors", () => {
      it("classifies HTTP 401 and 403 as auth_failure", () => {
        expect(classifyError({ status: 401 })).toBe("auth_failure");
        expect(classifyError({ status: 403 })).toBe("auth_failure");
      });

      it("classifies authentication message patterns", () => {
        expect(classifyError({ message: "Authentication failed" })).toBe("auth_failure");
        expect(classifyError({ message: "Authorization error" })).toBe("auth_failure");
        expect(classifyError({ message: "Invalid API key" })).toBe("auth_failure");
        expect(classifyError({ message: "Invalid token provided" })).toBe("auth_failure");
        expect(classifyError({ message: "Permission denied" })).toBe("auth_failure");
        expect(classifyError({ message: "Unauthorized access" })).toBe("auth_failure");
        expect(classifyError({ message: "Forbidden" })).toBe("auth_failure");
      });
    });

    describe("network errors", () => {
      it("classifies network error codes", () => {
        expect(classifyError({ code: "ECONNREFUSED" })).toBe("network");
        expect(classifyError({ code: "ECONNRESET" })).toBe("network");
        expect(classifyError({ code: "ENOTFOUND" })).toBe("network");
      });

      it("classifies network message patterns", () => {
        expect(classifyError({ message: "Network error" })).toBe("network");
        expect(classifyError({ message: "Connection refused" })).toBe("network");
        expect(classifyError({ message: "connect failed" })).toBe("network");
        expect(classifyError({ message: "Socket error" })).toBe("network");
        expect(classifyError({ message: "Fetch failed" })).toBe("network");
      });
    });

    describe("timeout errors", () => {
      it("classifies HTTP 408 as timeout", () => {
        expect(classifyError({ status: 408 })).toBe("timeout");
      });

      it("classifies timeout error codes", () => {
        expect(classifyError({ code: "ETIMEDOUT" })).toBe("timeout");
        expect(classifyError({ code: "ESOCKETTIMEDOUT" })).toBe("timeout");
      });

      it("classifies TimeoutError by name", () => {
        const error = new Error("Request timed out");
        error.name = "TimeoutError";
        expect(classifyError(error)).toBe("timeout");
      });

      it("classifies AbortError as timeout", () => {
        const error = new Error("Request aborted");
        error.name = "AbortError";
        expect(classifyError(error)).toBe("timeout");
      });

      it("classifies timeout message patterns", () => {
        expect(classifyError({ message: "Request timed out" })).toBe("timeout");
        expect(classifyError({ message: "Timeout error" })).toBe("timeout");
        expect(classifyError({ message: "Deadline exceeded" })).toBe("timeout");
        expect(classifyError({ message: "Request was aborted" })).toBe("timeout");
      });
    });

    describe("tool errors", () => {
      it("classifies tool execution errors", () => {
        expect(classifyError({ message: "Tool error occurred" })).toBe("tool_error");
        expect(classifyError({ message: "Tool execution failed" })).toBe("tool_error");
        expect(classifyError({ message: "MCP error" })).toBe("tool_error");
        expect(classifyError({ message: "MCP tool failed" })).toBe("tool_error");
      });
    });

    describe("unknown errors", () => {
      it("returns unknown for null/undefined", () => {
        expect(classifyError(null)).toBe("unknown");
        expect(classifyError(undefined)).toBe("unknown");
      });

      it("returns unknown for unrecognized errors", () => {
        expect(classifyError({ message: "Something unexpected happened" })).toBe("unknown");
        expect(classifyError(new Error("Generic error"))).toBe("unknown");
      });

      it("returns unknown for empty error objects", () => {
        expect(classifyError({})).toBe("unknown");
      });
    });

    describe("edge cases", () => {
      it("handles errors with both status and message", () => {
        // Status takes precedence
        expect(classifyError({ status: 429, message: "Connection error" })).toBe("rate_limit");
      });

      it("handles string errors", () => {
        expect(classifyError("Rate limit exceeded")).toBe("rate_limit");
      });

      it("handles numeric status as string", () => {
        expect(classifyError({ status: "429" })).toBe("rate_limit");
      });

      it("handles errors with code field", () => {
        expect(classifyError({ code: "ETIMEDOUT", message: "unknown" })).toBe("timeout");
      });
    });
  });

  describe("isRetryableError", () => {
    it("returns true for rate_limit errors by default", () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
    });

    it("returns true for network errors by default", () => {
      expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
    });

    it("returns true for timeout errors by default", () => {
      expect(isRetryableError({ status: 408 })).toBe(true);
    });

    it("returns false for auth errors by default", () => {
      expect(isRetryableError({ status: 401 })).toBe(false);
    });

    it("returns false for context overflow by default", () => {
      expect(isRetryableError({ message: "Context window exceeded" })).toBe(false);
    });

    it("respects custom retryable kinds list", () => {
      expect(isRetryableError({ status: 401 }, ["auth_failure"])).toBe(true);
      expect(isRetryableError({ status: 429 }, ["auth_failure"])).toBe(false);
    });
  });

  describe("describeErrorKind", () => {
    it("returns human-readable descriptions", () => {
      expect(describeErrorKind("rate_limit")).toBe("Rate limit exceeded");
      expect(describeErrorKind("context_overflow")).toBe("Context window overflow");
      expect(describeErrorKind("auth_failure")).toBe("Authentication failed");
      expect(describeErrorKind("network")).toBe("Network error");
      expect(describeErrorKind("timeout")).toBe("Request timed out");
      expect(describeErrorKind("tool_error")).toBe("Tool execution error");
      expect(describeErrorKind("unknown")).toBe("Unknown error");
    });
  });

  describe("withRetry", () => {
    it("returns result on first successful attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const options: RetryOptions = {
        maxRetries: 3,
        backoffMs: 100,
        retryOn: ["rate_limit"],
      };

      const result = await withRetry(fn, options);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable errors", async () => {
      const rateLimitError = { status: 429, message: "Rate limited" };
      const fn = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const options: RetryOptions = {
        maxRetries: 3,
        backoffMs: 100,
        retryOn: ["rate_limit"],
      };

      const promise = withRetry(fn, options);

      // Run all timers to completion (handles all retries)
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("throws immediately on non-retryable errors", async () => {
      const authError = { status: 401, message: "Unauthorized" };
      const fn = vi.fn().mockRejectedValue(authError);

      const options: RetryOptions = {
        maxRetries: 3,
        backoffMs: 100,
        retryOn: ["rate_limit"],
      };

      await expect(withRetry(fn, options)).rejects.toMatchObject({ status: 401 });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("throws after exhausting retries", async () => {
      const rateLimitError = { status: 429, message: "Rate limited" };
      const fn = vi.fn().mockRejectedValue(rateLimitError);

      const options: RetryOptions = {
        maxRetries: 2,
        backoffMs: 100,
        retryOn: ["rate_limit"],
      };

      // Attach rejection handler BEFORE running timers to avoid unhandled rejection
      const promise = withRetry(fn, options).catch((e) => e);

      // Run all timers to completion (exhausts all retries)
      await vi.runAllTimersAsync();

      const error = await promise;
      expect(error).toMatchObject({ status: 429 });
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("respects abort signal", async () => {
      const fn = vi.fn().mockRejectedValue({ status: 429 });
      const controller = new AbortController();

      const options: RetryOptions = {
        maxRetries: 3,
        backoffMs: 100,
        retryOn: ["rate_limit"],
        abortSignal: controller.signal,
      };

      controller.abort();

      await expect(withRetry(fn, options)).rejects.toThrow("Aborted");
    });

    it("calls onRetry callback for each retry", async () => {
      const rateLimitError = { status: 429, message: "Rate limited" };
      const fn = vi.fn().mockRejectedValueOnce(rateLimitError).mockResolvedValue("success");

      const onRetry = vi.fn();

      const options: RetryOptions = {
        maxRetries: 3,
        backoffMs: 100,
        retryOn: ["rate_limit"],
        onRetry,
      };

      const promise = withRetry(fn, options);
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(onRetry).toHaveBeenCalledWith(
        1, // attempt number
        rateLimitError,
        expect.any(Number), // delay
      );
    });

    it("applies exponential backoff", async () => {
      const rateLimitError = { status: 429, message: "Rate limited" };
      const fn = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const delays: number[] = [];

      const options: RetryOptions = {
        maxRetries: 3,
        backoffMs: 100,
        backoffMultiplier: 2,
        retryOn: ["rate_limit"],
        onRetry: (_attempt, _error, delay) => {
          delays.push(delay);
        },
      };

      const promise = withRetry(fn, options);

      // Need to advance through both retry waits
      await vi.advanceTimersByTimeAsync(500);
      await promise;

      // Delays should increase exponentially (with some jitter)
      expect(delays[0]).toBeGreaterThanOrEqual(100);
      expect(delays[0]).toBeLessThanOrEqual(120); // 100 + 20% jitter
      expect(delays[1]).toBeGreaterThanOrEqual(200);
      expect(delays[1]).toBeLessThanOrEqual(240); // 200 + 20% jitter
    });

    it("respects maxBackoffMs", async () => {
      const rateLimitError = { status: 429, message: "Rate limited" };
      const fn = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const delays: number[] = [];

      const options: RetryOptions = {
        maxRetries: 4,
        backoffMs: 1000,
        maxBackoffMs: 1500,
        backoffMultiplier: 10,
        retryOn: ["rate_limit"],
        onRetry: (_attempt, _error, delay) => {
          delays.push(delay);
        },
      };

      const promise = withRetry(fn, options);
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      // All delays should be capped at maxBackoffMs (+ jitter)
      for (const delay of delays) {
        expect(delay).toBeLessThanOrEqual(1500 * 1.2);
      }
    });
  });

  describe("CcsdkError", () => {
    it("creates error with kind and message", () => {
      const error = new CcsdkError("Rate limited", "rate_limit");

      expect(error.message).toBe("Rate limited");
      expect(error.kind).toBe("rate_limit");
      expect(error.name).toBe("CcsdkError");
    });

    it("includes optional status and code", () => {
      const error = new CcsdkError("Auth failed", "auth_failure", {
        status: 401,
        code: "AUTH_ERROR",
      });

      expect(error.status).toBe(401);
      expect(error.code).toBe("AUTH_ERROR");
    });

    it("chains cause from original error", () => {
      const original = new Error("Original error");
      const error = new CcsdkError("Wrapped error", "unknown", {
        cause: original,
      });

      // Access cause via ES2022 Error.cause property (cast to any for TypeScript)
      expect((error as unknown as { cause: unknown }).cause).toBe(original);
    });
  });

  describe("isCcsdkError", () => {
    it("returns true for CcsdkError instances", () => {
      const error = new CcsdkError("Test", "unknown");
      expect(isCcsdkError(error)).toBe(true);
    });

    it("returns false for regular errors", () => {
      const error = new Error("Test");
      expect(isCcsdkError(error)).toBe(false);
    });

    it("returns false for non-errors", () => {
      expect(isCcsdkError(null)).toBe(false);
      expect(isCcsdkError({ message: "not an error" })).toBe(false);
    });
  });

  describe("toCcsdkError", () => {
    it("returns same error if already CcsdkError", () => {
      const error = new CcsdkError("Already wrapped", "rate_limit");
      expect(toCcsdkError(error)).toBe(error);
    });

    it("converts regular error to CcsdkError", () => {
      const error = new Error("Rate limit exceeded");
      const converted = toCcsdkError(error);

      expect(converted).toBeInstanceOf(CcsdkError);
      expect(converted.message).toBe("Rate limit exceeded");
      expect(converted.kind).toBe("rate_limit");
    });

    it("extracts status and code from error", () => {
      const error = Object.assign(new Error("Not found"), {
        status: 404,
        code: "NOT_FOUND",
      });

      const converted = toCcsdkError(error);

      expect(converted.status).toBe(404);
      expect(converted.code).toBe("NOT_FOUND");
    });

    it("uses kind description for empty message", () => {
      const converted = toCcsdkError({ status: 429 });

      expect(converted.message).toBe("Rate limit exceeded");
      expect(converted.kind).toBe("rate_limit");
    });

    it("chains original error as cause", () => {
      const original = new Error("Original");
      const converted = toCcsdkError(original);

      // Access cause via ES2022 Error.cause property (cast to any for TypeScript)
      expect((converted as unknown as { cause: unknown }).cause).toBe(original);
    });
  });

  describe("DEFAULT_RETRY_OPTIONS", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_OPTIONS.backoffMs).toBe(1000);
      expect(DEFAULT_RETRY_OPTIONS.maxBackoffMs).toBe(30_000);
      expect(DEFAULT_RETRY_OPTIONS.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_OPTIONS.retryOn).toEqual(["rate_limit", "network", "timeout"]);
    });
  });
});
