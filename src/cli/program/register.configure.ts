import type { Command } from "commander";
import {
  CONFIGURE_WIZARD_SECTIONS,
  configureCommand,
  configureCommandWithSections,
} from "../../commands/configure.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerConfigureCommand(program: Command) {
  program
    .command("configure")
    .description("交互式配置：设置凭据、设备与代理默认值")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/configure", "docs.openclaw.ai/cli/configure")}\n`,
    )
    .option(
      "--section <section>",
      `配置分区（可重复指定）。可选值：${CONFIGURE_WIZARD_SECTIONS.join(", ")}`,
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
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
            `无效的 --section：${invalid.join(", ")}。可选值：${CONFIGURE_WIZARD_SECTIONS.join(", ")}。`,
          );
          defaultRuntime.exit(1);
          return;
        }

        await configureCommandWithSections(sections as never, defaultRuntime);
      });
    });
}
