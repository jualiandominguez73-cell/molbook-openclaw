import { parseModelRef } from "../../agents/model-selection.js";

export type RelevanceModelRef = {
  provider: string;
  model: string;
};

const FAST_MODEL_MAP: Record<string, { provider: string; model: string }> = {
  anthropic: { provider: "anthropic", model: "claude-3-haiku-20240307" },
  openai: { provider: "openai", model: "gpt-4o-mini" },
  google: { provider: "google", model: "gemini-2.0-flash" },
};

/**
 * Resolves which model to use for relevance checking.
 * @param relevanceModelConfig - "auto" for provider-matched fast model, or explicit "provider/model"
 */
export function resolveRelevanceModel(params: {
  relevanceModelConfig: string;
  mainProvider: string;
  mainModel: string;
}): RelevanceModelRef {
  if (params.relevanceModelConfig !== "auto") {
    const parsed = parseModelRef(params.relevanceModelConfig, params.mainProvider);
    if (parsed) {
      return parsed;
    }
  }

  const providerKey = params.mainProvider.toLowerCase();
  const mapped = FAST_MODEL_MAP[providerKey];
  if (mapped) {
    return mapped;
  }

  return { provider: params.mainProvider, model: params.mainModel };
}

const RELEVANCE_PROMPT = `You are evaluating whether a message in a team chat requires a response from an AI assistant.

Context about the channel: {channelContext}
The assistant's role: {agentPersona}

Evaluate this message and decide if the assistant should respond. Consider:
- Is the message a question or request that the assistant could help with?
- Is the assistant being addressed directly or indirectly?
- Would a helpful team member naturally chime in here?
- Is this relevant to the assistant's expertise/role?

Do NOT respond to:
- General social chat ("lol", "nice", "thanks everyone")
- Messages clearly directed at specific humans
- Off-topic discussions unrelated to the assistant's role
- Simple acknowledgments or reactions

Message to evaluate:
{message}

Reply with exactly one line:
RESPOND: <brief reason why assistant should respond>
or
SKIP: <brief reason why assistant should stay silent>`;

export type RelevanceCheckResult = {
  shouldRespond: boolean;
  reason: string;
};

export type RelevanceRunner = (prompt: string) => Promise<{ text: string }>;

export async function checkMessageRelevance(params: {
  message: string;
  channelContext: string;
  agentPersona: string;
  runner: RelevanceRunner;
}): Promise<RelevanceCheckResult> {
  const prompt = RELEVANCE_PROMPT.replace("{channelContext}", params.channelContext)
    .replace("{agentPersona}", params.agentPersona)
    .replace("{message}", params.message);

  try {
    const result = await params.runner(prompt);
    const text = result.text.trim();

    if (text.toUpperCase().startsWith("RESPOND:")) {
      return {
        shouldRespond: true,
        reason: text.slice(8).trim(),
      };
    }

    if (text.toUpperCase().startsWith("SKIP:")) {
      return {
        shouldRespond: false,
        reason: text.slice(5).trim(),
      };
    }

    return {
      shouldRespond: false,
      reason: "Unclear relevance signal, defaulting to silent",
    };
  } catch (err) {
    return {
      shouldRespond: true,
      reason: `Relevance check failed: ${String(err)}`,
    };
  }
}
