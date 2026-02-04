import type { ProvidersHealthHost } from "./providers-health.ts";
import { loadProvidersHealth } from "./providers-health.ts";

export type AuthProviderEntry = {
  id: string;
  name: string;
  authModes: string[];
  configured: boolean;
  envVars: string[];
  isLocal: boolean;
};

export type OAuthFlowState = {
  flowId: string;
  provider: string;
  status: "starting" | "waiting" | "success" | "error";
  authUrl?: string;
  error?: string;
  /** True when the flow needs the user to paste an authorization code */
  needsCode?: boolean;
  /** Prompt message from the plugin */
  codePromptMessage?: string;
};

export type AuthHost = ProvidersHealthHost & {
  authConfigProvider: string | null;
  authConfigSaving: boolean;
  authProvidersList: AuthProviderEntry[] | null;
  oauthFlow: OAuthFlowState | null;
  showToast: (type: "success" | "error" | "info" | "warn", message: string) => void;
};

export async function loadProvidersList(host: AuthHost): Promise<void> {
  if (!host.client || !host.connected) {
    return;
  }
  try {
    const result = await host.client.request("auth.listProviders", {});
    const data = result as { providers?: AuthProviderEntry[] } | undefined;
    host.authProvidersList = data?.providers ?? null;
  } catch {
    // Non-fatal: providers list is supplementary
  }
}

export async function setProviderCredential(
  host: AuthHost,
  provider: string,
  credential: string,
  credentialType: "api_key" | "token",
): Promise<boolean> {
  if (!host.client || !host.connected) {
    return false;
  }
  host.authConfigSaving = true;
  try {
    await host.client.request("auth.setKey", {
      provider,
      credential,
      credentialType,
    });
    host.showToast("success", `Credentials saved for ${provider}.`);
    host.authConfigProvider = null;

    // Refresh providers health + auth list
    await Promise.all([loadProvidersHealth(host), loadProvidersList(host)]);
    return true;
  } catch (err) {
    host.showToast("error", `Failed to save credentials: ${String(err)}`);
    return false;
  } finally {
    host.authConfigSaving = false;
  }
}

// --- OAuth flow ---

let oauthPollTimer: ReturnType<typeof setInterval> | null = null;

function stopOAuthPolling(): void {
  if (oauthPollTimer !== null) {
    clearInterval(oauthPollTimer);
    oauthPollTimer = null;
  }
}

export async function startOAuthFlow(host: AuthHost, provider: string): Promise<void> {
  if (!host.client || !host.connected) {
    return;
  }

  stopOAuthPolling();
  host.oauthFlow = { flowId: "", provider, status: "starting" };

  try {
    const result = await host.client.request("auth.startOAuth", { provider });
    const data = result as
      | {
          flowId?: string;
          authUrl?: string;
          userCode?: string;
          verificationUri?: string;
          flowType?: string;
        }
      | undefined;

    if (!data?.flowId) {
      host.oauthFlow = null;
      host.showToast("error", "Failed to start OAuth flow.");
      return;
    }

    host.oauthFlow = {
      flowId: data.flowId,
      provider,
      status: "waiting",
      authUrl: data.authUrl,
    };

    // Open the auth URL in a new tab
    if (data.authUrl) {
      window.open(data.authUrl, "_blank");
    }

    // Start polling for completion
    oauthPollTimer = setInterval(async () => {
      if (!host.client || !host.connected || !host.oauthFlow) {
        stopOAuthPolling();
        return;
      }
      try {
        const check = await host.client.request("auth.checkOAuth", {
          flowId: host.oauthFlow.flowId,
        });
        const data = check as {
          status?: string;
          error?: string;
          needsCode?: boolean;
          codePromptMessage?: string;
        };
        const status = data?.status;
        if (status === "success") {
          stopOAuthPolling();
          host.oauthFlow = null;
          host.authConfigProvider = null;
          host.showToast("success", `OAuth configured for ${provider}.`);
          await Promise.all([loadProvidersHealth(host), loadProvidersList(host)]);
        } else if (status === "error") {
          stopOAuthPolling();
          const error = data?.error ?? "OAuth flow failed";
          host.oauthFlow = { ...host.oauthFlow, status: "error", error };
          host.showToast("error", error);
        } else if (data?.needsCode && host.oauthFlow && !host.oauthFlow.needsCode) {
          host.oauthFlow = {
            ...host.oauthFlow,
            needsCode: true,
            codePromptMessage: data.codePromptMessage,
          };
        }
      } catch {
        // Polling error, keep trying
      }
    }, 2000);
  } catch (err) {
    host.oauthFlow = null;
    host.showToast("error", `Failed to start OAuth: ${String(err)}`);
  }
}

export async function submitOAuthCode(host: AuthHost, code: string): Promise<void> {
  if (!host.client || !host.connected || !host.oauthFlow) {
    return;
  }
  try {
    await host.client.request("auth.submitOAuthCode", {
      flowId: host.oauthFlow.flowId,
      code,
    });
    // Clear needsCode flag; polling will pick up success/error
    host.oauthFlow = { ...host.oauthFlow, needsCode: false, codePromptMessage: undefined };
  } catch (err) {
    host.showToast("error", `Failed to submit code: ${String(err)}`);
  }
}

export function cancelOAuthFlow(host: AuthHost): void {
  stopOAuthPolling();
  host.oauthFlow = null;
}
