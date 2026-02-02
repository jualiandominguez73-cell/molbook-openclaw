import type { OpenClawConfig } from "../config/config.js";
import type { GatewayWizardSettings } from "./onboarding.types.js";
import type { WizardPrompter } from "./prompts.js";

type FinalizeOnboardingOptions = {
  configPath: string;
  nextConfig: OpenClawConfig;
  gatewaySettings: GatewayWizardSettings;
  prompter: WizardPrompter;
};

export async function finalizeOnboarding(opts: FinalizeOnboardingOptions): Promise<void> {
  const { configPath, gatewaySettings, prompter } = opts;

  await prompter.note("OpenClaw 已准备就绪。", "安装完成！");

  let startCmd = "openclaw gateway run";
  if (gatewaySettings.bind !== "loopback") {
    // If not loopback, we might need sudo on some platforms for low ports, but usually 3000+ is fine.
    // Just showing the basic command is enough.
  }

  await prompter.note(
    [
      `配置文件: ${configPath}`,
      "",
      "启动 Gateway:",
      `  ${startCmd}`,
      "",
      "或者后台运行:",
      `  nohup ${startCmd} > gateway.log 2>&1 &`,
    ].join("\n"),
    "运行命令",
  );

  await prompter.select({
    message: "后续步骤",
    options: [
      { value: "discord", label: "加入 Discord", hint: "https://discord.gg/openclaw" },
      { value: "docs", label: "阅读文档", hint: "https://docs.openclaw.ai" },
      { value: "github", label: "在 GitHub 上点赞", hint: "https://github.com/openclaw/openclaw" },
      { value: "exit", label: "退出" },
    ],
  });
}
