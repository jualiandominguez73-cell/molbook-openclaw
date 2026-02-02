import type { SlashCommand } from "@mariozechner/pi-tui";
import { listChatCommands, listChatCommandsForConfig } from "../auto-reply/commands-registry.js";
import { formatThinkingLevels, listThinkingLevelLabels } from "../auto-reply/thinking.js";
import type { OpenClawConfig } from "../config/types.js";

const VERBOSE_LEVELS = ["on", "off"];
const REASONING_LEVELS = ["on", "off"];
const ELEVATED_LEVELS = ["on", "off", "ask", "full"];
const ACTIVATION_LEVELS = ["mention", "always"];
const USAGE_FOOTER_LEVELS = ["off", "tokens", "full"];

export type ParsedCommand = {
  name: string;
  args: string;
};

export type SlashCommandOptions = {
  cfg?: OpenClawConfig;
  provider?: string;
  model?: string;
};

const COMMAND_ALIASES: Record<string, string> = {
  elev: "elevated",
};

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.replace(/^\//, "").trim();
  if (!trimmed) return { name: "", args: "" };
  const [name, ...rest] = trimmed.split(/\s+/);
  const normalized = name.toLowerCase();
  return {
    name: COMMAND_ALIASES[normalized] ?? normalized,
    args: rest.join(" ").trim(),
  };
}

export function getSlashCommands(options: SlashCommandOptions = {}): SlashCommand[] {
  const thinkLevels = listThinkingLevelLabels(options.provider, options.model);
  const commands: SlashCommand[] = [
    { name: "help", description: "显示斜杠命令帮助" },
    { name: "status", description: "显示网关状态摘要" },
    { name: "agent", description: "切换智能体 (或打开选择器)" },
    { name: "agents", description: "打开智能体选择器" },
    { name: "session", description: "切换会话 (或打开选择器)" },
    { name: "sessions", description: "打开会话选择器" },
    {
      name: "model",
      description: "设置模型 (或打开选择器)",
    },
    { name: "models", description: "打开模型选择器" },
    {
      name: "think",
      description: "设置思考等级",
      getArgumentCompletions: (prefix) =>
        thinkLevels
          .filter((v) => v.startsWith(prefix.toLowerCase()))
          .map((value) => ({ value, label: value })),
    },
    {
      name: "verbose",
      description: "设置详细模式开启/关闭",
      getArgumentCompletions: (prefix) =>
        VERBOSE_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "reasoning",
      description: "设置推理开启/关闭",
      getArgumentCompletions: (prefix) =>
        REASONING_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "usage",
      description: "切换单次响应使用统计显示",
      getArgumentCompletions: (prefix) =>
        USAGE_FOOTER_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "elevated",
      description: "设置提权模式 (on/off/ask/full)",
      getArgumentCompletions: (prefix) =>
        ELEVATED_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "elev",
      description: "/elevated 的别名",
      getArgumentCompletions: (prefix) =>
        ELEVATED_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "activation",
      description: "Set group activation",
      getArgumentCompletions: (prefix) =>
        ACTIVATION_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    { name: "abort", description: "中止当前运行" },
    { name: "new", description: "重置会话" },
    { name: "reset", description: "重置会话" },
    { name: "settings", description: "打开设置" },
    { name: "exit", description: "退出 TUI" },
    { name: "quit", description: "退出 TUI" },
  ];

  const seen = new Set(commands.map((command) => command.name));
  const gatewayCommands = options.cfg ? listChatCommandsForConfig(options.cfg) : listChatCommands();
  for (const command of gatewayCommands) {
    const aliases = command.textAliases.length > 0 ? command.textAliases : [`/${command.key}`];
    for (const alias of aliases) {
      const name = alias.replace(/^\//, "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      commands.push({ name, description: command.description });
    }
  }

  return commands;
}

export function helpText(options: SlashCommandOptions = {}): string {
  const thinkLevels = formatThinkingLevels(options.provider, options.model, "|");
  return [
    "斜杠命令:",
    "/help",
    "/commands",
    "/status",
    "/agent <id> (或 /agents)",
    "/session <key> (或 /sessions)",
    "/model <provider/model> (或 /models)",
    `/think <${thinkLevels}>`,
    "/verbose <on|off>",
    "/reasoning <on|off>",
    "/usage <off|tokens|full>",
    "/elevated <on|off|ask|full>",
    "/elev <on|off|ask|full>",
    "/activation <mention|always>",
    "/new 或 /reset",
    "/abort",
    "/settings",
    "/exit",
  ].join("\n");
}
