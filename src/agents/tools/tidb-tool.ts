import { spawn } from "node:child_process";

import { Type } from "@sinclair/typebox";

import type { MoltbotConfig } from "../../config/config.js";
import { sanitizeBinaryOutput } from "../shell-utils.js";
import { optionalStringEnum } from "../schema/typebox.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

const OUTPUT_FORMATS = ["rows", "raw"] as const;

const TiDbSchema = Type.Object({
  sql: Type.String({
    description:
      "SQL to execute on TiDB via the mysql CLI. Use this for saving/querying large structured datasets (analysis, reporting, durable storage).",
  }),
  database: Type.Optional(
    Type.String({
      description: "Optional database/schema name override (defaults to URL pathname).",
    }),
  ),
  format: optionalStringEnum(OUTPUT_FORMATS, {
    description:
      'Output format: "rows" parses the first result set as TSV into JSON rows; "raw" returns stdout/stderr strings.',
    default: "rows",
  }),
  timeoutSeconds: Type.Optional(
    Type.Number({
      description:
        "Timeout for this mysql invocation in seconds (overrides tools.tidb.timeoutSeconds).",
      minimum: 1,
      maximum: 600,
    }),
  ),
});

export type ParsedTidbUrl = {
  scheme: "tidb" | "mysql";
  host: string;
  port: number;
  user?: string;
  password?: string;
  database?: string;
  params: Record<string, string>;
};

function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseTidbUrl(raw: string): ParsedTidbUrl {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("TiDB URL is empty.");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid TiDB URL: ${message}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  const scheme: ParsedTidbUrl["scheme"] =
    protocol === "tidb:" ? "tidb" : protocol === "mysql:" ? "mysql" : "mysql";
  if (protocol !== "tidb:" && protocol !== "mysql:") {
    throw new Error(`Unsupported TiDB URL scheme "${parsed.protocol}" (use tidb:// or mysql://).`);
  }

  const host = parsed.hostname.trim();
  if (!host) throw new Error("TiDB URL is missing hostname.");

  const defaultPort = scheme === "tidb" ? 4000 : 3306;
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : defaultPort;
  if (!Number.isFinite(port) || port <= 0) throw new Error("TiDB URL has an invalid port.");

  const user = parsed.username ? decodeUrlComponent(parsed.username) : undefined;
  const password = parsed.password ? decodeUrlComponent(parsed.password) : undefined;
  const database =
    parsed.pathname && parsed.pathname !== "/"
      ? decodeUrlComponent(parsed.pathname.slice(1))
      : undefined;

  const params: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams.entries()) {
    const k = key.trim();
    if (!k) continue;
    params[k] = value;
  }

  return { scheme, host, port, user, password, database, params };
}

function readBoolParam(params: Record<string, string>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    if (!(key in params)) continue;
    const raw = params[key]?.trim().toLowerCase();
    if (!raw) return undefined;
    if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
    if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  }
  return undefined;
}

function readStringParamFromMap(
  params: Record<string, string>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = params[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function resolveTidbSslMode(parsed: ParsedTidbUrl): string | undefined {
  const explicit = readStringParamFromMap(
    parsed.params,
    "ssl-mode",
    "sslMode",
    "sslmode",
    "ssl_mode",
  );
  if (explicit) return explicit.toUpperCase();

  const verifyIdentity = readBoolParam(
    parsed.params,
    "ssl_verify_identity",
    "sslVerifyIdentity",
    "ssl-verify-identity",
  );
  if (verifyIdentity === true) return "VERIFY_IDENTITY";

  const verifyCert = readBoolParam(
    parsed.params,
    "ssl_verify_cert",
    "sslVerifyCert",
    "ssl-verify-cert",
  );
  if (verifyCert === true) return "VERIFY_CA";

  const ssl = readBoolParam(parsed.params, "ssl", "tls");
  if (ssl === true) return "REQUIRED";

  // TiDB Cloud gateways commonly require TLS + hostname verification.
  if (parsed.host.toLowerCase().endsWith(".tidbcloud.com")) {
    return "VERIFY_IDENTITY";
  }

  return undefined;
}

function truncate(text: string, maxChars: number): string {
  const normalized = sanitizeBinaryOutput(text);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n… (truncated ${normalized.length - maxChars} chars)`;
}

function truncateSqlPreview(sql: string, maxChars = 4000): string {
  const normalized = sanitizeBinaryOutput(sql);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n… (sql truncated ${normalized.length - maxChars} chars)`;
}

function parseTsvToRows(stdout: string): {
  columns: string[];
  rows: Array<Record<string, string | null>>;
} {
  const lines = stdout
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };

  const header = lines[0].split("\t");
  const columns = header.map((c) => c.trim());
  const rows: Array<Record<string, string | null>> = [];

  for (const line of lines.slice(1)) {
    const values = line.split("\t");
    const row: Record<string, string | null> = {};
    for (let index = 0; index < columns.length; index += 1) {
      const key = columns[index] || `col_${index + 1}`;
      const value = values[index];
      row[key] = value === undefined ? null : value;
    }
    rows.push(row);
  }

  return { columns, rows };
}

type TiDbToolConfig = NonNullable<MoltbotConfig["tools"]>["tidb"];

function resolveTiDbToolConfig(cfg?: MoltbotConfig): TiDbToolConfig | undefined {
  const tidb = cfg?.tools?.tidb;
  if (!tidb || typeof tidb !== "object") return undefined;
  return tidb as TiDbToolConfig;
}

function resolveTidbUrlFromConfig(cfg?: TiDbToolConfig): string | undefined {
  const fromConfig = typeof cfg?.url === "string" ? cfg.url.trim() : "";
  return fromConfig || undefined;
}

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readEnvString(...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw !== "string") continue;
    const cleaned = stripOuterQuotes(raw);
    if (cleaned) return cleaned;
  }
  return undefined;
}

function resolveTidbUrl(cfg?: TiDbToolConfig): string | undefined {
  const fromConfig = resolveTidbUrlFromConfig(cfg);
  if (fromConfig) return fromConfig;

  return readEnvString("TIDB_URL")?.trim() || undefined;
}

function resolveTidbCommand(cfg?: TiDbToolConfig): string {
  const raw = typeof cfg?.command === "string" ? cfg.command.trim() : "";
  return raw || "mysql";
}

function resolveDefaultTimeoutSeconds(cfg?: TiDbToolConfig): number {
  const raw = typeof cfg?.timeoutSeconds === "number" ? cfg.timeoutSeconds : undefined;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.trunc(raw);
  return 30;
}

function resolveMaxOutputChars(cfg?: TiDbToolConfig): number {
  const raw = typeof cfg?.maxOutputChars === "number" ? cfg.maxOutputChars : undefined;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.trunc(raw);
  return 60_000;
}

export function createTiDbTool(options: { config?: MoltbotConfig }): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) return null;

  const tidbCfg = resolveTiDbToolConfig(cfg);
  if (!tidbCfg?.enabled) return null;

  const command = resolveTidbCommand(tidbCfg);
  const maxOutputChars = resolveMaxOutputChars(tidbCfg);

  return {
    label: "TiDB",
    name: "tidb",
    description:
      "Query or persist large structured data in TiDB (MySQL protocol) using the mysql CLI. Use this when results should be durable/queryable (analysis, reporting, large tables), not for small ephemeral notes.",
    parameters: TiDbSchema,
    execute: async (_toolCallId, params) => {
      const url = resolveTidbUrl(tidbCfg);
      if (!url) {
        return jsonResult({
          error: "missing_tidb_config",
          message:
            "TiDB tool is enabled but not configured. Copy the TiDB Cloud connection string (Connect panel -> General -> Connection String) into the gateway environment as TIDB_URL, or set tools.tidb.url.",
          docs: "https://docs.clawd.bot/tools/tidb",
        });
      }

      const sql = readStringParam(params, "sql", { required: true, trim: false });
      const databaseOverride = readStringParam(params, "database");
      const format = readStringParam(params, "format") as
        | (typeof OUTPUT_FORMATS)[number]
        | undefined;
      const timeoutSecondsOverride = readNumberParam(params, "timeoutSeconds", { integer: true });

      const parsed = parseTidbUrl(url);
      if (!parsed.user) {
        throw new Error(
          "TiDB connection must include a username (from tools.tidb.url or TIDB_URL).",
        );
      }

      const database = (databaseOverride?.trim() || parsed.database || "").trim() || undefined;
      const sslMode = resolveTidbSslMode(parsed);
      const sslCa = readStringParamFromMap(parsed.params, "ssl-ca", "sslCa", "ssl_ca");
      const sslCert = readStringParamFromMap(parsed.params, "ssl-cert", "sslCert", "ssl_cert");
      const sslKey = readStringParamFromMap(parsed.params, "ssl-key", "sslKey", "ssl_key");

      const connectTimeoutRaw = readStringParamFromMap(
        parsed.params,
        "connect-timeout",
        "connectTimeout",
        "connect_timeout",
      );
      const connectTimeout = connectTimeoutRaw ? Number.parseInt(connectTimeoutRaw, 10) : undefined;

      const argv: string[] = [
        command,
        "--host",
        parsed.host,
        "--port",
        String(parsed.port),
        "--user",
        parsed.user,
        "--protocol",
        "tcp",
        "--batch",
        "--raw",
      ];
      if (database) argv.push("--database", database);
      if (sslMode) argv.push("--ssl-mode", sslMode);
      if (sslCa) argv.push("--ssl-ca", sslCa);
      if (sslCert) argv.push("--ssl-cert", sslCert);
      if (sslKey) argv.push("--ssl-key", sslKey);
      if (
        typeof connectTimeout === "number" &&
        Number.isFinite(connectTimeout) &&
        connectTimeout > 0
      ) {
        argv.push("--connect-timeout", String(connectTimeout));
      }

      const outputFormat = format ?? "rows";
      if (outputFormat === "raw") {
        argv.push("--skip-column-names");
      } else {
        argv.push("--column-names");
      }

      argv.push("--execute", sql);

      const timeoutSeconds = Math.max(
        1,
        Math.min(600, timeoutSecondsOverride ?? resolveDefaultTimeoutSeconds(tidbCfg)),
      );

      const env: Record<string, string> = { ...process.env } as Record<string, string>;
      if (parsed.password) {
        env.MYSQL_PWD = parsed.password;
      }

      const startedAt = Date.now();
      const child = spawn(argv[0], argv.slice(1), { stdio: ["ignore", "pipe", "pipe"], env });

      let stdout = "";
      let stderr = "";
      let spawnError: string | null = null;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", (err) => {
        spawnError = err instanceof Error ? err.message : String(err);
      });

      const timedOut = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const timer = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore
          }
          finish(true);
        }, timeoutSeconds * 1000);
        const cleanup = () => {
          clearTimeout(timer);
          child.removeListener("exit", onExit);
          child.removeListener("error", onError);
        };
        const onExit = () => {
          cleanup();
          finish(false);
        };
        const onError = () => {
          cleanup();
          finish(false);
        };
        child.once("exit", onExit);
        child.once("error", onError);
      });

      const exitCode = typeof child.exitCode === "number" ? child.exitCode : null;
      const durationMs = Date.now() - startedAt;

      const stdoutTrimmed = truncate(stdout, maxOutputChars);
      const stderrTrimmed = truncate(stderr, maxOutputChars);

      const base = {
        ok: !timedOut && !spawnError && exitCode === 0,
        timedOut,
        spawnError,
        exitCode,
        durationMs,
        connection: {
          scheme: parsed.scheme,
          host: parsed.host,
          port: parsed.port,
          user: parsed.user,
          database,
          sslMode: sslMode ?? null,
        },
        command: argv[0],
        sqlPreview: truncateSqlPreview(sql),
        stdout: stdoutTrimmed,
        stderr: stderrTrimmed,
      } as const;

      if (outputFormat !== "rows") {
        return jsonResult(base);
      }

      const parsedRows = parseTsvToRows(stdoutTrimmed);
      return jsonResult({
        ...base,
        columns: parsedRows.columns,
        rows: parsedRows.rows,
      });
    },
  };
}
