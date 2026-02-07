import type { MediaUnderstandingProvider } from "../../types.js";
import { transcribeDashscopeAudio } from "./audio.js";

export const dashscopeProvider: MediaUnderstandingProvider = {
  id: "dashscope",
  capabilities: ["audio"],
  transcribeAudio: transcribeDashscopeAudio,
};
