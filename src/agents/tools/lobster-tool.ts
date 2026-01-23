import { spawn } from "node:child_process";

import { Type } from "@sinclair/typebox";

import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_CHARS = 50_000;

const LobsterToolSchema = Type.Object({
  pipeline: Type.String({ description: "Lobster pipeline string to run." }),
  timeoutMs: Type.Optional(
    Type.Number({
      description: "Timeout in milliseconds (kills the lobster process on expiry).",
      minimum: 1_000,
    }),
  ),
  maxChars: Type.Optional(
    Type.Number({
      description: "Maximum characters to return from lobster stdout/stderr.",
      minimum: 1_000,
    }),
  ),
});

type LobsterEnvelope = {
  protocolVersion?: number;
  ok: boolean;
  status?: string;
  output?: unknown;
  error?: { type?: string; message?: string };
  requiresApproval?: unknown;
};

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n…(truncated ${text.length - maxChars} chars)`;
}

async function runLobsterToolMode(params: {
  pipeline: string;
  timeoutMs: number;
  maxChars: number;
}): Promise<LobsterEnvelope> {
  const lobsterBin = (process.env.LOBSTER_BIN ?? "lobster").trim() || "lobster";
  const argv = ["run", "--mode", "tool", params.pipeline];

  return await new Promise<LobsterEnvelope>((resolve, reject) => {
    const child = spawn(lobsterBin, argv, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`lobster timeout after ${params.timeoutMs}ms`));
    }, params.timeoutMs);

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const msg = truncate(
          (stderr || stdout).trim() || `lobster exited ${code}`,
          params.maxChars,
        );
        reject(new Error(msg));
        return;
      }

      const trimmed = stdout.trim();
      try {
        resolve(JSON.parse(trimmed) as LobsterEnvelope);
      } catch (err) {
        const msg = truncate(
          `lobster returned invalid JSON: ${String(err)}\n${truncate(stdout, params.maxChars)}`,
          params.maxChars,
        );
        reject(new Error(msg));
      }
    });
  });
}

export function createLobsterTool(): AnyAgentTool {
  return {
    label: "Lobster",
    name: "lobster",
    description:
      "Run Lobster pipelines (tool-mode JSON) to build deterministic workflows and recipes.",
    parameters: LobsterToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const pipeline = readStringParam(params, "pipeline", { required: true, trim: false });
      const timeoutMs = readNumberParam(params, "timeoutMs") ?? DEFAULT_TIMEOUT_MS;
      const maxChars = readNumberParam(params, "maxChars") ?? DEFAULT_MAX_CHARS;

      const envelope = await runLobsterToolMode({ pipeline, timeoutMs, maxChars });
      return jsonResult(envelope);
    },
  };
}
