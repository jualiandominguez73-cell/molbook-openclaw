import { resolveEnvApiKey } from "../agents/model-auth.js";
import {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
} from "./auth-choice.api-key.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyDefaultModelChoice } from "./auth-choice.default-model.js";
import { applyAuthChoicePluginProvider } from "./auth-choice.apply.plugin-provider.js";
import {
  applyAuthProfileConfig,
  setChutesApiKey,
  applyChutesConfig,
  applyChutesProviderConfig,
} from "./onboard-auth.js";

export async function applyAuthChoiceChutes(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  let nextConfig = params.config;
  let agentModelOverride: string | undefined;
  const noteAgentModel = async (model: string) => {
    if (!params.agentId) {
      return;
    }
    await params.prompter.note(
      `Default model set to ${model} for agent "${params.agentId}".`,
      "Model configured",
    );
  };

  if (params.authChoice === "chutes-oauth") {
    return await applyAuthChoicePluginProvider(params, {
      authChoice: "chutes-oauth",
      pluginId: "chutes-auth",
      providerId: "chutes",
      methodId: "oauth",
      label: "Chutes.ai",
    });
  }

  if (params.authChoice === "chutes") {
    let hasCredential = false;
    const envKey = resolveEnvApiKey("chutes");
    if (envKey) {
      const useExisting = await params.prompter.confirm({
        message: `Use existing CHUTES_API_KEY (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setChutesApiKey(envKey.apiKey, params.agentDir);
        hasCredential = true;
      }
    }
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "Enter Chutes API key",
        validate: validateApiKeyInput,
      });
      await setChutesApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "chutes:default",
      provider: "chutes",
      mode: "api_key",
    });
    {
      const modelRef = "chutes/deepseek-ai/DeepSeek-V3";
      const applied = await applyDefaultModelChoice({
        config: nextConfig,
        setDefaultModel: params.setDefaultModel,
        defaultModel: modelRef,
        applyDefaultConfig: (config) => applyChutesConfig(config, "deepseek-ai/DeepSeek-V3"),
        applyProviderConfig: (config) => applyChutesProviderConfig(config, "deepseek-ai/DeepSeek-V3"),
        noteAgentModel,
        prompter: params.prompter,
      });
      nextConfig = applied.config;
      agentModelOverride = applied.agentModelOverride ?? agentModelOverride;
    }
    return { config: nextConfig, agentModelOverride };
  }

  return null;
}
