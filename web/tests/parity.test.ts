// Checks the TypeScript port against the Python experiment code. The expected
// values in parity_fixtures.json are written by `python experiment/src/export_for_web.py`.
import { describe, expect, it } from "vitest";
import fixtures from "./parity_fixtures.json";
import {
  buildSystemPrompt,
  buildUserPrompt,
  calculatePercentages,
  calculateScores,
  parseAnswers,
  personalityType,
  validateAnswers,
  type Persona,
} from "@/lib/experiment";

describe("prompt builder matches Python", () => {
  it.each(fixtures.system_prompts)("system prompt for $prompt", ({ persona, prompt }) => {
    expect(buildSystemPrompt(persona as Persona)).toBe(prompt);
  });

  it("no-persona control has no system prompt", () => {
    expect(buildSystemPrompt(null)).toBe(fixtures.no_persona_prompt);
  });

  it("user prompt", () => {
    expect(buildUserPrompt()).toBe(fixtures.user_prompt);
  });
});

describe("scoring matches Python", () => {
  it.each(fixtures.scoring.map((s, i) => ({ ...s, i })))("answer set $i", (fixture) => {
    const answers = Object.fromEntries(Object.entries(fixture.answers).map(([id, a]) => [Number(id), a]));
    expect(validateAnswers(answers)).toBe(true);
    const percentages = calculatePercentages(calculateScores(answers));
    expect(percentages).toEqual(fixture.percentages);
    expect(personalityType(percentages)).toBe(fixture.type);
  });
});

describe("parsing model replies", () => {
  it("finds JSON inside extra text", () => {
    expect(parseAnswers('Sure! {"1": 2, "2": -3} Hope that helps')).toEqual({ 1: 2, 2: -3 });
  });

  it("skips a reasoning model's <think> block, braces and all", () => {
    expect(parseAnswers('<think>Maybe {"1": 3}? No.</think>\n{"1": 1, "2": 0}')).toEqual({ 1: 1, 2: 0 });
  });

  it("reads ratings written as text", () => {
    expect(parseAnswers('```json\n{"1": "-1", "2": "3"}\n```')).toEqual({ 1: -1, 2: 3 });
  });

  it("rejects a reply without JSON", () => {
    expect(() => parseAnswers("I can't answer that.")).toThrow();
  });

  it("rejects out-of-range, fractional and true/false answers", () => {
    const good = Object.fromEntries(Object.keys(fixtures.scoring[0].answers).map((id) => [Number(id), 0]));
    expect(validateAnswers(good)).toBe(true);
    expect(validateAnswers({ ...good, 1: 4 })).toBe(false);
    expect(validateAnswers({ ...good, 1: 1.5 })).toBe(false);
    expect(validateAnswers({ ...good, 1: true as unknown as number })).toBe(false);
    const missing = { ...good };
    delete missing[1];
    expect(validateAnswers(missing)).toBe(false);
  });
});
