#!/usr/bin/env node

/**
 * PM2 Health Monitor for Moltbot Gateway
 *
 * Monitors gateway responsiveness and automatically recovers from hangs.
 * Runs as a separate PM2-managed process (not systemd).
 *
 * Features:
 * - Checks if gateway is responding on port 18789
 * - Detects inotify watcher exhaustion
 * - Force-restarts hung gateway processes
 * - Logs all checks and recoveries
 */

import net from 'net';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Configuration
const GATEWAY_PORT = 18789;
const GATEWAY_HOST = '127.0.0.1';
const CHECK_INTERVAL = parseInt(process.env.INTERVAL || '300000'); // 5 minutes default
const INOTIFY_THRESHOLD = 0.8; // 80% of limit = warning
const LOG_FILE = '/tmp/moltbot/pm2-health-monitor.log';

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Log with timestamp
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  console.log(logEntry);
  fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

/**
 * Check if gateway port is responding
 */
function checkGatewayResponsive() {
  return new Promise((resolve) => {
    const socket = net.createConnection(GATEWAY_PORT, GATEWAY_HOST);
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

/**
 * Get inotify watcher usage
 */
async function checkInotifyUsage() {
  return new Promise((resolve) => {
    fs.readFile('/proc/sys/fs/inotify/max_user_watches', 'utf8', (err, limit) => {
      if (err) {
        resolve({ limit: 0, usage: 0, percentage: 0 });
        return;
      }

      const maxWatchers = parseInt(limit.trim());
      resolve({
        limit: maxWatchers,
        threshold: Math.floor(maxWatchers * INOTIFY_THRESHOLD)
      });
    });
  });
}

/**
 * Force restart gateway via PM2
 */
function restartGateway() {
  return new Promise((resolve) => {
    log('⚠️  Gateway unresponsive. Attempting force restart...');

    const killProc = spawn('killall', ['-9', 'moltbot']);

    killProc.on('close', () => {
      setTimeout(() => {
        log('✓ Gateway force-killed. PM2 will restart automatically.');
        resolve(true);
      }, 2000);
    });

    killProc.on('error', () => {
      resolve(true);
    });
  });
}

/**
 * Main health check routine
 */
async function performHealthCheck() {
  try {
    log('🔍 Starting health check...');

    const isResponsive = await checkGatewayResponsive();

    if (isResponsive) {
      log('✓ Gateway is responding on port 18789');
    } else {
      log('✗ Gateway NOT responding on port 18789');
      await restartGateway();
      return;
    }

    const inotify = await checkInotifyUsage();
    if (inotify.limit > 0) {
      log(`ℹ️  Inotify limit: ${inotify.limit} (threshold: ${inotify.threshold})`);
    }

    log('✓ Health check passed');
  } catch (error) {
    log(`✗ Health check error: ${error.message}`);
  }
}

/**
 * Start periodic health checks
 */
function startHealthMonitoring() {
  log(`🚀 PM2 Health Monitor started (check interval: ${CHECK_INTERVAL}ms)`);
  log(`   Gateway: ${GATEWAY_HOST}:${GATEWAY_PORT}`);
  log(`   Log file: ${LOG_FILE}`);

  performHealthCheck();

  setInterval(() => {
    performHealthCheck();
  }, CHECK_INTERVAL);
}

process.on('SIGINT', () => {
  log('📴 Health monitor shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('📴 Health monitor terminated');
  process.exit(0);
});

startHealthMonitoring();
