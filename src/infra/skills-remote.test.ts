import { describe, expect, it } from "vitest";

import { extractErrorMessage, isNodeUnavailableError } from "./skills-remote.js";

describe("extractErrorMessage", () => {
  it("extracts message from Error object", () => {
    expect(extractErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("extracts message from string", () => {
    expect(extractErrorMessage("string error")).toBe("string error");
  });

  it("extracts message from object with message property", () => {
    expect(extractErrorMessage({ message: "object error" })).toBe("object error");
  });

  it("converts number to string", () => {
    expect(extractErrorMessage(42)).toBe("42");
  });

  it("converts boolean to string", () => {
    expect(extractErrorMessage(true)).toBe("true");
  });

  it("returns undefined for null", () => {
    expect(extractErrorMessage(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(extractErrorMessage(undefined)).toBeUndefined();
  });

  it("JSON-stringifies plain objects without message", () => {
    expect(extractErrorMessage({ code: "ERR" })).toBe('{"code":"ERR"}');
  });
});

describe("isNodeUnavailableError", () => {
  it("returns true for 'node not connected' message", () => {
    expect(isNodeUnavailableError("node not connected")).toBe(true);
    expect(isNodeUnavailableError("prefix node not connected suffix")).toBe(true);
  });

  it("returns true for 'node disconnected' message", () => {
    expect(isNodeUnavailableError("node disconnected (system.which)")).toBe(true);
    expect(isNodeUnavailableError("node disconnected")).toBe(true);
  });

  it("returns true for Error with 'node disconnected' message", () => {
    expect(isNodeUnavailableError(new Error("node disconnected (system.which)"))).toBe(true);
  });

  it("returns true for Error with 'node not connected' message", () => {
    expect(isNodeUnavailableError(new Error("node not connected"))).toBe(true);
  });

  it("returns true for object with matching message property", () => {
    expect(isNodeUnavailableError({ message: "node disconnected (system.run)" })).toBe(true);
  });

  it("returns false for timeout errors", () => {
    expect(isNodeUnavailableError("invoke timed out")).toBe(false);
    expect(isNodeUnavailableError(new Error("timeout"))).toBe(false);
  });

  it("returns false for other errors", () => {
    expect(isNodeUnavailableError("some other error")).toBe(false);
    expect(isNodeUnavailableError(new Error("connection refused"))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isNodeUnavailableError(null)).toBe(false);
    expect(isNodeUnavailableError(undefined)).toBe(false);
  });
});
