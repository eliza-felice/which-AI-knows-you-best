// Step 9, the wrap-up: the reflection quiz and the share card's sentence.
// Shared by the page and /api/card.
import { TRAIT_NAMES, type Dimension } from "@/lib/experiment";
import { MODELS, modelInfo } from "@/lib/models";

export type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  /** Shown after answering, right or wrong. */
  explain: string;
};

export const QUIZ: QuizQuestion[] = [
  {
    question: "An AI describes your personality in a confident, detailed way. What does that confidence tell you?",
    options: ["It's probably right", "Nothing about whether it's right", "It must have seen your data"],
    correct: 1,
    explain:
      "AIs write just as confidently when they're wrong. In the reveal, the boldest guess was rarely the closest one.",
  },
  {
    question: "In our study, which single fact changed the AIs' guesses the most?",
    options: ["Nationality", "Gender", "Job"],
    correct: 2,
    explain:
      "Job, by far: changing only the job moved the answers about 12 points on average, nationality only about 2.5. Same person, different stereotype.",
  },
  {
    question: "You ask the same AI the same question about the same person twice. What should you expect?",
    options: ["Exactly the same answer", "A somewhat different answer", "It refuses the second time"],
    correct: 1,
    explain:
      "Answers move by a few points every time, and asking one question at a time instead of all at once changes them even more.",
  },
];

/**
 * The share card's one sentence. No demographic details: just which AI was
 * closest and, if they all made the same wrong guess, what it was.
 */
export function cardSentence(card: ShareCard): string {
  const name = modelInfo(card.winner).name;
  if (!card.miss) return `${name} knew me best.`;
  const trait = TRAIT_NAMES[card.miss.d][card.miss.side];
  return `${name} knew me best, but ${card.miss.all ? "every AI" : "most AIs"} guessed I was ${trait}.`;
}

export type ShareCard = {
  winner: string;
  match: number;
  /** A trait most AIs got wrong, if any. */
  miss?: { d: Dimension; side: 0 | 1; all: boolean };
};

/** Card settings as URL parameters for /api/card, and back (rejecting anything odd). */
export function cardParams(card: ShareCard): string {
  const params = new URLSearchParams({ winner: card.winner, match: String(Math.round(card.match)) });
  if (card.miss) params.set("miss", `${card.miss.d}${card.miss.side}${card.miss.all ? "a" : "m"}`);
  return params.toString();
}

export function parseCard(params: URLSearchParams): ShareCard | null {
  const winner = params.get("winner") ?? "";
  const match = Number(params.get("match"));
  if (!MODELS.some((m) => m.id === winner) || !Number.isFinite(match) || match < 0 || match > 100) return null;
  const miss = params.get("miss");
  if (!miss) return { winner, match };
  const parsed = miss.match(/^(EI|SN|TF|JP|AT)([01])([am])$/);
  if (!parsed) return null;
  return {
    winner,
    match,
    miss: { d: parsed[1] as Dimension, side: Number(parsed[2]) as 0 | 1, all: parsed[3] === "a" },
  };
}
