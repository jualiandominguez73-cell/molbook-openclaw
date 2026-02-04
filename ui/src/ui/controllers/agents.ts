import type { GatewayBrowserClient } from "../gateway.ts";
import type { AgentsListResult } from "../types.ts";

/** Model choice from gateway models.list */
export type GatewayModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  vision?: boolean;
};

export type AgentsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentsLoading: boolean;
  agentsError: string | null;
  agentsList: AgentsListResult | null;
  agentsSelectedId: string | null;
  /** Available models from gateway */
  modelCatalog: GatewayModelChoice[];
  modelsLoading: boolean;
};

export async function loadAgents(state: AgentsState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.agentsLoading) {
    return;
  }
  state.agentsLoading = true;
  state.agentsError = null;
  try {
    const res = await state.client.request<AgentsListResult>("agents.list", {});
    if (res) {
      state.agentsList = res;
      const selected = state.agentsSelectedId;
      const known = res.agents.some((entry) => entry.id === selected);
      if (!selected || !known) {
        state.agentsSelectedId = res.defaultId ?? res.agents[0]?.id ?? null;
      }
    }
  } catch (err) {
    state.agentsError = String(err);
  } finally {
    state.agentsLoading = false;
  }
}

/** Load available models from gateway */
export async function loadModelCatalog(state: AgentsState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.modelsLoading) {
    return;
  }
  state.modelsLoading = true;
  try {
    const res = await state.client.request<{ models?: GatewayModelChoice[] }>("models.list", {});
    if (res && Array.isArray(res.models)) {
      state.modelCatalog = res.models;
    }
  } catch (err) {
    // Non-fatal - fall back to config-based models
    console.warn("Failed to load model catalog:", err);
  } finally {
    state.modelsLoading = false;
  }
}
