/**
 * Security configuration types for OpenClaw.
 * 
 * This module defines configuration options for security features including
 * prompt injection detection and content guarding.
 */

/**
 * Per-channel security settings for prompt injection detection.
 */
export type ChannelSecurityConfig = {
  /** Enable prompt injection detection for this channel */
  detect?: boolean;
  /** Wrap detected content with security warnings */
  wrap?: boolean;
  /** Log detections for monitoring */
  log?: boolean;
};

/**
 * Prompt injection detection configuration.
 */
export type PromptInjectionConfig = {
  /** 
   * Enable prompt injection detection globally.
   * Default: false (for backward compatibility)
   */
  detect?: boolean;
  
  /**
   * Wrap detected content with security warnings.
   * When true, suspicious content is wrapped with warnings before being
   * passed to the LLM. When false, detection is logged but content is unchanged.
   * Default: false
   */
  wrap?: boolean;
  
  /**
   * Log all prompt injection detections.
   * Default: true
   */
  log?: boolean;
  
  /**
   * Per-channel overrides for prompt injection settings.
   * Channel IDs should match the provider name (e.g., "telegram", "discord", "slack")
   */
  channels?: Record<string, ChannelSecurityConfig>;
};

/**
 * Security configuration root type.
 */
export type SecurityConfig = {
  /** Prompt injection detection and guarding configuration */
  promptInjection?: PromptInjectionConfig;
};
