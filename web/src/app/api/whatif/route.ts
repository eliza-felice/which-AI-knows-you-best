// The what-if explorer.
//
// GET  /api/whatif
//   {"remaining": 7}: how many live what-ifs this visitor has left today
//   (null when there's no limit), without using one.
//
// POST /api/whatif  {profile, change: {field, value}, models: ["gpt-5-mini", ...]}
//   The chosen models' guesses for the user's profile and for the same profile
//   with exactly one thing changed. Streams newline-delimited JSON:
//     {"meta": {"live": 2, "remaining": 7}}   first: how many guesses need a live call
//     {"which": "before", "model": "gpt-5-mini", "status": "ok", ...}
//     {"which": "after", "model": "gpt-5-mini", "status": "ok", ...}
//
//   field "age" | "gender" | "nationality" | "job": only the four facts are
//     used, never free text, so guesses can come from the study or the cache.
//   field "words": the user's own description, changed to `value`. Only the
//     "after" guesses are sent: the page already has "before" from the reveal.
//     Free text is always asked live and never cached or saved.
import { MODELS } from "@/lib/models";
import { normaliseProfile, profileSystemPrompt, type UserProfile } from "@/lib/profile";
import { ndjsonStream, planGuesses, runGuesses, type Plan } from "@/lib/server/guesses";
import { claim, clientIp, remaining } from "@/lib/server/limits";
import { MAX_WHATIF_MODELS, WHATIF_FIELDS, type WhatIfField } from "@/lib/whatif";

export const maxDuration = 90;

export async function GET(request: Request) {
  return Response.json(
    { remaining: await remaining("whatif", clientIp(request)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    profile?: unknown;
    change?: { field?: string; value?: unknown };
    models?: unknown;
  } | null;

  const before = normaliseProfile({ ...(body?.profile as object), details: "" });
  if ("error" in before) return Response.json({ error: before.error }, { status: 400 });
  const field = body?.change?.field as WhatIfField;
  if (!WHATIF_FIELDS.includes(field)) return Response.json({ error: "Choose one thing to change." }, { status: 400 });

  const words = field === "words";
  const after = normaliseProfile(
    words ? { ...before.profile, details: body?.change?.value } : { ...before.profile, [field]: body?.change?.value },
  );
  if ("error" in after) return Response.json({ error: after.error }, { status: 400 });
  if (words && !after.profile.details) {
    return Response.json({ error: "Write something about yourself first." }, { status: 400 });
  }
  if (!words && profileSystemPrompt(after.profile) === profileSystemPrompt(before.profile)) {
    return Response.json(
      { error: "That doesn't change what the AIs see. (They're only told your age group, e.g. \"in your 20s\".)" },
      { status: 400 },
    );
  }

  const ids = Array.isArray(body?.models) ? [...new Set(body.models.map(String))] : [];
  const models = ids.filter((id) => MODELS.some((m) => m.id === id));
  if (models.length === 0 || models.length > MAX_WHATIF_MODELS || models.length !== ids.length) {
    return Response.json({ error: `Choose 1 to ${MAX_WHATIF_MODELS} AIs.` }, { status: 400 });
  }

  const plans: { which: "before" | "after"; plan: Plan }[] = [
    ...(words ? [] : [{ which: "before" as const, plan: await planGuesses(before.profile as UserProfile, models) }]),
    { which: "after", plan: await planGuesses(after.profile as UserProfile, models) },
  ];
  const live = plans.reduce((sum, { plan }) => sum + plan.live.length, 0);
  let left: number | null = null;
  // A what-if answered entirely from the study or the cache is free and isn't counted.
  if (live > 0) {
    const result = await claim("whatif", clientIp(request));
    if ("refusal" in result) return Response.json({ error: result.refusal }, { status: 429 });
    left = Number.isFinite(result.remaining) ? result.remaining : null;
  }

  return ndjsonStream(async (send) => {
    send({ meta: { live, remaining: left } });
    await Promise.all(plans.map(({ which, plan }) => runGuesses(plan, (prediction) => send({ which, ...prediction }))));
  });
}
