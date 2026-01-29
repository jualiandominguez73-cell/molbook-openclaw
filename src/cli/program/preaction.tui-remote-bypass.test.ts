import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

const ensureConfigReady = vi.fn(async () => undefined);
vi.mock("./config-guard.js", () => ({ ensureConfigReady }));

const { registerPreActionHooks } = await import("./preaction.js");

describe("cli preAction config guard", () => {
  const originalArgv = process.argv.slice();

  afterEach(() => {
    process.argv = originalArgv.slice();
    vi.clearAllMocks();
  });

  it("bypasses config guard for tui --url (client mode)", async () => {
    process.argv = ["node", "moltbot", "tui", "--url", "ws://example"];

    const program = new Command();
    registerPreActionHooks(program, "test");
    const tuiAction = vi.fn(async () => undefined);
    program.command("tui").option("--url <url>").action(tuiAction);

    await program.parseAsync(["tui", "--url", "ws://example"], { from: "user" });

    expect(ensureConfigReady).not.toHaveBeenCalled();
    expect(tuiAction).toHaveBeenCalled();
  });

  it("runs config guard for tui without --url", async () => {
    process.argv = ["node", "moltbot", "tui"];

    const program = new Command();
    registerPreActionHooks(program, "test");
    program.command("tui").action(async () => undefined);

    await program.parseAsync(["tui"], { from: "user" });

    expect(ensureConfigReady).toHaveBeenCalled();
  });
});
