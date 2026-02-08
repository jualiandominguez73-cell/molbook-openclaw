#!/usr/bin/env node
/**
 * replylint.mjs
 *
 * Lightweight linter for short external-chat replies (WhatsApp/Signal/etc.).
 * Designed to catch common “oops” issues before you hit send.
 *
 * Usage:
 *   $ echo "Outcome: ..." | node scripts/replylint.mjs
 *   $ node scripts/replylint.mjs path/to/message.txt
 *   $ node scripts/replylint.mjs -   # read from stdin
 */

import fs from "node:fs";

function readStdin() {
  // fd 0 is stdin; readFileSync(0) is supported in Node 16+
  return fs.readFileSync(0, "utf8");
}

const argv = process.argv.slice(2);
const inputPath = argv[0];

let text = "";
if (!inputPath || inputPath === "-") {
  text = readStdin();
} else {
  text = fs.readFileSync(inputPath, "utf8");
}

// Normalize newlines for analysis.
text = text.replace(/\r\n/g, "\n");
const lines = text.split("\n");

const issues = [];
const warnings = [];

const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "";
if (firstNonEmpty && !/^(Outcome|Done):\s+/.test(firstNonEmpty)) {
  issues.push(
    "First non-empty line should start with 'Outcome:' or 'Done:' for quick readability.",
  );
}

const qCount = (text.match(/\?/g) ?? []).length;
if (qCount > 1) {
  issues.push(
    `Too many question marks: ${qCount}. Target is <= 1 (bundle clarifications into one question).`,
  );
}

if (text.includes("```")) {
  issues.push("Contains fenced code blocks (```); avoid for external chat surfaces.");
}

if (lines.some((l) => l.startsWith("#"))) {
  issues.push("Contains Markdown heading line(s) starting with '#'; avoid in external chat surfaces.");
}

// Command formatting: keep to <= 3 lines and prefix with `$ `.
const cmdLines = lines.filter((l) => l.trimStart().startsWith("$ "));
if (cmdLines.length > 3) {
  warnings.push(`Has ${cmdLines.length} command lines; guideline is <= 3.`);
}

const commandLike = lines.filter((l) => {
  const s = l.trim();
  if (!s) return false;
  if (s.startsWith("$ ")) return false;
  // Common command starts; this is intentionally conservative.
  return /^(openclaw|cd|ls|cat|tail|rg|jq|git|pnpm|bun|node|npm)\b/.test(s);
});
if (commandLike.length > 0) {
  warnings.push(
    `Command-like line(s) missing "$ " prefix (example: "${commandLike[0].trim()}").`,
  );
}

// URLs with query params add extra '?' and can violate the one-question rule.
const urlsWithQuery = text.match(/https?:\/\/\S*\?\S*/g) ?? [];
if (urlsWithQuery.length > 0) {
  warnings.push(
    `URL(s) contain '?'. Prefer canonical URLs without query params (example: ${urlsWithQuery[0]}).`,
  );
}

// Keep lines readable on mobile.
const longLines = lines
  .map((l, i) => ({ i: i + 1, len: l.length, l }))
  .filter(({ len }) => len > 110);
if (longLines.length > 0) {
  warnings.push(
    `Has ${longLines.length} long line(s) (>110 chars). Consider wrapping for readability (first: line ${longLines[0].i}).`,
  );
}

if (issues.length === 0 && warnings.length === 0) {
  process.stdout.write("REPLYLINT_OK\n");
  process.exit(0);
}

if (issues.length > 0) {
  process.stdout.write("REPLYLINT_FAIL\n\nIssues:\n");
  for (const i of issues) process.stdout.write(`- ${i}\n`);
  if (warnings.length > 0) process.stdout.write("\nWarnings:\n");
  for (const w of warnings) process.stdout.write(`- ${w}\n`);
  process.exit(1);
}

process.stdout.write("REPLYLINT_WARN\n\nWarnings:\n");
for (const w of warnings) process.stdout.write(`- ${w}\n`);
process.exit(0);
