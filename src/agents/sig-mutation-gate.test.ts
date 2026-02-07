import type { SigConfig } from "@disreguard/sig";
import { describe, it, expect } from "vitest";
import { checkMutationGate, extractPatchPaths } from "./sig-mutation-gate.js";

const PROJECT_ROOT = "/workspace";

function makeConfig(files?: SigConfig["files"]): SigConfig {
  return {
    version: 1,
    files: files ?? {
      "soul.md": {
        mutable: true,
        authorizedIdentities: ["owner:*"],
        requireSignedSource: true,
      },
      "agents.md": {
        mutable: true,
        authorizedIdentities: ["owner:*"],
        requireSignedSource: true,
      },
      "llm/prompts/*.txt": {
        mutable: false,
      },
    },
  };
}

describe("sig-mutation-gate", () => {
  it("passes non-write tools through", () => {
    const config = makeConfig();
    for (const tool of ["exec", "read", "message", "gateway", "sessions_spawn"]) {
      const result = checkMutationGate(tool, { path: "soul.md" }, PROJECT_ROOT, config);
      expect(result.blocked, `${tool} should not be blocked`).toBe(false);
    }
  });

  it("passes write to non-protected file", () => {
    const config = makeConfig();
    const result = checkMutationGate("write", { path: "README.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(false);
  });

  it("blocks write to protected mutable file", () => {
    const config = makeConfig();
    const result = checkMutationGate("write", { path: "soul.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("soul.md");
      expect(result.reason).toContain("update_and_sign");
      expect(result.reason).toContain("signed_message");
    }
  });

  it("blocks edit to protected mutable file", () => {
    const config = makeConfig();
    const result = checkMutationGate("edit", { path: "agents.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("agents.md");
      expect(result.reason).toContain("update_and_sign");
    }
  });

  it("blocks apply_patch when patch touches a protected file", () => {
    const config = makeConfig();
    const patch = [
      "*** Begin Patch",
      "*** Update File: soul.md",
      "@@ -1,3 +1,3 @@",
      " line1",
      "-old",
      "+new",
      "*** End Patch",
    ].join("\n");
    const result = checkMutationGate("apply_patch", { input: patch }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("soul.md");
      expect(result.reason).toContain("update_and_sign");
    }
  });

  it("passes apply_patch when patch only touches non-protected files", () => {
    const config = makeConfig();
    const patch = [
      "*** Begin Patch",
      "*** Update File: README.md",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "*** End Patch",
    ].join("\n");
    const result = checkMutationGate("apply_patch", { input: patch }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(false);
  });

  it("blocks apply_patch when any file in a multi-file patch is protected", () => {
    const config = makeConfig();
    const patch = [
      "*** Begin Patch",
      "*** Update File: README.md",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "*** Add File: agents.md",
      "new content",
      "*** End Patch",
    ].join("\n");
    const result = checkMutationGate("apply_patch", { input: patch }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("agents.md");
    }
  });

  it("passes apply_patch with empty input", () => {
    const config = makeConfig();
    const result = checkMutationGate("apply_patch", { input: "" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(false);
  });

  it("passes write to immutable policy file (integrity handled by verify)", () => {
    const config = makeConfig();
    const result = checkMutationGate(
      "write",
      { path: "llm/prompts/identity.txt" },
      PROJECT_ROOT,
      config,
    );
    expect(result.blocked).toBe(false);
  });

  it("passes when no file policy exists", () => {
    const config = makeConfig({});
    const result = checkMutationGate("write", { path: "soul.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(false);
  });

  it("handles file_path param alias", () => {
    const config = makeConfig();
    const result = checkMutationGate("write", { file_path: "soul.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
  });

  it("passes when sigConfig is null", () => {
    const result = checkMutationGate("write", { path: "soul.md" }, PROJECT_ROOT, null);
    expect(result.blocked).toBe(false);
  });

  it("passes when projectRoot is undefined", () => {
    const config = makeConfig();
    const result = checkMutationGate("write", { path: "soul.md" }, undefined, config);
    expect(result.blocked).toBe(false);
  });

  it("does not include signed source note when requireSignedSource is false", () => {
    const config = makeConfig({
      "notes.md": { mutable: true, requireSignedSource: false },
    });
    const result = checkMutationGate("write", { path: "notes.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("update_and_sign");
      expect(result.reason).not.toContain("signed_message");
    }
  });
});

describe("extractPatchPaths", () => {
  it("extracts Add, Update, and Delete file paths", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: src/new.ts",
      "content",
      "*** Update File: soul.md",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "*** Delete File: old.txt",
      "*** End Patch",
    ].join("\n");
    expect(extractPatchPaths(patch)).toEqual(["src/new.ts", "soul.md", "old.txt"]);
  });

  it("returns empty array for empty input", () => {
    expect(extractPatchPaths("")).toEqual([]);
  });

  it("returns empty array when no file markers present", () => {
    expect(extractPatchPaths("just some text\nno markers here")).toEqual([]);
  });
});
