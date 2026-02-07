/**
 * Audit logging tests for sig gate decisions.
 *
 * Verifies that the hook pipeline writes audit entries to `.sig/audit.jsonl`
 * when the verification gate blocks a tool, the mutation gate blocks a tool,
 * and a gated tool executes after successful verification.
 */

import type { SigConfig } from "@disreguard/sig";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWrappedToolMap } from "./adversarial-harness.js";
import {
  resetVerification,
  setVerified,
  clearSessionSecurityState,
} from "./session-security-state.js";
import { readGateAuditLog } from "./sig-gate-audit.js";

// -- Fixtures ----------------------------------------------------------------

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "sig-audit-"));
});

afterEach(async () => {
  clearSessionSecurityState("audit-test");
  await rm(projectRoot, { recursive: true, force: true });
});

function enforcedConfig() {
  return {
    agents: {
      defaults: {
        sig: { enforceVerification: true },
      },
    },
  } as never;
}

function sigFileConfig(): SigConfig {
  return {
    version: 1,
    files: {
      "soul.md": {
        mutable: true,
        authorizedIdentities: ["owner:*"],
        requireSignedSource: true,
      },
    },
  };
}

// Small delay so fire-and-forget audit writes complete before assertions
async function flushAudit(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

// -- Tests -------------------------------------------------------------------

describe("gate audit logging", () => {
  it("logs gate_blocked when verification gate blocks an unverified gated tool", async () => {
    const sessionKey = "audit-test";
    const turnId = "turn-1";
    const hookCtx = {
      sessionKey,
      turnId,
      config: enforcedConfig(),
      projectRoot,
    };

    resetVerification(sessionKey, turnId);
    const { tools } = buildWrappedToolMap(["exec"], hookCtx);
    const wrappedExec = tools.get("exec")!;

    // Attempt to call gated tool without verification — should throw
    await expect(wrappedExec.execute("call-1", {}, undefined, undefined)).rejects.toThrow(
      /verification/i,
    );
    await flushAudit();

    const entries = await readGateAuditLog(projectRoot);
    expect(entries.length).toBe(1);
    expect(entries[0].event).toBe("gate_blocked");
    expect(entries[0].gate).toBe("verification");
    expect(entries[0].tool).toBe("exec");
    expect(entries[0].session).toBe(sessionKey);
    expect(entries[0].turn).toBe(turnId);
    expect(entries[0].reason).toContain("verify");
    expect(entries[0].ts).toBeTruthy();
  });

  it("logs gate_blocked when mutation gate blocks a protected file write", async () => {
    const sessionKey = "audit-test";
    const turnId = "turn-1";
    const hookCtx = {
      sessionKey,
      turnId,
      config: enforcedConfig(),
      projectRoot,
      sigConfig: sigFileConfig(),
    };

    // Verify first so the verification gate passes
    resetVerification(sessionKey, turnId);
    setVerified(sessionKey, turnId);

    const { tools } = buildWrappedToolMap(["write"], hookCtx);
    const wrappedWrite = tools.get("write")!;

    await expect(
      wrappedWrite.execute(
        "call-1",
        { path: "soul.md", content: "backdoor" },
        undefined,
        undefined,
      ),
    ).rejects.toThrow(/update_and_sign/i);
    await flushAudit();

    const entries = await readGateAuditLog(projectRoot);
    expect(entries.length).toBe(1);
    expect(entries[0].event).toBe("gate_blocked");
    expect(entries[0].gate).toBe("mutation");
    expect(entries[0].tool).toBe("write");
    expect(entries[0].session).toBe(sessionKey);
    expect(entries[0].turn).toBe(turnId);
    expect(entries[0].reason).toContain("soul.md");
  });

  it("logs gate_allowed when a verified gated tool executes", async () => {
    const sessionKey = "audit-test";
    const turnId = "turn-1";
    const hookCtx = {
      sessionKey,
      turnId,
      config: enforcedConfig(),
      projectRoot,
    };

    resetVerification(sessionKey, turnId);
    setVerified(sessionKey, turnId);

    const { tools } = buildWrappedToolMap(["exec"], hookCtx);
    const wrappedExec = tools.get("exec")!;

    await wrappedExec.execute("call-1", { command: "ls" }, undefined, undefined);
    await flushAudit();

    const entries = await readGateAuditLog(projectRoot);
    expect(entries.length).toBe(1);
    expect(entries[0].event).toBe("gate_allowed");
    expect(entries[0].gate).toBe("verification");
    expect(entries[0].tool).toBe("exec");
    expect(entries[0].session).toBe(sessionKey);
    expect(entries[0].turn).toBe(turnId);
  });

  it("does not log audit entries for non-gated tools", async () => {
    const sessionKey = "audit-test";
    const turnId = "turn-1";
    const hookCtx = {
      sessionKey,
      turnId,
      config: enforcedConfig(),
      projectRoot,
    };

    resetVerification(sessionKey, turnId);
    const { tools } = buildWrappedToolMap(["read", "web_search"], hookCtx);

    // Non-gated tools should pass without any audit entries
    await tools.get("read")!.execute("call-1", {}, undefined, undefined);
    await tools.get("web_search")!.execute("call-2", {}, undefined, undefined);
    await flushAudit();

    const entries = await readGateAuditLog(projectRoot);
    expect(entries.length).toBe(0);
  });

  it("logs multiple blocks in a multi-tool attack scenario", async () => {
    const sessionKey = "audit-test";
    const turnId = "turn-1";
    const hookCtx = {
      sessionKey,
      turnId,
      config: enforcedConfig(),
      projectRoot,
    };

    resetVerification(sessionKey, turnId);
    const { tools } = buildWrappedToolMap(["exec", "message", "gateway"], hookCtx);

    for (const name of ["exec", "message", "gateway"]) {
      await tools
        .get(name)!
        .execute(`call-${name}`, {}, undefined, undefined)
        .catch(() => {});
    }
    await flushAudit();

    const entries = await readGateAuditLog(projectRoot);
    expect(entries.length).toBe(3);
    expect(entries.every((e) => e.event === "gate_blocked")).toBe(true);
    expect(entries.every((e) => e.gate === "verification")).toBe(true);
    expect(new Set(entries.map((e) => e.tool))).toEqual(new Set(["exec", "message", "gateway"]));
  });

  it("logs both blocked and allowed in a verify-then-execute flow", async () => {
    const sessionKey = "audit-test";
    const turnId = "turn-1";
    const hookCtx = {
      sessionKey,
      turnId,
      config: enforcedConfig(),
      projectRoot,
    };

    resetVerification(sessionKey, turnId);
    const { tools } = buildWrappedToolMap(["exec"], hookCtx);
    const wrappedExec = tools.get("exec")!;

    // First attempt: blocked (unverified)
    await wrappedExec.execute("call-1", {}, undefined, undefined).catch(() => {});
    await flushAudit();

    // Simulate verification
    setVerified(sessionKey, turnId);

    // Second attempt: allowed (verified)
    await wrappedExec.execute("call-2", {}, undefined, undefined);
    await flushAudit();

    const entries = await readGateAuditLog(projectRoot);
    expect(entries.length).toBe(2);
    const events = new Set(entries.map((e) => e.event));
    expect(events).toContain("gate_blocked");
    expect(events).toContain("gate_allowed");
  });

  it("does not log when enforcement is disabled", async () => {
    const sessionKey = "audit-test";
    const turnId = "turn-1";
    const hookCtx = {
      sessionKey,
      turnId,
      config: undefined, // No enforcement
      projectRoot,
    };

    resetVerification(sessionKey, turnId);
    const { tools } = buildWrappedToolMap(["exec", "write"], hookCtx);

    await tools.get("exec")!.execute("call-1", {}, undefined, undefined);
    await tools.get("write")!.execute("call-2", {}, undefined, undefined);
    await flushAudit();

    const entries = await readGateAuditLog(projectRoot);
    expect(entries.length).toBe(0);
  });
});
