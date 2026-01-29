import type { MoltbotConfig, DmPolicy } from "clawdbot/plugin-sdk";
import {
  addWildcardAllowFrom,
  formatDocsLink,
  promptAccountId,
  type ChannelOnboardingAdapter,
  type ChannelOnboardingDmPolicy,
  type WizardPrompter,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  migrateBaseNameToDefaultAccount,
} from "clawdbot/plugin-sdk";

import {
  listDingTalkAccountIds,
  resolveDefaultDingTalkAccountId,
  resolveDingTalkAccount,
} from "./accounts.js";

const channel = "dingtalk" as const;

// Stream mode environment variables
const ENV_CLIENT_ID = "DINGTALK_CLIENT_ID";
const ENV_CLIENT_SECRET = "DINGTALK_CLIENT_SECRET";

function setDingTalkDmPolicy(cfg: MoltbotConfig, policy: DmPolicy) {
  const allowFrom =
    policy === "open"
      ? addWildcardAllowFrom(cfg.channels?.dingtalk?.dm?.allowFrom)
      : undefined;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      dingtalk: {
        ...(cfg.channels?.dingtalk ?? {}),
        dm: {
          ...(cfg.channels?.dingtalk?.dm ?? {}),
          policy,
          ...(allowFrom ? { allowFrom } : {}),
        },
      },
    },
  };
}

function parseAllowFromInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function promptAllowFrom(params: {
  cfg: MoltbotConfig;
  prompter: WizardPrompter;
}): Promise<MoltbotConfig> {
  const current = params.cfg.channels?.dingtalk?.dm?.allowFrom ?? [];
  const entry = await params.prompter.text({
    message: "DingTalk allowFrom (user ID)",
    placeholder: "user123, user456",
    initialValue: current[0] ? String(current[0]) : undefined,
    validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
  });
  const parts = parseAllowFromInput(String(entry));
  const unique = [...new Set(parts)];
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      dingtalk: {
        ...(params.cfg.channels?.dingtalk ?? {}),
        enabled: true,
        dm: {
          ...(params.cfg.channels?.dingtalk?.dm ?? {}),
          policy: "allowlist",
          allowFrom: unique,
        },
      },
    },
  };
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "DingTalk",
  channel,
  policyKey: "channels.dingtalk.dm.policy",
  allowFromKey: "channels.dingtalk.dm.allowFrom",
  getCurrent: (cfg) => cfg.channels?.dingtalk?.dm?.policy ?? "pairing",
  setPolicy: (cfg, policy) => setDingTalkDmPolicy(cfg, policy),
  promptAllowFrom,
};

function applyAccountConfig(params: {
  cfg: MoltbotConfig;
  accountId: string;
  patch: Record<string, unknown>;
}): MoltbotConfig {
  const { cfg, accountId, patch } = params;
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        dingtalk: {
          ...(cfg.channels?.dingtalk ?? {}),
          enabled: true,
          ...patch,
        },
      },
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      dingtalk: {
        ...(cfg.channels?.dingtalk ?? {}),
        enabled: true,
        accounts: {
          ...(cfg.channels?.dingtalk?.accounts ?? {}),
          [accountId]: {
            ...(cfg.channels?.dingtalk?.accounts?.[accountId] ?? {}),
            enabled: true,
            ...patch,
          },
        },
      },
    },
  };
}

async function promptCredentials(params: {
  cfg: MoltbotConfig;
  prompter: WizardPrompter;
  accountId: string;
}): Promise<MoltbotConfig> {
  const { cfg, prompter, accountId } = params;
  const envReady =
    accountId === DEFAULT_ACCOUNT_ID &&
    Boolean(process.env[ENV_CLIENT_ID]) &&
    Boolean(process.env[ENV_CLIENT_SECRET]);

  if (envReady) {
    const useEnv = await prompter.confirm({
      message: "Use DINGTALK_CLIENT_ID/DINGTALK_CLIENT_SECRET env vars?",
      initialValue: true,
    });
    if (useEnv) {
      return applyAccountConfig({ cfg, accountId, patch: {} });
    }
  }

  const clientId = await prompter.text({
    message: "DingTalk AppKey (Client ID)",
    placeholder: "dingxxxxxxxx",
    validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
  });

  const clientSecret = await prompter.text({
    message: "DingTalk AppSecret (Client Secret)",
    placeholder: "xxxxxxxx",
    validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
  });

  return applyAccountConfig({
    cfg,
    accountId,
    patch: {
      clientId: String(clientId).trim(),
      clientSecret: String(clientSecret).trim(),
    },
  });
}

async function noteDingTalkSetup(prompter: WizardPrompter) {
  await prompter.note(
    [
      "DingTalk Stream mode uses WebSocket connection (no public URL needed).",
      "1. Create an enterprise internal robot in DingTalk Open Platform",
      "2. Enable 'Stream Mode' in robot settings",
      "3. Copy the AppKey (Client ID) and AppSecret (Client Secret)",
      `Docs: ${formatDocsLink("/channels/dingtalk", "channels/dingtalk")}`,
    ].join("\n"),
    "DingTalk setup",
  );
}

export const dingtalkOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  dmPolicy,
  getStatus: async ({ cfg }) => {
    const configured = listDingTalkAccountIds(cfg).some(
      (accountId) => resolveDingTalkAccount({ cfg, accountId }).credentialSource !== "none",
    );
    return {
      channel,
      configured,
      statusLines: [`DingTalk: ${configured ? "configured" : "needs credentials"}`],
      selectionHint: configured ? "configured" : "needs auth",
    };
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const override = accountOverrides["dingtalk"]?.trim();
    const defaultAccountId = resolveDefaultDingTalkAccountId(cfg);
    let accountId = override ? normalizeAccountId(override) : defaultAccountId;

    if (shouldPromptAccountIds && !override) {
      accountId = await promptAccountId({
        cfg,
        prompter,
        label: "DingTalk",
        currentId: accountId,
        listAccountIds: listDingTalkAccountIds,
        defaultAccountId,
      });
    }

    let next = cfg;
    await noteDingTalkSetup(prompter);
    next = await promptCredentials({ cfg: next, prompter, accountId });

    const namedConfig = migrateBaseNameToDefaultAccount({
      cfg: next,
      channelKey: "dingtalk",
    });

    return { cfg: namedConfig, accountId };
  },
};
