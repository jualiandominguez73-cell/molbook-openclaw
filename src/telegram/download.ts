import * as fs from "node:fs/promises";
import { detectMime } from "../media/mime.js";
import { type SavedMedia, saveMediaBuffer } from "../media/store.js";
import { isLocalApiPath, normalizeApiRoot } from "./local-api.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export type TelegramFileInfo = {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
};

export async function getTelegramFile(
  token: string,
  fileId: string,
  apiBase?: string,
): Promise<TelegramFileInfo> {
  const baseUrl = normalizeApiRoot(apiBase) ?? TELEGRAM_API_BASE;
  const res = await fetch(`${baseUrl}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!res.ok) {
    throw new Error(`getFile failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { ok: boolean; result?: TelegramFileInfo };
  if (!json.ok || !json.result?.file_path) {
    throw new Error("getFile returned no file_path");
  }
  return json.result;
}

export async function downloadTelegramFile(
  token: string,
  info: TelegramFileInfo,
  maxBytes?: number,
  apiBase?: string,
): Promise<SavedMedia> {
  if (!info.file_path) {
    throw new Error("file_path missing");
  }

  let array: Buffer;
  let contentTypeHeader: string | null = null;

  if (isLocalApiPath(info.file_path)) {
    array = await fs.readFile(info.file_path);
  } else {
    const baseUrl = normalizeApiRoot(apiBase) ?? TELEGRAM_API_BASE;
    const url = `${baseUrl}/file/bot${token}/${info.file_path}`;
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download telegram file: HTTP ${res.status}`);
    }
    array = Buffer.from(await res.arrayBuffer());
    contentTypeHeader = res.headers.get("content-type");
  }

  const mime = await detectMime({
    buffer: array,
    headerMime: contentTypeHeader,
    filePath: info.file_path,
  });
  const saved = await saveMediaBuffer(array, mime, "inbound", maxBytes, info.file_path);
  if (!saved.contentType && mime) {
    saved.contentType = mime;
  }
  return saved;
}
