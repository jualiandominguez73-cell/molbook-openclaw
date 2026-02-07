import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "./time-format.js";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix "now" to a known point: 2026-01-15T12:00:00.000Z
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const now = () => Date.now();

  // --- "just now" (< 60 seconds ago) ---

  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    expect(formatRelativeTime(now() - 30_000)).toBe("just now");
  });

  it('returns "just now" for a timestamp 0 seconds ago', () => {
    expect(formatRelativeTime(now())).toBe("just now");
  });

  it('returns "just now" for 59 seconds ago', () => {
    expect(formatRelativeTime(now() - 59_000)).toBe("just now");
  });

  // --- Minutes (1m – 59m) ---

  it('returns "1m ago" for exactly 60 seconds ago', () => {
    expect(formatRelativeTime(now() - 60_000)).toBe("1m ago");
  });

  it('returns "30m ago" for 30 minutes ago', () => {
    expect(formatRelativeTime(now() - 30 * 60_000)).toBe("30m ago");
  });

  it('returns "59m ago" for 59 minutes ago', () => {
    expect(formatRelativeTime(now() - 59 * 60_000)).toBe("59m ago");
  });

  // --- Hours (1h – 23h) ---

  it('returns "1h ago" for exactly 1 hour ago', () => {
    expect(formatRelativeTime(now() - 60 * 60_000)).toBe("1h ago");
  });

  it('returns "12h ago" for 12 hours ago', () => {
    expect(formatRelativeTime(now() - 12 * 60 * 60_000)).toBe("12h ago");
  });

  it('returns "23h ago" for 23 hours ago', () => {
    expect(formatRelativeTime(now() - 23 * 60 * 60_000)).toBe("23h ago");
  });

  // --- Yesterday ---

  it('returns "Yesterday" for exactly 24 hours ago', () => {
    expect(formatRelativeTime(now() - 24 * 60 * 60_000)).toBe("Yesterday");
  });

  // --- Days (2d – 6d) ---

  it('returns "2d ago" for 2 days ago', () => {
    expect(formatRelativeTime(now() - 2 * 24 * 60 * 60_000)).toBe("2d ago");
  });

  it('returns "6d ago" for 6 days ago', () => {
    expect(formatRelativeTime(now() - 6 * 24 * 60 * 60_000)).toBe("6d ago");
  });

  // --- 7+ days: locale date string ---

  it("returns the same locale date string as toLocaleDateString for 7 days ago", () => {
    const sevenDaysAgo = now() - 7 * 24 * 60 * 60_000;
    const expected = new Date(sevenDaysAgo).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    expect(formatRelativeTime(sevenDaysAgo)).toBe(expected);
  });

  it("returns the same locale date string as toLocaleDateString for 30 days ago", () => {
    const thirtyDaysAgo = now() - 30 * 24 * 60 * 60_000;
    const expected = new Date(thirtyDaysAgo).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    expect(formatRelativeTime(thirtyDaysAgo)).toBe(expected);
  });
});
