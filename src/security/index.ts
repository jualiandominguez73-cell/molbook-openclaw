/**
 * Security module exports for OpenClaw.
 */

// Security events system
export {
  type SecurityEvent,
  type SecurityEventCategory,
  type SecurityEventSeverity,
  type SecurityEventListener,
  emitSecurityEvent,
  onSecurityEvent,
  clearSecurityEventListeners,
  getSecurityEventListenerCount,
  // Convenience event emitters
  emitAuthEvent,
  emitAccessEvent,
  emitCommandEvent,
  emitRateLimitEvent,
  emitInjectionEvent,
  emitNetworkEvent,
  emitAnomalyEvent,
  emitConfigEvent,
  emitFileSystemEvent,
} from "./events.js";

// Security events store
export {
  type SecurityEventQueryOptions,
  type SecurityEventStats,
  initializeSecurityEventsStore,
  shutdownSecurityEventsStore,
  getSecurityEventsDir,
  getCurrentLogPath,
  querySecurityEvents,
  getSecurityEventStats,
  getRecentSecurityAlerts,
  getBlockedEvents,
  getSessionSecurityEvents,
  getEventsByIpAddress,
} from "./events-store.js";

// External content security (prompt injection protection)
export {
  type ExternalContentSource,
  type WrapExternalContentOptions,
  wrapExternalContent,
  detectSuspiciousPatterns,
  buildSafeExternalPrompt,
  isExternalHookSession,
  getHookType,
  wrapWebContent,
} from "./external-content.js";
