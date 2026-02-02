import { type OpenClawConfig, createConfigIO, readConfigFileSnapshot } from "../config/config.js";
import { type RuntimeEnv, defaultRuntime } from "../runtime.js";
import { createClackPrompter } from "./clack-prompter.js";
import { finalizeOnboarding } from "./onboarding.finalize.js";
import { configureGatewayForOnboarding } from "./onboarding.gateway-config.js";
import {
  type QuickstartGatewayDefaults,
  type WizardFlow,
  WizardFlowSchema,
} from "./onboarding.types.js";
import { WizardCancelledError, type WizardPrompter } from "./prompts.js";
import type { OnboardOptions } from "../commands/onboard-types.js";

type OnboardingOptions = {
  configPath: string;
  existingConfig?: OpenClawConfig;
  localPort?: number;
};

function createDefaultConfig(): OpenClawConfig {
  return {};
}

const QUICKSTART_GATEWAY_DEFAULTS: QuickstartGatewayDefaults = {
  hasExisting: false,
  port: 18789,
  bind: "loopback",
  authMode: "token",
  tailscaleMode: "off",
  tailscaleResetOnExit: false,
};

export async function runOnboardingWizard(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter = createClackPrompter()
): Promise<void> {
  const io = createConfigIO();
  const snapshot = await readConfigFileSnapshot();

  await runOnboarding(
    {
      configPath: io.configPath,
      existingConfig: snapshot.exists ? snapshot.config : undefined,
    },
    runtime,
    prompter
  );
}

export async function runOnboarding(
  opts: OnboardingOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter = createClackPrompter()
): Promise<void> {
  const { configPath, existingConfig } = opts;
  // const runtime: RuntimeEnv = determineRuntime();
  // const prompter = createClackPrompter();

  // If we have an existing config, we might want to offer "Edit" vs "Reset".
  // For now, assume "Reconfigure" logic or fresh start.
  // We'll use createDefaultConfig() as the base if existing is empty/invalid.
  const baseConfig = existingConfig ?? createDefaultConfig();
  let nextConfig = { ...baseConfig };

  try {
    await prompter.intro("OpenClaw 安装");
    await prompter.note("欢迎使用 OpenClaw", "OpenClaw 安装");

    const flow = (await prompter.select({
      message: "选择安装模式",
      options: [
        {
          value: "quickstart",
          label: "快速开始 (推荐)",
          hint: "使用大多数用户的默认设置",
        },
        { value: "advanced", label: "高级", hint: "自定义所有设置" },
        { value: "exit", label: "退出", hint: "取消安装" },
      ],
    })) as "quickstart" | "advanced" | "exit";

    if (flow === "exit") {
      throw new WizardCancelledError();
    }

    const validFlow = WizardFlowSchema.parse(flow);

    // 1. Gateway Config
    // If quickstart, we skip prompts where possible and use defaults.
    // We still might need to confirm some things if environment is tricky (e.g. port conflict),
    // but for now we'll just assume defaults work or throw if they don't.
    // Actually, configureGatewayForOnboarding handles "flow" logic internally.
    const gatewayResult = await configureGatewayForOnboarding({
      flow: validFlow,
      baseConfig,
      nextConfig,
      localPort: opts.localPort ?? 18789,
      quickstartGateway: QUICKSTART_GATEWAY_DEFAULTS,
      prompter,
      runtime,
    });
    nextConfig = gatewayResult.nextConfig;

    // 2. Providers / Models (Future)
    // For now, we just stick to Gateway.

    // 3. Write Config
    // In a real app, we would write the config file here.
    // await writeConfig(configPath, nextConfig);
    // For this wizard lib, we might just return the config or call a callback.
    // But the prompt implies we are "running" the onboarding.
    // We'll simulate the "Done" step.

    await finalizeOnboarding({
      configPath,
      nextConfig,
      gatewaySettings: gatewayResult.settings,
      prompter,
    });
  } catch (error) {
    if (error instanceof WizardCancelledError) {
      // Handled by prompter internals or just exit cleanly
      return;
    }
    throw error;
  }
}
