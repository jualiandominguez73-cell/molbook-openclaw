import { describe, expect, it } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";
import {
  categorizeTool,
  detectToolCategoriesFromMessage,
  filterToolsByCategories,
  TOOL_CATEGORIES,
} from "./tool-categories.js";

// Mock tools for testing
const createMockTool = (name: string): AnyAgentTool =>
  ({
    name,
    label: name,
    description: `Mock tool ${name}`,
    parameters: {},
    execute: async () => ({ success: true }),
  }) as AnyAgentTool;

describe("categorizeTool", () => {
  it("categorizes core tools correctly", () => {
    expect(categorizeTool("read")).toBe(TOOL_CATEGORIES.CORE);
    expect(categorizeTool("write")).toBe(TOOL_CATEGORIES.CORE);
    expect(categorizeTool("edit")).toBe(TOOL_CATEGORIES.CORE);
    expect(categorizeTool("grep")).toBe(TOOL_CATEGORIES.CORE);
    expect(categorizeTool("find")).toBe(TOOL_CATEGORIES.CORE);
    expect(categorizeTool("ls")).toBe(TOOL_CATEGORIES.CORE);
    expect(categorizeTool("exec")).toBe(TOOL_CATEGORIES.CORE);
    expect(categorizeTool("process")).toBe(TOOL_CATEGORIES.CORE);
  });

  it("categorizes web tools correctly", () => {
    expect(categorizeTool("web_search")).toBe(TOOL_CATEGORIES.WEB);
    expect(categorizeTool("web_fetch")).toBe(TOOL_CATEGORIES.WEB);
    expect(categorizeTool("browser")).toBe(TOOL_CATEGORIES.WEB);
  });

  it("categorizes channel tools correctly", () => {
    expect(categorizeTool("message")).toBe(TOOL_CATEGORIES.CHANNELS);
    expect(categorizeTool("cron")).toBe(TOOL_CATEGORIES.CHANNELS);
    expect(categorizeTool("tts")).toBe(TOOL_CATEGORIES.CHANNELS);
  });

  it("categorizes session tools correctly", () => {
    expect(categorizeTool("sessions_list")).toBe(TOOL_CATEGORIES.SESSIONS);
    expect(categorizeTool("sessions_send")).toBe(TOOL_CATEGORIES.SESSIONS);
    expect(categorizeTool("sessions_spawn")).toBe(TOOL_CATEGORIES.SESSIONS);
    expect(categorizeTool("sessions_history")).toBe(TOOL_CATEGORIES.SESSIONS);
    expect(categorizeTool("session_status")).toBe(TOOL_CATEGORIES.SESSIONS);
    expect(categorizeTool("agents_list")).toBe(TOOL_CATEGORIES.SESSIONS);
  });

  it("categorizes infra tools correctly", () => {
    expect(categorizeTool("gateway")).toBe(TOOL_CATEGORIES.INFRA);
    expect(categorizeTool("nodes")).toBe(TOOL_CATEGORIES.INFRA);
    expect(categorizeTool("canvas")).toBe(TOOL_CATEGORIES.INFRA);
  });

  it("categorizes vision tools correctly", () => {
    expect(categorizeTool("image")).toBe(TOOL_CATEGORIES.VISION);
  });

  it("returns UNKNOWN for unrecognized tools", () => {
    expect(categorizeTool("unknown_tool")).toBe(TOOL_CATEGORIES.UNKNOWN);
    expect(categorizeTool("custom_plugin")).toBe(TOOL_CATEGORIES.UNKNOWN);
  });
});

describe("detectToolCategoriesFromMessage", () => {
  it("always includes CORE category", () => {
    const result = detectToolCategoriesFromMessage("hello world");
    expect(result).toContain(TOOL_CATEGORIES.CORE);
  });

  it("detects web category from keywords", () => {
    const webKeywords = [
      "search",
      "google",
      "website",
      "http",
      "url",
      "browser",
      "web",
      "internet",
      "site",
    ];

    for (const keyword of webKeywords) {
      const result = detectToolCategoriesFromMessage(`Please ${keyword} something`);
      expect(result).toContain(TOOL_CATEGORIES.WEB);
    }
  });

  it("detects channels category from keywords", () => {
    const channelKeywords = [
      "telegram",
      "discord",
      "slack",
      "whatsapp",
      "signal",
      "message",
      "send",
      "channel",
      "remind",
      "schedule",
    ];

    for (const keyword of channelKeywords) {
      const result = detectToolCategoriesFromMessage(`Send a ${keyword} please`);
      expect(result).toContain(TOOL_CATEGORIES.CHANNELS);
    }
  });

  it("detects sessions category from keywords", () => {
    const sessionKeywords = ["session", "agent", "spawn", "subagent", "history"];

    for (const keyword of sessionKeywords) {
      const result = detectToolCategoriesFromMessage(`Check ${keyword}`);
      expect(result).toContain(TOOL_CATEGORIES.SESSIONS);
    }
  });

  it("detects infra category from keywords", () => {
    const infraKeywords = ["gateway", "restart", "config", "node", "camera", "screen"];

    for (const keyword of infraKeywords) {
      const result = detectToolCategoriesFromMessage(`Use ${keyword}`);
      expect(result).toContain(TOOL_CATEGORIES.INFRA);
    }
  });

  it("detects vision category from image mentions", () => {
    const visionKeywords = ["image", "picture", "photo", "analyze image", "vision"];

    for (const keyword of visionKeywords) {
      const result = detectToolCategoriesFromMessage(`Analyze this ${keyword}`);
      expect(result).toContain(TOOL_CATEGORIES.VISION);
    }
  });

  it("detects multiple categories", () => {
    const result = detectToolCategoriesFromMessage("Search the web and send a message to telegram");

    expect(result).toContain(TOOL_CATEGORIES.CORE);
    expect(result).toContain(TOOL_CATEGORIES.WEB);
    expect(result).toContain(TOOL_CATEGORIES.CHANNELS);
    expect(result).not.toContain(TOOL_CATEGORIES.SESSIONS);
    expect(result).not.toContain(TOOL_CATEGORIES.INFRA);
  });

  it("returns only CORE for generic messages", () => {
    const genericMessages = [
      "Hello",
      "How are you?",
      "Create a file",
      "Run this command",
      "Edit the code",
    ];

    for (const message of genericMessages) {
      const result = detectToolCategoriesFromMessage(message);
      expect(result).toEqual([TOOL_CATEGORIES.CORE]);
    }
  });
});

describe("filterToolsByCategories", () => {
  const mockTools: AnyAgentTool[] = [
    createMockTool("read"),
    createMockTool("write"),
    createMockTool("web_search"),
    createMockTool("browser"),
    createMockTool("message"),
    createMockTool("cron"),
    createMockTool("sessions_list"),
    createMockTool("gateway"),
    createMockTool("image"),
    createMockTool("custom_plugin"),
  ];

  it("filters tools by single category", () => {
    const result = filterToolsByCategories(mockTools, [TOOL_CATEGORIES.CORE]);

    expect(result.map((t) => t.name)).toContain("read");
    expect(result.map((t) => t.name)).toContain("write");
    expect(result.map((t) => t.name)).not.toContain("web_search");
    expect(result.map((t) => t.name)).not.toContain("message");
  });

  it("filters tools by multiple categories", () => {
    const result = filterToolsByCategories(mockTools, [TOOL_CATEGORIES.CORE, TOOL_CATEGORIES.WEB]);

    expect(result.map((t) => t.name)).toContain("read");
    expect(result.map((t) => t.name)).toContain("web_search");
    expect(result.map((t) => t.name)).toContain("browser");
    expect(result.map((t) => t.name)).not.toContain("message");
    expect(result.map((t) => t.name)).not.toContain("gateway");
  });

  it("includes UNKNOWN category tools", () => {
    const result = filterToolsByCategories(mockTools, [TOOL_CATEGORIES.CORE]);

    // Unknown/plugin tools should always be included
    expect(result.map((t) => t.name)).toContain("custom_plugin");
  });

  it("returns empty array for empty input", () => {
    const result = filterToolsByCategories([], [TOOL_CATEGORIES.CORE]);
    expect(result).toEqual([]);
  });

  it("returns all tools when all categories specified", () => {
    const allCategories = Object.values(TOOL_CATEGORIES);
    const result = filterToolsByCategories(mockTools, allCategories);

    expect(result).toHaveLength(mockTools.length);
  });
});

describe("Integration: message to filtered tools", () => {
  const allTools: AnyAgentTool[] = [
    createMockTool("read"),
    createMockTool("write"),
    createMockTool("edit"),
    createMockTool("web_search"),
    createMockTool("web_fetch"),
    createMockTool("browser"),
    createMockTool("message"),
    createMockTool("cron"),
    createMockTool("sessions_list"),
    createMockTool("sessions_spawn"),
    createMockTool("gateway"),
    createMockTool("nodes"),
    createMockTool("image"),
  ];

  it("reduces tools for generic message", () => {
    const categories = detectToolCategoriesFromMessage("Create a file");
    const filtered = filterToolsByCategories(allTools, categories);

    // Should only have core tools
    expect(filtered.map((t) => t.name)).toContain("read");
    expect(filtered.map((t) => t.name)).toContain("write");
    expect(filtered.map((t) => t.name)).not.toContain("web_search");
    expect(filtered.map((t) => t.name)).not.toContain("message");
    expect(filtered.map((t) => t.name)).not.toContain("gateway");

    // Should reduce from 13 to ~4 tools
    expect(filtered.length).toBeLessThan(allTools.length);
  });

  it("includes web tools for web-related message", () => {
    const categories = detectToolCategoriesFromMessage("Search on Google");
    const filtered = filterToolsByCategories(allTools, categories);

    expect(filtered.map((t) => t.name)).toContain("web_search");
    expect(filtered.map((t) => t.name)).toContain("web_fetch");
    expect(filtered.map((t) => t.name)).toContain("browser");
  });

  it("includes channel tools for messaging request", () => {
    const categories = detectToolCategoriesFromMessage("Send telegram message");
    const filtered = filterToolsByCategories(allTools, categories);

    expect(filtered.map((t) => t.name)).toContain("message");
    expect(filtered.map((t) => t.name)).toContain("cron");
  });

  it("estimates token reduction", () => {
    const genericMessage = "Edit this file";
    const categories = detectToolCategoriesFromMessage(genericMessage);
    const filtered = filterToolsByCategories(allTools, categories);

    const reduction = allTools.length - filtered.length;
    const reductionPercent = (reduction / allTools.length) * 100;

    // Should reduce by at least 50% for generic messages
    expect(reductionPercent).toBeGreaterThan(50);
  });
});
