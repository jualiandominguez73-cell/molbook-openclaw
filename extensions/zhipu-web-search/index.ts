import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import type { ZhipuSearchToolOptions } from "./src/zhipu-search.js";
import type { ZhipuEngine, ZhipuContentSize, ZhipuMode } from "./src/types.js";
import { createZhipuWebSearchTool } from "./src/zhipu-search.js";

/** Valid Zhipu search engine identifiers. */
const VALID_ENGINES = new Set(["search_std", "search_pro", "search_pro_sogou", "search_pro_quark"]);
/** Valid content size options. */
const VALID_CONTENT_SIZES = new Set(["medium", "high"]);
/** Valid mode options. */
const VALID_MODES = new Set(["api", "mcp"]);

interface ZhipuPluginConfig {
  apiKey?: string;
  engine?: string;
  contentSize?: string;
  mode?: string;
}

function isZhipuPluginConfig(val: unknown): val is ZhipuPluginConfig {
  return typeof val === "object" && val !== null;
}

export default function register(api: OpenClawPluginApi) {
  api.registerTool((ctx) => {
    const raw = api.pluginConfig;
    const config = isZhipuPluginConfig(raw) ? raw : undefined;

    const opts: ZhipuSearchToolOptions = {
      apiKey: resolveApiKey(config),
      engine: resolveEngine(config),
      contentSize: resolveContentSize(config),
      mode: resolveMode(config),
      logger: api.logger,
    };

    return createZhipuWebSearchTool(opts);
  });
}

function resolveApiKey(config?: ZhipuPluginConfig): string | undefined {
  const fromConfig =
    config && typeof config.apiKey === "string" ? config.apiKey.trim() : undefined;
  if (fromConfig) return fromConfig;
  const fromEnv = process.env.ZHIPU_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return undefined;
}

function resolveEngine(config?: ZhipuPluginConfig): ZhipuEngine {
  const raw = config && typeof config.engine === "string" ? config.engine.trim() : "";
  if (VALID_ENGINES.has(raw)) {
    return raw as ZhipuEngine;
  }
  return "search_std";
}

function resolveContentSize(config?: ZhipuPluginConfig): ZhipuContentSize {
  const raw =
    config && typeof config.contentSize === "string" ? config.contentSize.trim() : "";
  if (VALID_CONTENT_SIZES.has(raw)) {
    return raw as ZhipuContentSize;
  }
  return "medium";
}

function resolveMode(config?: ZhipuPluginConfig): ZhipuMode {
  const raw = config && typeof config.mode === "string" ? config.mode.trim().toLowerCase() : "";
  if (VALID_MODES.has(raw)) {
    return raw as ZhipuMode;
  }
  return "api";
}
