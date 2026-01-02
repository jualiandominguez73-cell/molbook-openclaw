import { describe, expect, it } from "vitest";

import { parseGapQuestions } from "./gap-questions.js";

const config = {
  questionCount: 3,
  minWords: 3,
  maxWords: 5,
};

function countWords(input: string) {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

describe("parseGapQuestions", () => {
  it("parses bullet lines into normalized questions", () => {
    const raw = [
      "- Kakoi rynok i srok?",
      "- Kakie istochniki nuzhny?",
      "- Kakoi format rezultata?",
    ].join("\n");

    expect(parseGapQuestions(raw, config)).toEqual([
      "Kakoi rynok i srok?",
      "Kakie istochniki nuzhny?",
      "Kakoi format rezultata?",
    ]);
  });

  it("splits multiple questions and enforces word limits", () => {
    const raw =
      "1) Ochen detalnyi vremennyi gorizont i sroki vypolneniia? " +
      "Kakie istochniki obyazatelny? Kakie ogranicheniia po obemu?";

    const result = parseGapQuestions(raw, config);
    expect(result).toHaveLength(3);
    for (const question of result) {
      expect(question.endsWith("?")).toBe(true);
      const words = countWords(question.replace(/[?]+$/, ""));
      expect(words).toBeGreaterThanOrEqual(config.minWords);
      expect(words).toBeLessThanOrEqual(config.maxWords);
    }
  });
});
