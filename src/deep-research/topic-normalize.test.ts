import { describe, expect, it } from "vitest";

import { parseTopicNormalizationResponse } from "./topic-normalize.js";

const CONFIG = {
  minWords: 3,
  maxWords: 5,
  maxTopicChars: 200,
};

describe("parseTopicNormalizationResponse", () => {
  it("parses JSON and normalizes topic/questions", () => {
    const raw =
      '{"topic":"  ситуация в Иране  ","questions":["Какой период времени","Какие источники использовать","Нужен фокус на жертвах"]}';
    const result = parseTopicNormalizationResponse(raw, CONFIG);

    expect(result).toEqual({
      topic: "ситуация в Иране",
      questions: [
        "Какой период времени?",
        "Какие источники использовать?",
        "Нужен фокус на жертвах?",
      ],
    });
  });

  it("extracts JSON embedded in extra text", () => {
    const raw =
      'Here is the result:\n{"topic":"тренды в одежде","questions":[]}';
    const result = parseTopicNormalizationResponse(raw, CONFIG);

    expect(result).toEqual({ topic: "тренды в одежде", questions: [] });
  });

  it("returns null for empty content", () => {
    const raw = "n/a";
    const result = parseTopicNormalizationResponse(raw, CONFIG);

    expect(result).toBeNull();
  });

  it("keeps only valid short questions", () => {
    const raw =
      '{"topic":"тренды","questions":["Срок?","Нужен фокус на сегментах рынка","География исследования","???"]}';
    const result = parseTopicNormalizationResponse(raw, CONFIG);

    expect(result).toEqual({
      topic: "тренды",
      questions: ["Нужен фокус на сегментах рынка?"],
    });
  });
});
