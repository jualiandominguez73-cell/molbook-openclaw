/**
 * Session Access Control
 * Enforces strict boundaries between user sessions
 */

import { randomUUID, createHash } from "node:crypto";
import type { SessionACLEntry, ACLResult } from "./types.js";
import { getAuditLogger } from "./audit-logger.js";

export interface SessionACLConfig {
  /** Enable access control */
  enabled: boolean;
  /** Default policy for unspecified access */
  defaultPolicy: "allow" | "deny";
  /** Capability token expiration (ms) */
  tokenExpiration: number;
  /** Enable audit logging */
  enableAudit: boolean;
}

const DEFAULT_CONFIG: SessionACLConfig = {
  enabled: true,
  defaultPolicy: "deny",
  tokenExpiration: 24 * 60 * 60 * 1000, // 24 hours
  enableAudit: true,
};

type Operation = "read" | "write" | "message";

export class SessionAccessControl {
  private config: SessionACLConfig;
  private acl: Map<string, SessionACLEntry> = new Map();
  private capabilityTokens: Map<string, { entry: SessionACLEntry; expiresAt: number }> = new Map();

  constructor(config: Partial<SessionACLConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if access is allowed
   */
  authorize(
    fromSession: string,
    toSession: string,
    operation: Operation
  ): ACLResult {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    // Same session always allowed
    if (fromSession === toSession) {
      return { allowed: true };
    }

    const key = this.makeKey(fromSession, toSession);
    const entry = this.acl.get(key);

    // Check explicit ACL entry
    if (entry) {
      // Check expiration
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.acl.delete(key);
        return this.deny(fromSession, toSession, operation, "Permission expired");
      }

      // Check operation
      if (entry.operations.includes(operation)) {
        this.logAccess(fromSession, toSession, operation, true);
        return { allowed: true };
      }

      return this.deny(fromSession, toSession, operation, "Operation not permitted");
    }

    // Check default policy
    if (this.config.defaultPolicy === "allow") {
      this.logAccess(fromSession, toSession, operation, true);
      return { allowed: true };
    }

    return this.deny(fromSession, toSession, operation, "No explicit permission");
  }

  /**
   * Check access using a capability token
   */
  authorizeWithToken(
    token: string,
    operation: Operation
  ): ACLResult {
    const cap = this.capabilityTokens.get(token);

    if (!cap) {
      return {
        allowed: false,
        reason: "Invalid capability token",
      };
    }

    // Check expiration
    if (cap.expiresAt < Date.now()) {
      this.capabilityTokens.delete(token);
      return {
        allowed: false,
        reason: "Capability token expired",
      };
    }

    // Check operation
    if (!cap.entry.operations.includes(operation)) {
      return {
        allowed: false,
        reason: "Operation not permitted by capability",
      };
    }

    this.logAccess(cap.entry.fromSession, cap.entry.toSession, operation, true);
    return { allowed: true };
  }

  /**
   * Grant access from one session to another
   */
  grant(
    fromSession: string,
    toSession: string,
    operations: Operation[],
    options?: { expiresAt?: number; generateToken?: boolean }
  ): { entry: SessionACLEntry; token?: string } {
    const key = this.makeKey(fromSession, toSession);

    const entry: SessionACLEntry = {
      fromSession,
      toSession,
      operations,
      expiresAt: options?.expiresAt,
    };

    // Generate capability token if requested
    let token: string | undefined;
    if (options?.generateToken) {
      token = this.generateCapabilityToken();
      entry.capabilityToken = token;

      this.capabilityTokens.set(token, {
        entry,
        expiresAt: options?.expiresAt || Date.now() + this.config.tokenExpiration,
      });
    }

    this.acl.set(key, entry);

    getAuditLogger().info("session_access_granted", {
      fromSession,
      toSession,
      operations,
      expiresAt: entry.expiresAt,
      hasToken: !!token,
    });

    return { entry, token };
  }

  /**
   * Revoke access
   */
  revoke(fromSession: string, toSession: string): boolean {
    const key = this.makeKey(fromSession, toSession);
    const entry = this.acl.get(key);

    if (!entry) {
      return false;
    }

    // Revoke capability token if exists
    if (entry.capabilityToken) {
      this.capabilityTokens.delete(entry.capabilityToken);
    }

    this.acl.delete(key);

    getAuditLogger().info("session_access_revoked", {
      fromSession,
      toSession,
    });

    return true;
  }

  /**
   * Revoke a capability token
   */
  revokeToken(token: string): boolean {
    const cap = this.capabilityTokens.get(token);
    if (!cap) {
      return false;
    }

    this.capabilityTokens.delete(token);

    // Also revoke the ACL entry if it references this token
    const key = this.makeKey(cap.entry.fromSession, cap.entry.toSession);
    const entry = this.acl.get(key);
    if (entry && entry.capabilityToken === token) {
      this.acl.delete(key);
    }

    getAuditLogger().info("capability_token_revoked", {
      fromSession: cap.entry.fromSession,
      toSession: cap.entry.toSession,
    });

    return true;
  }

  /**
   * Revoke all access for a session
   */
  revokeAll(session: string): number {
    let revoked = 0;

    // Revoke outgoing access
    for (const [key, entry] of this.acl) {
      if (entry.fromSession === session || entry.toSession === session) {
        if (entry.capabilityToken) {
          this.capabilityTokens.delete(entry.capabilityToken);
        }
        this.acl.delete(key);
        revoked++;
      }
    }

    if (revoked > 0) {
      getAuditLogger().info("session_access_revoked_all", {
        session,
        revokedCount: revoked,
      });
    }

    return revoked;
  }

  /**
   * Get all permissions for a session
   */
  getPermissions(session: string): SessionACLEntry[] {
    const permissions: SessionACLEntry[] = [];

    for (const entry of this.acl.values()) {
      if (entry.fromSession === session || entry.toSession === session) {
        permissions.push(entry);
      }
    }

    return permissions;
  }

  /**
   * Check if a session can read from another
   */
  canRead(fromSession: string, toSession: string): boolean {
    return this.authorize(fromSession, toSession, "read").allowed;
  }

  /**
   * Check if a session can write to another
   */
  canWrite(fromSession: string, toSession: string): boolean {
    return this.authorize(fromSession, toSession, "write").allowed;
  }

  /**
   * Check if a session can message another
   */
  canMessage(fromSession: string, toSession: string): boolean {
    return this.authorize(fromSession, toSession, "message").allowed;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    // Clean ACL entries
    for (const [key, entry] of this.acl) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.acl.delete(key);
        cleaned++;
      }
    }

    // Clean capability tokens
    for (const [token, cap] of this.capabilityTokens) {
      if (cap.expiresAt < now) {
        this.capabilityTokens.delete(token);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Create deny result and log
   */
  private deny(
    fromSession: string,
    toSession: string,
    operation: Operation,
    reason: string
  ): ACLResult {
    this.logAccess(fromSession, toSession, operation, false, reason);
    return { allowed: false, reason };
  }

  /**
   * Log access attempt
   */
  private logAccess(
    fromSession: string,
    toSession: string,
    operation: string,
    allowed: boolean,
    reason?: string
  ): void {
    if (!this.config.enableAudit) return;

    getAuditLogger().logSessionAccess({
      fromSession,
      toSession,
      operation,
      allowed,
      reason,
    });
  }

  /**
   * Generate a capability token
   */
  private generateCapabilityToken(): string {
    const random = randomUUID();
    const hash = createHash("sha256").update(random).digest("hex");
    return `cap_${hash.slice(0, 32)}`;
  }

  /**
   * Make ACL key from session pair
   */
  private makeKey(from: string, to: string): string {
    return `${from}:${to}`;
  }

  /**
   * Get statistics
   */
  getStats(): { aclCount: number; tokenCount: number } {
    return {
      aclCount: this.acl.size,
      tokenCount: this.capabilityTokens.size,
    };
  }
}

// Singleton instance
let defaultACL: SessionAccessControl | null = null;

/**
 * Get or create the default session ACL
 */
export function getSessionACL(config?: Partial<SessionACLConfig>): SessionAccessControl {
  if (!defaultACL) {
    defaultACL = new SessionAccessControl(config);
  }
  return defaultACL;
}
