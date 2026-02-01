export type ReasoningTagMode = "strict" | "preserve";
export type ReasoningTagTrim = "none" | "start" | "both";

const QUICK_TAG_RE = /<\s*\/?\s*(?:think(?:ing)?|thought|antthinking|final)\b/i;
const FINAL_TAG_RE = /<\s*\/?\s*final\b[^>]*>/gi;
const THINKING_TAG_RE = /<\s*(\/?)\s*(?:think(?:ing)?|thought|antthinking)\b[^>]*>/gi;

function applyTrim(value: string, mode: ReasoningTagTrim): string {
  if (mode === "none") return value;
  if (mode === "start") return value.trimStart();
  return value.trim();
}

export function stripReasoningTagsFromText(
  text: string,
  options?: {
    mode?: ReasoningTagMode;
    trim?: ReasoningTagTrim;
  },
): string {
  if (!text) return text;
  if (!QUICK_TAG_RE.test(text)) return text;

  const mode = options?.mode ?? "strict";
  const trimMode = options?.trim ?? "both";

  let cleaned = text;
  if (FINAL_TAG_RE.test(cleaned)) {
    FINAL_TAG_RE.lastIndex = 0;
    cleaned = cleaned.replace(FINAL_TAG_RE, "");
  } else {
    FINAL_TAG_RE.lastIndex = 0;
  }

  THINKING_TAG_RE.lastIndex = 0;
  let result = "";
  let lastIndex = 0;
  let inThinking = false;

  // Collect all matches first to detect orphaned closing tags
  const matches = [...cleaned.matchAll(THINKING_TAG_RE)];

  // Check for orphaned closing tag at start (no preceding open tag)
  // This handles models that output "reasoning text </think> response" without opening tag
  if (matches.length > 0) {
    const firstMatch = matches[0];
    const firstIsClose = firstMatch[1] === "/";
    const firstIdx = firstMatch.index ?? 0;
    // If first tag is a closing tag near the start, treat everything before as thinking
    if (firstIsClose && firstIdx < 500) {
      // Skip all content before the orphaned closing tag
      lastIndex = firstIdx + firstMatch[0].length;
      // Process remaining matches starting from index 1
      for (let i = 1; i < matches.length; i++) {
        const match = matches[i];
        const idx = match.index ?? 0;
        const isClose = match[1] === "/";

        if (!inThinking) {
          result += cleaned.slice(lastIndex, idx);
          if (!isClose) {
            inThinking = true;
          }
        } else if (isClose) {
          inThinking = false;
        }

        lastIndex = idx + match[0].length;
      }

      if (!inThinking || mode === "preserve") {
        result += cleaned.slice(lastIndex);
      }

      return applyTrim(result, trimMode);
    }
  }

  // Normal paired tag handling
  for (const match of matches) {
    const idx = match.index ?? 0;
    const isClose = match[1] === "/";

    if (!inThinking) {
      result += cleaned.slice(lastIndex, idx);
      if (!isClose) {
        inThinking = true;
      }
    } else if (isClose) {
      inThinking = false;
    }

    lastIndex = idx + match[0].length;
  }

  if (!inThinking || mode === "preserve") {
    result += cleaned.slice(lastIndex);
  }

  return applyTrim(result, trimMode);
}
