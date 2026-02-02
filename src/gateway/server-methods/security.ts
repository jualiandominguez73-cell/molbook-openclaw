import type { GatewayRequestHandlers } from "./types.js";
import { loadConfig } from "../../config/config.js";
import { runSecurityAudit } from "../../security/audit.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

/**
 * Runs a shallow security audit (config + channel security, no filesystem or deep probe)
 * for the Activity dashboard. Returns findings for UI display.
 */
export const securityHandlers: GatewayRequestHandlers = {
  "security.audit": async ({ respond }) => {
    try {
      const config = loadConfig();
      const report = await runSecurityAudit({
        config,
        deep: false,
        includeFilesystem: false,
        includeChannelSecurity: true,
      });
      respond(true, { ok: true, findings: report.findings, summary: report.summary }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
