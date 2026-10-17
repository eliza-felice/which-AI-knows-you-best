import { describe, expect, it } from "vitest";
import { factsMentioned, highlightFacts } from "@/lib/insights";
import type { Ranked } from "@/lib/match";
import type { UserProfile } from "@/lib/profile";

const profile: UserProfile = {
  age: 21,
  gender: "female",
  nationality: "Singaporean",
  job: "student",
  details: "I love hiking and board games, and I have two cats. I volunteer at an animal shelter on weekends.",
};

function ranked(summary: string, noticed: string[] = []): Ranked {
  const guess = { EI: 50, SN: 50, TF: 50, JP: 50, AT: 50 };
  return { model: "m", rank: 1, match: 90, guess, summary, noticed, closeToNext: false };
}

describe("facts an AI's note mentions", () => {
  it("finds the job, paraphrased details, age and nationality", () => {
    const note = ranked(
      "As a young student in Singapore, your volunteering and caring for two cats suggested empathy.",
    );
    expect([...factsMentioned(note, profile)].sort()).toEqual(["age", "job", "nationality", "words"]);
  });

  it("doesn't count words that merely contain a fact", () => {
    // "human" contains "man"; "manage" too.
    expect(factsMentioned(ranked("You manage human relationships well."), profile).has("gender")).toBe(false);
  });

  it("marks the mentions, keeping all the text", () => {
    const summary = "A student who loves hiking.";
    const parts = highlightFacts(summary, profile);
    expect(parts.map((p) => p.text).join("")).toBe(summary);
    expect(parts.filter((p) => p.fact).map((p) => [p.text, p.fact])).toEqual([
      ["student", "job"],
      ["hiking", "words"],
    ]);
  });
});

describe("facts an AI rated", () => {
  it("counts facts it rated 2 or 3, ignoring its note's wording", () => {
    const note = {
      ...ranked("As a student in Singapore..."),
      influence: { job: 3, age: 2, gender: 0, nationality: 1, words: 2 },
    };
    expect([...factsMentioned(note, profile)].sort()).toEqual(["age", "job", "words"]);
  });
});
