import { formatAgo, formatDurationMs, formatMs } from "./format";
import { t } from "./i18n";
import { CronJob } from "../../src/infra/cron-job";
import type { GatewaySessionRow, PresenceEntry } from "./types";

export function formatPresenceSummary(entry: PresenceEntry): string {
  const host = entry.host ?? t("common.unknown");
  const ip = entry.ip ? `(${entry.ip})` : "";
  const mode = entry.mode ?? "";
  const version = entry.version ?? "";
  return `${host} ${ip} ${mode} ${version}`.trim();
}

export function formatPresenceAge(entry: PresenceEntry): string {
  const ts = entry.ts ?? null;
  return ts ? formatAgo(ts) : t("common.na");
}

export function formatNextRun(ms?: number | null) {
  if (!ms) return t("common.na");
  return `${formatMs(ms)} (${formatAgo(ms)})`;
}

export function formatSessionTokens(row: GatewaySessionRow) {
  if (row.totalTokens == null) return t("common.na");
  const total = row.totalTokens ?? 0;
  const ctx = row.contextTokens ?? 0;
  return ctx ? `${total} / ${ctx}` : String(total);
}

export function formatEventPayload(payload: unknown): string {
  if (payload == null) return "";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function presentCronSchedule(job: CronJob): string {
  const parts: string[] = [];
  if (job.schedule.at) parts.push(t("cron.schedule.atValue", { time: formatMs(job.schedule.at) }));
  if (job.schedule.every) parts.push(t("cron.schedule.everyValue", { duration: formatDurationMs(job.schedule.every) }));
  if (job.schedule.cron) parts.push(t("cron.schedule.cronValue", { expr: job.schedule.cron }));
  return parts.join(", ") || t("common.unknown");
}

export function presentCronStatus(job: CronJob): string {
  const parts: string[] = [];
  if (job.status.nextWake) parts.push(`${t("cron.status.next")} ${formatMs(job.status.nextWake)}`);
  if (job.status.lastWake) parts.push(`${t("cron.status.last")} ${formatMs(job.status.lastWake)}`);
  return parts.join(", ");
}

export function presentCronPayload(job: CronJob): string {
  const parts: string[] = [];
  if (job.payload.system) parts.push(t("cron.payload.system", { text: job.payload.system }));
  if (job.payload.agent) parts.push(t("cron.payload.agent", { message: job.payload.agent }));
  return parts.join(", ");
}
