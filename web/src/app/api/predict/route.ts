// POST /api/predict  {profile: {age, gender, nationality, job, details}}
//
// Every model's guess for the user's profile, one repetition each, streamed
// back as newline-delimited JSON, one line per model as it's ready:
//   {"model": "gpt-5-mini", "status": "ok", "profile": {...}, "type": "INFJA", "source": "live", ...}
//   {"model": "gpt-4o-mini", "status": "failed", "reason": "timed out"}
// Guesses come from the study, the shared cache or a live call, in that order
// (see lib/server/guesses.ts). Nothing that identifies the user is stored.
import { MODELS } from "@/lib/models";
import { normaliseProfile } from "@/lib/profile";
import { ndjsonStream, planGuesses, runGuesses } from "@/lib/server/guesses";
import { claimProfileRun, clientIp } from "@/lib/server/limits";

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

  const plan = await planGuesses(checked.profile, MODELS.map((m) => m.id));
  // Only live calls cost anything, so only they count towards the limits.
  if (plan.live.length > 0) {
    const refusal = await claimProfileRun(clientIp(request));
    if (refusal) return Response.json({ error: refusal }, { status: 429 });
  }
  return ndjsonStream((send) => runGuesses(plan, send));
}
