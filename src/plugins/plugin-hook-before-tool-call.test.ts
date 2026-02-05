import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { createHookRunner } from "./hooks.js";
import { loadOpenClawPlugins } from "./loader.js";

/**
 * Regression test: Plugin registers before_tool_call hook via api.registerHook(),
 * but createHookRunner(registry).runBeforeToolCall() never invokes it.
 *
 * Root cause: api.registerHook() routes to registerInternalHook() (the lifecycle
 * event system), NOT to registry.typedHooks (which createHookRunner reads from).
 *
 * This test MUST FAIL until the bug is fixed.
 */

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `openclaw-plugin-test-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function writePlugin(params: { id: string; body: string; dir?: string }) {
  const dir = params.dir ?? makeTempDir();
  const file = path.join(dir, `${params.id}.js`);
  fs.writeFileSync(file, params.body, "utf-8");
  fs.writeFileSync(
    path.join(dir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: params.id,
        configSchema: { type: "object", additionalProperties: false, properties: {} },
      },
      null,
      2,
    ),
    "utf-8",
  );
  return { dir, file, id: params.id };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

describe("plugin before_tool_call hook integration", () => {
  it("should invoke plugin-registered before_tool_call hook via hookRunner.runBeforeToolCall", async () => {
    const pluginDir = makeTempDir();
    writePlugin({
      id: "test-blocker",
      body: `
        export default function register(api) {
          api.registerHook("before_tool_call", async (event, ctx) => {
            if (event.toolName === "read") {
              return { block: true, blockReason: "blocked by test plugin" };
            }
          }, { name: "test-blocker-hook" });
        }
      `,
      dir: pluginDir,
    });

    const registry = loadOpenClawPlugins({
      cache: false,
      directories: [pluginDir],
      config: {
        plugins: {
          entries: {
            "test-blocker": { enabled: true },
          },
        },
        hooks: {
          internal: { enabled: true },
        },
      },
    });

    // Verify the plugin loaded
    const plugin = registry.plugins.find((p) => p.id === "test-blocker");
    expect(plugin?.status).toBe("loaded");

    // Create hook runner from the SAME registry
    const hookRunner = createHookRunner(registry, { catchErrors: false });

    // This is the critical test: does runBeforeToolCall actually invoke
    // the handler that was registered via api.registerHook()?
    const result = await hookRunner.runBeforeToolCall(
      { toolName: "read", params: { path: "/tmp/test.txt" } },
      { toolName: "read" },
    );

    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toBe("blocked by test plugin");
  });

  it("should allow plugin hook to modify tool params", async () => {
    const pluginDir = makeTempDir();
    writePlugin({
      id: "test-limiter",
      body: `
        export default function register(api) {
          api.registerHook("before_tool_call", async (event, ctx) => {
            if (event.toolName === "read") {
              return { params: { ...event.params, limit: 10 } };
            }
          }, { name: "test-limiter-hook" });
        }
      `,
      dir: pluginDir,
    });

    const registry = loadOpenClawPlugins({
      cache: false,
      directories: [pluginDir],
      config: {
        plugins: {
          entries: {
            "test-limiter": { enabled: true },
          },
        },
        hooks: {
          internal: { enabled: true },
        },
      },
    });

    const hookRunner = createHookRunner(registry, { catchErrors: false });

    const result = await hookRunner.runBeforeToolCall(
      { toolName: "read", params: { path: "/tmp/test.txt" } },
      { toolName: "read" },
    );

    expect(result?.params).toEqual({ path: "/tmp/test.txt", limit: 10 });
  });
});
