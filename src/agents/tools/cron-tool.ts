import { Type } from "@sinclair/typebox";
import {
  normalizeCronJobCreate,
  normalizeCronJobPatch,
} from "../../cron/normalize.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

// Flattened schema for LLM tool use - avoids nested anyOf unions that fail
// strict JSON Schema validation on some providers (e.g., google-antigravity).
// Uses string enums instead of Type.Union([Type.Literal()]) to produce cleaner
// JSON Schema without anyOf constructs.
// The execute() function validates the actual structure at runtime.
const CronToolSchema = Type.Object({
  action: Type.String({
    enum: ["status", "list", "add", "update", "remove", "run", "runs", "wake"],
  }),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),

  // For "list" action
  includeDisabled: Type.Optional(Type.Boolean()),

  // For "update", "remove", "run", "runs" actions
  id: Type.Optional(Type.String()),

  // For "wake" action
  text: Type.Optional(Type.String()),
  mode: Type.Optional(Type.String({ enum: ["now", "next-heartbeat"] })),

  // For "add" action - flattened job fields
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  enabled: Type.Optional(Type.Boolean()),

  // Schedule - flattened (kind determines which fields are used)
  scheduleKind: Type.Optional(Type.String({ enum: ["at", "every", "cron"] })),
  scheduleAtMs: Type.Optional(Type.Number()),
  scheduleEveryMs: Type.Optional(Type.Number()),
  scheduleAnchorMs: Type.Optional(Type.Number()),
  scheduleCronExpr: Type.Optional(Type.String()),
  scheduleTz: Type.Optional(Type.String()),

  // Session/wake mode
  sessionTarget: Type.Optional(Type.String({ enum: ["main", "isolated"] })),
  wakeMode: Type.Optional(Type.String({ enum: ["next-heartbeat", "now"] })),

  // Payload - flattened (payloadKind determines which fields are used)
  payloadKind: Type.Optional(
    Type.String({ enum: ["systemEvent", "agentTurn"] }),
  ),
  payloadText: Type.Optional(Type.String()),
  payloadMessage: Type.Optional(Type.String()),
  payloadThinking: Type.Optional(Type.String()),
  payloadTimeoutSeconds: Type.Optional(Type.Number()),
  payloadDeliver: Type.Optional(Type.Boolean()),
  payloadChannel: Type.Optional(
    Type.String({
      enum: [
        "last",
        "whatsapp",
        "telegram",
        "discord",
        "slack",
        "signal",
        "imessage",
      ],
    }),
  ),
  payloadTo: Type.Optional(Type.String()),
  payloadBestEffortDeliver: Type.Optional(Type.Boolean()),

  // Isolation
  isolationPostToMainPrefix: Type.Optional(Type.String()),

  // For "update" action - patch fields (same as add fields, all optional)
  // Uses the same flattened fields as add, applied as a patch
});

/**
 * Reconstruct nested job object from flattened params.
 */
function buildJobFromFlatParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const schedule: Record<string, unknown> = {};
  const scheduleKind = params.scheduleKind as string | undefined;
  if (scheduleKind === "at") {
    schedule.kind = "at";
    schedule.atMs = params.scheduleAtMs;
  } else if (scheduleKind === "every") {
    schedule.kind = "every";
    schedule.everyMs = params.scheduleEveryMs;
    if (params.scheduleAnchorMs !== undefined) {
      schedule.anchorMs = params.scheduleAnchorMs;
    }
  } else if (scheduleKind === "cron") {
    schedule.kind = "cron";
    schedule.expr = params.scheduleCronExpr;
    if (params.scheduleTz !== undefined) {
      schedule.tz = params.scheduleTz;
    }
  }

  const payload: Record<string, unknown> = {};
  const payloadKind = params.payloadKind as string | undefined;
  if (payloadKind === "systemEvent") {
    payload.kind = "systemEvent";
    payload.text = params.payloadText;
  } else if (payloadKind === "agentTurn") {
    payload.kind = "agentTurn";
    payload.message = params.payloadMessage;
    if (params.payloadThinking !== undefined) {
      payload.thinking = params.payloadThinking;
    }
    if (params.payloadTimeoutSeconds !== undefined) {
      payload.timeoutSeconds = params.payloadTimeoutSeconds;
    }
    if (params.payloadDeliver !== undefined) {
      payload.deliver = params.payloadDeliver;
    }
    if (params.payloadChannel !== undefined) {
      payload.channel = params.payloadChannel;
    }
    if (params.payloadTo !== undefined) {
      payload.to = params.payloadTo;
    }
    if (params.payloadBestEffortDeliver !== undefined) {
      payload.bestEffortDeliver = params.payloadBestEffortDeliver;
    }
  }

  const job: Record<string, unknown> = {
    name: params.name,
    schedule,
    sessionTarget: params.sessionTarget,
    wakeMode: params.wakeMode,
    payload,
  };

  if (params.description !== undefined) {
    job.description = params.description;
  }
  if (params.enabled !== undefined) {
    job.enabled = params.enabled;
  }
  if (params.isolationPostToMainPrefix !== undefined) {
    job.isolation = { postToMainPrefix: params.isolationPostToMainPrefix };
  }

  return job;
}

/**
 * Build a patch object from flattened params (only includes defined fields).
 */
function buildPatchFromFlatParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (params.name !== undefined) {
    patch.name = params.name;
  }
  if (params.description !== undefined) {
    patch.description = params.description;
  }
  if (params.enabled !== undefined) {
    patch.enabled = params.enabled;
  }
  if (params.sessionTarget !== undefined) {
    patch.sessionTarget = params.sessionTarget;
  }
  if (params.wakeMode !== undefined) {
    patch.wakeMode = params.wakeMode;
  }

  // Build schedule if any schedule fields are present
  const scheduleKind = params.scheduleKind as string | undefined;
  if (scheduleKind) {
    const schedule: Record<string, unknown> = { kind: scheduleKind };
    if (scheduleKind === "at" && params.scheduleAtMs !== undefined) {
      schedule.atMs = params.scheduleAtMs;
    } else if (scheduleKind === "every" && params.scheduleEveryMs !== undefined) {
      schedule.everyMs = params.scheduleEveryMs;
      if (params.scheduleAnchorMs !== undefined) {
        schedule.anchorMs = params.scheduleAnchorMs;
      }
    } else if (scheduleKind === "cron" && params.scheduleCronExpr !== undefined) {
      schedule.expr = params.scheduleCronExpr;
      if (params.scheduleTz !== undefined) {
        schedule.tz = params.scheduleTz;
      }
    }
    patch.schedule = schedule;
  }

  // Build payload if any payload fields are present
  const payloadKind = params.payloadKind as string | undefined;
  if (payloadKind) {
    const payload: Record<string, unknown> = { kind: payloadKind };
    if (payloadKind === "systemEvent" && params.payloadText !== undefined) {
      payload.text = params.payloadText;
    } else if (payloadKind === "agentTurn") {
      if (params.payloadMessage !== undefined) {
        payload.message = params.payloadMessage;
      }
      if (params.payloadThinking !== undefined) {
        payload.thinking = params.payloadThinking;
      }
      if (params.payloadTimeoutSeconds !== undefined) {
        payload.timeoutSeconds = params.payloadTimeoutSeconds;
      }
      if (params.payloadDeliver !== undefined) {
        payload.deliver = params.payloadDeliver;
      }
      if (params.payloadChannel !== undefined) {
        payload.channel = params.payloadChannel;
      }
      if (params.payloadTo !== undefined) {
        payload.to = params.payloadTo;
      }
      if (params.payloadBestEffortDeliver !== undefined) {
        payload.bestEffortDeliver = params.payloadBestEffortDeliver;
      }
    }
    patch.payload = payload;
  }

  if (params.isolationPostToMainPrefix !== undefined) {
    patch.isolation = { postToMainPrefix: params.isolationPostToMainPrefix };
  }

  return patch;
}

export function createCronTool(): AnyAgentTool {
  return {
    label: "Cron",
    name: "cron",
    description: `Manage Gateway cron jobs and send wake events.

Actions:
- status: Get cron system status
- list: List all cron jobs (use includeDisabled=true to include disabled jobs)
- add: Create a new cron job (requires name, scheduleKind, sessionTarget, wakeMode, payloadKind, and related fields)
- update: Update an existing cron job (requires id, plus any fields to update)
- remove: Delete a cron job (requires id)
- run: Manually trigger a cron job (requires id)
- runs: Get run history for a job (requires id)
- wake: Send a wake event (requires text, optionally mode=now|next-heartbeat)

Schedule types (set scheduleKind):
- "at": One-time at scheduleAtMs (epoch ms)
- "every": Recurring every scheduleEveryMs (ms), optional scheduleAnchorMs
- "cron": Cron expression in scheduleCronExpr, optional scheduleTz

Payload types (set payloadKind):
- "systemEvent": Simple event with payloadText
- "agentTurn": Agent message with payloadMessage, optional payloadThinking, payloadChannel, etc.`,
    parameters: CronToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: readStringParam(params, "gatewayUrl", { trim: false }),
        gatewayToken: readStringParam(params, "gatewayToken", { trim: false }),
        timeoutMs:
          typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
      };

      switch (action) {
        case "status":
          return jsonResult(
            await callGatewayTool("cron.status", gatewayOpts, {}),
          );
        case "list":
          return jsonResult(
            await callGatewayTool("cron.list", gatewayOpts, {
              includeDisabled: Boolean(params.includeDisabled),
            }),
          );
        case "add": {
          const job = buildJobFromFlatParams(params);
          const normalized = normalizeCronJobCreate(job) ?? job;
          return jsonResult(
            await callGatewayTool("cron.add", gatewayOpts, normalized),
          );
        }
        case "update": {
          const id = readStringParam(params, "id", { required: true });
          const patch = buildPatchFromFlatParams(params);
          const normalized = normalizeCronJobPatch(patch) ?? patch;
          return jsonResult(
            await callGatewayTool("cron.update", gatewayOpts, {
              id,
              patch: normalized,
            }),
          );
        }
        case "remove": {
          const id = readStringParam(params, "id", { required: true });
          return jsonResult(
            await callGatewayTool("cron.remove", gatewayOpts, { id }),
          );
        }
        case "run": {
          const id = readStringParam(params, "id", { required: true });
          return jsonResult(
            await callGatewayTool("cron.run", gatewayOpts, { id }),
          );
        }
        case "runs": {
          const id = readStringParam(params, "id", { required: true });
          return jsonResult(
            await callGatewayTool("cron.runs", gatewayOpts, { id }),
          );
        }
        case "wake": {
          const text = readStringParam(params, "text", { required: true });
          const mode =
            params.mode === "now" || params.mode === "next-heartbeat"
              ? params.mode
              : "next-heartbeat";
          return jsonResult(
            await callGatewayTool(
              "wake",
              gatewayOpts,
              { mode, text },
              { expectFinal: false },
            ),
          );
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
