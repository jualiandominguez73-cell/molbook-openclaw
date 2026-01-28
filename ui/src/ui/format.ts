import { stripReasoningTagsFromText } from "../../../src/shared/text/reasoning-tags.js";
import { t } from "./i18n";

export function formatMs(ms?: number | null): string {
  if (!ms && ms !== 0) return t("common.na");
  return new Date(ms).toLocaleString();
}

export function formatAgo(ms?: number | null): string {
  if (!ms && ms !== 0) return t("common.na");
  const diff = Date.now() - ms;
  if (diff < 0) return t("format.ago.justNow");
  const sec = Math.round(diff / 1000);
  if (sec < 60) return t("format.ago.seconds", { seconds: sec });
  const min = Math.round(sec / 60);
  if (min < 60) return t("format.ago.minutes", { minutes: min });
  const hr = Math.round(min / 60);
  if (hr < 48) return t("format.ago.hours", { hours: hr });
  const day = Math.round(hr / 24);
  return t("format.ago.days", { days: day });
}

export function formatDurationMs(ms?: number | null): string {
  if (!ms && ms !== 0) return t("common.na");
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return t("format.duration.seconds", { seconds: sec });
  const min = Math.round(sec / 60);
  if (min < 60) return t("format.duration.minutes", { minutes: min });
  const hr = Math.round(min / 60);
  if (hr < 48) return t("format.duration.hours", { hours: hr });
  const day = Math.round(hr / 24);
  return t("format.duration.days", { days: day });
}

export function formatList(values?: Array<string | null | undefined>): string {
  if (!values || values.length === 0) return t("common.none");
  return values.filter((v): v is string => Boolean(v && v.trim())).join(", ");
}

export function clampText(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function truncateText(value: string, max: number): {
  text: string;
  truncated: boolean;
  total: number;
} {
  if (value.length <= max) {
    return { text: value, truncated: false, total: value.length };
  }
  return {
    text: value.slice(0, Math.max(0, max)),
    truncated: true,
    total: value.length,
  };
}

export function toNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function stripThinkingTags(value: string): string {
  return stripReasoningTagsFromText(value, { mode: "preserve", trim: "start" });
}
