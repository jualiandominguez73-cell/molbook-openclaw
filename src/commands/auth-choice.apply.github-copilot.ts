import { githubCopilotLoginCommand } from "../providers/github-copilot-auth.js";
declare const process: any;
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyAuthProfileConfig, ensureAuthProfileStore } from "./onboard-auth.js";

export async function applyAuthChoiceGitHubCopilot(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "github-copilot") return null;

  let nextConfig = params.config;

  await params.prompter.note(
    [
      "This will open a GitHub device login to authorize Copilot.",
      "Requires an active GitHub Copilot subscription.",
    ].join("\n"),
    "GitHub Copilot",
  );

  const store = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false,
  });
  const existing = store.profiles["github-copilot:github"];
  if (existing && existing.type === "token") {
    const useExisting = await params.prompter.confirm({
      message: `Use existing GitHub Copilot authentication (${existing.email ?? "authorized"})?`,
      initialValue: true,
    });
    if (useExisting) {
      // already has profile, skip login
    } else if (!process.stdin.isTTY) {
      await params.prompter.note(
        "GitHub Copilot login requires an interactive TTY.",
        "GitHub Copilot",
      );
      return { config: nextConfig };
    } else {
      try {
        await githubCopilotLoginCommand({ yes: true }, params.runtime);
      } catch (err) {
        await params.prompter.note(`GitHub Copilot login failed: ${String(err)}`, "GitHub Copilot");
        return { config: nextConfig };
      }
    }
  } else if (!process.stdin.isTTY) {
    await params.prompter.note(
      "GitHub Copilot login requires an interactive TTY.",
      "GitHub Copilot",
    );
    return { config: nextConfig };
  } else {
    try {
      await githubCopilotLoginCommand({ yes: true }, params.runtime);
    } catch (err) {
      await params.prompter.note(`GitHub Copilot login failed: ${String(err)}`, "GitHub Copilot");
      return { config: nextConfig };
    }
  }

  nextConfig = applyAuthProfileConfig(nextConfig, {
    profileId: "github-copilot:github",
    provider: "github-copilot",
    mode: "token",
  });

  if (params.setDefaultModel) {
    const model = "github-copilot/gpt-4o";
    nextConfig = {
      ...nextConfig,
      agents: {
        ...nextConfig.agents,
        defaults: {
          ...nextConfig.agents?.defaults,
          model: {
            ...(typeof nextConfig.agents?.defaults?.model === "object"
              ? nextConfig.agents.defaults.model
              : undefined),
            primary: model,
          },
        },
      },
    };
    await params.prompter.note(`Default model set to ${model}`, "Model configured");
  }

  return { config: nextConfig };
}
