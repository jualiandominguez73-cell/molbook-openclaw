import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStorage,
  StorageNotFoundError,
  StorageCorruptionError,
  StorageIOError,
  type Storage,
} from "./index.js";

// -----------------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------------

let testDir: string;
let storage: Storage;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "komatachi-storage-test-"));
  storage = createStorage(testDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// Write raw content to a file in the test directory (bypassing storage)
async function writeRaw(path: string, content: string): Promise<void> {
  await writeFile(join(testDir, path), content, "utf-8");
}

// Read raw content from a file in the test directory (bypassing storage)
async function readRaw(path: string): Promise<string> {
  return readFile(join(testDir, path), "utf-8");
}

// -----------------------------------------------------------------------------
// JSON read/write
// -----------------------------------------------------------------------------

describe("readJson", () => {
  it("reads and parses a JSON file", async () => {
    await writeRaw("config.json", '{"name": "test", "version": 1}');

    const result = await storage.readJson<{ name: string; version: number }>(
      "config.json"
    );

    expect(result).toEqual({ name: "test", version: 1 });
  });

  it("throws StorageNotFoundError for missing file", async () => {
    await expect(storage.readJson("missing.json")).rejects.toThrow(
      StorageNotFoundError
    );

    try {
      await storage.readJson("missing.json");
    } catch (error) {
      expect(error).toBeInstanceOf(StorageNotFoundError);
      expect((error as StorageNotFoundError).path).toBe("missing.json");
    }
  });

  it("throws StorageCorruptionError for invalid JSON", async () => {
    await writeRaw("bad.json", "not valid json {{{");

    await expect(storage.readJson("bad.json")).rejects.toThrow(
      StorageCorruptionError
    );

    try {
      await storage.readJson("bad.json");
    } catch (error) {
      expect(error).toBeInstanceOf(StorageCorruptionError);
      expect((error as StorageCorruptionError).path).toBe("bad.json");
    }
  });

  it("reads files in subdirectories", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(testDir, "sub", "dir"), { recursive: true });
    await writeRaw("sub/dir/data.json", '{"nested": true}');

    const result = await storage.readJson<{ nested: boolean }>(
      "sub/dir/data.json"
    );

    expect(result).toEqual({ nested: true });
  });

  it("reads arrays", async () => {
    await writeRaw("list.json", "[1, 2, 3]");

    const result = await storage.readJson<number[]>("list.json");

    expect(result).toEqual([1, 2, 3]);
  });

  it("reads null", async () => {
    await writeRaw("null.json", "null");

    const result = await storage.readJson<null>("null.json");

    expect(result).toBeNull();
  });
});

describe("writeJson", () => {
  it("writes data as pretty-printed JSON", async () => {
    await storage.writeJson("out.json", { key: "value", count: 42 });

    const raw = await readRaw("out.json");

    expect(raw).toBe('{\n  "key": "value",\n  "count": 42\n}\n');
  });

  it("creates parent directories automatically", async () => {
    await storage.writeJson("a/b/c/deep.json", { deep: true });

    const result = await storage.readJson<{ deep: boolean }>(
      "a/b/c/deep.json"
    );

    expect(result).toEqual({ deep: true });
  });

  it("overwrites existing files", async () => {
    await storage.writeJson("data.json", { version: 1 });
    await storage.writeJson("data.json", { version: 2 });

    const result = await storage.readJson<{ version: number }>("data.json");

    expect(result).toEqual({ version: 2 });
  });

  it("round-trips complex objects", async () => {
    const complex = {
      id: "abc-123",
      tags: ["a", "b"],
      nested: { deep: { value: true } },
      count: 0,
      items: [{ name: "first" }, { name: "second" }],
    };

    await storage.writeJson("complex.json", complex);
    const result = await storage.readJson<typeof complex>("complex.json");

    expect(result).toEqual(complex);
  });

  it("writes no temp files on success", async () => {
    await storage.writeJson("clean.json", { data: true });

    const { readdir } = await import("node:fs/promises");
    const files = await readdir(testDir);

    expect(files).toEqual(["clean.json"]);
  });
});

// -----------------------------------------------------------------------------
// JSONL append and read
// -----------------------------------------------------------------------------

describe("appendJsonl", () => {
  it("creates the file and appends the first entry", async () => {
    await storage.appendJsonl("log.jsonl", { event: "start" });

    const raw = await readRaw("log.jsonl");

    expect(raw).toBe('{"event":"start"}\n');
  });

  it("appends multiple entries as separate lines", async () => {
    await storage.appendJsonl("log.jsonl", { n: 1 });
    await storage.appendJsonl("log.jsonl", { n: 2 });
    await storage.appendJsonl("log.jsonl", { n: 3 });

    const raw = await readRaw("log.jsonl");

    expect(raw).toBe('{"n":1}\n{"n":2}\n{"n":3}\n');
  });

  it("creates parent directories automatically", async () => {
    await storage.appendJsonl("deep/path/log.jsonl", { ok: true });

    const raw = await readRaw("deep/path/log.jsonl");

    expect(raw).toBe('{"ok":true}\n');
  });
});

describe("readAllJsonl", () => {
  it("reads all entries from a JSONL file", async () => {
    await writeRaw("log.jsonl", '{"n":1}\n{"n":2}\n{"n":3}\n');

    const entries = await storage.readAllJsonl<{ n: number }>("log.jsonl");

    expect(entries).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it("returns empty array for an empty file", async () => {
    await writeRaw("empty.jsonl", "");

    const entries = await storage.readAllJsonl("empty.jsonl");

    expect(entries).toEqual([]);
  });

  it("returns empty array for file with only whitespace", async () => {
    await writeRaw("whitespace.jsonl", "   \n  \n\n");

    const entries = await storage.readAllJsonl("whitespace.jsonl");

    expect(entries).toEqual([]);
  });

  it("skips empty lines between entries", async () => {
    await writeRaw("sparse.jsonl", '{"a":1}\n\n{"b":2}\n\n');

    const entries = await storage.readAllJsonl<{ a?: number; b?: number }>(
      "sparse.jsonl"
    );

    expect(entries).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("throws StorageNotFoundError for missing file", async () => {
    await expect(storage.readAllJsonl("missing.jsonl")).rejects.toThrow(
      StorageNotFoundError
    );
  });

  it("handles file with trailing newline", async () => {
    await writeRaw("trailing.jsonl", '{"x":1}\n');

    const entries = await storage.readAllJsonl<{ x: number }>(
      "trailing.jsonl"
    );

    expect(entries).toEqual([{ x: 1 }]);
  });

  it("handles file without trailing newline", async () => {
    await writeRaw("no-trailing.jsonl", '{"x":1}');

    const entries = await storage.readAllJsonl<{ x: number }>(
      "no-trailing.jsonl"
    );

    expect(entries).toEqual([{ x: 1 }]);
  });
});

describe("readAllJsonl - crash resilience", () => {
  it("skips partial trailing line from crash", async () => {
    // Simulate crash mid-append: last line is incomplete JSON
    await writeRaw("crashed.jsonl", '{"n":1}\n{"n":2}\n{"n":3');

    const entries = await storage.readAllJsonl<{ n: number }>(
      "crashed.jsonl"
    );

    expect(entries).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("skips partial trailing line with only opening brace", async () => {
    await writeRaw("partial.jsonl", '{"n":1}\n{');

    const entries = await storage.readAllJsonl<{ n: number }>(
      "partial.jsonl"
    );

    expect(entries).toEqual([{ n: 1 }]);
  });

  it("returns empty array when only entry is partial", async () => {
    await writeRaw("only-partial.jsonl", '{"incomplete');

    const entries = await storage.readAllJsonl("only-partial.jsonl");

    expect(entries).toEqual([]);
  });

  it("throws StorageCorruptionError for corrupt non-trailing line", async () => {
    // Corruption in the middle -- this is not a crash artifact
    await writeRaw(
      "corrupt-middle.jsonl",
      '{"n":1}\nNOT_JSON\n{"n":3}\n'
    );

    await expect(
      storage.readAllJsonl("corrupt-middle.jsonl")
    ).rejects.toThrow(StorageCorruptionError);
  });

  it("throws StorageCorruptionError for corrupt first line with valid later lines", async () => {
    await writeRaw("corrupt-first.jsonl", 'CORRUPT\n{"n":2}\n');

    await expect(
      storage.readAllJsonl("corrupt-first.jsonl")
    ).rejects.toThrow(StorageCorruptionError);
  });
});

describe("readRangeJsonl", () => {
  it("reads a range of entries [start, end)", async () => {
    await writeRaw(
      "range.jsonl",
      '{"n":0}\n{"n":1}\n{"n":2}\n{"n":3}\n{"n":4}\n'
    );

    const entries = await storage.readRangeJsonl<{ n: number }>(
      "range.jsonl",
      1,
      3
    );

    expect(entries).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("returns empty array when start >= end", async () => {
    await writeRaw("range.jsonl", '{"n":0}\n{"n":1}\n');

    const entries = await storage.readRangeJsonl("range.jsonl", 3, 1);

    expect(entries).toEqual([]);
  });

  it("clamps to available entries when end exceeds file length", async () => {
    await writeRaw("short.jsonl", '{"n":0}\n{"n":1}\n');

    const entries = await storage.readRangeJsonl<{ n: number }>(
      "short.jsonl",
      0,
      100
    );

    expect(entries).toEqual([{ n: 0 }, { n: 1 }]);
  });

  it("returns empty array when start exceeds file length", async () => {
    await writeRaw("short.jsonl", '{"n":0}\n');

    const entries = await storage.readRangeJsonl("short.jsonl", 10, 20);

    expect(entries).toEqual([]);
  });

  it("reads from start=0 to end", async () => {
    await writeRaw("range.jsonl", '{"n":0}\n{"n":1}\n{"n":2}\n');

    const entries = await storage.readRangeJsonl<{ n: number }>(
      "range.jsonl",
      0,
      2
    );

    expect(entries).toEqual([{ n: 0 }, { n: 1 }]);
  });
});

describe("writeJsonl", () => {
  it("writes entries as JSONL", async () => {
    await storage.writeJsonl("out.jsonl", [{ a: 1 }, { b: 2 }, { c: 3 }]);

    const raw = await readRaw("out.jsonl");

    expect(raw).toBe('{"a":1}\n{"b":2}\n{"c":3}\n');
  });

  it("writes empty file for empty array", async () => {
    await storage.writeJsonl("empty.jsonl", []);

    const raw = await readRaw("empty.jsonl");

    expect(raw).toBe("");
  });

  it("overwrites existing JSONL file atomically", async () => {
    await storage.appendJsonl("log.jsonl", { old: 1 });
    await storage.appendJsonl("log.jsonl", { old: 2 });

    await storage.writeJsonl("log.jsonl", [{ new: 1 }]);

    const entries = await storage.readAllJsonl<{ new?: number }>(
      "log.jsonl"
    );

    expect(entries).toEqual([{ new: 1 }]);
  });

  it("creates parent directories automatically", async () => {
    await storage.writeJsonl("x/y/z.jsonl", [{ nested: true }]);

    const entries = await storage.readAllJsonl<{ nested: boolean }>(
      "x/y/z.jsonl"
    );

    expect(entries).toEqual([{ nested: true }]);
  });
});

// -----------------------------------------------------------------------------
// Round-trip and integration
// -----------------------------------------------------------------------------

describe("round-trip", () => {
  it("append then readAll preserves order and content", async () => {
    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "How are you?" },
    ];

    for (const msg of messages) {
      await storage.appendJsonl("transcript.jsonl", msg);
    }

    const loaded = await storage.readAllJsonl<{
      role: string;
      content: string;
    }>("transcript.jsonl");

    expect(loaded).toEqual(messages);
  });

  it("writeJsonl then readAllJsonl round-trips correctly", async () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      index: i,
      data: `entry-${i}`,
    }));

    await storage.writeJsonl("large.jsonl", entries);
    const loaded = await storage.readAllJsonl<{
      index: number;
      data: string;
    }>("large.jsonl");

    expect(loaded).toEqual(entries);
  });

  it("writeJson then readJson round-trips correctly", async () => {
    const data = {
      timestamps: { created: 1000, updated: 2000 },
      compactionCount: 3,
      model: "claude-sonnet-4-20250514",
    };

    await storage.writeJson("meta.json", data);
    const loaded = await storage.readJson<typeof data>("meta.json");

    expect(loaded).toEqual(data);
  });
});

// -----------------------------------------------------------------------------
// Base directory and path resolution
// -----------------------------------------------------------------------------

describe("baseDir", () => {
  it("exposes the base directory", () => {
    expect(storage.baseDir).toBe(testDir);
  });

  it("resolves paths relative to baseDir", async () => {
    await storage.writeJson("sub/file.json", { ok: true });

    const raw = await readRaw("sub/file.json");
    expect(raw).toContain('"ok": true');
  });
});

// -----------------------------------------------------------------------------
// Error type properties
// -----------------------------------------------------------------------------

describe("error types", () => {
  it("StorageNotFoundError has correct name and path", () => {
    const error = new StorageNotFoundError("some/path.json");
    expect(error.name).toBe("StorageNotFoundError");
    expect(error.path).toBe("some/path.json");
    expect(error.message).toContain("some/path.json");
    expect(error).toBeInstanceOf(Error);
  });

  it("StorageCorruptionError has correct name, path, and cause", () => {
    const cause = new SyntaxError("Unexpected token");
    const error = new StorageCorruptionError("data.json", cause);
    expect(error.name).toBe("StorageCorruptionError");
    expect(error.path).toBe("data.json");
    expect(error.cause).toBe(cause);
    expect(error).toBeInstanceOf(Error);
  });

  it("StorageIOError has correct name, path, and cause", () => {
    const cause = new Error("EACCES");
    const error = new StorageIOError("locked.json", cause);
    expect(error.name).toBe("StorageIOError");
    expect(error.path).toBe("locked.json");
    expect(error.cause).toBe(cause);
    expect(error).toBeInstanceOf(Error);
  });
});

// -----------------------------------------------------------------------------
// Edge cases
// -----------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles JSON with unicode characters", async () => {
    const data = { text: "Hello \u{1F600} World", kanji: "\u6771\u4EAC" };
    await storage.writeJson("unicode.json", data);
    const loaded = await storage.readJson<typeof data>("unicode.json");
    expect(loaded).toEqual(data);
  });

  it("handles JSONL with unicode characters", async () => {
    const entry = { text: "caf\u00e9 \u2603" };
    await storage.appendJsonl("unicode.jsonl", entry);
    const loaded = await storage.readAllJsonl<typeof entry>("unicode.jsonl");
    expect(loaded).toEqual([entry]);
  });

  it("handles JSONL entries with embedded newlines in strings", async () => {
    // JSON.stringify escapes newlines in strings, so they don't break JSONL
    const entry = { text: "line1\nline2\nline3" };
    await storage.appendJsonl("newlines.jsonl", entry);
    const loaded = await storage.readAllJsonl<typeof entry>("newlines.jsonl");
    expect(loaded).toEqual([entry]);
  });

  it("handles writeJsonl with single entry", async () => {
    await storage.writeJsonl("single.jsonl", [{ only: true }]);
    const loaded = await storage.readAllJsonl<{ only: boolean }>(
      "single.jsonl"
    );
    expect(loaded).toEqual([{ only: true }]);
  });

  it("handles very long JSON values", async () => {
    const longString = "x".repeat(100_000);
    await storage.writeJson("long.json", { data: longString });
    const loaded = await storage.readJson<{ data: string }>("long.json");
    expect(loaded.data.length).toBe(100_000);
  });

  it("handles deeply nested objects", async () => {
    // Build a deeply nested object (100 levels)
    let obj: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 100; i++) {
      obj = { nested: obj };
    }
    await storage.writeJson("deep.json", obj);
    const loaded = await storage.readJson<typeof obj>("deep.json");
    expect(loaded).toEqual(obj);
  });
});
