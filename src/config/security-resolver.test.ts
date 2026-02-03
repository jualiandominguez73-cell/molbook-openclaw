/**
 * Tests for security configuration resolver.
 */

import { describe, it, expect } from "vitest";
import type { OpenClawConfig } from "./types.openclaw.js";
import {
  shouldDetectPromptInjection,
  shouldWrapPromptInjection,
  shouldLogPromptInjection,
  resolvePromptInjectionSettings,
} from "./security-resolver.js";
import type { InboundContentSource } from "../security/external-content.js";

describe("shouldDetectPromptInjection", () => {
  it("should return false when no security config exists", () => {
    const cfg: OpenClawConfig = {};
    expect(shouldDetectPromptInjection(cfg, "telegram")).toBe(false);
  });

  it("should return false when no prompt injection config exists", () => {
    const cfg: OpenClawConfig = { security: {} };
    expect(shouldDetectPromptInjection(cfg, "telegram")).toBe(false);
  });

  it("should return global setting when no channel override", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          detect: true,
        },
      },
    };
    expect(shouldDetectPromptInjection(cfg, "telegram")).toBe(true);
  });

  it("should return false for global setting when false", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          detect: false,
        },
      },
    };
    expect(shouldDetectPromptInjection(cfg, "telegram")).toBe(false);
  });

  it("should use channel override over global setting", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          detect: false,
          channels: {
            telegram: { detect: true },
          },
        },
      },
    };
    expect(shouldDetectPromptInjection(cfg, "telegram")).toBe(true);
  });

  it("should use global setting when channel override not specified", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          detect: true,
          channels: {
            discord: { detect: false },
          },
        },
      },
    };
    // Telegram uses global setting (true)
    expect(shouldDetectPromptInjection(cfg, "telegram")).toBe(true);
    // Discord uses channel override (false)
    expect(shouldDetectPromptInjection(cfg, "discord")).toBe(false);
  });

  it("should default to false for backward compatibility", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {},
      },
    };
    expect(shouldDetectPromptInjection(cfg, "telegram")).toBe(false);
  });

  it("should work for different sources", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          detect: true,
        },
      },
    };
    expect(shouldDetectPromptInjection(cfg, "email")).toBe(true);
    expect(shouldDetectPromptInjection(cfg, "webhook")).toBe(true);
    expect(shouldDetectPromptInjection(cfg, "slack")).toBe(true);
  });
});

describe("shouldWrapPromptInjection", () => {
  it("should return false when no security config exists", () => {
    const cfg: OpenClawConfig = {};
    expect(shouldWrapPromptInjection(cfg, "telegram")).toBe(false);
  });

  it("should return global setting when no channel override", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          wrap: true,
        },
      },
    };
    expect(shouldWrapPromptInjection(cfg, "telegram")).toBe(true);
  });

  it("should use channel override over global setting", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          wrap: false,
          channels: {
            telegram: { wrap: true },
          },
        },
      },
    };
    expect(shouldWrapPromptInjection(cfg, "telegram")).toBe(true);
  });

  it("should default to false", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {},
      },
    };
    expect(shouldWrapPromptInjection(cfg, "telegram")).toBe(false);
  });
});

describe("shouldLogPromptInjection", () => {
  it("should return true when no security config exists (default)", () => {
    const cfg: OpenClawConfig = {};
    expect(shouldLogPromptInjection(cfg, "telegram")).toBe(true);
  });

  it("should return global setting when no channel override", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          log: false,
        },
      },
    };
    expect(shouldLogPromptInjection(cfg, "telegram")).toBe(false);
  });

  it("should use channel override over global setting", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          log: true,
          channels: {
            telegram: { log: false },
          },
        },
      },
    };
    expect(shouldLogPromptInjection(cfg, "telegram")).toBe(false);
  });

  it("should default to true for security visibility", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {},
      },
    };
    expect(shouldLogPromptInjection(cfg, "telegram")).toBe(true);
  });
});

describe("resolvePromptInjectionSettings", () => {
  it("should resolve all settings correctly", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          detect: true,
          wrap: true,
          log: false,
        },
      },
    };
    const settings = resolvePromptInjectionSettings(cfg, "telegram");
    expect(settings.detect).toBe(true);
    expect(settings.wrap).toBe(true);
    expect(settings.log).toBe(false);
  });

  it("should resolve per-channel settings correctly", () => {
    const cfg: OpenClawConfig = {
      security: {
        promptInjection: {
          detect: false,
          wrap: false,
          log: true,
          channels: {
            telegram: { detect: true, wrap: true },
          },
        },
      },
    };
    const settings = resolvePromptInjectionSettings(cfg, "telegram");
    expect(settings.detect).toBe(true);
    expect(settings.wrap).toBe(true);
    expect(settings.log).toBe(true); // From global
  });
});
