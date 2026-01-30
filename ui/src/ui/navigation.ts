import type { IconName } from "./icons.js";
import type { Locale } from "./i18n";
import { t } from "./i18n";

export function tabGroupsForLocale(locale: Locale | undefined) {
  return [
    { key: "chat", label: t(locale, "nav.group.chat"), tabs: ["chat"] },
    {
      key: "control",
      label: t(locale, "nav.group.control"),
      tabs: ["overview", "channels", "instances", "sessions", "cron"],
    },
    { key: "agent", label: t(locale, "nav.group.agent"), tabs: ["skills", "nodes"] },
    { key: "settings", label: t(locale, "nav.group.settings"), tabs: ["config", "debug", "logs"] },
  ] as const;
}

export type Tab =
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "cron"
  | "skills"
  | "nodes"
  | "chat"
  | "config"
  | "debug"
  | "logs";

const TAB_PATHS: Record<Tab, string> = {
  overview: "/overview",
  channels: "/channels",
  instances: "/instances",
  sessions: "/sessions",
  cron: "/cron",
  skills: "/skills",
  nodes: "/nodes",
  chat: "/chat",
  config: "/config",
  debug: "/debug",
  logs: "/logs",
};

const PATH_TO_TAB = new Map(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]),
);

export function normalizeBasePath(basePath: string): string {
  if (!basePath) return "";
  let base = basePath.trim();
  if (!base.startsWith("/")) base = `/${base}`;
  if (base === "/") return "";
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

export function normalizePath(path: string): string {
  if (!path) return "/";
  let normalized = path.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const path = TAB_PATHS[tab];
  return base ? `${base}${path}` : path;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) normalized = "/";
  if (normalized === "/") return "chat";
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") return "";
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (PATH_TO_TAB.has(candidate)) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "chat":
      return "messageSquare";
    case "overview":
      return "barChart";
    case "channels":
      return "link";
    case "instances":
      return "radio";
    case "sessions":
      return "fileText";
    case "cron":
      return "loader";
    case "skills":
      return "zap";
    case "nodes":
      return "monitor";
    case "config":
      return "settings";
    case "debug":
      return "bug";
    case "logs":
      return "scrollText";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab, locale: Locale | undefined) {
  switch (tab) {
    case "overview":
      return t(locale, "nav.tab.overview");
    case "channels":
      return t(locale, "nav.tab.channels");
    case "instances":
      return t(locale, "nav.tab.instances");
    case "sessions":
      return t(locale, "nav.tab.sessions");
    case "cron":
      return t(locale, "nav.tab.cron");
    case "skills":
      return t(locale, "nav.tab.skills");
    case "nodes":
      return t(locale, "nav.tab.nodes");
    case "chat":
      return t(locale, "nav.tab.chat");
    case "config":
      return t(locale, "nav.tab.config");
    case "debug":
      return t(locale, "nav.tab.debug");
    case "logs":
      return t(locale, "nav.tab.logs");
    default:
      return t(locale, "nav.group.control");
  }
}

export function subtitleForTab(tab: Tab, locale: Locale | undefined) {
  switch (tab) {
    case "overview":
      return t(locale, "nav.subtitle.overview");
    case "channels":
      return t(locale, "nav.subtitle.channels");
    case "instances":
      return t(locale, "nav.subtitle.instances");
    case "sessions":
      return t(locale, "nav.subtitle.sessions");
    case "cron":
      return t(locale, "nav.subtitle.cron");
    case "skills":
      return t(locale, "nav.subtitle.skills");
    case "nodes":
      return t(locale, "nav.subtitle.nodes");
    case "chat":
      return t(locale, "nav.subtitle.chat");
    case "config":
      return t(locale, "nav.subtitle.config");
    case "debug":
      return t(locale, "nav.subtitle.debug");
    case "logs":
      return t(locale, "nav.subtitle.logs");
    default:
      return "";
  }
}
