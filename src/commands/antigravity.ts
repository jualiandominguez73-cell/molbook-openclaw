import fs from "node:fs/promises";
import path from "node:path";
import { loginAntigravityVpsAware } from "./antigravity-oauth.js";
import { writeOAuthCredentials } from "./onboard-auth.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveOAuthPath, resolveOAuthDir } from "../config/paths.js";
import { getAntigravityAccounts } from "../agents/model-auth.js";

// Re-implementing simplified loadOAuthStorage to avoid circular deps or complexity
async function loadOAuthStorage() {
  const p = resolveOAuthPath();
  try {
    const content = await fs.readFile(p, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function saveOAuthStorage(storage: Record<string, unknown>) {
  const p = resolveOAuthPath();
  await fs.writeFile(p, JSON.stringify(storage, null, 2), "utf8");
}

async function loadAntigravityState(): Promise<Record<string, unknown>> {
  const p = path.join(resolveOAuthDir(), "antigravity-state.json");
  try {
    const content = await fs.readFile(p, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function saveAntigravityState(state: Record<string, unknown>) {
  const p = path.join(resolveOAuthDir(), "antigravity-state.json");
  await fs.writeFile(p, JSON.stringify(state, null, 2), "utf8");
}

export async function antigravityAddCommand(runtime: RuntimeEnv) {
  runtime.log("Starting Antigravity login...");

  const creds = await loginAntigravityVpsAware(
    (url) => {
      runtime.log("\nOpen this URL to authorize:");
      runtime.log(url + "\n");
    },
    (msg) => runtime.log(msg),
  );

  if (creds && creds.email) {
    const key = `google-antigravity:${creds.email}`;
    // We cast to any because OAuthProvider is a strict union type in the library,
    // but the storage underlying implementation handles string keys.
    await writeOAuthCredentials(key as any, creds);
    runtime.log(`Successfully added account: ${creds.email}`);
  } else {
    throw new Error("Login failed or email could not be retrieved.");
  }
}

export async function antigravityListCommand(runtime: RuntimeEnv) {
  const storage = await loadOAuthStorage();
  const accounts = getAntigravityAccounts(storage);

  if (accounts.length === 0) {
    runtime.log("No Antigravity accounts found.");
    return;
  }

  runtime.log("Antigravity Accounts:");
  for (const acc of accounts) {
    runtime.log(`- ${acc}`);
  }
}

export async function antigravityRemoveCommand(
  runtime: RuntimeEnv,
  emailOrKey: string,
) {
  const storage = await loadOAuthStorage();
  const accounts = getAntigravityAccounts(storage);

  // Normalize: accept either email or full key
  let keyToRemove: string | undefined;
  for (const acc of accounts) {
    if (acc === emailOrKey || acc === `google-antigravity:${emailOrKey}`) {
      keyToRemove = acc;
      break;
    }
    // Also match just the email part
    if (acc.startsWith("google-antigravity:")) {
      const email = acc.slice("google-antigravity:".length);
      if (email === emailOrKey) {
        keyToRemove = acc;
        break;
      }
    }
  }

  if (!keyToRemove) {
    runtime.error(`Account not found: ${emailOrKey}`);
    runtime.log("Available accounts:");
    for (const acc of accounts) {
      runtime.log(`  - ${acc}`);
    }
    return;
  }

  // Remove from oauth storage
  delete storage[keyToRemove];
  await saveOAuthStorage(storage);

  // Remove from antigravity state if present
  const state = await loadAntigravityState();
  if (keyToRemove in state) {
    delete state[keyToRemove];
    await saveAntigravityState(state);
  }

  runtime.log(`Removed account: ${keyToRemove}`);
}
