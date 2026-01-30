/**
 * Configuration file I/O with secure permissions.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

// Secure file permissions: owner read/write only
export const SECURE_FILE_MODE = 0o600;
export const SECURE_DIR_MODE = 0o700;

/**
 * Ensure directory exists with secure permissions.
 */
export function ensureSecureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true, mode: SECURE_DIR_MODE });
  } else {
    // Verify and fix permissions if needed
    const stats = statSync(dirPath);
    const currentMode = stats.mode & 0o777;
    if (currentMode !== SECURE_DIR_MODE) {
      chmodSync(dirPath, SECURE_DIR_MODE);
    }
  }
}

/**
 * Atomic write with secure permissions.
 * Uses temp file + rename to prevent corruption.
 */
export function atomicWriteSecure(filePath: string, data: string): void {
  const dir = dirname(filePath);
  ensureSecureDir(dir);

  // Create temp file with random suffix
  const tempPath = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;

  try {
    // Write to temp file with secure permissions
    writeFileSync(tempPath, data, { mode: SECURE_FILE_MODE, encoding: 'utf-8' });

    // Atomic rename
    renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Read file with permission check.
 */
export function readSecureFile(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  // Check and fix permissions
  const stats = statSync(filePath);
  const currentMode = stats.mode & 0o777;
  if (currentMode !== SECURE_FILE_MODE) {
    console.warn(`Warning: Fixing insecure permissions on ${filePath}`);
    chmodSync(filePath, SECURE_FILE_MODE);
  }

  return readFileSync(filePath, 'utf-8');
}

/**
 * Check if a path is a symlink.
 */
export function isSymlink(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  return statSync(filePath, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
}
