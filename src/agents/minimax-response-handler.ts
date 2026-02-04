/**
 * MiniMax-specific response handling utilities
 * Fixes issue where MiniMax-M2.1 responses show "(no output)" in TUI
 */

/**
 * Check if a response might be from MiniMax by provider or model hints
 */
export function isMiniMaxResponse(params?: {
  provider?: string;
  model?: string;
}): boolean {
  const provider = params?.provider?.toLowerCase() || "";
  const model = params?.model?.toLowerCase() || "";
  
  return (
    provider.includes("minimax") ||
    model.includes("minimax") ||
    model.includes("m2.1")
  );
}

/**
 * Extract meaningful content from a response, with MiniMax-specific handling
 * MiniMax sometimes returns responses where the actual content is in unexpected places
 */
export function extractMiniMaxResponseText(params: {
  finalText?: string | null;
  streamedText?: string | null;
  assistantMessage?: Record<string, unknown>;
  provider?: string;
  model?: string;
}): {
  text: string;
  isEmpty: boolean;
  debugInfo?: string;
} {
  const finalText = params.finalText?.trim() || "";
  const streamedText = params.streamedText?.trim() || "";

  // Standard case: have content in expected fields
  if (finalText || streamedText) {
    return {
      text: finalText || streamedText,
      isEmpty: false,
    };
  }

  // MiniMax-specific: check assistant message structure for nested content
  if (params.assistantMessage && typeof params.assistantMessage === "object") {
    const msg = params.assistantMessage as Record<string, unknown>;
    
    // Check common response fields
    const candidates = [
      msg.content,
      msg.text,
      msg.message,
      msg.response,
      msg.output,
      Array.isArray(msg.content) ? 
        (msg.content as Array<{type?: string, text?: string}>)
          .find(b => b.type === "text" || b.type === undefined)
          ?.text 
        : null,
    ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

    if (candidates.length > 0) {
      return {
        text: candidates[0],
        isEmpty: false,
        debugInfo: "extracted from assistantMessage structure",
      };
    }
  }

  // Check if response is actually empty or just whitespace
  return {
    text: "",
    isEmpty: true,
  };
}
