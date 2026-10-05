// Server only: every live guess for a profile without free text is saved as
// an anonymous record, so the app's responses become study data too. Nothing
// in a record identifies the visitor: the profile is stored as age group,
// gender, nationality and job, and profiles with free text aren't saved.
//
// Where it goes: an Upstash Redis list ("responses", newest first, up to
// MAX_RESPONSES) when Upstash is set up; otherwise, in development, the file
// web/.data/responses.jsonl. `node scripts/export-responses.mjs` turns either
// into a CSV next to the experiment data.
import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Prediction } from "@/lib/match";
import type { UserProfile } from "@/lib/profile";
import { PROMPT_FINGERPRINT } from "@/lib/server/gateway";
import { pushToList, usesUpstash } from "@/lib/server/store";

const MAX_RESPONSES = 100_000;
export const RESPONSES_KEY = "responses";
const LOCAL_FILE = path.join(process.cwd(), ".data", "responses.jsonl");

export async function recordResponse(prediction: Prediction, profile: UserProfile) {
  if (prediction.status !== "ok" || prediction.source !== "live" || profile.details) return;
  const record = {
    date: new Date().toISOString(),
    prompt_version: PROMPT_FINGERPRINT,
    model: prediction.model,
    age_group: profile.age >= 20 ? `${Math.floor(profile.age / 10) * 10}s` : String(profile.age),
    gender: profile.gender,
    nationality: profile.nationality,
    job: profile.job,
    type: prediction.type,
    ...Object.fromEntries(Object.entries(prediction.profile).map(([d, v]) => [`percentage_${d}`, v])),
    ...Object.fromEntries(Object.entries(prediction.influence).map(([f, w]) => [`influence_${f}`, w])),
    summary: prediction.summary,
    seconds: prediction.seconds,
  };
  try {
    if (usesUpstash()) {
      await pushToList(RESPONSES_KEY, JSON.stringify(record), MAX_RESPONSES);
    } else if (process.env.NODE_ENV !== "production") {
      await mkdir(path.dirname(LOCAL_FILE), { recursive: true });
      await appendFile(LOCAL_FILE, JSON.stringify(record) + "\n");
    }
  } catch (error) {
    console.warn("[responses] save failed:", (error as Error).message);
  }
}
