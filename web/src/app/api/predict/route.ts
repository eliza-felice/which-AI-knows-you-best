// POST /api/predict  {profile: {age, gender, nationality, job, details}}
//
// Asks every model to answer the questionnaire as the user's profile, all in
// parallel, one repetition each. Replies stream back as newline-delimited
// JSON, one line per model as it finishes:
//   {"model": "gpt-5-mini", "status": "ok", "profile": {...}, "type": "INFJA", "source": "live", ...}
//   {"model": "gpt-4o-mini", "status": "failed", "reason": "timed out"}
//
// To keep API costs down, each model's guess comes from the first of:
//   1. our study, if the profile gives exactly the prompt of a persona we
//      tested (studyRuns.ts)
//   2. the shared cache of earlier live guesses for the same prompt (cache.ts)
//   3. a live call, which is then cached and saved as an anonymous record
//      (responses.ts)
// Profiles with free-text details always go live and are never cached or saved.
import { MODELS } from "@/lib/models";
import type { Prediction } from "@/lib/match";
import { normaliseProfile, profileSystemPrompt } from "@/lib/profile";
import { cachedPredictions, savePrediction } from "@/lib/server/cache";
import { predict } from "@/lib/server/gateway";
import { claimProfileRun, clientIp } from "@/lib/server/limits";
import { recordResponse } from "@/lib/server/responses";
import { studyPrediction } from "@/lib/server/studyRuns";

// The slowest model can take up to 60 seconds (MODEL_TIMEOUT_MS); leave room on top.
export const maxDuration = 90;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const checked = normaliseProfile((body as { profile?: unknown })?.profile);
  if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });

  const profile = checked.profile;
  const systemPrompt = profileSystemPrompt(profile);
  // Free text is personal, so a profile with details never uses or fills the
  // shared cache. (It can't match a study persona either: the prompt differs.)
  const shareable = !profile.details;

  const ready = new Map<string, Prediction>();
  for (const { id } of MODELS) {
    const fromStudy = studyPrediction(id, systemPrompt);
    if (fromStudy) ready.set(id, fromStudy);
  }
  if (shareable) {
    const fromCache = await cachedPredictions(
      MODELS.filter((m) => !ready.has(m.id)).map((m) => m.id),
      systemPrompt,
    );
    for (const [id, prediction] of fromCache) ready.set(id, prediction);
  }
  const live = MODELS.filter((m) => !ready.has(m.id));

  // Only live calls cost anything, so only they count towards the limits.
  if (live.length > 0) {
    const refusal = await claimProfileRun(clientIp(request));
    if (refusal) return Response.json({ error: refusal }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (prediction: Prediction) =>
        controller.enqueue(encoder.encode(JSON.stringify(prediction) + "\n"));
      for (const prediction of ready.values()) send(prediction);
      await Promise.all(
        live.map(async ({ id }) => {
          const prediction = await predict(id, systemPrompt, profile.details);
          send(prediction);
          if (shareable) {
            await Promise.all([savePrediction(prediction, systemPrompt), recordResponse(prediction, profile)]);
          }
        }),
      );
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
