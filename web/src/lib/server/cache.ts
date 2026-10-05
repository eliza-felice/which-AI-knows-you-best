// Server only: the shared prediction cache. A guess for a profile with no
// free-text details is saved, keyed by the model and the exact prompt it was
// given, and reused for later visitors whose profile gives the same prompt
// (e.g. everyone in their 20s with the same gender, nationality and job).
// Nothing in it links to a person: the key is a hash, and the value is the
// model's guess. Profiles with free-text details are never cached.
//
//   CACHE_TTL_DAYS   how long a guess is reused (default 30), since models
//                    change over time
import "server-only";
import { createHash } from "node:crypto";
import type { Prediction } from "@/lib/match";
import { PROMPT_FINGERPRINT } from "@/lib/server/gateway";
import { getMany, set } from "@/lib/server/store";

type CachedPrediction = Extract<Prediction, { status: "ok" }>;

function ttlSeconds(): number {
  const days = Number(process.env.CACHE_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : 30) * 24 * 60 * 60;
}

function key(model: string, systemPrompt: string): string {
  const hash = createHash("sha256").update(`${PROMPT_FINGERPRINT}\n${model}\n${systemPrompt}`).digest("hex");
  return `prediction:${hash.slice(0, 32)}`;
}

/** Saved guesses for these models, by model id. A store error counts as a miss. */
export async function cachedPredictions(models: string[], systemPrompt: string) {
  const found = new Map<string, CachedPrediction>();
  try {
    const values = await getMany(models.map((model) => key(model, systemPrompt)));
    values.forEach((value, i) => {
      if (value) found.set(models[i], { ...(JSON.parse(value) as CachedPrediction), source: "cache" });
    });
  } catch (error) {
    console.warn("[cache] read failed:", (error as Error).message);
  }
  return found;
}

/** Saves a successful guess. Failures and guesses using free text are never saved. */
export async function savePrediction(prediction: Prediction, systemPrompt: string) {
  if (prediction.status !== "ok") return;
  try {
    const { source: _source, ...saved } = prediction; // eslint-disable-line @typescript-eslint/no-unused-vars
    await set(key(prediction.model, systemPrompt), JSON.stringify(saved), ttlSeconds());
  } catch (error) {
    console.warn("[cache] write failed:", (error as Error).message);
  }
}
