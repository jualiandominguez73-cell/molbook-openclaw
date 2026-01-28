const KEY = "clawdbot.control.settings.v1";

import type { ThemeMode } from "./theme";
import { resolveInitialLocale, setLocale, type Locale } from "./i18n";

export type UiSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: ThemeMode;
  locale: Locale;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number; // Sidebar split ratio (0.4 to 0.7, default 0.6)
  navCollapsed: boolean; // Collapsible sidebar state
  navGroupsCollapsed: Record<string, boolean>; // Which nav groups are collapsed
};

export function loadSettings(): UiSettings {
  const defaultUrl = (() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}`;
  })();

  const defaults: UiSettings = {
    gatewayUrl: defaultUrl,
    token: "",
    sessionKey: "main",
    lastActiveSessionKey: "main",
    theme: "system",
    locale: "en",
    chatFocusMode: false,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: false,
    navGroupsCollapsed: {},
  };

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const resolvedLocale = resolveInitialLocale(null);
      setLocale(resolvedLocale);
      return { ...defaults, locale: resolvedLocale };
    }
    const parsed = JSON.parse(raw) as Partial<UiSettings> & { locale?: string };
    const resolvedLocale = resolveInitialLocale(
      typeof parsed.locale === "string" ? parsed.locale : null,
    );
    setLocale(resolvedLocale);
    const rawNavGroupsCollapsed =
      typeof parsed.navGroupsCollapsed === "object" && parsed.navGroupsCollapsed !== null
        ? (parsed.navGroupsCollapsed as Record<string, boolean>)
        : defaults.navGroupsCollapsed;
    const navGroupsCollapsed: Record<string, boolean> = { ...rawNavGroupsCollapsed };
    if (typeof navGroupsCollapsed.Chat === "boolean" && typeof navGroupsCollapsed.chat !== "boolean") {
      navGroupsCollapsed.chat = navGroupsCollapsed.Chat;
    }
    if (
      typeof navGroupsCollapsed.Control === "boolean" &&
      typeof navGroupsCollapsed.control !== "boolean"
    ) {
      navGroupsCollapsed.control = navGroupsCollapsed.Control;
    }
    if (typeof navGroupsCollapsed.Agent === "boolean" && typeof navGroupsCollapsed.agent !== "boolean") {
      navGroupsCollapsed.agent = navGroupsCollapsed.Agent;
    }
    if (
      typeof navGroupsCollapsed.Settings === "boolean" &&
      typeof navGroupsCollapsed.settings !== "boolean"
    ) {
      navGroupsCollapsed.settings = navGroupsCollapsed.Settings;
    }
    return {
      gatewayUrl:
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : defaults.gatewayUrl,
      token: typeof parsed.token === "string" ? parsed.token : defaults.token,
      sessionKey:
        typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()
          ? parsed.sessionKey.trim()
          : defaults.sessionKey,
      lastActiveSessionKey:
        typeof parsed.lastActiveSessionKey === "string" &&
        parsed.lastActiveSessionKey.trim()
          ? parsed.lastActiveSessionKey.trim()
          : (typeof parsed.sessionKey === "string" &&
              parsed.sessionKey.trim()) ||
            defaults.lastActiveSessionKey,
      theme:
        parsed.theme === "light" ||
        parsed.theme === "dark" ||
        parsed.theme === "system"
          ? parsed.theme
          : defaults.theme,
      locale: resolvedLocale,
      chatFocusMode:
        typeof parsed.chatFocusMode === "boolean"
          ? parsed.chatFocusMode
          : defaults.chatFocusMode,
      chatShowThinking:
        typeof parsed.chatShowThinking === "boolean"
          ? parsed.chatShowThinking
          : defaults.chatShowThinking,
      splitRatio:
        typeof parsed.splitRatio === "number" &&
        parsed.splitRatio >= 0.4 &&
        parsed.splitRatio <= 0.7
          ? parsed.splitRatio
          : defaults.splitRatio,
      navCollapsed:
        typeof parsed.navCollapsed === "boolean"
          ? parsed.navCollapsed
          : defaults.navCollapsed,
      navGroupsCollapsed:
        navGroupsCollapsed,
    };
  } catch {
    const resolvedLocale = resolveInitialLocale(null);
    setLocale(resolvedLocale);
    return { ...defaults, locale: resolvedLocale };
  }
}

export function saveSettings(next: UiSettings) {
  setLocale(next.locale);
  localStorage.setItem(KEY, JSON.stringify(next));
}
