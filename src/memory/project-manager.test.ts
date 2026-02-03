import { describe, expect, it, vi } from "vitest";
import { ProjectMemoryManager } from "./project-manager.js";
import type { ProjectConfig } from "./project-scope.js";

// Mock the MemoryIndexManager
vi.mock("./manager.js", () => ({
  MemoryIndexManager: {
    get: vi.fn().mockResolvedValue(null),
  },
}));

describe("ProjectMemoryManager", () => {
  const projects: ProjectConfig[] = [
    { id: "backend", name: "Backend", channels: ["#backend"] },
    { id: "frontend", name: "Frontend", channels: ["#frontend"] },
  ];

  it("resolves project from channel", () => {
    const manager = new ProjectMemoryManager({
      agentId: "main",
      projects,
      cfg: {} as any,
    });

    const ctx = manager.resolveContext({ channelName: "#backend" });
    expect(ctx.projectId).toBe("backend");
    expect(ctx.source).toBe("channel");
  });

  it("allows explicit project override", () => {
    const manager = new ProjectMemoryManager({
      agentId: "main",
      projects,
      cfg: {} as any,
    });

    const ctx = manager.resolveContext({
      channelName: "#backend",
      explicitProjectId: "frontend",
    });
    expect(ctx.projectId).toBe("frontend");
    expect(ctx.source).toBe("explicit");
  });

  it("lists available projects", () => {
    const manager = new ProjectMemoryManager({
      agentId: "main",
      projects,
      cfg: {} as any,
    });

    const list = manager.listProjects();
    expect(list).toContain("backend");
    expect(list).toContain("frontend");
  });
});
