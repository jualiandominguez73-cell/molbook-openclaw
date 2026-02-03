/**
 * Task classifier for dynamic model selection.
 * Analyzes prompts to determine the type of task and select appropriate models.
 */

export type TaskType = "coding" | "vision" | "reasoning" | "general";

/**
 * Keywords that indicate a coding-related task.
 */
const CODING_KEYWORDS = [
  // Actions
  "code",
  "implement",
  "write",
  "create",
  "build",
  "develop",
  "program",
  "script",
  // Code structures
  "function",
  "class",
  "method",
  "module",
  "component",
  "interface",
  "type",
  "enum",
  "struct",
  "variable",
  "const",
  "let",
  "var",
  // Operations
  "debug",
  "fix",
  "refactor",
  "optimize",
  "review",
  "test",
  "lint",
  "format",
  "compile",
  "transpile",
  // Languages
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "java",
  "kotlin",
  "swift",
  "c++",
  "c#",
  "ruby",
  "php",
  "scala",
  "elixir",
  "haskell",
  // Frameworks/Tools
  "react",
  "vue",
  "angular",
  "svelte",
  "node",
  "express",
  "fastapi",
  "django",
  "flask",
  "rails",
  "spring",
  "nextjs",
  "nuxt",
  "remix",
  "astro",
  // Development tools
  "git",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "docker",
  "kubernetes",
  "terraform",
  "ansible",
  // Data/API
  "api",
  "rest",
  "graphql",
  "database",
  "sql",
  "nosql",
  "mongodb",
  "postgres",
  "mysql",
  "redis",
  // Patterns
  "bug",
  "error",
  "exception",
  "issue",
  "pull request",
  "pr",
  "commit",
  "merge",
  "branch",
  "repository",
  "repo",
  // File types
  ".ts",
  ".js",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".swift",
  ".cpp",
  ".c",
  ".rb",
  ".php",
];

/**
 * Keywords that indicate a reasoning-heavy task.
 */
const REASONING_KEYWORDS = [
  "analyze",
  "explain",
  "think",
  "reason",
  "consider",
  "evaluate",
  "compare",
  "contrast",
  "plan",
  "design",
  "architect",
  "strategy",
  "decision",
  "tradeoff",
  "trade-off",
  "pros and cons",
  "advantages",
  "disadvantages",
  "implications",
  "consequences",
  "step by step",
  "step-by-step",
  "break down",
  "breakdown",
  "logical",
  "logic",
  "deduce",
  "infer",
  "conclude",
  "hypothesis",
  "theory",
  "proof",
  "prove",
  "derive",
  "derivation",
];

/**
 * Keywords that indicate vision/image-related tasks.
 */
const VISION_KEYWORDS = [
  "image",
  "picture",
  "photo",
  "screenshot",
  "diagram",
  "chart",
  "graph",
  "visual",
  "ui",
  "user interface",
  "design",
  "mockup",
  "wireframe",
  "layout",
  "look at",
  "see",
  "show",
  "display",
  "render",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
];

/**
 * Score a prompt against a set of keywords.
 */
function scoreKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      // Longer keywords get slightly higher weight
      score += 1 + keyword.length / 20;
    }
  }
  return score;
}

/**
 * Classify a task based on the prompt content.
 * Returns the most likely task type based on keyword analysis.
 */
export function classifyTask(prompt: string): TaskType {
  if (!prompt?.trim()) {
    return "general";
  }

  const lower = prompt.toLowerCase();

  // Check for explicit image/vision indicators first
  // These are strong signals that override other classifications
  const hasImageAttachment =
    lower.includes("[image]") ||
    lower.includes("attached image") ||
    lower.includes("this image") ||
    lower.includes("the image") ||
    /\.(png|jpg|jpeg|gif|webp|svg)\b/i.test(prompt);

  if (hasImageAttachment) {
    return "vision";
  }

  // Score each category
  const codingScore = scoreKeywords(prompt, CODING_KEYWORDS);
  const reasoningScore = scoreKeywords(prompt, REASONING_KEYWORDS);
  const visionScore = scoreKeywords(prompt, VISION_KEYWORDS);

  // Determine thresholds
  const CODING_THRESHOLD = 2.5; // Need multiple coding indicators
  const REASONING_THRESHOLD = 2.0; // Reasoning needs slightly less
  const VISION_THRESHOLD = 1.5; // Vision keywords are more specific

  // Check vision first (it's the most specific)
  if (
    visionScore >= VISION_THRESHOLD &&
    visionScore > codingScore &&
    visionScore > reasoningScore
  ) {
    return "vision";
  }

  // Coding tasks take priority if score is high enough
  if (codingScore >= CODING_THRESHOLD && codingScore >= reasoningScore) {
    return "coding";
  }

  // Reasoning tasks
  if (reasoningScore >= REASONING_THRESHOLD && reasoningScore > codingScore) {
    return "reasoning";
  }

  // Coding with lower threshold if it's the dominant category
  if (codingScore >= 1.5 && codingScore > reasoningScore && codingScore > visionScore) {
    return "coding";
  }

  return "general";
}

/**
 * Classify a task with confidence scores for each category.
 * Useful for debugging or advanced selection logic.
 */
export function classifyTaskWithScores(prompt: string): {
  type: TaskType;
  scores: {
    coding: number;
    reasoning: number;
    vision: number;
    general: number;
  };
} {
  const codingScore = scoreKeywords(prompt, CODING_KEYWORDS);
  const reasoningScore = scoreKeywords(prompt, REASONING_KEYWORDS);
  const visionScore = scoreKeywords(prompt, VISION_KEYWORDS);

  // General score is inverse of specificity
  const maxScore = Math.max(codingScore, reasoningScore, visionScore, 1);
  const generalScore = 1 / (1 + maxScore * 0.3);

  return {
    type: classifyTask(prompt),
    scores: {
      coding: codingScore,
      reasoning: reasoningScore,
      vision: visionScore,
      general: generalScore,
    },
  };
}

/**
 * Check if a prompt appears to be a coding task.
 */
export function isCodingTask(prompt: string): boolean {
  return classifyTask(prompt) === "coding";
}

/**
 * Check if a prompt appears to need vision capabilities.
 */
export function isVisionTask(prompt: string): boolean {
  return classifyTask(prompt) === "vision";
}

/**
 * Check if a prompt appears to need extended reasoning.
 */
export function isReasoningTask(prompt: string): boolean {
  return classifyTask(prompt) === "reasoning";
}
