import type { Command } from "commander";

import {
  githubCopilotLoginCommand,
  modelsAliasesAddCommand,
  modelsAliasesListCommand,
  modelsAliasesRemoveCommand,
  modelsAuthAddCommand,
  modelsAuthLoginCommand,
  modelsAuthOrderClearCommand,
  modelsAuthOrderGetCommand,
  modelsAuthOrderSetCommand,
  modelsAuthPasteTokenCommand,
  modelsAuthSetupTokenCommand,
  modelsFallbacksAddCommand,
  modelsFallbacksClearCommand,
  modelsFallbacksListCommand,
  modelsFallbacksRemoveCommand,
  modelsImageFallbacksAddCommand,
  modelsImageFallbacksClearCommand,
  modelsImageFallbacksListCommand,
  modelsImageFallbacksRemoveCommand,
  modelsListCommand,
  modelsScanCommand,
  modelsSetCommand,
  modelsSetImageCommand,
  modelsStatusCommand,
} from "../commands/models.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { resolveOptionFromCommand, runCommandWithRuntime } from "./cli-utils.js";

function runModelsCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action);
}

export function registerModelsCli(program: Command) {
  const models = program
    .command("models")
    .description("模型发现、扫描和配置")
    .option("--status-json", "输出 JSON（`models status --json` 的别名）", false)
    .option("--status-plain", "纯文本输出（`models status --plain` 的别名）", false)
    .option(
      "--agent <id>",
      "要检查的 Agent ID（覆盖 OPENCLAW_AGENT_DIR/PI_CODING_AGENT_DIR）",
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/models", "docs.openclaw.ai/cli/models")}\n`,
    );

  models
    .command("list")
    .description("列出模型（默认显示已配置的）")
    .option("--all", "显示完整模型目录", false)
    .option("--local", "仅显示本地模型", false)
    .option("--provider <name>", "按提供商过滤")
    .option("--json", "输出 JSON", false)
    .option("--plain", "纯文本行输出", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsListCommand(opts, defaultRuntime);
      });
    });

  models
    .command("status")
    .description("显示已配置的模型状态")
    .option("--json", "输出 JSON", false)
    .option("--plain", "纯文本输出", false)
    .option(
      "--check",
      "如果认证即将过期/已过期则以非零状态退出（1=过期/缺失，2=即将过期）",
      false,
    )
    .option("--probe", "探测已配置的提供商认证（实时）", false)
    .option("--probe-provider <name>", "仅探测单个提供商")
    .option(
      "--probe-profile <id>",
      "仅探测特定的认证配置文件 ID（可重复或逗号分隔）",
      (value, previous) => {
        const next = Array.isArray(previous) ? previous : previous ? [previous] : [];
        next.push(value);
        return next;
      },
    )
    .option("--probe-timeout <ms>", "每个探测的超时时间 (ms)")
    .option("--probe-concurrency <n>", "探测并发数")
    .option("--probe-max-tokens <n>", "探测最大 token 数（尽力而为）")
    .option(
      "--agent <id>",
      "要检查的 Agent ID（覆盖 OPENCLAW_AGENT_DIR/PI_CODING_AGENT_DIR）",
    )
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsStatusCommand(
          {
            json: Boolean(opts.json),
            plain: Boolean(opts.plain),
            check: Boolean(opts.check),
            probe: Boolean(opts.probe),
            probeProvider: opts.probeProvider as string | undefined,
            probeProfile: opts.probeProfile as string | string[] | undefined,
            probeTimeout: opts.probeTimeout as string | undefined,
            probeConcurrency: opts.probeConcurrency as string | undefined,
            probeMaxTokens: opts.probeMaxTokens as string | undefined,
            agent,
          },
          defaultRuntime,
        );
      });
    });

  models
    .command("set")
    .description("设置默认模型")
    .argument("<model>", "模型 ID 或别名")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsSetCommand(model, defaultRuntime);
      });
    });

  models
    .command("set-image")
    .description("设置图像模型")
    .argument("<model>", "模型 ID 或别名")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsSetImageCommand(model, defaultRuntime);
      });
    });

  const aliases = models.command("aliases").description("管理模型别名");

  aliases
    .command("list")
    .description("列出模型别名")
    .option("--json", "输出 JSON", false)
    .option("--plain", "纯文本输出", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAliasesListCommand(opts, defaultRuntime);
      });
    });

  aliases
    .command("add")
    .description("添加或更新模型别名")
    .argument("<alias>", "别名名称")
    .argument("<model>", "模型 ID 或别名")
    .action(async (alias: string, model: string) => {
      await runModelsCommand(async () => {
        await modelsAliasesAddCommand(alias, model, defaultRuntime);
      });
    });

  aliases
    .command("remove")
    .description("移除模型别名")
    .argument("<alias>", "别名名称")
    .action(async (alias: string) => {
      await runModelsCommand(async () => {
        await modelsAliasesRemoveCommand(alias, defaultRuntime);
      });
    });

  const fallbacks = models.command("fallbacks").description("管理模型回退列表");

  fallbacks
    .command("list")
    .description("列出回退模型")
    .option("--json", "输出 JSON", false)
    .option("--plain", "纯文本输出", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsFallbacksListCommand(opts, defaultRuntime);
      });
    });

  fallbacks
    .command("add")
    .description("添加回退模型")
    .argument("<model>", "模型 ID 或别名")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsFallbacksAddCommand(model, defaultRuntime);
      });
    });

  fallbacks
    .command("remove")
    .description("移除回退模型")
    .argument("<model>", "模型 ID 或别名")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsFallbacksRemoveCommand(model, defaultRuntime);
      });
    });

  fallbacks
    .command("clear")
    .description("清空所有回退模型")
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsFallbacksClearCommand(defaultRuntime);
      });
    });

  const imageFallbacks = models
    .command("image-fallbacks")
    .description("管理图像模型回退列表");

  imageFallbacks
    .command("list")
    .description("列出图像回退模型")
    .option("--json", "输出 JSON", false)
    .option("--plain", "纯文本输出", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksListCommand(opts, defaultRuntime);
      });
    });

  imageFallbacks
    .command("add")
    .description("添加图像回退模型")
    .argument("<model>", "模型 ID 或别名")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksAddCommand(model, defaultRuntime);
      });
    });

  imageFallbacks
    .command("remove")
    .description("移除图像回退模型")
    .argument("<model>", "模型 ID 或别名")
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksRemoveCommand(model, defaultRuntime);
      });
    });

  imageFallbacks
    .command("clear")
    .description("清空所有图像回退模型")
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksClearCommand(defaultRuntime);
      });
    });

  models
    .command("scan")
    .description("扫描 OpenRouter 免费模型以获取工具 + 图像")
    .option("--min-params <b>", "最小参数量（十亿）")
    .option("--max-age-days <days>", "跳过早于 N 天的模型")
    .option("--provider <name>", "按提供商前缀过滤")
    .option("--max-candidates <n>", "最大回退候选数量", "6")
    .option("--timeout <ms>", "每个探测的超时时间 (ms)")
    .option("--concurrency <n>", "探测并发数")
    .option("--no-probe", "跳过实时探测；仅列出免费候选")
    .option("--yes", "无需提示直接接受默认值", false)
    .option("--no-input", "禁用提示（使用默认值）")
    .option("--set-default", "将 agents.defaults.model 设置为第一个选择", false)
    .option("--set-image", "将 agents.defaults.imageModel 设置为第一个图像选择", false)
    .option("--json", "输出 JSON", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsScanCommand(opts, defaultRuntime);
      });
    });

  models.action(async (opts) => {
    await runModelsCommand(async () => {
      await modelsStatusCommand(
        {
          json: Boolean(opts?.statusJson),
          plain: Boolean(opts?.statusPlain),
          agent: opts?.agent as string | undefined,
        },
        defaultRuntime,
      );
    });
  });

  const auth = models.command("auth").description("管理模型认证配置文件");
  auth.option("--agent <id>", "用于认证顺序 get/set/clear 的 Agent ID");
  auth.action(() => {
    auth.help();
  });

  auth
    .command("add")
    .description("交互式认证助手（setup-token 或 paste token）")
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsAuthAddCommand({}, defaultRuntime);
      });
    });

  auth
    .command("login")
    .description("运行提供商插件认证流程 (OAuth/API key)")
    .option("--provider <id>", "插件注册的提供商 ID")
    .option("--method <id>", "提供商认证方法 ID")
    .option("--set-default", "应用提供商的默认模型推荐", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthLoginCommand(
          {
            provider: opts.provider as string | undefined,
            method: opts.method as string | undefined,
            setDefault: Boolean(opts.setDefault),
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("setup-token")
    .description("Run a provider CLI to create/sync a token (TTY required)")
    .option("--provider <name>", "Provider id (default: anthropic)")
    .option("--yes", "Skip confirmation", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthSetupTokenCommand(
          {
            provider: opts.provider as string | undefined,
            yes: Boolean(opts.yes),
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("paste-token")
    .description("Paste a token into auth-profiles.json and update config")
    .requiredOption("--provider <name>", "Provider id (e.g. anthropic)")
    .option("--profile-id <id>", "Auth profile id (default: <provider>:manual)")
    .option(
      "--expires-in <duration>",
      "Optional expiry duration (e.g. 365d, 12h). Stored as absolute expiresAt.",
    )
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthPasteTokenCommand(
          {
            provider: opts.provider as string | undefined,
            profileId: opts.profileId as string | undefined,
            expiresIn: opts.expiresIn as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("login-github-copilot")
    .description("Login to GitHub Copilot via GitHub device flow (TTY required)")
    .option("--profile-id <id>", "Auth profile id (default: github-copilot:github)")
    .option("--yes", "Overwrite existing profile without prompting", false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await githubCopilotLoginCommand(
          {
            profileId: opts.profileId as string | undefined,
            yes: Boolean(opts.yes),
          },
          defaultRuntime,
        );
      });
    });

  const order = auth.command("order").description("Manage per-agent auth profile order overrides");

  order
    .command("get")
    .description("Show per-agent auth order override (from auth-profiles.json)")
    .requiredOption("--provider <name>", "Provider id (e.g. anthropic)")
    .option("--agent <id>", "Agent id (default: configured default agent)")
    .option("--json", "Output JSON", false)
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderGetCommand(
          {
            provider: opts.provider as string,
            agent,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  order
    .command("set")
    .description("设置每 Agent 认证顺序覆盖（锁定轮询到此列表）")
    .requiredOption("--provider <name>", "提供商 ID（例如 anthropic）")
    .option("--agent <id>", "Agent ID（默认：配置的默认 Agent）")
    .argument("<profileIds...>", "认证配置文件 ID（例如 anthropic:default）")
    .action(async (profileIds: string[], opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderSetCommand(
          {
            provider: opts.provider as string,
            agent,
            order: profileIds,
          },
          defaultRuntime,
        );
      });
    });

  order
    .command("clear")
    .description("清除每 Agent 认证顺序覆盖（回退到配置/轮询）")
    .requiredOption("--provider <name>", "提供商 ID（例如 anthropic）")
    .option("--agent <id>", "Agent ID（默认：配置的默认 Agent）")
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderClearCommand(
          {
            provider: opts.provider as string,
            agent,
          },
          defaultRuntime,
        );
      });
    });
}
