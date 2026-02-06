import { describe, it, expect, vi, afterEach } from "vitest";
import { createZhipuWebSearchTool } from "./zhipu-search.js";

describe("createZhipuWebSearchTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns missing_query when query is absent", async () => {
    const tool = createZhipuWebSearchTool({ apiKey: "test-key", mode: "mcp" });
    expect(tool).not.toBeNull();

    const result = await tool!.execute("tc1", {});
    expect(result.details).toMatchObject({
      error: "missing_query",
    });
  });

  it("returns missing_query when query is whitespace only", async () => {
    const tool = createZhipuWebSearchTool({ apiKey: "test-key", mode: "mcp" });
    expect(tool).not.toBeNull();

    const result = await tool!.execute("tc-whitespace", { query: "   " });
    expect(result.details).toMatchObject({
      error: "missing_query",
    });
  });

  it("parses count from string via shared param helper", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        search_result: [{ title: "t1", content: "c1", link: "https://example.com" }],
      }),
    } as Response);

    const tool = createZhipuWebSearchTool({ apiKey: "test-key", mode: "api" });
    expect(tool).not.toBeNull();

    const result = await tool!.execute("tc2", {
      query: "hello",
      count: "3",
    });

    expect(result.details).toMatchObject({
      provider: "zhipu",
      mode: "api",
      query: "hello",
      count: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init).toBeTruthy();
    expect(typeof init.body).toBe("string");
    expect(JSON.parse(String(init.body))).toMatchObject({
      search_query: "hello",
      count: 3,
    });
  });
});
