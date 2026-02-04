/**
 * Network Access Policy
 * Prevents agents from accessing internal resources via SSRF
 */

import { lookup } from "node:dns/promises";
import type { NetworkPolicy, NetworkAccessResult } from "./types.js";
import { DEFAULT_NETWORK_POLICY } from "./types.js";
import { getAuditLogger } from "./audit-logger.js";

export interface NetworkPolicyConfig {
  /** Network policy rules */
  policy: NetworkPolicy;
  /** Enable audit logging */
  enableAudit: boolean;
  /** Cache DNS resolutions */
  enableDnsCache: boolean;
  /** DNS cache TTL (ms) */
  dnsCacheTtl: number;
}

const DEFAULT_CONFIG: NetworkPolicyConfig = {
  policy: DEFAULT_NETWORK_POLICY,
  enableAudit: true,
  enableDnsCache: true,
  dnsCacheTtl: 60000, // 1 minute
};

// Cloud metadata endpoints to block
const CLOUD_METADATA_HOSTS = [
  "169.254.169.254", // AWS, GCP, Azure
  "metadata.google.internal",
  "metadata.goog",
  "169.254.170.2", // ECS
  "fd00:ec2::254", // AWS IPv6
];

// Private IP ranges (RFC 1918 + others)
const PRIVATE_IP_RANGES = [
  { start: "10.0.0.0", end: "10.255.255.255" },
  { start: "172.16.0.0", end: "172.31.255.255" },
  { start: "192.168.0.0", end: "192.168.255.255" },
  { start: "127.0.0.0", end: "127.255.255.255" },
  { start: "169.254.0.0", end: "169.254.255.255" },
  { start: "0.0.0.0", end: "0.255.255.255" },
];

interface DnsCacheEntry {
  addresses: string[];
  expiresAt: number;
}

export class NetworkAccessPolicy {
  private config: NetworkPolicyConfig;
  private dnsCache: Map<string, DnsCacheEntry> = new Map();

  constructor(config: Partial<NetworkPolicyConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      policy: { ...DEFAULT_NETWORK_POLICY, ...config.policy },
    };
  }

  /**
   * Check if a URL is allowed to be accessed
   */
  async authorize(
    url: string,
    context?: { userId?: string; sessionKey?: string }
  ): Promise<NetworkAccessResult> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return this.deny("Invalid URL format", context, url);
    }

    const { policy } = this.config;

    // Check TLS requirement
    if (policy.requireTLS && parsed.protocol !== "https:") {
      return this.deny("HTTPS required", context, url);
    }

    // Check cloud metadata endpoints
    if (policy.blockCloudMetadata && this.isCloudMetadata(parsed.hostname)) {
      return this.deny("Cloud metadata access denied", context, url);
    }

    // Check domain allowlist (if configured)
    if (policy.allowedDomains.length > 0) {
      const domainAllowed = policy.allowedDomains.some((domain) =>
        this.matchesDomain(parsed.hostname, domain)
      );
      if (!domainAllowed) {
        return this.deny("Domain not in allowlist", context, url);
      }
    }

    // Resolve IP address
    let resolvedIP: string;
    try {
      resolvedIP = await this.resolveIP(parsed.hostname);
    } catch {
      // DNS resolution failed - might be internal hostname
      if (policy.blockPrivateIPs) {
        return this.deny("DNS resolution failed", context, url);
      }
      resolvedIP = "unknown";
    }

    // Check private IP ranges
    if (policy.blockPrivateIPs && resolvedIP !== "unknown") {
      if (this.isPrivateIP(resolvedIP)) {
        return this.deny("Private IP access denied", context, url, resolvedIP);
      }
    }

    // DNS rebinding protection - re-resolve before returning
    if (policy.dnsRebindingProtection && resolvedIP !== "unknown") {
      try {
        const reResolved = await this.resolveIP(parsed.hostname, true);
        if (reResolved !== resolvedIP && this.isPrivateIP(reResolved)) {
          return this.deny("DNS rebinding detected", context, url, reResolved);
        }
      } catch {
        // Ignore re-resolution failures
      }
    }

    // All checks passed
    this.logDecision(url, true, undefined, resolvedIP, context);

    return {
      allowed: true,
      resolvedIP,
    };
  }

  /**
   * Check if hostname is a cloud metadata endpoint
   */
  isCloudMetadata(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    return CLOUD_METADATA_HOSTS.some((h) => lower === h || lower.endsWith(`.${h}`));
  }

  /**
   * Check if IP is in private ranges
   */
  isPrivateIP(ip: string): boolean {
    // IPv6 localhost
    if (ip === "::1") return true;

    // IPv6 private ranges (simplified)
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) {
      return true;
    }

    // Parse IPv4
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return false; // Not a valid IPv4, might be IPv6
    }

    const ipNum = (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];

    for (const range of PRIVATE_IP_RANGES) {
      const startParts = range.start.split(".").map(Number);
      const endParts = range.end.split(".").map(Number);

      const startNum = (startParts[0] << 24) + (startParts[1] << 16) + (startParts[2] << 8) + startParts[3];
      const endNum = (endParts[0] << 24) + (endParts[1] << 16) + (endParts[2] << 8) + endParts[3];

      if (ipNum >= startNum && ipNum <= endNum) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if hostname matches a domain pattern
   */
  matchesDomain(hostname: string, pattern: string): boolean {
    const h = hostname.toLowerCase();
    const p = pattern.toLowerCase();

    // Exact match
    if (h === p) return true;

    // Wildcard match (*.example.com)
    if (p.startsWith("*.")) {
      const suffix = p.slice(2);
      return h.endsWith(`.${suffix}`) || h === suffix;
    }

    return false;
  }

  /**
   * Resolve hostname to IP
   */
  private async resolveIP(hostname: string, skipCache: boolean = false): Promise<string> {
    // Check if already an IP
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return hostname;
    }

    // Check cache
    if (!skipCache && this.config.enableDnsCache) {
      const cached = this.dnsCache.get(hostname);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.addresses[0];
      }
    }

    // Resolve
    const result = await lookup(hostname);
    const address = result.address;

    // Cache result
    if (this.config.enableDnsCache) {
      this.dnsCache.set(hostname, {
        addresses: [address],
        expiresAt: Date.now() + this.config.dnsCacheTtl,
      });
    }

    return address;
  }

  /**
   * Create a deny result and log it
   */
  private deny(
    reason: string,
    context?: { userId?: string; sessionKey?: string },
    url?: string,
    resolvedIP?: string
  ): NetworkAccessResult {
    if (url) {
      this.logDecision(url, false, reason, resolvedIP, context);
    }

    return {
      allowed: false,
      reason,
      resolvedIP,
    };
  }

  /**
   * Log authorization decision
   */
  private logDecision(
    url: string,
    allowed: boolean,
    reason: string | undefined,
    resolvedIP: string | undefined,
    context?: { userId?: string; sessionKey?: string }
  ): void {
    if (!this.config.enableAudit) return;

    getAuditLogger().logNetworkAccess({
      url,
      allowed,
      reason,
      resolvedIP,
      userId: context?.userId,
      sessionKey: context?.sessionKey,
    });
  }

  /**
   * Clear DNS cache
   */
  clearDnsCache(): void {
    this.dnsCache.clear();
  }

  /**
   * Get policy configuration
   */
  getPolicy(): NetworkPolicy {
    return { ...this.config.policy };
  }

  /**
   * Update policy configuration
   */
  updatePolicy(updates: Partial<NetworkPolicy>): void {
    this.config.policy = { ...this.config.policy, ...updates };
  }
}

// Singleton instance
let defaultPolicy: NetworkAccessPolicy | null = null;

/**
 * Get or create the default network policy
 */
export function getNetworkPolicy(config?: Partial<NetworkPolicyConfig>): NetworkAccessPolicy {
  if (!defaultPolicy) {
    defaultPolicy = new NetworkAccessPolicy(config);
  }
  return defaultPolicy;
}
