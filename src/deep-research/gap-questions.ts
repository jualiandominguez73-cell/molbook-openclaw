import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { resolveConfiguredModelRef } from "../agents/model-selection.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { DEFAULT_AGENT_WORKSPACE_DIR, ensureAgentWorkspace } from "../agents/workspace.js";
import type { ClawdisConfig } from "../config/config.js";
import { loadConfig } from "../config/config.js";
import { logVerbose } from "../globals.js";

type GapPromptConfig = {
  version: string;
  language: string;
  questionCount: number;
  minWords: number;
  maxWords: number;
  template: string;
  retryTemplate?: string;
};

const PROMPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "prompts",
  "deep-research",
  "gap-questions.json",
);

let cachedPromptConfig: GapPromptConfig | undefined;

async function loadPromptConfig(): Promise<GapPromptConfig> {
  if (cachedPromptConfig) return cachedPromptConfig;
  const raw = await fs.readFile(PROMPT_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<GapPromptConfig>;
  if (
    !parsed ||
    typeof parsed.template !== "string" ||
    typeof parsed.questionCount !== "number" ||
    typeof parsed.minWords !== "number" ||
    typeof parsed.maxWords !== "number"
  ) {
    throw new Error("Invalid gap question prompt config");
  }
  cachedPromptConfig = {
    version: parsed.version ?? "1.0",
    language: parsed.language ?? "ru",
    questionCount: parsed.questionCount,
    minWords: parsed.minWords,
    maxWords: parsed.maxWords,
    template: parsed.template,
    retryTemplate: parsed.retryTemplate,
  };
  return cachedPromptConfig;
}

function renderTemplate(
  template: string,
  params: {
    request: string;
    questionCount: number;
    minWords: number;
    maxWords: number;
  },
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    if (key === "request") return params.request;
    if (key === "questionCount") return String(params.questionCount);
    if (key === "minWords") return String(params.minWords);
    if (key === "maxWords") return String(params.maxWords);
    return "";
  });
}

function normalizeRequest(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 500) return trimmed;
  return trimmed.slice(0, 500).trim();
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

export function parseGapQuestions(
  raw: string,
  config: Pick<GapPromptConfig, "questionCount" | "minWords" | "maxWords">,
): string[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const candidates: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split("?").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      candidates.push(...parts);
      continue;
    }
    candidates.push(line);
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
    if (questions.length >= config.questionCount) break;
  }
  return questions;
}

export async function generateGapQuestions(params: {
  request: string;
  cfg?: ClawdisConfig;
}): Promise<string[] | null> {
  const cfg = params.cfg ?? loadConfig();
  let config: GapPromptConfig;
  try {
    config = await loadPromptConfig();
  } catch (err) {
    logVerbose(
      `[deep-research] Failed to load gap question prompt config: ${String(err)}`,
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
    30_000,
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
      questionCount: config.questionCount,
      minWords: config.minWords,
      maxWords: config.maxWords,
    });
    const sessionId = crypto.randomUUID();
    const sessionFile = path.join(
      os.tmpdir(),
      `clawdis-gap-${sessionId}.jsonl`,
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
      const questions = parseGapQuestions(text, config);
      if (questions.length === config.questionCount) {
        return questions;
      }
    } catch (err) {
      logVerbose(
        `[deep-research] Gap question generation failed: ${String(err)}`,
      );
    }
  }

  return null;
}
