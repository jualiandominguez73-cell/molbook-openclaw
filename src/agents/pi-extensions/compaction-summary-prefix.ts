import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const COMPACTION_SUMMARY_PREFIX =
  "Another language model started to solve this problem and produced a summary of its thinking process. " +
  "You also have access to the state of the tools that were used by that language model. " +
  "Use this to build on the work that has already been done and avoid duplicating work. " +
  "Here is the summary produced by the other language model, use the information in this summary to assist with your own analysis";
const COMPACTION_PREFIX_CUSTOM_TYPE = "compaction-prefix";

type CustomMessage = AgentMessage & {
  role: "custom";
  customType?: unknown;
  content?: unknown;
};

type UserMessage = AgentMessage & {
  role: "user";
  content?: unknown;
  timestamp?: number;
};

type TextMessage = AgentMessage & {
  content?: unknown;
  summary?: unknown;
};

function isCompactionPrefixMessage(message: AgentMessage): message is CustomMessage {
  return message.role === "custom" && message.customType === COMPACTION_PREFIX_CUSTOM_TYPE;
}

function extractText(message: TextMessage): string | null {
  if (typeof message.content === "string") {
    const trimmed = message.content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!Array.isArray(message.content)) return null;
  const parts = message.content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const rec = block as { type?: unknown; text?: unknown };
      return rec.type === "text" && typeof rec.text === "string" ? rec.text : "";
    })
    .filter(Boolean);
  if (parts.length === 0) return null;
  const joined = parts.join("\n").trim();
  return joined.length > 0 ? joined : null;
}

function extractSummaryText(message: TextMessage): string | null {
  if (typeof message.summary !== "string") return null;
  const trimmed = message.summary.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSummary(summary: unknown): string | null {
  if (typeof summary !== "string") return null;
  const trimmed = summary.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildWrappedSummaryText(prefix: string, summary: string): string {
  return `${prefix}\n\n<conversation>\n${summary}\n</conversation>`;
}

function buildUserPrefixMessage(text: string, timestamp?: number): UserMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
  };
}

function isCompactionSummaryAssistant(message: AgentMessage): boolean {
  if (message.role !== "assistant") return false;
  const text = extractText(message as TextMessage) ?? "";
  return /context checkpoint compaction/i.test(text) || /compaction summary/i.test(text);
}

function isCompactionSummaryMessage(message: AgentMessage): boolean {
  return message.role === "compactionSummary";
}

function hasUserMessage(messages: AgentMessage[]): boolean {
  return messages.some((message) => message.role === "user");
}

function getLatestCompactionSummary(ctx: ExtensionContext): string | null {
  try {
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i] as { type?: unknown; summary?: unknown };
      if (entry?.type === "compaction" && typeof entry.summary === "string") {
        const trimmed = entry.summary.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export default function compactionSummaryPrefixExtension(api: ExtensionAPI): void {
  api.on("session_compact", (event) => {
    const summary = normalizeSummary((event.compactionEntry as { summary?: unknown })?.summary);
    if (!summary) {
      return;
    }
    const wrapped = buildWrappedSummaryText(COMPACTION_SUMMARY_PREFIX, summary);
    const ts = new Date(event.compactionEntry.timestamp).getTime();
    api.sendMessage(
      {
        customType: COMPACTION_PREFIX_CUSTOM_TYPE,
        content: wrapped,
        display: false,
        details: { compactionId: event.compactionEntry.id },
      },
      { triggerTurn: false },
    );
    // Debug: confirm compaction hook fired and message queued.
    // This uses info so it shows without debug flags.
    // eslint-disable-next-line no-console
    console.info("[agent/embedded] compaction prefix: queued prefix", {
      compactionId: event.compactionEntry.id,
      timestamp: ts,
    });
  });

  api.on("context", async (event, ctx) => {
    // eslint-disable-next-line no-console
    console.info("[agent/embedded] compaction prefix: context event", {
      count: event.messages.length,
      firstRoles: event.messages.slice(0, 5).map((msg) => msg.role),
      hasPrefix: event.messages.some(isCompactionPrefixMessage),
    });
    const prefixIndex = event.messages.findIndex(isCompactionPrefixMessage);
    const prefixMessage = prefixIndex >= 0 ? (event.messages[prefixIndex] as CustomMessage) : null;
    let prefixText: string | null = null;
    let prefixTimestamp: number | undefined;
    if (prefixMessage) {
      prefixText = extractText(prefixMessage as TextMessage);
      prefixTimestamp = prefixMessage.timestamp;
    }

    let prefixSource = "";
    if (!prefixText) {
      const compactionMessage = event.messages.find(isCompactionSummaryMessage) as
        | TextMessage
        | undefined;
      const summaryText = compactionMessage ? extractSummaryText(compactionMessage) : null;
      if (summaryText) {
        prefixText = buildWrappedSummaryText(COMPACTION_SUMMARY_PREFIX, summaryText);
        prefixSource = "context:compactionSummary";
      }
    }

    if (!prefixText) {
      const summaryText = getLatestCompactionSummary(ctx);
      if (summaryText) {
        prefixText = buildWrappedSummaryText(COMPACTION_SUMMARY_PREFIX, summaryText);
        prefixSource = "session:compactionEntry";
      }
    }

    if (!prefixText) return;

    if (!hasUserMessage(event.messages)) {
      // Only inject the prefix when a real user message is present.
      // This avoids creating a standalone user turn after manual /compact.
      return;
    }

    const rest = event.messages.filter((msg, idx) => {
      if (idx === prefixIndex) return false;
      if (isCompactionSummaryMessage(msg)) return false;
      if (isCompactionSummaryAssistant(msg)) return false;
      return true;
    });

    const userPrefix = buildUserPrefixMessage(prefixText, prefixTimestamp);
    const firstUserIndex = rest.findIndex((msg) => msg.role === "user");
    const restFromFirstUser = firstUserIndex >= 0 ? rest.slice(firstUserIndex) : rest;
    // eslint-disable-next-line no-console
    console.info("[agent/embedded] compaction prefix: injected user prefix", {
      source: prefixSource || (prefixMessage ? "context:custom" : "unknown"),
      insertIndex: 0,
      droppedLeading: firstUserIndex > 0 ? firstUserIndex : 0,
    });
    return { messages: [userPrefix, ...restFromFirstUser] };
  });
}
