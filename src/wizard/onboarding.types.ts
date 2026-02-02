import type { GatewayAuthChoice } from "../commands/onboard-types.js";
import { z } from "zod";

export const WizardFlowSchema = z.enum(["quickstart", "advanced"]);
export type WizardFlow = z.infer<typeof WizardFlowSchema>;

export type QuickstartGatewayDefaults = {
  hasExisting: boolean;
  port: number;
  bind: "loopback" | "lan" | "auto" | "custom" | "tailnet";
  authMode: GatewayAuthChoice;
  tailscaleMode: "off" | "serve" | "funnel";
  token?: string;
  password?: string;
  customBindHost?: string;
  tailscaleResetOnExit: boolean;
};

export type GatewayWizardSettings = {
  port: number;
  bind: "loopback" | "lan" | "auto" | "custom" | "tailnet";
  customBindHost?: string;
  authMode: GatewayAuthChoice;
  gatewayToken?: string;
  tailscaleMode: "off" | "serve" | "funnel";
  tailscaleResetOnExit: boolean;
};
