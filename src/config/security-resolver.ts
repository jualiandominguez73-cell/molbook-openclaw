/**
 * Security configuration resolvers.
 * 
 * This module provides functions to resolve security settings based on
 * configuration and channel context.
 */

import type { OpenClawConfig } from "./types.openclaw.js";
import type { InboundContentSource } from "../security/external-content.js";

/**
 * Resolves whether prompt injection detection should be enabled for a given source.
 * 
 * Resolution order (highest priority first):
 * 1. Per-channel config (if source is a channel)
 * 2. Global config
 * 3. Default: false (for backward compatibility)
 * 
 * @param cfg - OpenClaw configuration
 * @param source - Content source (channel, hook, email, etc.)
 * @returns Whether detection is enabled
 */
export function shouldDetectPromptInjection(
  cfg: OpenClawConfig,
  source: InboundContentSource,
): boolean {
  const piConfig = cfg.security?.promptInjection;
  
  if (!piConfig) {
    return false;
  }
  
  // Check per-channel override if applicable
  if (source !== "channel" && source !== "hook" && source !== "unknown") {
    const channelConfig = piConfig.channels?.[source];
    if (channelConfig?.detect !== undefined) {
      return channelConfig.detect;
    }
  }
  
  // Fall back to global setting
  return piConfig.detect ?? false;
}

/**
 * Resolves whether detected prompt injection should be wrapped with warnings.
 * 
 * Resolution order (highest priority first):
 * 1. Per-channel config (if source is a channel)
 * 2. Global config
 * 3. Default: false
 * 
 * @param cfg - OpenClaw configuration
 * @param source - Content source (channel, hook, email, etc.)
 * @returns Whether wrapping is enabled
 */
export function shouldWrapPromptInjection(
  cfg: OpenClawConfig,
  source: InboundContentSource,
): boolean {
  const piConfig = cfg.security?.promptInjection;
  
  if (!piConfig) {
    return false;
  }
  
  // Check per-channel override if applicable
  if (source !== "channel" && source !== "hook" && source !== "unknown") {
    const channelConfig = piConfig.channels?.[source];
    if (channelConfig?.wrap !== undefined) {
      return channelConfig.wrap;
    }
  }
  
  // Fall back to global setting
  return piConfig.wrap ?? false;
}

/**
 * Resolves whether prompt injection detections should be logged.
 * 
 * Resolution order (highest priority first):
 * 1. Per-channel config (if source is a channel)
 * 2. Global config
 * 3. Default: true
 * 
 * @param cfg - OpenClaw configuration
 * @param source - Content source (channel, hook, email, etc.)
 * @returns Whether logging is enabled
 */
export function shouldLogPromptInjection(
  cfg: OpenClawConfig,
  source: InboundContentSource,
): boolean {
  const piConfig = cfg.security?.promptInjection;
  
  if (!piConfig) {
    return true; // Default to logging for security visibility
  }
  
  // Check per-channel override if applicable
  if (source !== "channel" && source !== "hook" && source !== "unknown") {
    const channelConfig = piConfig.channels?.[source];
    if (channelConfig?.log !== undefined) {
      return channelConfig.log;
    }
  }
  
  // Fall back to global setting
  return piConfig.log ?? true;
}

/**
 * Resolves all prompt injection settings for a given source.
 * 
 * @param cfg - OpenClaw configuration
 * @param source - Content source (channel, hook, email, etc.)
 * @returns Resolved settings object
 */
export function resolvePromptInjectionSettings(
  cfg: OpenClawConfig,
  source: InboundContentSource,
) {
  return {
    detect: shouldDetectPromptInjection(cfg, source),
    wrap: shouldWrapPromptInjection(cfg, source),
    log: shouldLogPromptInjection(cfg, source),
  };
}
