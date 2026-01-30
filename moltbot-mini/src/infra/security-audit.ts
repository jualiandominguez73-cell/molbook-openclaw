/**
 * Security audit utilities.
 *
 * Checks file permissions, symlinks, and other security concerns.
 */

import { existsSync, statSync, lstatSync } from 'node:fs';
import { getStateDir, getCredentialsPath, getConfigPath } from '../config/config-paths.js';
import { SECURE_FILE_MODE, SECURE_DIR_MODE } from '../config/io.js';

/**
 * Audit result structure.
 */
export interface AuditResult {
  secure: boolean;
  issues: AuditIssue[];
}

/**
 * Single audit issue.
 */
export interface AuditIssue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  path?: string;
}

/**
 * Run security audit on credential and config files.
 */
export function runSecurityAudit(): AuditResult {
  const issues: AuditIssue[] = [];

  // Check state directory
  const stateDir = getStateDir();
  if (existsSync(stateDir)) {
    checkDirectoryPermissions(stateDir, 'State directory', issues);
    checkSymlink(stateDir, 'State directory', issues);
  }

  // Check credentials file
  const credPath = getCredentialsPath();
  if (existsSync(credPath)) {
    checkFilePermissions(credPath, 'Credentials file', issues);
    checkSymlink(credPath, 'Credentials file', issues);
  }

  // Check config file
  const configPath = getConfigPath();
  if (existsSync(configPath)) {
    checkFilePermissions(configPath, 'Config file', issues);
    checkSymlink(configPath, 'Config file', issues);
  }

  return {
    secure: issues.filter((i) => i.severity === 'critical').length === 0,
    issues,
  };
}

/**
 * Check directory permissions.
 */
function checkDirectoryPermissions(
  dirPath: string,
  name: string,
  issues: AuditIssue[]
): void {
  try {
    const stats = statSync(dirPath);
    const mode = stats.mode & 0o777;

    if (mode & 0o007) {
      issues.push({
        severity: 'critical',
        message: `${name} is world-accessible (mode: ${mode.toString(8)})`,
        path: dirPath,
      });
    } else if (mode & 0o070) {
      issues.push({
        severity: 'warning',
        message: `${name} is group-accessible (mode: ${mode.toString(8)})`,
        path: dirPath,
      });
    } else if (mode !== SECURE_DIR_MODE) {
      issues.push({
        severity: 'info',
        message: `${name} has non-standard permissions (mode: ${mode.toString(8)}, expected: ${SECURE_DIR_MODE.toString(8)})`,
        path: dirPath,
      });
    }
  } catch {
    // Ignore stat errors
  }
}

/**
 * Check file permissions.
 */
function checkFilePermissions(
  filePath: string,
  name: string,
  issues: AuditIssue[]
): void {
  try {
    const stats = statSync(filePath);
    const mode = stats.mode & 0o777;

    if (mode & 0o007) {
      issues.push({
        severity: 'critical',
        message: `${name} is world-readable (mode: ${mode.toString(8)})`,
        path: filePath,
      });
    } else if (mode & 0o070) {
      issues.push({
        severity: 'warning',
        message: `${name} is group-readable (mode: ${mode.toString(8)})`,
        path: filePath,
      });
    } else if (mode !== SECURE_FILE_MODE) {
      issues.push({
        severity: 'info',
        message: `${name} has non-standard permissions (mode: ${mode.toString(8)}, expected: ${SECURE_FILE_MODE.toString(8)})`,
        path: filePath,
      });
    }
  } catch {
    // Ignore stat errors
  }
}

/**
 * Check if path is a symlink.
 */
function checkSymlink(
  path: string,
  name: string,
  issues: AuditIssue[]
): void {
  try {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      issues.push({
        severity: 'warning',
        message: `${name} is a symlink (potential security risk)`,
        path,
      });
    }
  } catch {
    // Ignore stat errors
  }
}

/**
 * Format audit results for display.
 */
export function formatAuditResults(result: AuditResult): string {
  const lines: string[] = [];

  if (result.secure && result.issues.length === 0) {
    lines.push('✅ No security issues found.');
    return lines.join('\n');
  }

  if (!result.secure) {
    lines.push('❌ Security issues found:\n');
  } else {
    lines.push('⚠️  Security warnings:\n');
  }

  for (const issue of result.issues) {
    const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
    lines.push(`${icon} ${issue.message}`);
    if (issue.path) {
      lines.push(`   Path: ${issue.path}`);
    }
  }

  return lines.join('\n');
}
