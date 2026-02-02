import type { ChannelsStatusSnapshot } from "../types";
import type { ChannelsState } from "./channels.types";

export type { ChannelsState };

export async function loadChannels(state: ChannelsState, probe: boolean) {
  if (!state.client || !state.connected) return;
  if (state.channelsLoading) return;
  state.channelsLoading = true;
  state.channelsError = null;
  try {
    const res = (await state.client.request("channels.status", {
      probe,
      timeoutMs: 8000,
    })) as ChannelsStatusSnapshot;
    state.channelsSnapshot = res;
    state.channelsLastSuccess = Date.now();
  } catch (err) {
    state.channelsError = "加载通道状态失败：" + String(err);
  } finally {
    state.channelsLoading = false;
  }
}

export async function startWhatsAppLogin(state: ChannelsState, force: boolean) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    const res = (await state.client.request("web.login.start", {
      force,
      timeoutMs: 30000,
    })) as { message?: string; qrDataUrl?: string };
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginQrDataUrl = res.qrDataUrl ?? null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = "启动登录失败：" + String(err);
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function waitWhatsAppLogin(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    const res = (await state.client.request("web.login.wait", {
      timeoutMs: 120000,
    })) as { connected?: boolean; message?: string };
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginConnected = res.connected ?? null;
    if (res.connected) state.whatsappLoginQrDataUrl = null;
  } catch (err) {
    state.whatsappLoginMessage = "等待登录失败：" + String(err);
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function logoutWhatsApp(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    await state.client.request("channels.logout", { channel: "whatsapp" });
    state.whatsappLoginMessage = "已退出登录。";
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = "退出登录失败：" + String(err);
  } finally {
    state.whatsappBusy = false;
  }
}
