/**
 * Shared owner-URL validation for OBA signing, verification, and CLI.
 * One function to rule them all -- extract.ts, sign.ts, and keygen all call this.
 */

export type OwnerUrlOk = { ok: true; url: URL };
export type OwnerUrlErr = { ok: false; error: string };
export type OwnerUrlResult = OwnerUrlOk | OwnerUrlErr;

export function validateOwnerUrl(owner: string, opts?: { allowPrivate?: boolean }): OwnerUrlResult {
  if (!owner || typeof owner !== "string") {
    return { ok: false, error: "owner must be a non-empty string" };
  }

  let parsed: URL;
  try {
    parsed = new URL(owner);
  } catch {
    return { ok: false, error: "owner is not a valid URL" };
  }

  // Reject credentials in URL.
  if (parsed.username || parsed.password) {
    return { ok: false, error: "owner URL must not contain credentials" };
  }

  // Reject fragments (pointless, confusing).
  if (parsed.hash) {
    return { ok: false, error: "owner URL must not contain a fragment" };
  }

  // Normalize hostname: lowercase + strip trailing dot.
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  const allowInsecure = process.env.OPENCLAW_OBA_ALLOW_INSECURE_OWNER === "1";
  if (parsed.protocol !== "https:") {
    // Allow http://localhost or http://127.0.0.1 when OPENCLAW_OBA_ALLOW_INSECURE_OWNER=1
    const isLocalHttp =
      parsed.protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
    if (!allowInsecure || !isLocalHttp) {
      return { ok: false, error: "owner must be an HTTPS URL" };
    }
  }

  const allowPrivate = opts?.allowPrivate ?? process.env.OPENCLAW_OBA_ALLOW_PRIVATE_OWNER === "1";
  if (!allowPrivate && isPrivateHost(hostname)) {
    return { ok: false, error: "owner must not be a private/local host" };
  }

  return { ok: true, url: parsed };
}

/**
 * Best-effort private host detection for IP literals + well-known local names.
 * Does NOT cover hostnames that DNS-resolve to private IPs (e.g. mycorp.internal).
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".local")) {
    return true;
  }
  // IPv6 loopback / unspecified.
  if (h === "::1" || h === "::" || h === "::0") {
    return true;
  }
  // IPv4 private/reserved ranges.
  const parts = h.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number);
    // 127.x.x.x loopback
    if (a === 127) {
      return true;
    }
    // 10.x.x.x
    if (a === 10) {
      return true;
    }
    // 172.16-31.x.x
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    // 192.168.x.x
    if (a === 192 && b === 168) {
      return true;
    }
    // 169.254.x.x link-local
    if (a === 169 && b === 254) {
      return true;
    }
    // 100.64-127.x.x CGNAT
    if (a === 100 && b >= 64 && b <= 127) {
      return true;
    }
  }
  return false;
}
