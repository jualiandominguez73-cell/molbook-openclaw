import { describe, expect, it } from "vitest";
import {
  authorizeGatewayConnect,
  validateHostHeader,
  shouldTrustLocalhost,
  type ResolvedGatewayAuth,
} from "./auth.js";

describe("gateway auth", () => {
  it("does not throw when req is missing socket", async () => {
    const res = await authorizeGatewayConnect({
      auth: {
        mode: "token",
        token: "secret",
        allowTailscale: false,
        trustLocalhost: false,
        allowedHosts: [],
      },
      connectAuth: { token: "secret" },
      // Regression: avoid crashing on req.socket.remoteAddress when callers pass a non-IncomingMessage.
      req: {} as never,
    });
    expect(res.ok).toBe(true);
  });

  it("reports missing and mismatched token reasons", async () => {
    const missing = await authorizeGatewayConnect({
      auth: {
        mode: "token",
        token: "secret",
        allowTailscale: false,
        trustLocalhost: false,
        allowedHosts: [],
      },
      connectAuth: null,
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("token_missing");

    const mismatch = await authorizeGatewayConnect({
      auth: {
        mode: "token",
        token: "secret",
        allowTailscale: false,
        trustLocalhost: false,
        allowedHosts: [],
      },
      connectAuth: { token: "wrong" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("token_mismatch");
  });

  it("reports missing token config reason", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", allowTailscale: false, trustLocalhost: false, allowedHosts: [] },
      connectAuth: { token: "anything" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_missing_config");
  });

  it("reports missing and mismatched password reasons", async () => {
    const missing = await authorizeGatewayConnect({
      auth: {
        mode: "password",
        password: "secret",
        allowTailscale: false,
        trustLocalhost: false,
        allowedHosts: [],
      },
      connectAuth: null,
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("password_missing");

    const mismatch = await authorizeGatewayConnect({
      auth: {
        mode: "password",
        password: "secret",
        allowTailscale: false,
        trustLocalhost: false,
        allowedHosts: [],
      },
      connectAuth: { password: "wrong" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("password_mismatch");
  });

  it("reports missing password config reason", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", allowTailscale: false, trustLocalhost: false, allowedHosts: [] },
      connectAuth: { password: "secret" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("password_missing_config");
  });

  it("treats local tailscale serve hostnames as direct", async () => {
    const res = await authorizeGatewayConnect({
      auth: {
        mode: "token",
        token: "secret",
        allowTailscale: true,
        trustLocalhost: false,
        allowedHosts: [],
      },
      connectAuth: { token: "secret" },
      req: {
        socket: { remoteAddress: "127.0.0.1" },
        headers: { host: "gateway.tailnet-1234.ts.net:443" },
      } as never,
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("allows tailscale identity to satisfy token mode auth", async () => {
    const res = await authorizeGatewayConnect({
      auth: {
        mode: "token",
        token: "secret",
        allowTailscale: true,
        trustLocalhost: false,
        allowedHosts: [],
      },
      connectAuth: null,
      tailscaleWhois: async () => ({ login: "peter", name: "Peter" }),
      req: {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          host: "gateway.local",
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "ai-hub.bone-egret.ts.net",
          "tailscale-user-login": "peter",
          "tailscale-user-name": "Peter",
        },
      } as never,
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("tailscale");
    expect(res.user).toBe("peter");
  });
});

describe("validateHostHeader", () => {
  it("rejects missing request", () => {
    const result = validateHostHeader(undefined, ["localhost"]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("no_request");
  });

  it("rejects missing host header", () => {
    const result = validateHostHeader({ headers: {} } as never, ["localhost"]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("host_missing");
  });

  it("accepts localhost when in allowed list", () => {
    const result = validateHostHeader({ headers: { host: "localhost:3000" } } as never, [
      "localhost",
      "127.0.0.1",
    ]);
    expect(result.valid).toBe(true);
    expect(result.host).toBe("localhost");
  });

  it("rejects host not in allowed list (DNS rebinding protection)", () => {
    const result = validateHostHeader({ headers: { host: "evil.attacker.com" } } as never, [
      "localhost",
      "127.0.0.1",
    ]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("host_not_allowed");
    expect(result.host).toBe("evil.attacker.com");
  });

  it("allows tailscale hosts with wildcard pattern", () => {
    const result = validateHostHeader(
      { headers: { host: "myhost.tailnet-abc.ts.net:443" } } as never,
      ["localhost", "*.ts.net"],
    );
    expect(result.valid).toBe(true);
    expect(result.host).toBe("myhost.tailnet-abc.ts.net");
  });

  it("accepts any host when allowed list is empty", () => {
    const result = validateHostHeader({ headers: { host: "anything.com" } } as never, []);
    expect(result.valid).toBe(true);
  });
});

describe("shouldTrustLocalhost", () => {
  const makeAuth = (trustLocalhost: boolean): ResolvedGatewayAuth => ({
    mode: "token",
    token: "secret",
    allowTailscale: false,
    trustLocalhost,
    allowedHosts: ["localhost", "127.0.0.1", "::1"],
  });

  it("returns false when trustLocalhost is disabled (default)", () => {
    const result = shouldTrustLocalhost(
      {
        socket: { remoteAddress: "127.0.0.1" },
        headers: { host: "localhost:3000" },
      } as never,
      makeAuth(false),
      [],
    );
    expect(result).toBe(false);
  });

  it("returns true only when trustLocalhost is explicitly enabled", () => {
    const result = shouldTrustLocalhost(
      {
        socket: { remoteAddress: "127.0.0.1" },
        headers: { host: "localhost:3000" },
      } as never,
      makeAuth(true),
      [],
    );
    expect(result).toBe(true);
  });

  it("returns false for remote connections even with trustLocalhost enabled", () => {
    const result = shouldTrustLocalhost(
      {
        socket: { remoteAddress: "203.0.113.1" },
        headers: { host: "localhost:3000" },
      } as never,
      makeAuth(true),
      [],
    );
    expect(result).toBe(false);
  });

  it("returns false when Host header fails validation (DNS rebinding)", () => {
    const result = shouldTrustLocalhost(
      {
        socket: { remoteAddress: "127.0.0.1" },
        headers: { host: "evil.attacker.com" },
      } as never,
      makeAuth(true),
      [],
    );
    expect(result).toBe(false);
  });
});
