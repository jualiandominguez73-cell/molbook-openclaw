/**
 * Safe Executor Integration Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getTrustLevelFromSource,
  createOpenClawExecutor,
  loadSafeExecutorConfig,
  DEFAULT_SAFE_EXECUTOR_CONFIG,
  isBlockedPath,
  isDangerousEnvVar,
  sanitizeEnv,
  isPrivateIP,
  isBlockedHostname,
  killProcessTree,
  isProcessRunning,
} from './index.js';
import type { MessageSource } from './openclaw-executor.js';

describe('getTrustLevelFromSource', () => {
  it('should return full for CLI', () => {
    const source: MessageSource = { provider: 'cli', channelType: 'dm' };
    expect(getTrustLevelFromSource(source)).toBe('full');
  });

  it('should return full for owner', () => {
    const source: MessageSource = { provider: 'discord', channelType: 'public', isOwner: true };
    expect(getTrustLevelFromSource(source)).toBe('full');
  });

  it('should return shell for trusted users', () => {
    const source: MessageSource = { provider: 'discord', channelType: 'dm', isTrusted: true };
    expect(getTrustLevelFromSource(source)).toBe('shell');
  });

  it('should return write for DMs', () => {
    const source: MessageSource = { provider: 'telegram', channelType: 'dm' };
    expect(getTrustLevelFromSource(source)).toBe('write');
  });

  it('should return llm for groups', () => {
    const source: MessageSource = { provider: 'slack', channelType: 'group' };
    expect(getTrustLevelFromSource(source)).toBe('llm');
  });

  it('should return network for public', () => {
    const source: MessageSource = { provider: 'web', channelType: 'public' };
    expect(getTrustLevelFromSource(source)).toBe('network');
  });
});

describe('config', () => {
  it('should have default config', () => {
    expect(DEFAULT_SAFE_EXECUTOR_CONFIG.enabled).toBe(false);
    expect(DEFAULT_SAFE_EXECUTOR_CONFIG.selfIds).toEqual([]);
  });

  it('should load config without error', () => {
    const config = loadSafeExecutorConfig();
    expect(config).toBeDefined();
    expect(config.enabled).toBeDefined();
  });
});

describe('security utilities from ajs-clawbot', () => {
  describe('isBlockedPath', () => {
    it('should block .env files', () => {
      expect(isBlockedPath('.env').blocked).toBe(true);
      expect(isBlockedPath('.env.local').blocked).toBe(true);
    });

    it('should block SSH keys', () => {
      expect(isBlockedPath('id_rsa').blocked).toBe(true);
      expect(isBlockedPath('.ssh/config').blocked).toBe(true);
    });

    it('should allow normal files', () => {
      expect(isBlockedPath('index.ts').blocked).toBe(false);
      expect(isBlockedPath('src/main.js').blocked).toBe(false);
    });
  });

  describe('isDangerousEnvVar', () => {
    it('should block LD_PRELOAD', () => {
      expect(isDangerousEnvVar('LD_PRELOAD')).toBe(true);
    });

    it('should block NODE_OPTIONS', () => {
      expect(isDangerousEnvVar('NODE_OPTIONS')).toBe(true);
    });

    it('should allow normal vars', () => {
      expect(isDangerousEnvVar('HOME')).toBe(false);
      expect(isDangerousEnvVar('MY_VAR')).toBe(false);
    });
  });

  describe('sanitizeEnv', () => {
    it('should remove dangerous vars', () => {
      const env = { HOME: '/home/user', LD_PRELOAD: '/evil.so', MY_VAR: 'safe' };
      const sanitized = sanitizeEnv(env);
      expect(sanitized.HOME).toBe('/home/user');
      expect(sanitized.MY_VAR).toBe('safe');
      expect(sanitized.LD_PRELOAD).toBeUndefined();
    });
  });

  describe('isPrivateIP', () => {
    it('should detect private IPs', () => {
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('127.0.0.1')).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
    });
  });

  describe('isBlockedHostname', () => {
    it('should block localhost', () => {
      expect(isBlockedHostname('localhost')).toBe(true);
    });

    it('should block metadata services', () => {
      expect(isBlockedHostname('metadata.google.internal')).toBe(true);
    });

    it('should allow normal hosts', () => {
      expect(isBlockedHostname('api.github.com')).toBe(false);
    });
  });
});

describe('process utilities from ajs-clawbot', () => {
  it('should check if current process is running', () => {
    expect(isProcessRunning(process.pid)).toBe(true);
  });

  it('should return false for non-existent process', () => {
    expect(isProcessRunning(999999999)).toBe(false);
  });
});

describe('createOpenClawExecutor', () => {
  it('should create executor with default options', () => {
    const { executor, execute } = createOpenClawExecutor({
      workspaceRoot: '/tmp/test',
    });
    expect(executor).toBeDefined();
    expect(typeof execute).toBe('function');
  });

  it('should create executor with strict rate limiting', () => {
    const { executor } = createOpenClawExecutor({
      workspaceRoot: '/tmp/test',
      strictRateLimiting: true,
      selfIds: ['bot-123'],
    });
    expect(executor).toBeDefined();
  });
});
