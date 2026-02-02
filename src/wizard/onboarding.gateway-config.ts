import { normalizeGatewayTokenInput, randomToken } from "../commands/onboard-helpers.js";
import type { GatewayAuthChoice } from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/config.js";
import { findTailscaleBinary } from "../infra/tailscale.js";
import type { RuntimeEnv } from "../runtime.js";
import type {
  GatewayWizardSettings,
  QuickstartGatewayDefaults,
  WizardFlow,
} from "./onboarding.types.js";
import type { WizardPrompter } from "./prompts.js";

type ConfigureGatewayOptions = {
  flow: WizardFlow;
  baseConfig: OpenClawConfig;
  nextConfig: OpenClawConfig;
  localPort: number;
  quickstartGateway: QuickstartGatewayDefaults;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
};

type ConfigureGatewayResult = {
  nextConfig: OpenClawConfig;
  settings: GatewayWizardSettings;
};

export async function configureGatewayForOnboarding(
  opts: ConfigureGatewayOptions,
): Promise<ConfigureGatewayResult> {
  const { flow, localPort, quickstartGateway, prompter } = opts;
  let { nextConfig } = opts;

  const port =
    flow === "quickstart"
      ? quickstartGateway.port
      : Number.parseInt(
          String(
            await prompter.text({
              message: "Gateway 端口",
              initialValue: String(localPort),
              validate: (value) => (Number.isFinite(Number(value)) ? undefined : "无效端口"),
            }),
          ),
          10,
        );

  let bind = (
    flow === "quickstart"
      ? quickstartGateway.bind
      : ((await prompter.select({
          message: "Gateway 绑定",
          options: [
            { value: "loopback", label: "回环 (127.0.0.1)" },
            { value: "lan", label: "局域网 (0.0.0.0)" },
            { value: "tailnet", label: "Tailnet (Tailscale IP)" },
            { value: "auto", label: "自动 (回环 → 局域网)" },
            { value: "custom", label: "自定义 IP" },
          ],
        })) as "loopback" | "lan" | "auto" | "custom" | "tailnet")
  ) as "loopback" | "lan" | "auto" | "custom" | "tailnet";

  let customBindHost = quickstartGateway.customBindHost;
  if (bind === "custom") {
    const needsPrompt = flow !== "quickstart" || !customBindHost;
    if (needsPrompt) {
      const input = await prompter.text({
        message: "自定义 IP 地址",
        placeholder: "192.168.1.100",
        initialValue: customBindHost ?? "",
        validate: (value) => {
          if (!value) return "自定义绑定模式需要 IP 地址";
          const trimmed = value.trim();
          const parts = trimmed.split(".");
          if (parts.length !== 4) return "无效的 IPv4 地址 (例如 192.168.1.100)";
          if (
            parts.every((part) => {
              const n = parseInt(part, 10);
              return !Number.isNaN(n) && n >= 0 && n <= 255 && part === String(n);
            })
          )
            return undefined;
          return "无效的 IPv4 地址 (每个八位字节必须是 0-255)";
        },
      });
      customBindHost = typeof input === "string" ? input.trim() : undefined;
    }
  }

  let authMode = (
    flow === "quickstart"
      ? quickstartGateway.authMode
      : ((await prompter.select({
          message: "Gateway 认证",
          options: [
            {
              value: "token",
              label: "令牌",
              hint: "推荐默认值 (本地 + 远程)",
            },
            { value: "password", label: "密码" },
          ],
          initialValue: "token",
        })) as GatewayAuthChoice)
  ) as GatewayAuthChoice;

  const tailscaleMode = (
    flow === "quickstart"
      ? quickstartGateway.tailscaleMode
      : ((await prompter.select({
          message: "Tailscale 暴露",
          options: [
            { value: "off", label: "关闭", hint: "无 Tailscale 暴露" },
            {
              value: "serve",
              label: "Serve",
              hint: "Tailnet 的私有 HTTPS (Tailscale 上的设备)",
            },
            {
              value: "funnel",
              label: "Funnel",
              hint: "通过 Tailscale Funnel 的公共 HTTPS (互联网)",
            },
          ],
        })) as "off" | "serve" | "funnel")
  ) as "off" | "serve" | "funnel";

  // Detect Tailscale binary before proceeding with serve/funnel setup.
  if (tailscaleMode !== "off") {
    const tailscaleBin = await findTailscaleBinary();
    if (!tailscaleBin) {
      await prompter.note(
        [
          "在 PATH 或 /Applications 中未找到 Tailscale 二进制文件。",
          "确保从以下位置安装 Tailscale：",
          "  https://tailscale.com/download/mac",
          "",
          "您可以继续设置，但在运行时 serve/funnel 将会失败。",
        ].join("\n"),
        "Tailscale 警告",
      );
    }
  }

  let tailscaleResetOnExit = flow === "quickstart" ? quickstartGateway.tailscaleResetOnExit : false;
  if (tailscaleMode !== "off" && flow !== "quickstart") {
    await prompter.note(
      ["文档:", "https://docs.openclaw.ai/gateway/tailscale", "https://docs.openclaw.ai/web"].join(
        "\n",
      ),
      "Tailscale",
    );
    tailscaleResetOnExit = Boolean(
      await prompter.confirm({
        message: "退出时重置 Tailscale serve/funnel？",
        initialValue: false,
      }),
    );
  }

  // Safety + constraints:
  // - Tailscale wants bind=loopback so we never expose a non-loopback server + tailscale serve/funnel at once.
  // - Funnel requires password auth.
  if (tailscaleMode !== "off" && bind !== "loopback") {
    await prompter.note("Tailscale 需要 bind=loopback。正在调整绑定为 loopback。", "注意");
    bind = "loopback";
    customBindHost = undefined;
  }

  if (tailscaleMode === "funnel" && authMode !== "password") {
    await prompter.note("Tailscale funnel 需要密码认证。", "注意");
    authMode = "password";
  }

  let gatewayToken: string | undefined;
  if (authMode === "token") {
    if (flow === "quickstart") {
      gatewayToken = quickstartGateway.token ?? randomToken();
    } else {
      const tokenInput = await prompter.text({
        message: "Gateway 令牌 (留空以生成)",
        placeholder: "多机或非回环访问所需",
        initialValue: quickstartGateway.token ?? "",
      });
      gatewayToken = normalizeGatewayTokenInput(tokenInput) || randomToken();
    }
  }

  if (authMode === "password") {
    const password =
      flow === "quickstart" && quickstartGateway.password
        ? quickstartGateway.password
        : await prompter.text({
            message: "Gateway 密码",
            validate: (value) => (value?.trim() ? undefined : "必填"),
          });
    nextConfig = {
      ...nextConfig,
      gateway: {
        ...nextConfig.gateway,
        auth: {
          ...nextConfig.gateway?.auth,
          mode: "password",
          password: String(password).trim(),
        },
      },
    };
  } else if (authMode === "token") {
    nextConfig = {
      ...nextConfig,
      gateway: {
        ...nextConfig.gateway,
        auth: {
          ...nextConfig.gateway?.auth,
          mode: "token",
          token: gatewayToken,
        },
      },
    };
  }

  nextConfig = {
    ...nextConfig,
    gateway: {
      ...nextConfig.gateway,
      port,
      bind,
      ...(bind === "custom" && customBindHost ? { customBindHost } : {}),
      tailscale: {
        ...nextConfig.gateway?.tailscale,
        mode: tailscaleMode,
        resetOnExit: tailscaleResetOnExit,
      },
    },
  };

  return {
    nextConfig,
    settings: {
      port,
      bind,
      customBindHost: bind === "custom" ? customBindHost : undefined,
      authMode,
      gatewayToken,
      tailscaleMode,
      tailscaleResetOnExit,
    },
  };
}
