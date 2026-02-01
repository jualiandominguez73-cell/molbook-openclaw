import type { SecurityAuditReport } from "../../security/audit.js";
import type { GatewayRequestHandlers } from "./types.js";
import { loadConfig } from "../../config/config.js";
import { runSecurityAudit } from "../../security/audit.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

const SECURITY_AUDIT_CACHE_TTL_MS = 60_000;

type SecurityAuditCacheEntry = {
  report?: SecurityAuditReport;
  updatedAt?: number;
  inFlight?: Promise<SecurityAuditReport>;
};

const securityAuditCache: SecurityAuditCacheEntry = {};

async function runSecurityAuditCached(): Promise<SecurityAuditReport> {
  const now = Date.now();
  if (
    securityAuditCache.report &&
    securityAuditCache.updatedAt &&
    now - securityAuditCache.updatedAt < SECURITY_AUDIT_CACHE_TTL_MS
  ) {
    return securityAuditCache.report;
  }
  if (securityAuditCache.inFlight) {
    return securityAuditCache.inFlight;
  }
  const config = loadConfig();
  const inFlight = runSecurityAudit({
    config,
    deep: false,
    includeFilesystem: false,
    includeChannelSecurity: true,
  })
    .then((report) => {
      securityAuditCache.report = report;
      securityAuditCache.updatedAt = Date.now();
      return report;
    })
    .finally(() => {
      securityAuditCache.inFlight = undefined;
    });
  securityAuditCache.inFlight = inFlight;
  return inFlight;
}

/**
 * Runs a shallow security audit (config + channel security, no filesystem or deep probe)
 * for the Activity dashboard. Returns findings for UI display. Cached for 60s to reduce load.
 */
export const securityHandlers: GatewayRequestHandlers = {
  "security.audit": async ({ respond, context }) => {
    try {
      const report = await runSecurityAuditCached();
      respond(true, { ok: true, findings: report.findings, summary: report.summary }, undefined);
    } catch (err) {
      context.logGateway?.warn?.(`security.audit failed: ${String(err)}`);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "Security audit failed"));
    }
  },
};
