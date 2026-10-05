// Server only: where each model's guess for a profile comes from. To keep API
// costs down, the first of:
//   1. our study, if the profile gives exactly the prompt of a persona we
//      tested (studyRuns.ts)
//   2. the shared cache of earlier live guesses for the same prompt (cache.ts)
//   3. a live call, which is then cached and saved as an anonymous record
//      (responses.ts)
// Profiles with free-text details always go live and are never cached or
// saved. Used by /api/predict and /api/whatif.
import "server-only";
import type { Prediction } from "@/lib/match";
import { MODELS, type ModelInfo } from "@/lib/models";
import { profileSystemPrompt, type UserProfile } from "@/lib/profile";
import { cachedPredictions, savePrediction } from "@/lib/server/cache";
import { predict } from "@/lib/server/gateway";
import { recordResponse } from "@/lib/server/responses";
import { studyPrediction } from "@/lib/server/studyRuns";

export type Plan = {
  profile: UserProfile;
  systemPrompt: string;
  /** Guesses available without a call. */
  ready: Map<string, Prediction>;
  /** Models that have to be asked live. */
  live: ModelInfo[];
};

/** Works out which guesses are free and which need a live call. */
export async function planGuesses(profile: UserProfile, modelIds: string[]): Promise<Plan> {
  const models = MODELS.filter((m) => modelIds.includes(m.id));
  const systemPrompt = profileSystemPrompt(profile);
  const ready = new Map<string, Prediction>();
  for (const { id } of models) {
    const fromStudy = studyPrediction(id, systemPrompt);
    if (fromStudy) ready.set(id, fromStudy);
  }
  // Free text is personal, so a profile with details never uses the shared
  // cache. (It can't match a study persona either: the prompt differs.)
  if (!profile.details) {
    const missing = models.filter((m) => !ready.has(m.id)).map((m) => m.id);
    for (const [id, prediction] of await cachedPredictions(missing, systemPrompt)) ready.set(id, prediction);
  }
  return { profile, systemPrompt, ready, live: models.filter((m) => !ready.has(m.id)) };
}

/** Sends the free guesses, then asks the rest live, sending each as it arrives. */
export async function runGuesses(plan: Plan, send: (prediction: Prediction) => void) {
  for (const prediction of plan.ready.values()) send(prediction);
  await Promise.all(
    plan.live.map(async ({ id }) => {
      const prediction = await predict(id, plan.systemPrompt, plan.profile.details);
      send(prediction);
      if (!plan.profile.details) {
        await Promise.all([savePrediction(prediction, plan.systemPrompt), recordResponse(prediction, plan.profile)]);
      }
    }),
  );
}

/** A newline-delimited JSON stream of whatever `fill` sends. */
export function ndjsonStream(fill: (send: (line: object) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await fill((line) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n")));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
