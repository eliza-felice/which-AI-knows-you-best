// The what-if explorer, shared by the page and /api/whatif: which facts can
// change, and what our study found about changing them.
import { DIMENSIONS, TRAIT_NAMES, type Dimension } from "@/lib/experiment";
import study from "@/data/study.json";

export const WHATIF_FIELDS = ["age", "gender", "nationality", "job"] as const;
export type WhatIfField = (typeof WHATIF_FIELDS)[number];
export const MAX_WHATIF_MODELS = 3;

/** The study's name for each field. */
export const STUDY_ATTRIBUTE: Record<WhatIfField, string> = {
  age: "age",
  gender: "gender",
  nationality: "nationality",
  job: "occupation",
};

type Shifts = Record<string, Record<string, Record<Dimension, number>>>;
const SHIFTS = study.persona_shifts as Shifts;
export const BASE_PERSONA = study.base_persona;

/**
 * The study's biggest measured shift for one tested value, averaged over the
 * AIs, e.g. ("occupation", "nurse") -> 19 points more Extraverted than the
 * base persona. Null if the value wasn't tested.
 */
export function biggestShift(attribute: string, value: string) {
  const shifts = SHIFTS[attribute]?.[value];
  if (!shifts) return null;
  const d = [...DIMENSIONS].sort((a, b) => Math.abs(shifts[b]) - Math.abs(shifts[a]))[0];
  return { d, points: Math.round(Math.abs(shifts[d])), side: TRAIT_NAMES[d][shifts[d] >= 0 ? 0 : 1] };
}

/** How many values of each attribute the study tested, including the base. */
export function testedCount(field: WhatIfField): number {
  return (study.tested_values as Record<string, unknown[]>)[STUDY_ATTRIBUTE[field]].length;
}
