import type { Command } from "commander";
import JSON5 from "json5";
import { readConfigFileSnapshot, writeConfigFile } from "../config/config.js";
import { danger, info } from "../globals.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { shortenHomePath } from "../utils.js";
import { formatCliCommand } from "./command-format.js";

type PathSegment = string;

function isIndexSegment(raw: string): boolean {
  return /^[0-9]+$/.test(raw);
}

type SecretMatch = {
  path: string;
  segments: PathSegment[];
  value: string;
  envVar: string;
  source: "mapped" | "generated";
  status: "static" | "env";
};

const SECRET_KEY_PATTERNS = [/token/i, /password/i, /secret/i, /api.?key/i];
const SECRET_KEY_EXACT = new Set(["serviceAccount"]);
const SECRET_KEY_SKIP_SUFFIXES = ["file", "path", "dir"];
const SECRET_ENV_OVERRIDES: Record<string, string> = {
  "gateway.auth.token": "OPENCLAW_GATEWAY_TOKEN",
  "gateway.auth.password": "OPENCLAW_GATEWAY_PASSWORD",
  "channels.telegram.botToken": "TELEGRAM_BOT_TOKEN",
  "channels.discord.token": "DISCORD_BOT_TOKEN",
  "channels.slack.botToken": "SLACK_BOT_TOKEN",
  "channels.slack.appToken": "SLACK_APP_TOKEN",
  "channels.line.channelAccessToken": "LINE_CHANNEL_ACCESS_TOKEN",
  "channels.line.channelSecret": "LINE_CHANNEL_SECRET",
  "tools.web.search.apiKey": "BRAVE_API_KEY",
  "tools.web.search.perplexity.apiKey": "PERPLEXITY_API_KEY",
  "tools.web.fetch.firecrawl.apiKey": "FIRECRAWL_API_KEY",
  "talk.apiKey": "ELEVENLABS_API_KEY",
  "messages.tts.elevenlabs.apiKey": "ELEVENLABS_API_KEY",
  "messages.tts.openai.apiKey": "OPENAI_API_KEY",
};
const PROVIDER_ENV_OVERRIDES: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  "vercel-ai-gateway": "AI_GATEWAY_API_KEY",
  minimax: "MINIMAX_API_KEY",
  xiaomi: "XIAOMI_API_KEY",
  synthetic: "SYNTHETIC_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
  deepgram: "DEEPGRAM_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  xai: "XAI_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
  venice: "VENICE_API_KEY",
  opencode: "OPENCODE_API_KEY",
};

function parsePath(raw: string): PathSegment[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  const parts: string[] = [];
  let current = "";
  let i = 0;
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (ch === "\\") {
      const next = trimmed[i + 1];
      if (next) {
        current += next;
      }
      i += 2;
      continue;
    }
    if (ch === ".") {
      if (current) {
        parts.push(current);
      }
      current = "";
      i += 1;
      continue;
    }
    if (ch === "[") {
      if (current) {
        parts.push(current);
      }
      current = "";
      const close = trimmed.indexOf("]", i);
      if (close === -1) {
        throw new Error(`Invalid path (missing "]"): ${raw}`);
      }
      const inside = trimmed.slice(i + 1, close).trim();
      if (!inside) {
        throw new Error(`Invalid path (empty "[]"): ${raw}`);
      }
      parts.push(inside);
      i = close + 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current) {
    parts.push(current);
  }
  return parts.map((part) => part.trim()).filter(Boolean);
}

function formatPath(segments: PathSegment[]): string {
  let out = "";
  for (const segment of segments) {
    if (isIndexSegment(segment)) {
      out += `[${segment}]`;
      continue;
    }
    out = out ? `${out}.${segment}` : segment;
  }
  return out;
}

function parseValue(raw: string, opts: { json?: boolean }): unknown {
  const trimmed = raw.trim();
  if (opts.json) {
    try {
      return JSON5.parse(trimmed);
    } catch (err) {
      throw new Error(`Failed to parse JSON5 value: ${String(err)}`, { cause: err });
    }
  }

  try {
    return JSON5.parse(trimmed);
  } catch {
    return raw;
  }
}

function getAtPath(root: unknown, path: PathSegment[]): { found: boolean; value?: unknown } {
  let current: unknown = root;
  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return { found: false };
    }
    if (Array.isArray(current)) {
      if (!isIndexSegment(segment)) {
        return { found: false };
      }
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        return { found: false };
      }
      current = current[index];
      continue;
    }
    const record = current as Record<string, unknown>;
    if (!(segment in record)) {
      return { found: false };
    }
    current = record[segment];
  }
  return { found: true, value: current };
}

function normalizeEnvPrefix(raw: string | undefined): string {
  const cleaned = (raw ?? "").trim() || "OPENCLAW_SECRET_";
  const withUnderscore = cleaned.endsWith("_") ? cleaned : `${cleaned}_`;
  return withUnderscore.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
}

function sanitizeEnvSegment(segment: string): string {
  if (!segment) {
    return "";
  }
  return segment
    .replace(/[^A-Za-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .toUpperCase();
}

function generateEnvVar(segments: PathSegment[], prefix: string): string {
  const tokens = segments.map((segment) => sanitizeEnvSegment(segment)).filter(Boolean);
  return `${prefix}${tokens.join("_")}`.replace(/_+/g, "_");
}

function parseEnvReference(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/);
  return match ? match[1] : null;
}

function isSensitiveKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (SECRET_KEY_SKIP_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return false;
  }
  if (SECRET_KEY_EXACT.has(trimmed)) {
    return true;
  }
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function resolveEnvVarForPath(
  segments: PathSegment[],
  prefix: string,
): { envVar: string; source: "mapped" | "generated" } {
  const path = formatPath(segments);
  const direct = SECRET_ENV_OVERRIDES[path];
  if (direct) {
    return { envVar: direct, source: "mapped" };
  }
  if (
    segments.length >= 4 &&
    segments[0] === "models" &&
    segments[1] === "providers" &&
    segments[3] === "apiKey"
  ) {
    const providerId = segments[2]?.toLowerCase() ?? "";
    const providerEnv = PROVIDER_ENV_OVERRIDES[providerId];
    if (providerEnv) {
      return { envVar: providerEnv, source: "mapped" };
    }
  }
  return { envVar: generateEnvVar(segments, prefix), source: "generated" };
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "<empty>";
  }
  if (trimmed.length <= 6) {
    return "***";
  }
  return `${trimmed.slice(0, 3)}...${trimmed.slice(-2)}`;
}

function collectSecretMatches(params: {
  root: unknown;
  prefix: string;
  includeEnvRefs?: boolean;
}): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const visit = (value: unknown, segments: PathSegment[]) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...segments, String(index)]));
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const nextSegments = [...segments, key];
      if (isSensitiveKey(key)) {
        const rawValue =
          typeof entry === "string"
            ? entry
            : SECRET_KEY_EXACT.has(key) && entry && typeof entry === "object"
              ? (() => {
                  try {
                    return JSON.stringify(entry);
                  } catch {
                    return "";
                  }
                })()
              : null;
        if (typeof rawValue === "string") {
          const envRef = parseEnvReference(rawValue);
          if (envRef && !params.includeEnvRefs) {
            continue;
          }
          const resolved = envRef
            ? { envVar: envRef, source: "mapped" as const }
            : resolveEnvVarForPath(nextSegments, params.prefix);
          matches.push({
            path: formatPath(nextSegments),
            segments: nextSegments,
            value: rawValue,
            envVar: resolved.envVar,
            source: resolved.source,
            status: envRef ? "env" : "static",
          });
          continue;
        }
      }
      visit(entry, nextSegments);
    }
  };
  visit(params.root, []);
  matches.sort((a, b) => a.path.localeCompare(b.path));
  const reserved = new Set(matches.filter((match) => match.status === "env").map((m) => m.envVar));
  const used = new Set<string>(reserved);
  const seenValueByEnv = new Map<string, string>();
  for (const match of matches) {
    if (match.status !== "static") {
      continue;
    }
    if (reserved.has(match.envVar)) {
      const base = generateEnvVar(match.segments, params.prefix);
      let candidate = base;
      let suffix = 2;
      while (used.has(candidate)) {
        candidate = `${base}_${suffix}`;
        suffix += 1;
      }
      match.envVar = candidate;
      match.source = "generated";
      used.add(candidate);
      seenValueByEnv.set(candidate, match.value);
      continue;
    }
    const existing = seenValueByEnv.get(match.envVar);
    if (!existing) {
      used.add(match.envVar);
      seenValueByEnv.set(match.envVar, match.value);
      continue;
    }
    if (existing === match.value) {
      continue;
    }
    const base = generateEnvVar(match.segments, params.prefix);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate) && seenValueByEnv.get(candidate) !== match.value) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    match.envVar = candidate;
    match.source = "generated";
    used.add(candidate);
    seenValueByEnv.set(candidate, match.value);
  }
  return matches;
}

function setAtPath(root: Record<string, unknown>, path: PathSegment[], value: unknown): void {
  let current: unknown = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    const next = path[i + 1];
    const nextIsIndex = Boolean(next && isIndexSegment(next));
    if (Array.isArray(current)) {
      if (!isIndexSegment(segment)) {
        throw new Error(`Expected numeric index for array segment "${segment}"`);
      }
      const index = Number.parseInt(segment, 10);
      const existing = current[index];
      if (!existing || typeof existing !== "object") {
        current[index] = nextIsIndex ? [] : {};
      }
      current = current[index];
      continue;
    }
    if (!current || typeof current !== "object") {
      throw new Error(`Cannot traverse into "${segment}" (not an object)`);
    }
    const record = current as Record<string, unknown>;
    const existing = record[segment];
    if (!existing || typeof existing !== "object") {
      record[segment] = nextIsIndex ? [] : {};
    }
    current = record[segment];
  }

  const last = path[path.length - 1];
  if (Array.isArray(current)) {
    if (!isIndexSegment(last)) {
      throw new Error(`Expected numeric index for array segment "${last}"`);
    }
    const index = Number.parseInt(last, 10);
    current[index] = value;
    return;
  }
  if (!current || typeof current !== "object") {
    throw new Error(`Cannot set "${last}" (parent is not an object)`);
  }
  (current as Record<string, unknown>)[last] = value;
}

function unsetAtPath(root: Record<string, unknown>, path: PathSegment[]): boolean {
  let current: unknown = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    if (!current || typeof current !== "object") {
      return false;
    }
    if (Array.isArray(current)) {
      if (!isIndexSegment(segment)) {
        return false;
      }
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }
    const record = current as Record<string, unknown>;
    if (!(segment in record)) {
      return false;
    }
    current = record[segment];
  }

  const last = path[path.length - 1];
  if (Array.isArray(current)) {
    if (!isIndexSegment(last)) {
      return false;
    }
    const index = Number.parseInt(last, 10);
    if (!Number.isFinite(index) || index < 0 || index >= current.length) {
      return false;
    }
    current.splice(index, 1);
    return true;
  }
  if (!current || typeof current !== "object") {
    return false;
  }
  const record = current as Record<string, unknown>;
  if (!(last in record)) {
    return false;
  }
  delete record[last];
  return true;
}

async function loadValidConfig() {
  const snapshot = await readConfigFileSnapshot();
  if (snapshot.valid) {
    return snapshot;
  }
  defaultRuntime.error(`Config invalid at ${shortenHomePath(snapshot.path)}.`);
  for (const issue of snapshot.issues) {
    defaultRuntime.error(`- ${issue.path || "<root>"}: ${issue.message}`);
  }
  defaultRuntime.error(`Run \`${formatCliCommand("openclaw doctor")}\` to repair, then retry.`);
  defaultRuntime.exit(1);
  return snapshot;
}

export function registerConfigCli(program: Command) {
  const cmd = program
    .command("config")
    .description("Config helpers (get/set/unset). Run without subcommand for the wizard.")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/config", "docs.openclaw.ai/cli/config")}\n`,
    )
    .option(
      "--section <section>",
      "Configure wizard sections (repeatable). Use with no subcommand.",
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .action(async (opts) => {
      const { CONFIGURE_WIZARD_SECTIONS, configureCommand, configureCommandWithSections } =
        await import("../commands/configure.js");
      const sections: string[] = Array.isArray(opts.section)
        ? opts.section
            .map((value: unknown) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean)
        : [];
      if (sections.length === 0) {
        await configureCommand(defaultRuntime);
        return;
      }

      const invalid = sections.filter((s) => !CONFIGURE_WIZARD_SECTIONS.includes(s as never));
      if (invalid.length > 0) {
        defaultRuntime.error(
          `Invalid --section: ${invalid.join(", ")}. Expected one of: ${CONFIGURE_WIZARD_SECTIONS.join(", ")}.`,
        );
        defaultRuntime.exit(1);
        return;
      }

      await configureCommandWithSections(sections as never, defaultRuntime);
    });

  cmd
    .command("get")
    .description("Get a config value by dot path")
    .argument("<path>", "Config path (dot or bracket notation)")
    .option("--json", "Output JSON", false)
    .action(async (path: string, opts) => {
      try {
        const parsedPath = parsePath(path);
        if (parsedPath.length === 0) {
          throw new Error("Path is empty.");
        }
        const snapshot = await loadValidConfig();
        const res = getAtPath(snapshot.config, parsedPath);
        if (!res.found) {
          defaultRuntime.error(danger(`Config path not found: ${path}`));
          defaultRuntime.exit(1);
          return;
        }
        if (opts.json) {
          defaultRuntime.log(JSON.stringify(res.value ?? null, null, 2));
          return;
        }
        if (
          typeof res.value === "string" ||
          typeof res.value === "number" ||
          typeof res.value === "boolean"
        ) {
          defaultRuntime.log(String(res.value));
          return;
        }
        defaultRuntime.log(JSON.stringify(res.value ?? null, null, 2));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  cmd
    .command("set")
    .description("Set a config value by dot path")
    .argument("<path>", "Config path (dot or bracket notation)")
    .argument("<value>", "Value (JSON5 or raw string)")
    .option("--json", "Parse value as JSON5 (required)", false)
    .action(async (path: string, value: string, opts) => {
      try {
        const parsedPath = parsePath(path);
        if (parsedPath.length === 0) {
          throw new Error("Path is empty.");
        }
        const parsedValue = parseValue(value, opts);
        const snapshot = await loadValidConfig();
        const next = snapshot.config as Record<string, unknown>;
        setAtPath(next, parsedPath, parsedValue);
        await writeConfigFile(next);
        defaultRuntime.log(info(`Updated ${path}. Restart the gateway to apply.`));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  cmd
    .command("unset")
    .description("Remove a config value by dot path")
    .argument("<path>", "Config path (dot or bracket notation)")
    .action(async (path: string) => {
      try {
        const parsedPath = parsePath(path);
        if (parsedPath.length === 0) {
          throw new Error("Path is empty.");
        }
        const snapshot = await loadValidConfig();
        const next = snapshot.config as Record<string, unknown>;
        const removed = unsetAtPath(next, parsedPath);
        if (!removed) {
          defaultRuntime.error(danger(`Config path not found: ${path}`));
          defaultRuntime.exit(1);
          return;
        }
        await writeConfigFile(next);
        defaultRuntime.log(info(`Removed ${path}. Restart the gateway to apply.`));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  const secrets = cmd
    .command("secrets")
    .description("Plan/apply env var migrations for sensitive config values");

  secrets
    .command("plan")
    .description("List secrets in config and suggested env vars")
    .option("--prefix <prefix>", "Env var prefix for generated names", "OPENCLAW_SECRET_")
    .action(async (opts) => {
      try {
        const snapshot = await loadValidConfig();
        const prefix = normalizeEnvPrefix(opts.prefix);
        const matches = collectSecretMatches({
          root: snapshot.config,
          prefix,
          includeEnvRefs: true,
        });
        if (matches.length === 0) {
          defaultRuntime.log(info("No secret values found in config."));
          return;
        }
        const pending = matches.filter((match) => match.status === "static");
        const existing = matches.filter((match) => match.status === "env");
        defaultRuntime.log(
          info(
            `Found ${matches.length} secret value(s) in ${shortenHomePath(
              snapshot.path,
            )} (${pending.length} to migrate).`,
          ),
        );
        for (const match of matches) {
          const status =
            match.status === "env" ? "already env" : `value ${maskSecret(match.value)}`;
          const source = match.source === "mapped" ? "mapped" : "generated";
          defaultRuntime.log(`- ${match.path} -> ${match.envVar} (${status}; ${source})`);
        }
        if (pending.length > 0) {
          defaultRuntime.log(
            info(
              `Store these env vars in 1Password (op run / op inject) or another manager, then run "${formatCliCommand(
                "openclaw config secrets apply",
              )}".`,
            ),
          );
        } else if (existing.length > 0) {
          defaultRuntime.log(info("All detected secrets already use env references."));
        }
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  secrets
    .command("apply")
    .description("Replace secret values with ${ENV_VAR} references")
    .option("--prefix <prefix>", "Env var prefix for generated names", "OPENCLAW_SECRET_")
    .action(async (opts) => {
      try {
        const snapshot = await loadValidConfig();
        const prefix = normalizeEnvPrefix(opts.prefix);
        const matches = collectSecretMatches({
          root: snapshot.config,
          prefix,
          includeEnvRefs: false,
        });
        if (matches.length === 0) {
          defaultRuntime.log(info("No secret values found to migrate."));
          return;
        }
        const next = snapshot.config as Record<string, unknown>;
        for (const match of matches) {
          setAtPath(next, match.segments, `\${${match.envVar}}`);
        }
        await writeConfigFile(next);
        defaultRuntime.log(
          info(
            `Updated ${matches.length} secret value(s). Set the env vars before restarting the gateway.`,
          ),
        );
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });
}
