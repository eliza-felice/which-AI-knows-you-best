"use client";
// Everything about the current visit lives in this browser tab only
// (sessionStorage): it survives a refresh and is gone when the tab closes.
// Test answers never leave the browser.
import { track as vercelTrack } from "@vercel/analytics";
import { DIMENSIONS, QUESTIONS, type Answers, type Question } from "@/lib/experiment";
import type { Prediction } from "@/lib/match";
import { MODELS } from "@/lib/models";
import type { UserProfile } from "@/lib/profile";

export type Step = "landing" | "profile" | "guessing" | "test" | "reveal";

export type Session = {
  step: Step;
  profile: UserProfile | null;
  /** The exact system prompt sent to the models, shown in the privacy lesson. */
  systemPrompt: string | null;
  predictions: Prediction[];
  /** Why the guesses couldn't be requested at all (e.g. the daily limit). */
  predictError: string | null;
  answers: Answers;
  questionIndex: number;
  testSubmittedAt: number | null;
  /** The podium countdown has been seen; coming back goes straight to the results. */
  revealed: boolean;
};

const KEY = "which-ai-knows-you:v1";

export const EMPTY_SESSION: Session = {
  step: "landing",
  profile: null,
  systemPrompt: null,
  predictions: [],
  predictError: null,
  answers: {},
  questionIndex: 0,
  testSubmittedAt: null,
  revealed: false,
};

export function loadSession(): Session {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (!saved) return EMPTY_SESSION;
    const session: Session = { ...EMPTY_SESSION, ...JSON.parse(saved) };
    // A refresh cuts off guesses that were still on their way; those models
    // count as "didn't answer" (asking again would cost another run).
    if (session.profile && !session.predictError && session.step !== "profile") {
      const answered = new Set(session.predictions.map((p) => p.model));
      session.predictions = [
        ...session.predictions,
        ...MODELS.filter((m) => !answered.has(m.id)).map((m): Prediction => ({
          model: m.id,
          status: "failed",
          reason: "page was reloaded",
        })),
      ];
    }
    return session;
  } catch {
    return EMPTY_SESSION;
  }
}

export function saveSession(session: Session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage blocked (e.g. private mode): the app still works, minus refresh.
  }
}

/** Start over: forgets the result and the explore ticks in this tab. */
export function clearSession() {
  try {
    for (const key of [KEY, VISITED_KEY]) sessionStorage.removeItem(key);
  } catch {}
}

/**
 * The same 60 statements the models answered, but taking one dimension at a
 * time in turn, so a person doesn't get ten extraversion questions in a row.
 */
export const TEST_ORDER: Question[] = (() => {
  const groups = DIMENSIONS.map((d) => QUESTIONS.filter((q) => q.dimension === d));
  const order: Question[] = [];
  for (let i = 0; order.length < QUESTIONS.length; i++) {
    for (const group of groups) if (group[i]) order.push(group[i]);
  }
  return order;
})();

/** Funnel events (no personal details). */
export function track(event: string, data?: Record<string, string | number>) {
  try {
    vercelTrack(event, data);
  } catch {}
}

/**
 * Asks /api/predict for every model's guess and reports each one as it
 * arrives. Resolves when all are in, or with an error message for the user.
 */
export async function requestPredictions(
  profile: UserProfile,
  onPrediction: (prediction: Prediction) => void,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
  } catch {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    return body?.error ?? "Something went wrong asking the AIs. Please try again.";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      break; // Connection dropped: whoever hasn't answered is marked by the caller.
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onPrediction(JSON.parse(line));
  }
  return null;
}

/** The explore screens seen in this tab, for the ticks on the Explore page. */
export type ExploreKey = "whatif" | "mask" | "reliability" | "playalong" | "lessons" | "research";
const VISITED_KEY = "which-ai-knows-you:visited";

export function markVisited(key: ExploreKey) {
  try {
    const seen = new Set(visited());
    seen.add(key);
    sessionStorage.setItem(VISITED_KEY, JSON.stringify([...seen]));
  } catch {}
}

export function visited(): ExploreKey[] {
  try {
    return JSON.parse(sessionStorage.getItem(VISITED_KEY) ?? "[]");
  } catch {
    return [];
  }
}
