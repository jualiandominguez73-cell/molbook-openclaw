import type { GatewayBrowserClient } from "../gateway";
import type { CostUsageSummary, SessionsListResult } from "../types";

export type ActivityState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  activityLoading: boolean;
  activityUsageResult: CostUsageSummary | null;
  activityDays: number;
  activitySessionsResult: SessionsListResult | null;
  activityError: string | null;
  activitySecurityFindings: Array<{
    checkId: string;
    severity: string;
    title: string;
    detail: string;
  }> | null;
};

export async function loadActivity(state: ActivityState, overrides?: { days?: number }) {
  if (!state.client || !state.connected) return;
  if (state.activityLoading) return;
  state.activityLoading = true;
  state.activityError = null;
  const days = overrides?.days ?? state.activityDays;
  const effectiveDays = Math.max(1, Math.min(90, days));
  try {
    const [usageRes, sessionsRes] = await Promise.all([
      state.client.request("usage.cost", { days: effectiveDays }) as Promise<
        CostUsageSummary | undefined
      >,
      state.client.request("sessions.list", {
        includeGlobal: true,
        includeUnknown: false,
        limit: 200,
      }) as Promise<SessionsListResult | undefined>,
    ]);
    if (usageRes) state.activityUsageResult = usageRes;
    if (sessionsRes) state.activitySessionsResult = sessionsRes;
    state.activityDays = effectiveDays;
    // security.audit: call if available (may not exist yet)
    try {
      const auditRes = (await state.client.request("security.audit", {})) as
        | {
            ok: boolean;
            findings?: Array<{ checkId: string; severity: string; title: string; detail: string }>;
          }
        | undefined;
      if (auditRes?.ok && Array.isArray(auditRes.findings)) {
        state.activitySecurityFindings = auditRes.findings;
      } else {
        state.activitySecurityFindings = null;
      }
    } catch {
      state.activitySecurityFindings = null;
    }
  } catch (err) {
    state.activityError = String(err);
  } finally {
    state.activityLoading = false;
  }
}
