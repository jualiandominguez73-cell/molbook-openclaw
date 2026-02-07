/**
 * Audit logging for sig gate decisions.
 *
 * Appends JSONL entries to `.sig/audit.jsonl` when the verification gate
 * or mutation gate blocks a tool call, and when a gated tool executes
 * after successful verification. Uses the same audit file as sig's own
 * sign/verify events, with gate-specific event types.
 *
 * Logging is fire-and-forget — gate decisions are never delayed by I/O.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface GateAuditEntry {
  ts: string;
  event: "gate_blocked" | "gate_allowed";
  gate: "verification" | "mutation";
  tool: string;
  session?: string;
  turn?: string;
  reason?: string;
  /** Target file path (mutation gate blocks). */
  file?: string;
}

/**
 * Append a gate audit event to `.sig/audit.jsonl`.
 *
 * Silently ignores errors (missing directory, permissions, etc.)
 * so audit logging never disrupts tool execution.
 */
export async function logGateEvent(
  projectRoot: string,
  entry: Omit<GateAuditEntry, "ts">,
): Promise<void> {
  const sigDir = join(projectRoot, ".sig");
  const auditPath = join(sigDir, "audit.jsonl");
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n";
  try {
    await mkdir(sigDir, { recursive: true });
    await appendFile(auditPath, line);
  } catch {
    // Audit logging must never block or fail tool execution.
  }
}

/**
 * Read gate audit entries from `.sig/audit.jsonl`.
 *
 * Returns only entries with `gate` field (filters out sig's own events).
 * Useful for tests and monitoring.
 */
export async function readGateAuditLog(projectRoot: string): Promise<GateAuditEntry[]> {
  const { readFile } = await import("node:fs/promises");
  const auditPath = join(projectRoot, ".sig", "audit.jsonl");
  try {
    const content = await readFile(auditPath, "utf-8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((e) => typeof e.gate === "string") as unknown as GateAuditEntry[];
  } catch {
    return [];
  }
}
