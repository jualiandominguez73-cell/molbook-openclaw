import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { resolveConfiguredModelRef } from "../agents/model-selection.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import {
  DEFAULT_AGENT_WORKSPACE_DIR,
  ensureAgentWorkspace,
} from "../agents/workspace.js";
import type { ClawdisConfig } from "../config/config.js";
import { loadConfig } from "../config/config.js";
import { logVerbose } from "../globals.js";
import {
  MAX_DEEP_RESEARCH_TOPIC_LENGTH,
  normalizeDeepResearchTopic,
} from "./topic.js";

type TopicNormalizePromptConfig = {
  version: string;
  language: string;
  questionCount: number;
  minWords: number;
  maxWords: number;
  maxTopicChars: number;
  template: string;
  retryTemplate?: string;
};

export type TopicNormalizeResult = {
  topic: string;
  questions: string[];
};

const PROMPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "prompts",
  "deep-research",
  "topic-normalize.json",
);

let cachedPromptConfig: TopicNormalizePromptConfig | undefined;

async function loadPromptConfig(): Promise<TopicNormalizePromptConfig> {
  if (cachedPromptConfig) return cachedPromptConfig;
  const raw = await fs.readFile(PROMPT_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<TopicNormalizePromptConfig>;
  if (
    !parsed ||
    typeof parsed.template !== "string" ||
    typeof parsed.questionCount !== "number" ||
    typeof parsed.minWords !== "number" ||
    typeof parsed.maxWords !== "number" ||
    typeof parsed.maxTopicChars !== "number"
  ) {
    throw new Error("Invalid topic normalize prompt config");
  }
  cachedPromptConfig = {
    version: parsed.version ?? "1.0",
    language: parsed.language ?? "ru",
    questionCount: parsed.questionCount,
    minWords: parsed.minWords,
    maxWords: parsed.maxWords,
    maxTopicChars: parsed.maxTopicChars,
    template: parsed.template,
    retryTemplate: parsed.retryTemplate,
  };
  return cachedPromptConfig;
}

function renderTemplate(
  template: string,
  params: {
    request: string;
    extractedTopic: string;
    questionCount: number;
    minWords: number;
    maxWords: number;
    maxTopicChars: number;
  },
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    if (key === "request") return params.request;
    if (key === "extractedTopic") return params.extractedTopic;
    if (key === "questionCount") return String(params.questionCount);
    if (key === "minWords") return String(params.minWords);
    if (key === "maxWords") return String(params.maxWords);
    if (key === "maxTopicChars") return String(params.maxTopicChars);
    return "";
  });
}

function normalizeRequest(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 800) return trimmed;
  return trimmed.slice(0, 800).trim();
}

function extractJsonPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function normalizeQuestion(
  raw: string,
  minWords: number,
  maxWords: number,
): string | null {
  const cleaned = raw
    .replace(/^[\s\-\*\d.)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const stripped = cleaned.replace(/[?!。！？]+$/g, "").trim();
  if (!stripped) return null;

  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length < minWords) return null;

  const trimmed = words.length > maxWords ? words.slice(0, maxWords) : words;
  return `${trimmed.join(" ")}?`;
}

function normalizeQuestions(
  raw: unknown,
  config: Pick<TopicNormalizePromptConfig, "minWords" | "maxWords">,
): string[] {
  const candidates: string[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") candidates.push(entry);
    }
  } else if (typeof raw === "string") {
    candidates.push(...raw.split(/\r?\n/));
  }

  const questions: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeQuestion(
      candidate,
      config.minWords,
      config.maxWords,
    );
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(normalized);
  }
  return questions;
}

function normalizeTopic(raw: string, maxChars: number): string {
  let cleaned = raw.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  cleaned = cleaned.replace(/^[\s:,\.\-—]+/, "").trim();
  cleaned = cleaned.replace(/[\s:,\.\-—!?]+$/, "").trim();

  const normalized = normalizeDeepResearchTopic(cleaned);
  if (!normalized) return "";

  const bounded = normalized.topic.slice(0, maxChars).trim();
  return bounded;
}

export function parseTopicNormalizationResponse(
  raw: string,
  config: Pick<
    TopicNormalizePromptConfig,
    "minWords" | "maxWords" | "maxTopicChars"
  >,
): TopicNormalizeResult | null {
  const jsonPayload = extractJsonPayload(raw);
  if (!jsonPayload) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as { topic?: unknown; questions?: unknown };
  const maxChars = Math.min(
    config.maxTopicChars,
    MAX_DEEP_RESEARCH_TOPIC_LENGTH,
  );

  const topicRaw = typeof obj.topic === "string" ? obj.topic : "";
  const topic = normalizeTopic(topicRaw, maxChars);
  const questions = normalizeQuestions(obj.questions, config);

  if (!topic && questions.length === 0) return null;
  return { topic, questions };
}

export async function normalizeDeepResearchTopicWithLlm(params: {
  request: string;
  extractedTopic: string;
  cfg?: ClawdisConfig;
}): Promise<TopicNormalizeResult | null> {
  const cfg = params.cfg ?? loadConfig();
  let config: TopicNormalizePromptConfig;
  try {
    config = await loadPromptConfig();
  } catch (err) {
    logVerbose(
      `[deep-research] Failed to load topic normalize prompt config: ${String(err)}`,
    );
    return null;
  }
  const request = normalizeRequest(params.request);
  if (!request) return null;

  const workspaceDir = cfg.agent?.workspace ?? DEFAULT_AGENT_WORKSPACE_DIR;
  await ensureAgentWorkspace({ dir: workspaceDir, ensureBootstrapFiles: true });

  const resolvedModel = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  const timeoutMs = Math.min(
    Math.max(cfg.agent?.timeoutSeconds ?? 120, 1) * 1000,
    20_000,
  );
  const skillsSnapshot = {
    prompt: "",
    skills: [],
    resolvedSkills: [],
  };

  const templates = [config.template, config.retryTemplate].filter(
    (template): template is string => Boolean(template),
  );

  for (const template of templates) {
    const prompt = renderTemplate(template, {
      request,
      extractedTopic: params.extractedTopic,
      questionCount: config.questionCount,
      minWords: config.minWords,
      maxWords: config.maxWords,
      maxTopicChars: config.maxTopicChars,
    });
    const sessionId = crypto.randomUUID();
    const sessionFile = path.join(
      os.tmpdir(),
      `clawdis-topic-${sessionId}.jsonl`,
    );

    try {
      const runResult = await runEmbeddedPiAgent({
        sessionId,
        sessionFile,
        workspaceDir,
        config: cfg,
        skillsSnapshot,
        prompt,
        provider: resolvedModel.provider,
        model: resolvedModel.model,
        thinkLevel: "off",
        timeoutMs,
        runId: sessionId,
      });
      const text = (runResult.payloads ?? [])
        .map((payload) => payload.text ?? "")
        .join("\n")
        .trim();
      const parsed = parseTopicNormalizationResponse(text, config);
      if (parsed) {
        return parsed;
      }
    } catch (err) {
      logVerbose(
        `[deep-research] Topic normalization failed: ${String(err)}`,
      );
    }
  }

  return null;
}
