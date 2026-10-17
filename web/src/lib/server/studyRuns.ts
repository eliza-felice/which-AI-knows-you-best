// Server only: guesses from our study. When a visitor's profile gives exactly
// the same prompt as a persona in the experiment (e.g. a Singaporean woman in
// her 30s working as a software engineer), each model's guess is one of its
// saved study runs, picked at random, so no API call is needed. The study
// asked for ratings only, so these guesses have no note.
// study-runs.json is written by `python experiment/src/export_for_web.py`.
import "server-only";
import runs from "@/data/study-runs.json";
import type { Profile5 } from "@/lib/experiment";
import type { Prediction } from "@/lib/match";

type Run = { profile: Profile5; type: string };
const RUNS = runs as Record<string, Record<string, Run[]>>;

export function studyPrediction(model: string, systemPrompt: string): Prediction | null {
  const options = RUNS[systemPrompt]?.[model];
  if (!options?.length) return null;
  const run = options[Math.floor(Math.random() * options.length)];
  return {
    model,
    status: "ok",
    profile: run.profile,
    type: run.type,
    summary: "",
    noticed: [],
    influence: {},
    seconds: 0,
    source: "study",
  };
}
