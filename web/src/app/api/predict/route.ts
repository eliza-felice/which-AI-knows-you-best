// POST /api/predict  {profile: {age, gender, nationality, job, details}}
//
// Asks every model to answer the questionnaire as the user's profile, all in
// parallel, one repetition each. Replies stream back as newline-delimited
// JSON, one line per model as it finishes:
//   {"model": "gpt-5-mini", "status": "ok", "profile": {...}, "type": "INFJA", ...}
//   {"model": "gpt-4o-mini", "status": "failed", "reason": "timed out"}
// Nothing about the user is stored.
import { MODELS } from "@/lib/models";
import { normaliseProfile, profileSystemPrompt } from "@/lib/profile";
import { predict } from "@/lib/server/gateway";
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

  const refusal = await claimProfileRun(clientIp(request));
  if (refusal) return Response.json({ error: refusal }, { status: 429 });

  const systemPrompt = profileSystemPrompt(checked.profile);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await Promise.all(
        MODELS.map(async ({ id }) => {
          const prediction = await predict(id, systemPrompt, checked.profile.details);
          controller.enqueue(encoder.encode(JSON.stringify(prediction) + "\n"));
        }),
      );
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
