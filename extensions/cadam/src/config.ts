/**
 * CADAM plugin configuration
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CADAMConfig {
  enabled: boolean;
  outputDir: string;
  renderer: 'cli' | 'none';
  openscadPath: string;
  includeLibraries: string[];
  defaultExportFormat: 'stl' | 'scad' | '3mf';
  model?: string;
  maxCodeTokens: number;
  cacheModels: boolean;
}

export const DEFAULT_CONFIG: CADAMConfig = {
  enabled: true,
  outputDir: join(homedir(), '.openclaw', 'cadam-models'),
  renderer: 'cli',
  openscadPath: '/usr/bin/openscad',
  includeLibraries: ['BOSL2', 'MCAD'],
  defaultExportFormat: 'stl',
  maxCodeTokens: 16000,
  cacheModels: true,
};

export function resolveConfig(pluginConfig: unknown): CADAMConfig {
  const raw = pluginConfig && typeof pluginConfig === 'object' ? pluginConfig as Record<string, unknown> : {};

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_CONFIG.enabled,
    outputDir: typeof raw.outputDir === 'string' ? raw.outputDir : DEFAULT_CONFIG.outputDir,
    renderer: raw.renderer === 'cli' || raw.renderer === 'none' ? raw.renderer : DEFAULT_CONFIG.renderer,
    openscadPath: typeof raw.openscadPath === 'string' ? raw.openscadPath : DEFAULT_CONFIG.openscadPath,
    includeLibraries: Array.isArray(raw.includeLibraries) ? raw.includeLibraries.filter((x): x is string => typeof x === 'string') : DEFAULT_CONFIG.includeLibraries,
    defaultExportFormat: raw.defaultExportFormat === 'stl' || raw.defaultExportFormat === 'scad' || raw.defaultExportFormat === '3mf' ? raw.defaultExportFormat : DEFAULT_CONFIG.defaultExportFormat,
    model: typeof raw.model === 'string' ? raw.model : undefined,
    maxCodeTokens: typeof raw.maxCodeTokens === 'number' ? raw.maxCodeTokens : DEFAULT_CONFIG.maxCodeTokens,
    cacheModels: typeof raw.cacheModels === 'boolean' ? raw.cacheModels : DEFAULT_CONFIG.cacheModels,
  };
}

export function validateConfig(config: CADAMConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.renderer === 'cli' && !config.openscadPath) {
    errors.push('openscadPath is required when renderer is "cli"');
  }

  if (config.maxCodeTokens < 1000 || config.maxCodeTokens > 32000) {
    errors.push('maxCodeTokens must be between 1000 and 32000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
