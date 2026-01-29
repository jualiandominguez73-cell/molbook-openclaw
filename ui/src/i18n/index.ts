/**
 * Moltbot Control UI - Internationalization (i18n) System
 *
 * A lightweight i18n implementation for the Lit-based Control UI.
 * Supports nested translation keys, interpolation, and pluralization.
 */

import { zhTW } from './locales/zh-TW';
import { enUS } from './locales/en-US';

export type Locale = 'en-US' | 'zh-TW';

export type TranslationDict = Record<string, string | TranslationDict>;

const locales: Record<Locale, TranslationDict> = {
  'en-US': enUS,
  'zh-TW': zhTW,
};

let currentLocale: Locale = 'zh-TW'; // Default to Traditional Chinese

/**
 * Get the current locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Set the current locale
 */
export function setLocale(locale: Locale): void {
  if (locales[locale]) {
    currentLocale = locale;
    // Store preference in localStorage
    try {
      localStorage.setItem('moltbot-locale', locale);
    } catch {
      // Ignore storage errors
    }
    // Dispatch event for components to react
    window.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale } }));
  }
}

/**
 * Initialize locale from stored preference or browser settings
 */
export function initLocale(): void {
  try {
    const stored = localStorage.getItem('moltbot-locale') as Locale | null;
    if (stored && locales[stored]) {
      currentLocale = stored;
      return;
    }
  } catch {
    // Ignore storage errors
  }

  // Detect from browser
  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) {
    currentLocale = 'zh-TW';
  } else {
    currentLocale = 'en-US';
  }
}

/**
 * Get a nested value from an object using a dot-separated path
 */
function getNestedValue(obj: TranslationDict, path: string): string | undefined {
  const keys = path.split('.');
  let current: string | TranslationDict | undefined = obj;

  for (const key of keys) {
    if (current === undefined || typeof current === 'string') {
      return undefined;
    }
    current = current[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate variables in a string
 * Supports {{variable}} syntax
 */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

/**
 * Main translation function
 *
 * @param key - Dot-separated translation key (e.g., 'nav.overview')
 * @param values - Optional interpolation values
 * @returns Translated string or the key if not found
 *
 * @example
 * t('nav.overview') // "總覽"
 * t('chat.messageCount', { count: 5 }) // "5 則訊息"
 */
export function t(key: string, values?: Record<string, string | number>): string {
  const dict = locales[currentLocale];
  const translation = getNestedValue(dict, key);

  if (translation === undefined) {
    // Fallback to English
    const fallback = getNestedValue(locales['en-US'], key);
    if (fallback !== undefined) {
      return interpolate(fallback, values);
    }
    // Return the key as last resort (helps identify missing translations)
    console.warn(`[i18n] Missing translation: ${key}`);
    return key;
  }

  return interpolate(translation, values);
}

/**
 * Check if a translation key exists
 */
export function hasTranslation(key: string): boolean {
  const dict = locales[currentLocale];
  return getNestedValue(dict, key) !== undefined;
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(locales) as Locale[];
}

/**
 * Get locale display name
 */
export function getLocaleDisplayName(locale: Locale): string {
  const names: Record<Locale, string> = {
    'en-US': 'English',
    'zh-TW': '繁體中文',
  };
  return names[locale] || locale;
}

// Initialize locale on module load
initLocale();
