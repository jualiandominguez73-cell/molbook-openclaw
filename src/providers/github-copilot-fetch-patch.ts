/**
 * Monkey-patch global fetch to inject required GitHub Copilot IDE headers.
 * 
 * GitHub Copilot API requires specific IDE headers for authentication to work properly.
 * Without these headers, requests return 421 Misdirected Request errors.
 * 
 * Required headers:
 * - Editor-Version: Identifies the IDE version
 * - Editor-Plugin-Version: Identifies the Copilot plugin version
 * - Openai-Organization: Must be "github-copilot"
 * - Openai-Intent: Identifies the request type (e.g., "conversation-panel")
 * - User-Agent: Identifies the client as GitHub Copilot
 */

const COPILOT_IDE_HEADERS = {
  "Editor-Version": "vscode/1.95.0",
  "Editor-Plugin-Version": "copilot-chat/0.22.4",
  "Openai-Organization": "github-copilot",
  "Openai-Intent": "conversation-panel",
  "User-Agent": "GithubCopilot/0.22.4",
} as const;

const originalFetch = globalThis.fetch;
let patched = false;

/**
 * Check if a URL is a GitHub Copilot API endpoint
 */
function isGitHubCopilotUrl(url: string | URL): boolean {
  const urlString = typeof url === "string" ? url : url.toString();
  return (
    urlString.includes("api.githubcopilot.com") ||
    urlString.includes("api.individual.githubcopilot.com") ||
    urlString.includes("api.business.githubcopilot.com")
  );
}

/**
 * Patch global fetch to inject GitHub Copilot headers when making requests
 * to GitHub Copilot API endpoints.
 */
export function patchFetchForGitHubCopilot(): void {
  if (patched) {
    return;
  }

  globalThis.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input : input.url;

    // Only inject headers for GitHub Copilot API requests
    if (isGitHubCopilotUrl(url)) {
      const headers = new Headers(init?.headers);

      // Only add headers if they don't already exist
      for (const [key, value] of Object.entries(COPILOT_IDE_HEADERS)) {
        if (!headers.has(key)) {
          headers.set(key, value);
        }
      }

      return originalFetch(input, {
        ...init,
        headers,
      });
    }

    // For non-Copilot requests, use original fetch unchanged
    return originalFetch(input, init);
  };

  patched = true;
}

/**
 * Restore the original fetch implementation (primarily for testing)
 */
export function unpatchFetch(): void {
  if (patched) {
    globalThis.fetch = originalFetch;
    patched = false;
  }
}
