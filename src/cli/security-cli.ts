import type { Command } from "commander";

import { loadConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import { runSecurityAudit } from "../security/audit.js";
import { fixSecurityFootguns } from "../security/fix.js";
import { formatDocsLink } from "../terminal/links.js";
import { isRich, theme } from "../terminal/theme.js";
import { shortenHomeInString, shortenHomePath } from "../utils.js";
import { formatCliCommand } from "./command-format.js";

type SecurityAuditOptions = {
  json?: boolean;
  deep?: boolean;
  fix?: boolean;
};

function formatSummary(summary: { critical: number; warn: number; info: number }): string {
  const rich = isRich();
  const c = summary.critical;
  const w = summary.warn;
  const i = summary.info;
  const parts: string[] = [];
  parts.push(rich ? theme.error(`${c} 严重`) : `${c} 严重`);
  parts.push(rich ? theme.warn(`${w} 警告`) : `${w} 警告`);
  parts.push(rich ? theme.muted(`${i} 信息`) : `${i} 信息`);
  return parts.join(" · ");
}

export function registerSecurityCli(program: Command) {
  const security = program
    .command("security")
    .description("安全工具（审计）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/security", "docs.openclaw.ai/cli/security")}\n`,
    );

  security
    .command("audit")
    .description("审计配置与本地状态，检查常见安全隐患")
    .option("--deep", "尝试实时探测网关（尽力而为）", false)
    .option("--fix", "应用安全修复（收紧默认值 + chmod 状态/配置）", false)
    .option("--json", "输出 JSON", false)
    .action(async (opts: SecurityAuditOptions) => {
      const fixResult = opts.fix ? await fixSecurityFootguns().catch((_err) => null) : null;

      const cfg = loadConfig();
      const report = await runSecurityAudit({
        config: cfg,
        deep: Boolean(opts.deep),
        includeFilesystem: true,
        includeChannelSecurity: true,
      });

      if (opts.json) {
        defaultRuntime.log(
          JSON.stringify(fixResult ? { fix: fixResult, report } : report, null, 2),
        );
        return;
      }

      const rich = isRich();
      const heading = (text: string) => (rich ? theme.heading(text) : text);
      const muted = (text: string) => (rich ? theme.muted(text) : text);

      const lines: string[] = [];
      lines.push(heading("OpenClaw 安全审计"));
      lines.push(muted(`概览：${formatSummary(report.summary)}`));
      lines.push(muted(`深入运行：${formatCliCommand("openclaw security audit --deep")}`));

      if (opts.fix) {
        lines.push(muted(`修复：${formatCliCommand("openclaw security audit --fix")}`));
        if (!fixResult) {
          lines.push(muted("修复：应用失败（意外错误）"));
        } else if (
          fixResult.errors.length === 0 &&
          fixResult.changes.length === 0 &&
          fixResult.actions.every((a) => a.ok === false)
        ) {
          lines.push(muted("修复：未应用任何更改"));
        } else {
          lines.push("");
          lines.push(heading("修复"));
          for (const change of fixResult.changes) {
            lines.push(muted(`  ${shortenHomeInString(change)}`));
          }
          for (const action of fixResult.actions) {
            if (action.kind === "chmod") {
              const mode = action.mode.toString(8).padStart(3, "0");
              if (action.ok) lines.push(muted(`  chmod ${mode} ${shortenHomePath(action.path)}`));
              else if (action.skipped)
                lines.push(
                  muted(`  跳过 chmod ${mode} ${shortenHomePath(action.path)} (${action.skipped})`),
                );
              else if (action.error)
                lines.push(
                  muted(`  chmod ${mode} ${shortenHomePath(action.path)} 失败：${action.error}`),
                );
              continue;
            }
            const command = shortenHomeInString(action.command);
            if (action.ok) lines.push(muted(`  ${command}`));
            else if (action.skipped) lines.push(muted(`  跳过 ${command} (${action.skipped})`));
            else if (action.error) lines.push(muted(`  ${command} 失败：${action.error}`));
          }
          if (fixResult.errors.length > 0) {
            for (const err of fixResult.errors) {
              lines.push(muted(`  错误：${shortenHomeInString(err)}`));
            }
          }
        }
      }

      const bySeverity = (sev: "critical" | "warn" | "info") =>
        report.findings.filter((f) => f.severity === sev);

      const render = (sev: "critical" | "warn" | "info") => {
        const list = bySeverity(sev);
        if (list.length === 0) return;
        const label =
          sev === "critical"
            ? rich
              ? theme.error("严重")
              : "严重"
            : sev === "warn"
              ? rich
                ? theme.warn("警告")
                : "警告"
              : rich
                ? theme.muted("信息")
                : "信息";
        lines.push("");
        lines.push(heading(label));
        for (const f of list) {
          lines.push(`${theme.muted(f.checkId)} ${f.title}`);
          lines.push(`  ${f.detail}`);
          if (f.remediation?.trim()) lines.push(`  ${muted(`修复：${f.remediation.trim()}`)}`);
        }
      };

      render("critical");
      render("warn");
      render("info");

      defaultRuntime.log(lines.join("\n"));
    });
}
