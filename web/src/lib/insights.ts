// Insights for the reveal, worked out from this user's result and the AIs'
// own notes. No extra model calls.
import { DIMENSIONS, TRAIT_NAMES, type Dimension, type Profile5 } from "@/lib/experiment";
import { confidence, sameSide, sideName, type Fact, type Ranked } from "@/lib/match";
import type { UserProfile } from "@/lib/profile";

export type { Fact };
export const FACT_LABELS: Record<Fact, string> = {
  age: "Age",
  gender: "Gender",
  nationality: "Nationality",
  job: "Job",
  words: "Your words",
};

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Common words that say nothing about the person.
const STOPWORDS = new Set(
  "about also always been from have into just like love loves make many more most much really some than that their them they this very want what when with would your enjoy".split(
    " ",
  ),
);

/** Key words from the user's own description, as patterns that also catch "volunteering" for "volunteer". */
function wordsPattern(details: string): RegExp | null {
  const stems = [
    ...new Set(
      (details.toLowerCase().match(/\p{L}{4,}/gu) ?? [])
        .filter((word) => !STOPWORDS.has(word))
        .map((word) => (word.length > 5 ? word.slice(0, 5) : word.replace(/s$/, ""))),
    ),
  ];
  return stems.length ? new RegExp(`\\b(${stems.map(escape).join("|")})\\w*`, "i") : null;
}

/** Patterns that show an AI's note mentions each fact about the user. */
export function factPatterns(profile: UserProfile): Partial<Record<Fact, RegExp>> {
  const decade = Math.floor(profile.age / 10) * 10;
  const nationality = profile.nationality;
  // "Singaporean" -> "Singapor" also catches "Singapore".
  const nationalityStem = nationality.slice(0, Math.max(5, nationality.length - 3));
  const jobWords = [profile.job, ...profile.job.split(" ").filter((w) => w.length >= 5)];
  const patterns: Partial<Record<Fact, RegExp>> = {
    age: new RegExp(
      `\\b(${decade}s|${profile.age}|age[ds]?|aging|years old|older|younger|young|mid-?life|mid-?career|retire\\w*|generation\\w*)\\b`,
      "i",
    ),
    gender: /\b(woman|women|female|man|men|male|gender|non-binary)\b/i,
    nationality: new RegExp(`\\b(${escape(nationalityStem)}\\w*|cultur\\w*)`, "i"),
    job: new RegExp(`\\b(${jobWords.map(escape).join("|")})\\w*|\\b(career|profession\\w*|job)\\b`, "i"),
  };
  const words = profile.details ? wordsPattern(profile.details) : null;
  if (words) patterns.words = words;
  return patterns;
}

/** An AI's own rating of a fact, 0 to 3, read as "shaped the guess" from 2 up. */
export const STRONG_INFLUENCE = 2;
export const INFLUENCE_WORDS = ["not at all", "a little", "somewhat", "a lot"];

/**
 * Which facts an AI says shaped its guess: those it rated 2 or 3 when it
 * rated them; otherwise (older guesses), mentions in its note and the quotes
 * it picked out of the user's description.
 */
export function factsMentioned(r: Ranked, profile: UserProfile): Set<Fact> {
  if (r.influence) {
    return new Set(
      (Object.entries(r.influence) as [Fact, number][]).filter(([, w]) => w >= STRONG_INFLUENCE).map(([f]) => f),
    );
  }
  const found = new Set<Fact>();
  for (const [fact, pattern] of Object.entries(factPatterns(profile)) as [Fact, RegExp][]) {
    if (pattern.test(r.summary)) found.add(fact);
  }
  if (profile.details && r.noticed.length > 0) found.add("words");
  return found;
}

/** Split a note into plain and highlighted parts, marking mentions of the user's facts. */
export function highlightFacts(summary: string, profile: UserProfile): { text: string; fact?: Fact }[] {
  const patterns = Object.entries(factPatterns(profile)) as [Fact, RegExp][];
  const parts: { text: string; fact?: Fact }[] = [];
  let rest = summary;
  while (rest) {
    let best: { index: number; length: number; fact: Fact } | null = null;
    for (const [fact, pattern] of patterns) {
      const match = pattern.exec(rest);
      if (match && (!best || match.index < best.index)) best = { index: match.index, length: match[0].length, fact };
    }
    if (!best) {
      parts.push({ text: rest });
      break;
    }
    if (best.index > 0) parts.push({ text: rest.slice(0, best.index) });
    parts.push({ text: rest.slice(best.index, best.index + best.length), fact: best.fact });
    rest = rest.slice(best.index + best.length);
  }
  return parts;
}

/** The trait most AIs agreed on, and whether the user is on that side. */
export function sharedAssumption(ranked: Ranked[], user: Profile5) {
  const options = DIMENSIONS.map((d) => {
    const leanFirst = ranked.filter((r) => r.guess[d] >= 50).length;
    const agreeing = Math.max(leanFirst, ranked.length - leanFirst);
    const side = leanFirst >= ranked.length - leanFirst ? 0 : 1;
    const average = ranked.reduce((sum, r) => sum + r.guess[d], 0) / ranked.length;
    const userSide = user[d] >= 50 ? 0 : 1;
    return { d, agreeing, side, average, wrong: side !== userSide, strength: Math.abs(average - 50) };
  });
  // Prefer a shared assumption that missed the user; then the strongest one.
  return options.sort(
    (a, b) => b.agreeing - a.agreeing || Number(b.wrong) - Number(a.wrong) || b.strength - a.strength,
  )[0];
}

/** The trait where the AIs disagreed most: same facts, opposite guesses. */
export function biggestSplit(ranked: Ranked[]) {
  return DIMENSIONS.map((d) => {
    const sorted = [...ranked].sort((a, b) => a.guess[d] - b.guess[d]);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    return { d, low, high, range: high.guess[d] - low.guess[d] };
  }).sort((a, b) => b.range - a.range)[0];
}

export function boldest(ranked: Ranked[]) {
  return [...ranked].sort((a, b) => confidence(b.guess) - confidence(a.guess))[0];
}

/** "74% Introverted" for a first-side percentage. */
export function lean(d: Dimension, value: number): string {
  return `${Math.round(value >= 50 ? value : 100 - value)}% ${sideName(d, value)}`;
}

export function traitPair(d: Dimension): string {
  return `${TRAIT_NAMES[d][0]} vs ${TRAIT_NAMES[d][1]}`;
}

export { sameSide };
