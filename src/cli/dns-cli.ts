import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../config/config.js";
import { pickPrimaryTailnetIPv4, pickPrimaryTailnetIPv6 } from "../infra/tailnet.js";
import { getWideAreaZonePath, resolveWideAreaDiscoveryDomain } from "../infra/widearea-dns.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";

type RunOpts = { allowFailure?: boolean; inherit?: boolean };

function run(cmd: string, args: string[], opts?: RunOpts): string {
  const res = spawnSync(cmd, args, {
    encoding: "utf-8",
    stdio: opts?.inherit ? "inherit" : "pipe",
  });
  if (res.error) throw res.error;
  if (!opts?.allowFailure && res.status !== 0) {
    const errText =
      typeof res.stderr === "string" && res.stderr.trim()
        ? res.stderr.trim()
        : `exit ${res.status ?? "unknown"}`;
    throw new Error(`${cmd} ${args.join(" ")} failed: ${errText}`);
  }
  return typeof res.stdout === "string" ? res.stdout : "";
}

function writeFileSudoIfNeeded(filePath: string, content: string): void {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    return;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "EACCES" && code !== "EPERM") {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  const res = spawnSync("sudo", ["tee", filePath], {
    input: content,
    encoding: "utf-8",
    stdio: ["pipe", "ignore", "inherit"],
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`sudo tee ${filePath} failed: exit ${res.status ?? "unknown"}`);
  }
}

function mkdirSudoIfNeeded(dirPath: string): void {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "EACCES" && code !== "EPERM") {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  run("sudo", ["mkdir", "-p", dirPath], { inherit: true });
}

function zoneFileNeedsBootstrap(zonePath: string): boolean {
  if (!fs.existsSync(zonePath)) return true;
  try {
    const content = fs.readFileSync(zonePath, "utf-8");
    return !/\bSOA\b/.test(content) || !/\bNS\b/.test(content);
  } catch {
    return true;
  }
}

function detectBrewPrefix(): string {
  const out = run("brew", ["--prefix"]);
  const prefix = out.trim();
  if (!prefix) throw new Error("无法解析 Homebrew 前缀");
  return prefix;
}

function ensureImportLine(corefilePath: string, importGlob: string): boolean {
  const existing = fs.readFileSync(corefilePath, "utf-8");
  if (existing.includes(importGlob)) return false;
  const next = `${existing.replace(/\s*$/, "")}\n\nimport ${importGlob}\n`;
  writeFileSudoIfNeeded(corefilePath, next);
  return true;
}

export function registerDnsCli(program: Command) {
  const dns = program
    .command("dns")
    .description("用于广域发现的 DNS 助手 (Tailscale + CoreDNS)")
    .addHelpText(
      "after",
      () => `\n${theme.muted("文档:")} ${formatDocsLink("/cli/dns", "docs.openclaw.ai/cli/dns")}\n`,
    );

  dns
    .command("setup")
    .description(
      "设置 CoreDNS 以服务于单播 DNS-SD (广域 Bonjour) 的发现域",
    )
    .option("--domain <domain>", "广域发现域 (例如 openclaw.internal)")
    .option(
      "--apply",
      "安装/更新 CoreDNS 配置并(重新)启动服务 (需要 sudo)",
      false,
    )
    .action(async (opts) => {
      const cfg = loadConfig();
      const tailnetIPv4 = pickPrimaryTailnetIPv4();
      const tailnetIPv6 = pickPrimaryTailnetIPv6();
      const wideAreaDomain = resolveWideAreaDiscoveryDomain({
        configDomain: (opts.domain as string | undefined) ?? cfg.discovery?.wideArea?.domain,
      });
      if (!wideAreaDomain) {
        throw new Error(
          "未配置广域发现域。请设置 discovery.wideArea.domain 或传递 --domain。",
        );
      }
      const zonePath = getWideAreaZonePath(wideAreaDomain);

      const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
      defaultRuntime.log(theme.heading("DNS 设置"));
      defaultRuntime.log(
        renderTable({
          width: tableWidth,
          columns: [
            { key: "Key", header: "键", minWidth: 18 },
            { key: "Value", header: "值", minWidth: 24, flex: true },
          ],
          rows: [
            { Key: "域", Value: wideAreaDomain },
            { Key: "区域文件", Value: zonePath },
            {
              Key: "Tailnet IP",
              Value: `${tailnetIPv4 ?? "—"}${tailnetIPv6 ? ` (v6 ${tailnetIPv6})` : ""}`,
            },
          ],
        }).trimEnd(),
      );
      defaultRuntime.log("");
      defaultRuntime.log(theme.heading("推荐的 ~/.openclaw/openclaw.json:"));
      defaultRuntime.log(
        JSON.stringify(
          {
            gateway: { bind: "auto" },
            discovery: { wideArea: { enabled: true, domain: wideAreaDomain } },
          },
          null,
          2,
        ),
      );
      defaultRuntime.log("");
      defaultRuntime.log(theme.heading("Tailscale 管理 (DNS → Nameservers):"));
      defaultRuntime.log(
        theme.muted(`- 添加名称服务器: ${tailnetIPv4 ?? "<本机 tailnet IPv4>"}`),
      );
      defaultRuntime.log(
        theme.muted(`- 限制到域 (Split DNS): ${wideAreaDomain.replace(/\.$/, "")}`),
      );

      if (!opts.apply) {
        defaultRuntime.log("");
        defaultRuntime.log(theme.muted("运行 --apply 以安装 CoreDNS 并配置它。"));
        return;
      }

      if (process.platform !== "darwin") {
        throw new Error("dns setup 目前仅支持 macOS");
      }
      if (!tailnetIPv4 && !tailnetIPv6) {
        throw new Error("未检测到 Tailnet IP；请确保 Tailscale 正在本机运行");
      }

      const prefix = detectBrewPrefix();
      const etcDir = path.join(prefix, "etc", "coredns");
      const corefilePath = path.join(etcDir, "Corefile");
      const confDir = path.join(etcDir, "conf.d");
      const importGlob = path.join(confDir, "*.server");
      const serverPath = path.join(confDir, `${wideAreaDomain.replace(/\.$/, "")}.server`);

      run("brew", ["list", "coredns"], { allowFailure: true });
      run("brew", ["install", "coredns"], {
        inherit: true,
        allowFailure: true,
      });

      mkdirSudoIfNeeded(confDir);

      if (!fs.existsSync(corefilePath)) {
        writeFileSudoIfNeeded(corefilePath, `import ${importGlob}\n`);
      } else {
        ensureImportLine(corefilePath, importGlob);
      }

      const bindArgs = [tailnetIPv4, tailnetIPv6].filter((v): v is string => Boolean(v?.trim()));

      const server = [
        `${wideAreaDomain.replace(/\.$/, "")}:53 {`,
        `  bind ${bindArgs.join(" ")}`,
        `  file ${zonePath} {`,
        `    reload 10s`,
        `  }`,
        `  errors`,
        `  log`,
        `}`,
        ``,
      ].join("\n");
      writeFileSudoIfNeeded(serverPath, server);

      // Ensure the gateway can write its zone file path.
      await fs.promises.mkdir(path.dirname(zonePath), { recursive: true });
      if (zoneFileNeedsBootstrap(zonePath)) {
        const y = new Date().getUTCFullYear();
        const m = String(new Date().getUTCMonth() + 1).padStart(2, "0");
        const d = String(new Date().getUTCDate()).padStart(2, "0");
        const serial = `${y}${m}${d}01`;

        const zoneLines = [
          `; created by openclaw dns setup (will be overwritten by the gateway when wide-area discovery is enabled)`,
          `$ORIGIN ${wideAreaDomain}`,
          `$TTL 60`,
          `@ IN SOA ns1 hostmaster ${serial} 7200 3600 1209600 60`,
          `@ IN NS ns1`,
          tailnetIPv4 ? `ns1 IN A ${tailnetIPv4}` : null,
          tailnetIPv6 ? `ns1 IN AAAA ${tailnetIPv6}` : null,
          ``,
        ].filter((line): line is string => Boolean(line));

        fs.writeFileSync(zonePath, zoneLines.join("\n"), "utf-8");
      }

      defaultRuntime.log("");
      defaultRuntime.log(theme.heading("正在启动 CoreDNS (sudo)…"));
      run("sudo", ["brew", "services", "restart", "coredns"], {
        inherit: true,
      });

      if (cfg.discovery?.wideArea?.enabled !== true) {
        defaultRuntime.log("");
        defaultRuntime.log(
          theme.muted(
            "注意：在网关上的 ~/.openclaw/openclaw.json 中启用 discovery.wideArea.enabled 并重启网关，以便它写入 DNS-SD 区域。",
          ),
        );
      }
    });
}
