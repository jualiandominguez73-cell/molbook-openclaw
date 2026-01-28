import { describe, expect, it } from "vitest";

import type { MoltbotConfig } from "../config/config.js";
import { createMoltbotTools } from "./moltbot-tools.js";

describe("createMoltbotTools (tidb)", () => {
  it("omits tidb tool when disabled", () => {
    const cfg: MoltbotConfig = {
      tools: {
        tidb: {
          enabled: false,
          url: "tidb://user:pass@example.com/mydb",
        },
      },
    };
    const tools = createMoltbotTools({ config: cfg });
    expect(tools.some((tool) => tool.name === "tidb")).toBe(false);
  });

  it("adds tidb tool when enabled + configured", () => {
    const cfg: MoltbotConfig = {
      tools: {
        tidb: {
          enabled: true,
          url: "tidb://user:pass@example.com/mydb",
        },
      },
    };
    const tools = createMoltbotTools({ config: cfg });
    expect(tools.some((tool) => tool.name === "tidb")).toBe(true);
  });

  it("adds tidb tool when enabled (even if url is missing)", () => {
    const cfg: MoltbotConfig = {
      tools: {
        tidb: {
          enabled: true,
        },
      },
    };
    const tools = createMoltbotTools({ config: cfg });
    expect(tools.some((tool) => tool.name === "tidb")).toBe(true);
  });
});
