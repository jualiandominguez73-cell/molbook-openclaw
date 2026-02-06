import type { Command } from "commander";
import { updateChutesModels } from "../../commands/chutes-oauth.js";
import { defaultRuntime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerChutesCommands(program: Command) {
  const chutes = program
    .command("chutes")
    .description("Manage Chutes.ai integration");

  chutes
    .command("models")
    .description("Discover and update Chutes.ai models")
    .action(async () => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        console.log(theme.muted("Discovering Chutes.ai models..."));
        await updateChutesModels();
        console.log(theme.success("Chutes.ai models updated successfully."));
      });
    });
}
