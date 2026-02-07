import { describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "../config/sessions.js";
import { applyModelOverrideToSessionEntry } from "./model-overrides.js";

function makeEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return { sessionId: "test", updatedAt: 0, ...overrides };
}

describe("applyModelOverrideToSessionEntry", () => {
  // --- non-default selection ---
  it("sets provider and model overrides for a non-default selection", () => {
    const entry = makeEntry();
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "anthropic", model: "claude-opus-4-6" },
    });
    expect(result.updated).toBe(true);
    expect(entry.providerOverride).toBe("anthropic");
    expect(entry.modelOverride).toBe("claude-opus-4-6");
  });

  it("returns updated: false when selection matches existing overrides", () => {
    const entry = makeEntry({
      providerOverride: "anthropic",
      modelOverride: "claude-opus-4-6",
    });
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "anthropic", model: "claude-opus-4-6" },
    });
    expect(result.updated).toBe(false);
  });

  // --- default selection ---
  it("clears overrides for a default selection", () => {
    const entry = makeEntry({
      providerOverride: "anthropic",
      modelOverride: "claude-opus-4-6",
    });
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "anthropic", model: "claude-opus-4-6", isDefault: true },
    });
    expect(result.updated).toBe(true);
    expect(entry.providerOverride).toBeUndefined();
    expect(entry.modelOverride).toBeUndefined();
  });

  it("returns updated: false for default selection when no overrides exist", () => {
    const entry = makeEntry();
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "anthropic", model: "claude-opus-4-6", isDefault: true },
    });
    expect(result.updated).toBe(false);
  });

  // --- profile override ---
  it("sets auth profile override when provided", () => {
    const entry = makeEntry();
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openai", model: "gpt-5" },
      profileOverride: "profile-1",
    });
    expect(result.updated).toBe(true);
    expect(entry.authProfileOverride).toBe("profile-1");
    expect(entry.authProfileOverrideSource).toBe("user");
  });

  it("uses auto source when profileOverrideSource is set", () => {
    const entry = makeEntry();
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openai", model: "gpt-5" },
      profileOverride: "profile-1",
      profileOverrideSource: "auto",
    });
    expect(entry.authProfileOverrideSource).toBe("auto");
  });

  it("clears auth profile override when profileOverride is not provided", () => {
    const entry = makeEntry({
      authProfileOverride: "old-profile",
      authProfileOverrideSource: "user",
    });
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openai", model: "gpt-5" },
    });
    expect(result.updated).toBe(true);
    expect(entry.authProfileOverride).toBeUndefined();
    expect(entry.authProfileOverrideSource).toBeUndefined();
  });

  it("clears authProfileOverrideCompactionCount when setting profile", () => {
    const entry = makeEntry({
      authProfileOverrideCompactionCount: 3,
    } as SessionEntry);
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openai", model: "gpt-5" },
      profileOverride: "new-profile",
    });
    expect((entry as Record<string, unknown>).authProfileOverrideCompactionCount).toBeUndefined();
  });

  it("clears authProfileOverrideCompactionCount when clearing profile", () => {
    const entry = makeEntry({
      authProfileOverrideCompactionCount: 3,
    } as SessionEntry);
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openai", model: "gpt-5" },
    });
    expect((entry as Record<string, unknown>).authProfileOverrideCompactionCount).toBeUndefined();
  });

  // --- updatedAt ---
  it("updates updatedAt when changes are made", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-07T00:00:00Z"));
    const entry = makeEntry();
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openai", model: "gpt-5" },
    });
    expect(entry.updatedAt).toBe(Date.now());
    vi.useRealTimers();
  });

  it("does not update updatedAt when no changes are made", () => {
    const entry = makeEntry({ updatedAt: 12345 });
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openai", model: "gpt-5", isDefault: true },
    });
    expect(entry.updatedAt).toBe(12345);
  });
});
