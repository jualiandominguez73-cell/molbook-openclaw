import { describe, expect, it } from "vitest";

import {
  buildBootstrapContextFiles,
  isMessagingToolDuplicate,
  normalizeTextForComparison,
} from "./pi-embedded-helpers.js";
import {
  DEFAULT_AGENTS_FILENAME,
  type WorkspaceBootstrapFile,
} from "./workspace.js";

const makeFile = (
  overrides: Partial<WorkspaceBootstrapFile>,
): WorkspaceBootstrapFile => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: "/tmp/AGENTS.md",
  content: "",
  missing: false,
  ...overrides,
});

describe("buildBootstrapContextFiles", () => {
  it("keeps missing markers", () => {
    const files = [makeFile({ missing: true, content: undefined })];
    expect(buildBootstrapContextFiles(files)).toEqual([
      {
        path: DEFAULT_AGENTS_FILENAME,
        content: "[MISSING] Expected at: /tmp/AGENTS.md",
      },
    ]);
  });

  it("skips empty or whitespace-only content", () => {
    const files = [makeFile({ content: "   \n  " })];
    expect(buildBootstrapContextFiles(files)).toEqual([]);
  });

  it("truncates large bootstrap content", () => {
    const head = `HEAD-${"a".repeat(6000)}`;
    const tail = `${"b".repeat(3000)}-TAIL`;
    const long = `${head}${tail}`;
    const files = [makeFile({ content: long })];
    const [result] = buildBootstrapContextFiles(files);
    expect(result?.content).toContain(
      "[...truncated, read AGENTS.md for full content...]",
    );
    expect(result?.content.length).toBeLessThan(long.length);
    expect(result?.content.startsWith(long.slice(0, 120))).toBe(true);
    expect(result?.content.endsWith(long.slice(-120))).toBe(true);
  });
});

describe("normalizeTextForComparison", () => {
  it("lowercases text", () => {
    expect(normalizeTextForComparison("Hello World")).toBe("hello world");
  });

  it("trims whitespace", () => {
    expect(normalizeTextForComparison("  hello  ")).toBe("hello");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeTextForComparison("hello    world")).toBe("hello world");
  });

  it("strips emoji", () => {
    expect(normalizeTextForComparison("Hello 👋 World 🌍")).toBe("hello world");
  });

  it("handles mixed normalization", () => {
    expect(normalizeTextForComparison("  Hello 👋   WORLD  🌍  ")).toBe(
      "hello world",
    );
  });
});

describe("isMessagingToolDuplicate", () => {
  it("returns false for empty sentTexts", () => {
    expect(isMessagingToolDuplicate("hello world", [])).toBe(false);
  });

  it("returns false for short texts", () => {
    expect(isMessagingToolDuplicate("short", ["short"])).toBe(false);
  });

  it("detects exact duplicates", () => {
    expect(
      isMessagingToolDuplicate("Hello, this is a test message!", [
        "Hello, this is a test message!",
      ]),
    ).toBe(true);
  });

  it("detects duplicates with different casing", () => {
    expect(
      isMessagingToolDuplicate("HELLO, THIS IS A TEST MESSAGE!", [
        "hello, this is a test message!",
      ]),
    ).toBe(true);
  });

  it("detects duplicates with emoji variations", () => {
    expect(
      isMessagingToolDuplicate("Hello! 👋 This is a test message!", [
        "Hello! This is a test message!",
      ]),
    ).toBe(true);
  });

  it("detects substring duplicates (LLM elaboration)", () => {
    expect(
      isMessagingToolDuplicate(
        'I sent the message: "Hello, this is a test message!"',
        ["Hello, this is a test message!"],
      ),
    ).toBe(true);
  });

  it("detects when sent text contains block reply (reverse substring)", () => {
    expect(
      isMessagingToolDuplicate("Hello, this is a test message!", [
        'I sent the message: "Hello, this is a test message!"',
      ]),
    ).toBe(true);
  });

  it("returns false for non-matching texts", () => {
    expect(
      isMessagingToolDuplicate("This is completely different content.", [
        "Hello, this is a test message!",
      ]),
    ).toBe(false);
  });
});
