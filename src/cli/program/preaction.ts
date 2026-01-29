import type { Command } from "commander";
import { defaultRuntime } from "../../runtime.js";
import { emitCliBanner } from "../banner.js";
import { getCommandPath, getFlagValue, getVerboseFlag, hasHelpOrVersion } from "../argv.js";
import { ensureConfigReady } from "./config-guard.js";
import { ensurePluginRegistryLoaded } from "../plugin-registry.js";
import { isTruthyEnvValue } from "../../infra/env.js";
import { setVerbose } from "../../globals.js";
import { resolveCliName } from "../cli-name.js";

function setProcessTitleForCommand(actionCommand: Command) {
  let current: Command = actionCommand;
  while (current.parent && current.parent.parent) {
    current = current.parent;
  }
  const name = current.name();
  const cliName = resolveCliName();
  if (!name || name === cliName) return;
  process.title = `${cliName}-${name}`;
}

// Commands that need channel plugins loaded
const PLUGIN_REQUIRED_COMMANDS = new Set(["message", "channels", "directory"]);

export function registerPreActionHooks(program: Command, programVersion: string) {
  program.hook("preAction", async (_thisCommand, actionCommand) => {
    setProcessTitleForCommand(actionCommand);
    const argv = process.argv;
    if (hasHelpOrVersion(argv)) return;
    const commandPath = getCommandPath(argv, 2);
    const hideBanner =
      isTruthyEnvValue(process.env.CLAWDBOT_HIDE_BANNER) ||
      commandPath[0] === "update" ||
      (commandPath[0] === "plugins" && commandPath[1] === "update");
    if (!hideBanner) {
      emitCliBanner(programVersion);
    }
    const verbose = getVerboseFlag(argv, { includeDebug: true });
    setVerbose(verbose);
    if (!verbose) {
      process.env.NODE_NO_WARNINGS ??= "1";
    }
    if (commandPath[0] === "doctor") return;
    // `tui --url` is client-only, so it should not require a valid local config (e.g. local plugins).
    const url = commandPath[0] === "tui" ? getFlagValue(argv, "--url") : undefined;
    const shouldBypassConfigGuardForTui = typeof url === "string" && url.trim().length > 0;
    if (!shouldBypassConfigGuardForTui) {
      await ensureConfigReady({ runtime: defaultRuntime, commandPath });
    }
    // Load plugins for commands that need channel access
    if (PLUGIN_REQUIRED_COMMANDS.has(commandPath[0])) {
      ensurePluginRegistryLoaded();
    }
  });
}
