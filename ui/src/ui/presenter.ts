import { formatAgo, formatDurationMs, formatMs } from "./format";
import { t, tFormat, type Locale } from "./i18n";
import type { CronJob, GatewaySessionRow, PresenceEntry } from "./types";

export function formatPresenceSummary(entry: PresenceEntry): string {
  const host = entry.host ?? "unknown";
  const ip = entry.ip ? `(${entry.ip})` : "";
  const mode = entry.mode ?? "";
  const version = entry.version ?? "";
  return `${host} ${ip} ${mode} ${version}`.trim();
}

export function formatPresenceAge(entry: PresenceEntry, locale?: string): string {
  const ts = entry.ts ?? null;
  return ts ? formatAgo(ts, locale) : "n/a";
}

export function formatNextRun(ms?: number | null, locale?: Locale) {
  if (!ms) return t(locale, "common.na");
  return `${formatMs(ms)} (${formatAgo(ms, locale)})`;
}

export function formatSessionTokens(row: GatewaySessionRow) {
  if (row.totalTokens == null) return "n/a";
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

export function formatCronState(job: CronJob, locale?: Locale) {
  const state = job.state ?? {};
  const next = state.nextRunAtMs ? formatMs(state.nextRunAtMs) : t(locale, "common.na");
  const last = state.lastRunAtMs ? formatMs(state.lastRunAtMs) : t(locale, "common.na");
  const status = state.lastStatus ?? t(locale, "common.na");
  return tFormat(locale, "cron.state.status", { status, next, last });
}

export function formatCronSchedule(job: CronJob, locale?: Locale) {
  const s = job.schedule;
  if (s.kind === "at") {
    return tFormat(locale, "cron.schedule.at", { time: formatMs(s.atMs) });
  }
  if (s.kind === "every") {
    return tFormat(locale, "cron.schedule.every", { duration: formatDurationMs(s.everyMs, locale) });
  }
  return tFormat(locale, "cron.schedule.cron", { expr: `${s.expr}${s.tz ? ` (${s.tz})` : ""}` });
}

export function formatCronPayload(job: CronJob, locale?: Locale) {
  const p = job.payload;
  if (p.kind === "systemEvent") {
    return tFormat(locale, "cron.payload.system", { text: p.text });
  }
  return tFormat(locale, "cron.payload.agent", { message: p.message });
}
