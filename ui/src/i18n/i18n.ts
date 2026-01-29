/**
 * Internationalization (i18n) module for Moltbot UI
 */

export type Locale = 'en' | 'zh-CN';

export interface TranslationKeys {
  // Navigation
  'nav.chat': string;
  'nav.overview': string;
  'nav.channels': string;
  'nav.instances': string;
  'nav.sessions': string;
  'nav.cron': string;
  'nav.skills': string;
  'nav.nodes': string;
  'nav.config': string;
  'nav.debug': string;
  'nav.logs': string;
  'nav.resources': string;
  'nav.docs': string;
  
  // Navigation Groups
  'nav.group.chat': string;
  'nav.group.control': string;
  'nav.group.agent': string;
  'nav.group.settings': string;
  
  // Page Titles and Subtitles
  'page.title.overview': string;
  'page.subtitle.overview': string;
  'page.title.channels': string;
  'page.subtitle.channels': string;
  'page.title.instances': string;
  'page.subtitle.instances': string;
  'page.title.sessions': string;
  'page.subtitle.sessions': string;
  'page.title.cron': string;
  'page.subtitle.cron': string;
  'page.title.skills': string;
  'page.subtitle.skills': string;
  'page.title.nodes': string;
  'page.subtitle.nodes': string;
  'page.title.chat': string;
  'page.subtitle.chat': string;
  'page.title.config': string;
  'page.subtitle.config': string;
  'page.title.debug': string;
  'page.subtitle.debug': string;
  'page.title.logs': string;
  'page.subtitle.logs': string;
  
  // Topbar
  'topbar.expand_sidebar': string;
  'topbar.collapse_sidebar': string;
  'topbar.brand_title': string;
  'topbar.brand_sub': string;
  'topbar.status.health': string;
  'topbar.status.ok': string;
  'topbar.status.offline': string;
  
  // Overview page
  'overview.gateway_access': string;
  'overview.gateway_subtitle': string;
  'overview.websocket_url': string;
  'overview.gateway_token': string;
  'overview.password': string;
  'overview.default_session_key': string;
  'overview.connect_button': string;
  'overview.refresh_button': string;
  'overview.click_connect_hint': string;
  'overview.snapshot': string;
  'overview.snapshot_subtitle': string;
  'overview.status': string;
  'overview.uptime': string;
  'overview.tick_interval': string;
  'overview.last_channels_refresh': string;
  'overview.instances': string;
  'overview.sessions': string;
  'overview.cron': string;
  'overview.notes': string;
  'overview.notes_subtitle': string;
  'overview.tailscale_serve': string;
  'overview.session_hygiene': string;
  'overview.cron_reminders': string;
  'overview.presence_beacons_hint': string;
  'overview.recent_sessions_hint': string;
  'overview.cron_next_wake': string;
  'overview.tailscale_serve_note': string;
  'overview.session_hygiene_note': string;
  'overview.cron_reminders_note': string;
  
  // Common terms
  'common.connected': string;
  'common.disconnected': string;
  'common.enabled': string;
  'common.disabled': string;
  'common.n_a': string;
  'common.cancel': string;
  'common.save': string;
  'common.apply': string;
  'common.update': string;
  'common.refresh': string;
  'common.close': string;
  'common.ok': string;
  'common.yes': string;
  'common.no': string;
  'common.error': string;
  'common.warning': string;
  'common.info': string;
  'common.success': string;
  'common.open_in_new_tab': string;
}

// English translations
const enTranslations: TranslationKeys = {
  // Navigation
  'nav.chat': 'Chat',
  'nav.overview': 'Overview',
  'nav.channels': 'Channels',
  'nav.instances': 'Instances',
  'nav.sessions': 'Sessions',
  'nav.cron': 'Cron Jobs',
  'nav.skills': 'Skills',
  'nav.nodes': 'Nodes',
  'nav.config': 'Config',
  'nav.debug': 'Debug',
  'nav.logs': 'Logs',
  'nav.resources': 'Resources',
  'nav.docs': 'Docs',
  
  // Navigation Groups
  'nav.group.chat': 'Chat',
  'nav.group.control': 'Control',
  'nav.group.agent': 'Agent',
  'nav.group.settings': 'Settings',
  
  // Page Titles and Subtitles
  'page.title.overview': 'Overview',
  'page.subtitle.overview': 'Gateway status, entry points, and a fast health read.',
  'page.title.channels': 'Channels',
  'page.subtitle.channels': 'Manage channels and settings.',
  'page.title.instances': 'Instances',
  'page.subtitle.instances': 'Presence beacons from connected clients and nodes.',
  'page.title.sessions': 'Sessions',
  'page.subtitle.sessions': 'Inspect active sessions and adjust per-session defaults.',
  'page.title.cron': 'Cron Jobs',
  'page.subtitle.cron': 'Schedule wakeups and recurring agent runs.',
  'page.title.skills': 'Skills',
  'page.subtitle.skills': 'Manage skill availability and API key injection.',
  'page.title.nodes': 'Nodes',
  'page.title.nodes': 'Paired devices, capabilities, and command exposure.',
  'page.title.chat': 'Chat',
  'page.subtitle.chat': 'Direct gateway chat session for quick interventions.',
  'page.title.config': 'Config',
  'page.subtitle.config': 'Edit ~/.clawdbot/moltbot.json safely.',
  'page.title.debug': 'Debug',
  'page.subtitle.debug': 'Gateway snapshots, events, and manual RPC calls.',
  'page.title.logs': 'Logs',
  'page.subtitle.logs': 'Live tail of the gateway file logs.',
  
  // Topbar
  'topbar.expand_sidebar': 'Expand sidebar',
  'topbar.collapse_sidebar': 'Collapse sidebar',
  'topbar.brand_title': 'MOLTBOT',
  'topbar.brand_sub': 'Gateway Dashboard',
  'topbar.status.health': 'Health',
  'topbar.status.ok': 'OK',
  'topbar.status.offline': 'Offline',
  
  // Overview page
  'overview.gateway_access': 'Gateway Access',
  'overview.gateway_subtitle': 'Where the dashboard connects and how it authenticates.',
  'overview.websocket_url': 'WebSocket URL',
  'overview.gateway_token': 'Gateway Token',
  'overview.password': 'Password (not stored)',
  'overview.default_session_key': 'Default Session Key',
  'overview.connect_button': 'Connect',
  'overview.refresh_button': 'Refresh',
  'overview.click_connect_hint': 'Click Connect to apply connection changes.',
  'overview.snapshot': 'Snapshot',
  'overview.snapshot_subtitle': 'Latest gateway handshake information.',
  'overview.status': 'Status',
  'overview.uptime': 'Uptime',
  'overview.tick_interval': 'Tick Interval',
  'overview.last_channels_refresh': 'Last Channels Refresh',
  'overview.instances': 'Instances',
  'overview.sessions': 'Sessions',
  'overview.cron': 'Cron',
  'overview.notes': 'Notes',
  'overview.notes_subtitle': 'Quick reminders for remote control setups.',
  'overview.tailscale_serve': 'Tailscale serve',
  'overview.session_hygiene': 'Session hygiene',
  'overview.cron_reminders': 'Cron reminders',
  'overview.presence_beacons_hint': 'Presence beacons in the last 5 minutes.',
  'overview.recent_sessions_hint': 'Recent session keys tracked by the gateway.',
  'overview.cron_next_wake': 'Next wake {nextRun}',
  'overview.tailscale_serve_note': 'Prefer serve mode to keep the gateway on loopback with tailnet auth.',
  'overview.session_hygiene_note': 'Use /new or sessions.patch to reset context.',
  'overview.cron_reminders_note': 'Use isolated sessions for recurring runs.',
  
  // Common terms
  'common.connected': 'Connected',
  'common.disconnected': 'Disconnected',
  'common.enabled': 'Enabled',
  'common.disabled': 'Disabled',
  'common.n_a': 'n/a',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.apply': 'Apply',
  'common.update': 'Update',
  'common.refresh': 'Refresh',
  'common.close': 'Close',
  'common.ok': 'OK',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.error': 'Error',
  'common.warning': 'Warning',
  'common.info': 'Info',
  'common.success': 'Success',
  'common.open_in_new_tab': 'opens in new tab',
  'common.open_in_new_tab': 'opens in new tab',
};

// Simplified Chinese translations
const zhCNTranslations: TranslationKeys = {
  // Navigation
  'nav.chat': '聊天',
  'nav.overview': '概览',
  'nav.channels': '频道',
  'nav.instances': '实例',
  'nav.sessions': '会话',
  'nav.cron': '定时任务',
  'nav.skills': '技能',
  'nav.nodes': '节点',
  'nav.config': '配置',
  'nav.debug': '调试',
  'nav.logs': '日志',
  'nav.resources': '资源',
  'nav.docs': '文档',
  
  // Navigation Groups
  'nav.group.chat': '聊天',
  'nav.group.control': '控制',
  'nav.group.agent': '代理',
  'nav.group.settings': '设置',
  
  // Page Titles and Subtitles
  'page.title.overview': '概览',
  'page.subtitle.overview': '网关状态、入口点和健康状况快速读取。',
  'page.title.channels': '频道',
  'page.subtitle.channels': '管理频道和设置。',
  'page.title.instances': '实例',
  'page.subtitle.instances': '来自连接客户端和节点的存在信标。',
  'page.title.sessions': '会话',
  'page.subtitle.sessions': '检查活动会话并调整每个会话的默认值。',
  'page.title.cron': '定时任务',
  'page.subtitle.cron': '安排唤醒和定期代理运行。',
  'page.title.skills': '技能',
  'page.subtitle.skills': '管理技能可用性和API密钥注入。',
  'page.title.nodes': '节点',
  'page.subtitle.nodes': '配对设备、功能和命令暴露。',
  'page.title.chat': '聊天',
  'page.subtitle.chat': '用于快速干预的直接网关聊天会话。',
  'page.title.config': '配置',
  'page.subtitle.config': '安全编辑 ~/.clawdbot/moltbot.json。',
  'page.title.debug': '调试',
  'page.subtitle.debug': '网关快照、事件和手动RPC调用。',
  'page.title.logs': '日志',
  'page.subtitle.logs': '网关文件日志的实时跟踪。',
  
  // Topbar
  'topbar.expand_sidebar': '展开侧边栏',
  'topbar.collapse_sidebar': '收起侧边栏',
  'topbar.brand_title': 'MOLTBOT',
  'topbar.brand_sub': '网关仪表板',
  'topbar.status.health': '健康状况',
  'topbar.status.ok': '正常',
  'topbar.status.offline': '离线',
  
  // Overview page
  'overview.gateway_access': '网关访问',
  'overview.gateway_subtitle': '仪表板连接的位置以及身份验证方式。',
  'overview.websocket_url': 'WebSocket URL',
  'overview.gateway_token': '网关令牌',
  'overview.password': '密码（不存储）',
  'overview.default_session_key': '默认会话密钥',
  'overview.connect_button': '连接',
  'overview.refresh_button': '刷新',
  'overview.click_connect_hint': '单击“连接”以应用连接更改。',
  'overview.snapshot': '快照',
  'overview.snapshot_subtitle': '最新的网关握手信息。',
  'overview.status': '状态',
  'overview.uptime': '运行时间',
  'overview.tick_interval': '心跳间隔',
  'overview.last_channels_refresh': '上次频道刷新',
  'overview.instances': '实例',
  'overview.sessions': '会话',
  'overview.cron': '定时任务',
  'overview.notes': '备注',
  'overview.notes_subtitle': '远程控制设置的快速提醒。',
  'overview.tailscale_serve': 'Tailscale服务',
  'overview.session_hygiene': '会话卫生',
  'overview.cron_reminders': '定时任务提醒',
  'overview.presence_beacons_hint': '最近5分钟内的存在信标。',
  'overview.recent_sessions_hint': '网关跟踪的最近会话密钥。',
  'overview.cron_next_wake': '下次唤醒 {nextRun}',
  'overview.tailscale_serve_note': '建议使用服务模式，通过尾网认证将网关保持在回环地址。',
  'overview.session_hygiene_note': '使用 /new 或 sessions.patch 重置上下文。',
  'overview.cron_reminders_note': '为重复运行使用隔离会话。',
  
  // Common terms
  'common.connected': '已连接',
  'common.disconnected': '已断开',
  'common.enabled': '启用',
  'common.disabled': '禁用',
  'common.n_a': '无',
  'common.cancel': '取消',
  'common.save': '保存',
  'common.apply': '应用',
  'common.update': '更新',
  'common.refresh': '刷新',
  'common.close': '关闭',
  'common.ok': '确定',
  'common.yes': '是',
  'common.no': '否',
  'common.error': '错误',
  'common.warning': '警告',
  'common.info': '信息',
  'common.success': '成功',
  'common.open_in_new_tab': '在新标签页中打开',
  'common.open_in_new_tab': '在新标签页中打开',
};

const translations = {
  en: enTranslations,
  'zh-CN': zhCNTranslations,
};

class I18nManager {
  private currentLocale: Locale = 'en';
  private listeners: Array<(locale: Locale) => void> = [];

  constructor() {
    // Detect locale from browser or URL
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    
    if (langParam && (langParam === 'en' || langParam === 'zh-CN')) {
      this.currentLocale = langParam as Locale;
    } else {
      // Fallback to browser language detection
      const browserLang = navigator.language;
      if (browserLang.startsWith('zh')) {
        this.currentLocale = 'zh-CN';
      } else {
        this.currentLocale = 'en';
      }
    }
  }

  /**
   * Get the current locale
   */
  getLocale(): Locale {
    return this.currentLocale;
  }

  /**
   * Set the locale and notify listeners
   */
  setLocale(locale: Locale): void {
    if (locale !== this.currentLocale) {
      this.currentLocale = locale;
      localStorage.setItem('moltbot_locale', locale);
      this.notifyListeners();
    }
  }

  /**
   * Translate a key with optional replacements
   */
  t(key: keyof TranslationKeys, replacements?: Record<string, string>): string {
    const translation = translations[this.currentLocale][key] || translations.en[key];
    
    if (!translation) {
      console.warn(`Translation key '${key}' not found for locale '${this.currentLocale}', falling back to English`);
      return key; // Return the key itself if translation is missing
    }
    
    // Replace placeholders in the translation
    let result = translation;
    if (replacements) {
      for (const [placeholder, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
      }
    }
    
    return result;
  }

  /**
   * Add a listener for locale changes
   */
  addListener(listener: (locale: Locale) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(listener: (locale: Locale) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of locale change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLocale));
  }
}

// Update HTML lang attribute when locale changes
function updateHtmlLangAttribute(locale: Locale) {
  const html = document.getElementById('html-root') || document.documentElement;
  html.setAttribute('lang', locale);
}

class I18nManager {
  private currentLocale: Locale = 'en';
  private listeners: Array<(locale: Locale) => void> = [];

  constructor() {
    // Detect locale from browser or URL
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    
    if (langParam && (langParam === 'en' || langParam === 'zh-CN')) {
      this.currentLocale = langParam as Locale;
    } else {
      // Fallback to browser language detection
      const browserLang = navigator.language;
      if (browserLang.startsWith('zh')) {
        this.currentLocale = 'zh-CN';
      } else {
        this.currentLocale = 'en';
      }
    }
    
    // Update the HTML lang attribute initially
    updateHtmlLangAttribute(this.currentLocale);
  }

  /**
   * Get the current locale
   */
  getLocale(): Locale {
    return this.currentLocale;
  }

  /**
   * Set the locale and notify listeners
   */
  setLocale(locale: Locale): void {
    if (locale !== this.currentLocale) {
      this.currentLocale = locale;
      localStorage.setItem('moltbot_locale', locale);
      updateHtmlLangAttribute(locale);
      this.notifyListeners();
    }
  }

  /**
   * Translate a key with optional replacements
   */
  t(key: keyof TranslationKeys, replacements?: Record<string, string>): string {
    const translation = translations[this.currentLocale][key] || translations.en[key];
    
    if (!translation) {
      console.warn(`Translation key '${key}' not found for locale '${this.currentLocale}', falling back to English`);
      return key; // Return the key itself if translation is missing
    }
    
    // Replace placeholders in the translation
    let result = translation;
    if (replacements) {
      for (const [placeholder, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
      }
    }
    
    return result;
  }

  /**
   * Add a listener for locale changes
   */
  addListener(listener: (locale: Locale) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(listener: (locale: Locale) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of locale change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLocale));
  }
}

export const i18n = new I18nManager();

// Export a helper function for easy usage
export const t = (key: keyof TranslationKeys, replacements?: Record<string, string>): string => {
  return i18n.t(key, replacements);
};