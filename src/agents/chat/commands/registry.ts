/**
 * Command registry for channel slash commands.
 * Manages registration and execution of channel commands like /invite, /kick, etc.
 */

import type { AgentChannel, AgentChannelMember, ChannelPermission } from "../types/channels.js";
import { hasChannelPermission } from "../types/channels.js";

export type CommandContext = {
  channelId: string;
  channel: AgentChannel;
  executorId: string;
  executorMember: AgentChannelMember;
  args: string[];
  rawArgs: string;
};

export type CommandResult = {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
};

export type CommandHandler = (ctx: CommandContext) => Promise<CommandResult>;

export type CommandDefinition = {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  examples?: string[];
  requiredPermission?: ChannelPermission;
  minArgs?: number;
  maxArgs?: number;
  handler: CommandHandler;
};

// Command registry
const commands = new Map<string, CommandDefinition>();
const aliasMap = new Map<string, string>(); // alias -> command name

/**
 * Register a command.
 */
export function registerCommand(definition: CommandDefinition): void {
  commands.set(definition.name, definition);

  // Register aliases
  if (definition.aliases) {
    for (const alias of definition.aliases) {
      aliasMap.set(alias.toLowerCase(), definition.name);
    }
  }
}

/**
 * Get a command by name or alias.
 */
export function getCommand(name: string): CommandDefinition | undefined {
  const normalizedName = name.toLowerCase();
  const resolvedName = aliasMap.get(normalizedName) ?? normalizedName;
  return commands.get(resolvedName);
}

/**
 * List all registered commands.
 */
export function listCommands(): CommandDefinition[] {
  return [...commands.values()];
}

/**
 * Check if a message is a command.
 */
export function isCommand(message: string): boolean {
  return message.trim().startsWith("/");
}

/**
 * Parse a command from a message.
 */
export function parseCommand(message: string): {
  name: string;
  args: string[];
  rawArgs: string;
} | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const withoutSlash = trimmed.slice(1);
  const spaceIndex = withoutSlash.indexOf(" ");

  if (spaceIndex === -1) {
    return {
      name: withoutSlash.toLowerCase(),
      args: [],
      rawArgs: "",
    };
  }

  const name = withoutSlash.slice(0, spaceIndex).toLowerCase();
  const rawArgs = withoutSlash.slice(spaceIndex + 1).trim();

  // Parse args, respecting quotes
  const args = parseArgs(rawArgs);

  return { name, args, rawArgs };
}

/**
 * Parse arguments from a string, respecting quotes.
 */
function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (const char of input) {
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = "";
    } else if (char === " " && !inQuotes) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Execute a command.
 */
export async function executeCommand(
  message: string,
  ctx: Omit<CommandContext, "args" | "rawArgs">,
): Promise<CommandResult> {
  const parsed = parseCommand(message);
  if (!parsed) {
    return {
      success: false,
      error: "Invalid command format",
    };
  }

  const command = getCommand(parsed.name);
  if (!command) {
    return {
      success: false,
      error: `Unknown command: /${parsed.name}. Use /help for available commands.`,
    };
  }

  // Check permission
  if (command.requiredPermission) {
    if (!hasChannelPermission(ctx.executorMember.role, command.requiredPermission)) {
      return {
        success: false,
        error: `Permission denied. You need '${command.requiredPermission}' permission to use this command.`,
      };
    }
  }

  // Validate args count
  if (command.minArgs !== undefined && parsed.args.length < command.minArgs) {
    return {
      success: false,
      error: `Not enough arguments. Usage: ${command.usage}`,
    };
  }

  if (command.maxArgs !== undefined && parsed.args.length > command.maxArgs) {
    return {
      success: false,
      error: `Too many arguments. Usage: ${command.usage}`,
    };
  }

  // Execute the command
  try {
    return await command.handler({
      ...ctx,
      args: parsed.args,
      rawArgs: parsed.rawArgs,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Command execution failed",
    };
  }
}

/**
 * Generate help text for a command.
 */
export function getCommandHelp(name: string): string | null {
  const command = getCommand(name);
  if (!command) {
    return null;
  }

  let help = `**/${command.name}**\n`;
  help += `${command.description}\n\n`;
  help += `Usage: \`${command.usage}\`\n`;

  if (command.aliases && command.aliases.length > 0) {
    help += `Aliases: ${command.aliases.map((a) => `/${a}`).join(", ")}\n`;
  }

  if (command.examples && command.examples.length > 0) {
    help += `\nExamples:\n`;
    for (const example of command.examples) {
      help += `  ${example}\n`;
    }
  }

  if (command.requiredPermission) {
    help += `\nRequired permission: ${command.requiredPermission}`;
  }

  return help;
}

/**
 * Generate help text for all commands.
 */
export function getAllCommandsHelp(): string {
  const cmds = listCommands();
  let help = "**Available Commands**\n\n";

  const categories = new Map<string | undefined, CommandDefinition[]>();

  for (const cmd of cmds) {
    const permission = cmd.requiredPermission ?? "none";
    if (!categories.has(permission)) {
      categories.set(permission, []);
    }
    categories.get(permission)!.push(cmd);
  }

  for (const [permission, cmdList] of categories) {
    if (permission !== "none") {
      help += `\n**Requires: ${permission}**\n`;
    }
    for (const cmd of cmdList) {
      help += `  \`/${cmd.name}\` - ${cmd.description}\n`;
    }
  }

  help += "\n\nUse `/help <command>` for detailed help on a specific command.";

  return help;
}
