import type { Command } from "commander";
import * as qr from "qrcode-terminal";
import { intro, outro, text, confirm, spinner } from "@clack/prompts";

import { loadConfig, writeConfigFile } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import { runSecurityAudit } from "../security/audit.js";
import { fixSecurityFootguns } from "../security/fix.js";
import { TotpManager } from "../security/totp.js";
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
  parts.push(rich ? theme.error(`${c} critical`) : `${c} critical`);
  parts.push(rich ? theme.warn(`${w} warn`) : `${w} warn`);
  parts.push(rich ? theme.muted(`${i} info`) : `${i} info`);
  return parts.join(" · ");
}

export function registerSecurityCli(program: Command) {
  const security = program
    .command("security")
    .description("Security tools (audit)")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/security", "docs.molt.bot/cli/security")}\n`,
    );

  security
    .command("audit")
    .description("Audit config + local state for common security foot-guns")
    .option("--deep", "Attempt live Gateway probe (best-effort)", false)
    .option("--fix", "Apply safe fixes (tighten defaults + chmod state/config)", false)
    .option("--json", "Print JSON", false)
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
      lines.push(heading("Moltbot security audit"));
      lines.push(muted(`Summary: ${formatSummary(report.summary)}`));
      lines.push(muted(`Run deeper: ${formatCliCommand("moltbot security audit --deep")}`));

      if (opts.fix) {
        lines.push(muted(`Fix: ${formatCliCommand("moltbot security audit --fix")}`));
        if (!fixResult) {
          lines.push(muted("Fixes: failed to apply (unexpected error)"));
        } else if (
          fixResult.errors.length === 0 &&
          fixResult.changes.length === 0 &&
          fixResult.actions.every((a) => a.ok === false)
        ) {
          lines.push(muted("Fixes: no changes applied"));
        } else {
          lines.push("");
          lines.push(heading("FIX"));
          for (const change of fixResult.changes) {
            lines.push(muted(`  ${shortenHomeInString(change)}`));
          }
          for (const action of fixResult.actions) {
            if (action.kind === "chmod") {
              const mode = action.mode.toString(8).padStart(3, "0");
              if (action.ok) lines.push(muted(`  chmod ${mode} ${shortenHomePath(action.path)}`));
              else if (action.skipped)
                lines.push(
                  muted(`  skip chmod ${mode} ${shortenHomePath(action.path)} (${action.skipped})`),
                );
              else if (action.error)
                lines.push(
                  muted(`  chmod ${mode} ${shortenHomePath(action.path)} failed: ${action.error}`),
                );
              continue;
            }
            const command = shortenHomeInString(action.command);
            if (action.ok) lines.push(muted(`  ${command}`));
            else if (action.skipped) lines.push(muted(`  skip ${command} (${action.skipped})`));
            else if (action.error) lines.push(muted(`  ${command} failed: ${action.error}`));
          }
          if (fixResult.errors.length > 0) {
            for (const err of fixResult.errors) {
              lines.push(muted(`  error: ${shortenHomeInString(err)}`));
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
              ? theme.error("CRITICAL")
              : "CRITICAL"
            : sev === "warn"
              ? rich
                ? theme.warn("WARN")
                : "WARN"
              : rich
                ? theme.muted("INFO")
                : "INFO";
        lines.push("");
        lines.push(heading(label));
        for (const f of list) {
          lines.push(`${theme.muted(f.checkId)} ${f.title}`);
          lines.push(`  ${f.detail}`);
          if (f.remediation?.trim()) lines.push(`  ${muted(`Fix: ${f.remediation.trim()}`)}`);
        }
      };

      render("critical");
      render("warn");
      render("info");

      defaultRuntime.log(lines.join("\n"));
    });

  // OTP setup command
  security
    .command("otp")
    .description("Set up OTP (One-Time Password) verification")
    .action(async () => {
      const rich = isRich();

      intro(rich ? theme.heading("🔒 OTP Setup") : "OTP Setup");

      try {
        // Check if OTP is already configured
        const cfg = loadConfig();
        const currentSecret = cfg.security?.otpVerification?.secret;

        if (currentSecret) {
          const overwrite = await confirm({
            message: "OTP is already configured. Do you want to replace it?",
            initialValue: false,
          });

          if (!overwrite) {
            outro("Setup cancelled. Your existing OTP configuration is unchanged.");
            return;
          }
        }

        // Get user details for TOTP generation
        const accountName = await text({
          message: "Enter account identifier (email/username):",
          placeholder: "user@example.com",
          validate: (value) => {
            if (!value?.trim()) return "Account identifier is required";
            return;
          },
        });

        if (typeof accountName === "symbol") {
          outro("Setup cancelled");
          return;
        }

        // Generate TOTP secret
        const setupSpinner = spinner();
        setupSpinner.start("Generating TOTP secret...");

        const totpSecret = TotpManager.generateSecret(accountName as string, "Moltbot");

        setupSpinner.stop("Secret generated successfully");

        // Display QR code
        defaultRuntime.log(
          rich
            ? theme.heading("\n📱 Scan this QR code with your authenticator app:")
            : "\nScan this QR code with your authenticator app:",
        );
        defaultRuntime.log("");

        // Generate ASCII QR code
        qr.generate(totpSecret.uri, { small: true }, (qrString) => {
          defaultRuntime.log(qrString);
        });

        defaultRuntime.log("");
        defaultRuntime.log(
          rich
            ? theme.muted("Manual entry (if QR code doesn't work):")
            : "Manual entry (if QR code doesn't work):",
        );
        defaultRuntime.log(
          rich ? theme.muted(`Secret: ${totpSecret.secret}`) : `Secret: ${totpSecret.secret}`,
        );
        defaultRuntime.log(
          rich
            ? theme.muted(`Account: ${totpSecret.accountName}`)
            : `Account: ${totpSecret.accountName}`,
        );
        defaultRuntime.log(
          rich ? theme.muted(`Issuer: ${totpSecret.issuer}`) : `Issuer: ${totpSecret.issuer}`,
        );
        defaultRuntime.log("");

        // Get test code to verify setup
        const testCode = await text({
          message: "Enter the 6-digit code from your authenticator app to verify setup:",
          placeholder: "123456",
          validate: (value) => {
            if (!value?.trim()) return "Verification code is required";
            if (!/^\d{6}$/.test(value.replace(/\D/g, ""))) {
              return "Code must be exactly 6 digits";
            }
            return;
          },
        });

        if (typeof testCode === "symbol") {
          outro("Setup cancelled");
          return;
        }

        // Validate the test code
        const verifySpinner = spinner();
        verifySpinner.start("Verifying code...");

        const isValid = TotpManager.validateCode(totpSecret.secret, testCode as string);

        if (!isValid) {
          verifySpinner.stop("❌ Verification failed");
          defaultRuntime.log("");
          defaultRuntime.log(
            rich
              ? theme.error("The code you entered is incorrect.")
              : "The code you entered is incorrect.",
          );
          defaultRuntime.log(rich ? theme.muted("Please check that:") : "Please check that:");
          defaultRuntime.log(
            rich
              ? theme.muted("• Your phone's time is synchronized")
              : "• Your phone's time is synchronized",
          );
          defaultRuntime.log(
            rich
              ? theme.muted("• You entered the current 6-digit code")
              : "• You entered the current 6-digit code",
          );
          defaultRuntime.log(
            rich
              ? theme.muted("• Your authenticator app is properly configured")
              : "• Your authenticator app is properly configured",
          );
          outro("Setup failed. Please try again.");
          return;
        }

        verifySpinner.stop("✅ Code verified successfully");

        // Save to config
        const saveSpinner = spinner();
        saveSpinner.start("Saving OTP configuration...");

        const updatedConfig = {
          ...cfg,
          security: {
            ...cfg.security,
            otpVerification: {
              enabled: true,
              secret: totpSecret.secret,
              accountName: totpSecret.accountName,
              issuer: totpSecret.issuer,
              intervalHours: 24,
              strictMode: false,
              gracePeriodMinutes: 15,
            },
          },
        };

        await writeConfigFile(updatedConfig);
        saveSpinner.stop("Configuration saved");

        defaultRuntime.log("");
        defaultRuntime.log(
          rich
            ? theme.success("🎉 OTP setup completed successfully!")
            : "OTP setup completed successfully!",
        );
        defaultRuntime.log("");
        defaultRuntime.log(rich ? theme.muted("Configuration:") : "Configuration:");
        defaultRuntime.log(
          rich
            ? theme.muted(`• Verification interval: 24 hours`)
            : "• Verification interval: 24 hours",
        );
        defaultRuntime.log(
          rich ? theme.muted(`• Grace period: 15 minutes`) : "• Grace period: 15 minutes",
        );
        defaultRuntime.log(
          rich ? theme.muted(`• Strict mode: disabled`) : "• Strict mode: disabled",
        );
        defaultRuntime.log("");
        defaultRuntime.log(
          rich
            ? theme.muted("Your authenticator app is now configured and ready to use.")
            : "Your authenticator app is now configured and ready to use.",
        );

        outro("Setup complete! 🔒");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        defaultRuntime.log("");
        defaultRuntime.log(
          rich ? theme.error(`Setup failed: ${errorMessage}`) : `Setup failed: ${errorMessage}`,
        );
        outro("Setup cancelled due to error");
        process.exit(1);
      }
    });
}
