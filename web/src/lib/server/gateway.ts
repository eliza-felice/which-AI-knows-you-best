// Server only: asks one model the full questionnaire, like the experiment's
// one_shot condition, plus a short note after the ratings. The API key never
// leaves the server.
import "server-only";
import { createHash } from "node:crypto";
import {
  MODEL_SETTINGS,
  buildRequestFormat,
  buildUserPrompt,
  parseAnswers,
  parseReplyObject,
  scoreAnswers,
  validateAnswers,
} from "@/lib/experiment";
import type { Fact, Prediction } from "@/lib/match";

/**
 * A model that hasn't answered in this time is marked "didn't answer". The
 * PRD says 30 seconds, but the slowest models take longer: gpt-5-mini and
 * DeepSeek V4.1 25 to 35 seconds with the note, and Qwen3.6 Flash over 40
 * seconds even without it. The test takes minutes, so the wait is still hidden.
 */
export const MODEL_TIMEOUT_MS = 60_000;

const GATEWAY_URL = process.env.MODEL_GATEWAY_URL ?? "https://api.apiyi.com/v1";

// The one difference from the experiment's prompt: after its ratings, the
// model adds a note on what it assumed and what it took from the person's
// own description. The ratings come first in the reply, so they are written
// before the note.
const NOTES_INSTRUCTION = `

After the ratings, step out of character and add three more keys to the same JSON object:
"summary": two or three sentences addressed to the person you played ("You..."), saying what personality you assumed and which facts about them led you there.
"influence": for each fact you were given, how much it shaped your ratings, from 0 (not at all) to 3 (a lot), like {"age": 1, "gender": 0, "nationality": 2, "job": 3, "description": 1}. "description" is the person's own words; give it 0 if there are none.
"noticed": up to 3 short quotes from the person's own description that most shaped your ratings, or [] if there is no description or none of it mattered.`;

// The facts the model rates; "description" is what the app calls "words".
const INFLUENCE_KEYS = { age: "age", gender: "gender", nationality: "nationality", job: "job", description: "words" } as const;
const weightSchema = { type: "integer", enum: [0, 1, 2, 3] };

const NOTES_SCHEMA = {
  summary: { type: "string" },
  influence: {
    type: "object",
    properties: Object.fromEntries(Object.keys(INFLUENCE_KEYS).map((key) => [key, weightSchema])),
    required: Object.keys(INFLUENCE_KEYS),
    additionalProperties: false,
  },
  noticed: { type: "array", items: { type: "string" } },
};

/**
 * Changes whenever the questions, instructions or note format change, so
 * cached guesses from an older prompt are never reused (see cache.ts).
 */
export const PROMPT_FINGERPRINT = createHash("sha256")
  .update(buildUserPrompt() + NOTES_INSTRUCTION + JSON.stringify(NOTES_SCHEMA))
  .digest("hex")
  .slice(0, 16);

const SUMMARY_MAX_LENGTH = 600;
const NOTICED_MAX = 3;
const NOTICED_MAX_LENGTH = 80;

function apiKey(): string {
  const key = process.env.MODEL_GATEWAY_API_KEY;
  if (!key) throw new Error("MODEL_GATEWAY_API_KEY is not set");
  return key;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

/**
 * The model's note, tidied. A "noticed" quote is kept only if it is really in
 * the person's description, so the app never shows words the user didn't write.
 */
function parseNotes(content: string, details: string) {
  const reply = parseReplyObject(content);
  const summary = cleanText(reply.summary, SUMMARY_MAX_LENGTH);
  const written = details.toLowerCase();
  const noticed = (Array.isArray(reply.noticed) ? reply.noticed : [])
    .map((quote) => cleanText(quote, NOTICED_MAX_LENGTH).replace(/^["'“]+|["'”.]+$/g, ""))
    .filter((quote) => quote && written.includes(quote.toLowerCase()))
    .slice(0, NOTICED_MAX);
  // How much each fact shaped the ratings, 0 to 3, by the model's own account.
  // Anything missing or out of range is left out rather than guessed.
  const raw = (typeof reply.influence === "object" && reply.influence) || {};
  const influence: Partial<Record<Fact, number>> = {};
  for (const [key, fact] of Object.entries(INFLUENCE_KEYS)) {
    const weight = Number((raw as Record<string, unknown>)[key]);
    if (Number.isInteger(weight) && weight >= 0 && weight <= 3) influence[fact] = weight;
  }
  // Without a description there is nothing of the user's own words to rely on.
  if (!details) delete influence.words;
  return { summary, noticed, influence };
}

async function askOnce(model: string, systemPrompt: string, details: string, signal: AbortSignal) {
  const format = buildRequestFormat(MODEL_SETTINGS[model].response_format, undefined, NOTES_SCHEMA);
  const response = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserPrompt() + NOTES_INSTRUCTION },
      ],
      ...(format ? { response_format: format } : {}),
    }),
    signal,
  });
  if (!response.ok) throw new Error(`gateway returned ${response.status}`);
  const body = await response.json();
  const content: string = body?.choices?.[0]?.message?.content ?? "";
  const answers = parseAnswers(content);
  if (!validateAnswers(answers)) throw new Error("invalid answers");
  return { answers, ...parseNotes(content, details) };
}

/**
 * One repetition for one model. An unusable reply is retried while there is
 * time left; after MODEL_TIMEOUT_MS the model is given up on.
 */
export async function predict(model: string, systemPrompt: string, details: string): Promise<Prediction> {
  const started = Date.now();
  const signal = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  let reason = "no answer";
  while (!signal.aborted) {
    try {
      const { answers, summary, noticed, influence } = await askOnce(model, systemPrompt, details, signal);
      const { profile, type } = scoreAnswers(answers);
      return {
        model,
        status: "ok",
        profile,
        type,
        summary,
        noticed,
        influence,
        seconds: (Date.now() - started) / 1000,
        source: "live",
      };
    } catch (error) {
      reason = signal.aborted ? "timed out" : (error as Error).message;
      console.warn(`[predict] ${model}: ${reason}`);
      if (Date.now() - started > MODEL_TIMEOUT_MS / 2) break; // Not enough time for another try.
    }
  }
  return { model, status: "failed", reason };
}
