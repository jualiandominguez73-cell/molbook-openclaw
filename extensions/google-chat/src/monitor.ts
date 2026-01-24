import { PubSub } from "@google-cloud/pubsub";
import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { ResolvedGoogleChatAccount } from "./accounts.js";
import type { GoogleChatEvent } from "./types.js";
import { getGoogleChatRuntime } from "./runtime.js";

export type MonitorOptions = {
  account: ResolvedGoogleChatAccount;
  config: ClawdbotConfig;
  runtime: any;
  abortSignal: AbortSignal;
};

export async function monitorGoogleChatProvider(
  options: MonitorOptions,
): Promise<void> {
  const { account, runtime, abortSignal } = options;

  if (!account.credentialsPath || !account.subscriptionName) {
    throw new Error("Google Chat account not properly configured");
  }

  const pubsub = new PubSub({
    projectId: account.projectId,
    keyFilename: account.credentialsPath,
  });

  const subscription = pubsub.subscription(account.subscriptionName);

  const messageHandler = async (message: any) => {
    try {
      const event: GoogleChatEvent = JSON.parse(message.data.toString());

      // Process Google Chat events
      // TODO: Route to agent via runtime

      runtime.log?.info(`[${account.accountId}] Received event: ${event.type}`);

      message.ack();
    } catch (error) {
      runtime.log?.error(`[${account.accountId}] Error processing message:`, error);
      message.nack();
    }
  };

  subscription.on("message", messageHandler);

  // Handle abort signal
  abortSignal.addEventListener("abort", () => {
    subscription.removeListener("message", messageHandler);
    subscription.close();
  });

  runtime.log?.info(`[${account.accountId}] Google Chat monitor started`);

  // Keep alive until aborted
  await new Promise<void>((resolve) => {
    abortSignal.addEventListener("abort", () => resolve());
  });
}
