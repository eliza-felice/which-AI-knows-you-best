// Port of the experiment's prompt builder and scoring (src/personality_lab.py).
// The questions, instructions and model settings come from
// src/data/experiment.json, written by `python src/export_for_web.py`, so the
// app asks exactly what the experiment asked. tests/parity.test.ts checks this
// file against the Python code.
import experiment from "@/data/experiment.json";

export type Dimension = "EI" | "SN" | "TF" | "JP" | "AT";
export const DIMENSIONS: Dimension[] = ["EI", "SN", "TF", "JP", "AT"];

export type Question = {
  id: number;
  text: string;
  dimension: Dimension;
  direction: string;
};

export type Persona = {
  age: number;
  gender: string;
  nationality: string;
  occupation: string;
};

export type Answers = Record<number, number>;
/** Percentage for the first side of each dimension (E, S, T, J, A); 50 = no lean. */
export type Profile5 = Record<Dimension, number>;
export type ResponseFormat = "json_schema" | "json_object" | "none";

export const PROMPT_VERSION: number = experiment.prompt_version;
export const INSTRUCTIONS: string = experiment.instructions;
export const QUESTIONS = experiment.questions as Question[];
export const MODEL_SETTINGS = experiment.models as Record<
  string,
  { response_format: ResponseFormat }
>;

export const TRAIT_NAMES: Record<Dimension, [string, string]> = {
  EI: ["Extraverted", "Introverted"],
  SN: ["Observant", "Intuitive"],
  TF: ["Thinking", "Feeling"],
  JP: ["Judging", "Prospecting"],
  AT: ["Assertive", "Turbulent"],
};

export const ANSWER_MEANINGS: Record<number, string> = {
  [-3]: "strongly disagree",
  [-2]: "disagree",
  [-1]: "slightly disagree",
  0: "neutral",
  1: "slightly agree",
  2: "agree",
  3: "strongly agree",
};

const DIMENSION_COUNTS = QUESTIONS.reduce(
  (counts, q) => ({ ...counts, [q.dimension]: (counts[q.dimension] ?? 0) + 1 }),
  {} as Record<Dimension, number>,
);

/** 'Indian' -> 'an Indian', 'nurse' -> 'a nurse'. */
export function withArticle(word: string): string {
  return `${"aeiou".includes(word[0].toLowerCase()) ? "an" : "a"} ${word}`;
}

/** The persona as a system prompt, or null for the no-persona control. */
export function buildSystemPrompt(persona: Persona | null): string | null {
  if (!persona) return null;
  const [genderWord, pronoun] =
    ({ female: ["woman", "her"], male: ["man", "his"] } as Record<string, [string, string]>)[
      persona.gender.toLowerCase()
    ] ?? ["person", "their"];
  const age = persona.age;
  const ageDescription =
    age >= 20 ? `in ${pronoun} ${Math.floor(age / 10) * 10}s` : `aged ${age}`;
  return (
    `You are ${withArticle(persona.nationality)} ${genderWord} ` +
    `${ageDescription}, working as ${withArticle(persona.occupation)}.`
  );
}

export function buildUserPrompt(batch: Question[] = QUESTIONS): string {
  return INSTRUCTIONS + batch.map((q) => `${q.id}. ${q.text}`).join("\n");
}

/**
 * extra: more JSON fields to require after the ratings (the app's notes);
 * the experiment uses none.
 */
export function buildRequestFormat(
  format: ResponseFormat,
  batch: Question[] = QUESTIONS,
  extra: Record<string, object> = {},
) {
  if (format === "json_schema") {
    const answerSchema = { type: "integer", enum: [-3, -2, -1, 0, 1, 2, 3] };
    const properties = {
      ...Object.fromEntries(batch.map((q) => [String(q.id), answerSchema])),
      ...extra,
    };
    return {
      type: "json_schema",
      json_schema: {
        name: "personality_answers",
        strict: true,
        schema: {
          type: "object",
          properties,
          required: Object.keys(properties),
          additionalProperties: false,
        },
      },
    };
  }
  if (format === "json_object") return { type: "json_object" };
  return null;
}

/** The JSON object in a reply, tolerating extra text around it. */
export function parseReplyObject(content: string | null | undefined): Record<string, unknown> {
  // Some reasoning models (e.g. MiniMax) write their thinking, braces and all,
  // in <think>...</think> before the answer.
  const match = (content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object in reply");
  const parsed: unknown = JSON.parse(match[0]);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Reply is not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

/** Pull {question_id: rating} out of a reply. Keys that aren't numbers are ignored. */
export function parseAnswers(content: string | null | undefined): Answers {
  const answers: Answers = {};
  for (const [id, answer] of Object.entries(parseReplyObject(content))) {
    if (/^\d+$/.test(id)) answers[Number(id)] = answer as number;
  }
  return answers;
}

/** Every question answered exactly once, with a whole number from -3 to 3. */
export function validateAnswers(answers: Answers, batch: Question[] = QUESTIONS): boolean {
  const expected = new Set(batch.map((q) => q.id));
  const actual = Object.keys(answers).map(Number);
  if (actual.length !== expected.size || !actual.every((id) => expected.has(id))) return false;
  return Object.values(answers).every(
    (a) => typeof a === "number" && Number.isInteger(a) && a >= -3 && a <= 3,
  );
}

export function calculateScores(answers: Answers): Record<Dimension, number> {
  const scores: Record<Dimension, number> = { EI: 0, SN: 0, TF: 0, JP: 0, AT: 0 };
  for (const q of QUESTIONS) {
    scores[q.dimension] += q.direction === q.dimension[0] ? answers[q.id] : -answers[q.id];
  }
  return scores;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Same shape as the Python code: {EI: {E: 61.7, I: 38.3}, ...}. */
export function calculatePercentages(scores: Record<Dimension, number>) {
  const result = {} as Record<Dimension, Record<string, number>>;
  for (const d of DIMENSIONS) {
    // Each answer is worth up to 3 points, so the most extreme possible score
    // depends on how many questions this dimension has.
    const percentage = 50 + (scores[d] / (3 * DIMENSION_COUNTS[d])) * 50;
    result[d] = { [d[0]]: round1(percentage), [d[1]]: round1(100 - percentage) };
  }
  return result;
}

export function personalityType(percentages: ReturnType<typeof calculatePercentages>): string {
  return DIMENSIONS.map((d) =>
    percentages[d][d[0]] >= percentages[d][d[1]] ? d[0] : d[1],
  ).join("");
}

/** Answers -> first-side percentage per dimension, the form the app uses. */
export function scoreAnswers(answers: Answers): { profile: Profile5; type: string } {
  const percentages = calculatePercentages(calculateScores(answers));
  const profile = Object.fromEntries(
    DIMENSIONS.map((d) => [d, percentages[d][d[0]]]),
  ) as Profile5;
  return { profile, type: personalityType(percentages) };
}
