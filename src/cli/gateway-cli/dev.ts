import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveDefaultAgentWorkspaceDir } from "../../agents/workspace.js";
import { handleReset } from "../../commands/onboard-helpers.js";
import { createConfigIO, writeConfigFile } from "../../config/config.js";
import { defaultRuntime } from "../../runtime.js";
import { resolveUserPath, shortenHomePath } from "../../utils.js";

const DEV_IDENTITY_NAME = "C3-PO";
const DEV_IDENTITY_THEME = "protocol droid";
const DEV_IDENTITY_EMOJI = "🤖";
const DEV_AGENT_WORKSPACE_SUFFIX = "dev";

const DEV_TEMPLATE_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../docs/reference/templates",
);

async function loadDevTemplate(name: string, fallback: string): Promise<string> {
  try {
    const raw = await fs.promises.readFile(path.join(DEV_TEMPLATE_DIR, name), "utf-8");
    if (!raw.startsWith("---")) return raw;
    const endIndex = raw.indexOf("\n---", 3);
    if (endIndex === -1) return raw;
    return raw.slice(endIndex + "\n---".length).replace(/^\s+/, "");
  } catch {
    return fallback;
  }
}

const resolveDevWorkspaceDir = (env: NodeJS.ProcessEnv = process.env): string => {
  const baseDir = resolveDefaultAgentWorkspaceDir(env, os.homedir);
  const profile = env.OPENCLAW_PROFILE?.trim().toLowerCase();
  if (profile === "dev") return baseDir;
  return `${baseDir}-${DEV_AGENT_WORKSPACE_SUFFIX}`;
};

async function writeFileIfMissing(filePath: string, content: string) {
  try {
    await fs.promises.writeFile(filePath, content, {
      encoding: "utf-8",
      flag: "wx",
    });
  } catch (err) {
    const anyErr = err as { code?: string };
    if (anyErr.code !== "EEXIST") throw err;
  }
}

async function ensureDevWorkspace(dir: string) {
  const resolvedDir = resolveUserPath(dir);
  await fs.promises.mkdir(resolvedDir, { recursive: true });

  const [agents, soul, tools, identity, user] = await Promise.all([
    loadDevTemplate(
      "AGENTS.dev.md",
      `# AGENTS.md - OpenClaw 开发工作区\n\nopenclaw gateway --dev 的默认开发工作区。\n`,
    ),
    loadDevTemplate(
      "SOUL.dev.md",
      `# SOUL.md - 开发角色\n\n用于调试和操作的协议机器人。\n`,
    ),
    loadDevTemplate(
      "TOOLS.dev.md",
      `# TOOLS.md - 用户工具说明 (可编辑)\n\n在此处添加您的本地工具说明。\n`,
    ),
    loadDevTemplate(
      "IDENTITY.dev.md",
      `# IDENTITY.md - 代理身份\n\n- Name: ${DEV_IDENTITY_NAME}\n- Creature: protocol droid\n- Vibe: ${DEV_IDENTITY_THEME}\n- Emoji: ${DEV_IDENTITY_EMOJI}\n`,
    ),
    loadDevTemplate(
      "USER.dev.md",
      `# USER.md - 用户资料\n\n- Name:\n- Preferred address:\n- Notes:\n`,
    ),
  ]);

  await writeFileIfMissing(path.join(resolvedDir, "AGENTS.md"), agents);
  await writeFileIfMissing(path.join(resolvedDir, "SOUL.md"), soul);
  await writeFileIfMissing(path.join(resolvedDir, "TOOLS.md"), tools);
  await writeFileIfMissing(path.join(resolvedDir, "IDENTITY.md"), identity);
  await writeFileIfMissing(path.join(resolvedDir, "USER.md"), user);
}

export async function ensureDevGatewayConfig(opts: { reset?: boolean }) {
  const workspace = resolveDevWorkspaceDir();
  if (opts.reset) {
    await handleReset("full", workspace, defaultRuntime);
  }

  const io = createConfigIO();
  const configPath = io.configPath;
  const configExists = fs.existsSync(configPath);
  if (!opts.reset && configExists) return;

  await writeConfigFile({
    gateway: {
      mode: "local",
      bind: "loopback",
    },
    agents: {
      defaults: {
        workspace,
        skipBootstrap: true,
      },
      list: [
        {
          id: "dev",
          default: true,
          workspace,
          identity: {
            name: DEV_IDENTITY_NAME,
            theme: DEV_IDENTITY_THEME,
            emoji: DEV_IDENTITY_EMOJI,
          },
        },
      ],
    },
  });
  await ensureDevWorkspace(workspace);
  defaultRuntime.log(`开发配置就绪: ${shortenHomePath(configPath)}`);
  defaultRuntime.log(`开发工作区就绪: ${shortenHomePath(resolveUserPath(workspace))}`);
}
