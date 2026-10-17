// Comparing each model's guess with the user's own result.
import { DIMENSIONS, TRAIT_NAMES, type Dimension, type Profile5 } from "@/lib/experiment";
import study from "@/data/study.json";

/** A fact about the user; "words" is their own description. */
export type Fact = "age" | "gender" | "nationality" | "job" | "words";

/** Differences smaller than this may just be run-to-run noise. */
export const CHANCE_GAP = 5;

export type Prediction =
  | {
      model: string;
      status: "ok";
      profile: Profile5;
      type: string;
      /** The model's own note: what it assumed about the user and why. */
      summary: string;
      /** Quotes from the user's own description that the model says shaped its answers. */
      noticed: string[];
      /** How much each fact shaped its ratings, 0 (not at all) to 3 (a lot), by its own account. */
      influence: Partial<Record<Fact, number>>;
      seconds: number;
      /**
       * Where the guess came from: asked live now, the shared cache of earlier
       * live guesses, or a saved run from our study (which has no note).
       */
      source?: "live" | "cache" | "study";
    }
  | { model: string; status: "failed"; reason: string };

export type Ranked = {
  model: string;
  rank: number;
  match: number;
  guess: Profile5;
  summary: string;
  noticed: string[];
  /** Missing for guesses saved before the AIs rated each fact. */
  influence?: Partial<Record<Fact, number>>;
  source?: "live" | "cache" | "study";
  /** Within CHANCE_GAP of the model ranked just below it. */
  closeToNext: boolean;
};

/** 100 minus the average point gap across the five traits. */
function matchScore(guess: Profile5, user: Profile5): number {
  const gaps = DIMENSIONS.map((d) => Math.abs(guess[d] - user[d]));
  return Math.round((100 - gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10;
}

/** How far from 50/50 the guess is on average, 0 (unsure) to 100 (extreme). */
export function confidence(guess: Profile5): number {
  const distances = DIMENSIONS.map((d) => Math.abs(guess[d] - 50) * 2);
  return Math.round(distances.reduce((a, b) => a + b, 0) / distances.length);
}

export function sameSide(a: number, b: number): boolean {
  return a >= 50 === b >= 50;
}

export function rankModels(predictions: Prediction[], user: Profile5): Ranked[] {
  const ranked = predictions
    .filter((p): p is Extract<Prediction, { status: "ok" }> => p.status === "ok")
    .map((p) => ({
      model: p.model,
      guess: p.profile,
      // Older saved sessions have no notes.
      summary: p.summary ?? "",
      noticed: p.noticed ?? [],
      influence: p.influence,
      source: p.source,
      match: matchScore(p.profile, user),
    }))
    .sort((a, b) => b.match - a.match);
  return ranked.map((r, i) => ({
    ...r,
    rank: i + 1,
    closeToNext: i + 1 < ranked.length && r.match - ranked[i + 1].match < CHANCE_GAP,
  }));
}

/** The side a percentage leans to, e.g. (EI, 26) -> "Introverted". */
export function sideName(d: Dimension, value: number): string {
  return TRAIT_NAMES[d][value >= 50 ? 0 : 1];
}

/** e.g. "74% Introverted", always given for the side it leans to. */
export function describeTrait(d: Dimension, value: number): string {
  const lean = value >= 50 ? value : 100 - value;
  return `${Math.round(lean)}% ${sideName(d, value)}`;
}

type StudyModel = { no_persona: Profile5; no_persona_runs: number };
const STUDY_MODELS = study.models as Record<string, StudyModel>;

/**
 * The no-information baseline: the model's average answers with no persona at
 * all (from the study), scored against the user. Shows whether knowing the
 * profile helped the guess.
 */
export function baseline(model: string, user: Profile5) {
  const entry = STUDY_MODELS[model];
  if (!entry) return null;
  return { guess: entry.no_persona, match: matchScore(entry.no_persona, user), runs: entry.no_persona_runs };
}
