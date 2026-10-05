"use client";
// After the podium: the full ranking, what each AI thought of the user (in its
// own words), and a few insights that each look at the result from a
// different angle. Everything comes from this one set of guesses.
import Link from "next/link";
import { useState } from "react";
import { Character } from "@/components/Character";
import { Button, ChanceNote, HandTitle, LessonBlock, ModelChip, TraitBars } from "@/components/ui";
import { DIMENSIONS, QUESTIONS, TRAIT_NAMES, type Profile5 } from "@/lib/experiment";
import {
  FACT_LABELS,
  INFLUENCE_WORDS,
  biggestSplit,
  boldest,
  factsMentioned,
  highlightFacts,
  lean,
  sharedAssumption,
  traitPair,
  type Fact,
} from "@/lib/insights";
import { CHANCE_GAP, baseline, confidence, sameSide, type Ranked } from "@/lib/match";
import { modelInfo } from "@/lib/models";
import type { UserProfile } from "@/lib/profile";
import type { Session } from "@/lib/session";
import study from "@/data/study.json";

// Highlight colours for each fact in the AIs' notes (fills behind ink text).
const FACT_MARKS: Record<Fact, string> = {
  age: "#E2C566",
  gender: "#9CC3D5",
  nationality: "#D98A5F",
  job: "#B9C5E6",
  words: "#B7D3C3",
};

export function Results({
  session,
  user,
  ranked,
  onStartOver,
}: {
  session: Session;
  user: { profile: Profile5; type: string };
  ranked: Ranked[];
  onStartOver: () => void;
}) {
  const failed = session.predictions.filter((p) => p.status === "failed");
  const profile = session.profile!;
  const [selected, setSelected] = useState(ranked[0]?.model ?? null);
  const [confirming, setConfirming] = useState(false);
  const selectedRank = ranked.find((r) => r.model === selected);

  return (
    <main className="screen mx-auto w-full max-w-2xl flex-1 space-y-14 px-4 pt-8 pb-16 sm:px-6">
      <section>
        {ranked.length > 0 ? (
          <HandTitle className="text-4xl!">{modelInfo(ranked[0].model).name} guessed closest</HandTitle>
        ) : (
          <HandTitle>None of the AIs answered</HandTitle>
        )}
        <p className="mt-2 text-ink-soft">
          Match = 100 minus the average gap, in percentage points, between an AI&rsquo;s guess and your own answers
          across the five traits. Your result: <span className="font-medium text-ink">{user.type}</span>.
        </p>

        <ol className="mt-6">
          {ranked.map((r) => (
            <li key={r.model} className="flex items-center gap-3 border-b border-line py-3">
              <span className="w-7 font-hand text-2xl">{r.rank}</span>
              <Character slot={modelInfo(r.model).character} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{modelInfo(r.model).name}</span>
                  <span className="font-medium whitespace-nowrap">
                    {r.match.toFixed(1)}
                    <span className={`ml-1 inline-block w-3 text-ink-soft ${r.closeToNext ? "" : "invisible"}`}>≈</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-line/60">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(0, r.match)}%`, background: modelInfo(r.model).colour }}
                  />
                </div>
              </div>
            </li>
          ))}
          {failed.map((p) => (
            <li key={p.model} className="flex items-center gap-3 border-b border-line py-3 text-ink-soft">
              <span className="w-7" />
              <span className="opacity-50">
                <Character slot={modelInfo(p.model).character} size={40} />
              </span>
              <span className="flex-1">{modelInfo(p.model).name}</span>
              <span className="text-sm">didn&rsquo;t answer</span>
            </li>
          ))}
        </ol>
        {ranked.some((r) => r.closeToNext) && (
          <p className="mt-3 text-sm text-ink-soft">
            ≈ less than {CHANCE_GAP} points ahead of the next AI, so the order between them may be chance.
          </p>
        )}
        <ChanceNote className="mt-1" />
      </section>

      {selected && selectedRank && (
        <section>
          <h2 className="text-2xl">What each AI thought of you</h2>
          <p className="mt-1 text-ink-soft">After answering as you, each AI wrote a short note about its guess.</p>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Choose an AI">
            {ranked.map((r) => (
              <button
                key={r.model}
                role="tab"
                aria-selected={selected === r.model}
                onClick={() => setSelected(r.model)}
                className={`press min-h-11 rounded-full border px-3 text-sm ${
                  selected === r.model ? "border-ink bg-cream" : "border-line"
                }`}
              >
                <ModelChip model={r.model} />
              </button>
            ))}
          </div>
          <div className="mt-6 space-y-6 rounded-card border-[1.5px] border-ink bg-cream p-4 sm:p-5">
            <Note r={selectedRank} profile={profile} user={user.profile} />
            <div className="pt-2">
              <p className="text-sm text-ink-soft">The black dot is you; the coloured dot is its guess.</p>
              <TraitBars user={user.profile} guess={selectedRank.guess} model={selectedRank.model} />
            </div>
          </div>
        </section>
      )}

      {ranked.length > 0 && (
        <section className="space-y-12">
          <h2 className="text-2xl">What stood out</h2>
          <WhatTheyUsed ranked={ranked} profile={profile} />
          <SharedAssumption ranked={ranked} user={user.profile} />
          <Split ranked={ranked} />
          <BoldVsRight ranked={ranked} />
          <Baseline ranked={ranked} user={user.profile} />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/lessons"
          className="press inline-flex h-12 items-center rounded-full bg-cobalt px-7 font-medium text-cobalt-ink"
        >
          More about AI and you
        </Link>
        <Button variant="outline" onClick={() => (confirming ? onStartOver() : setConfirming(true))}>
          {confirming ? "Erase my results?" : "Start over"}
        </Button>
        {confirming && (
          <p className="w-full text-sm text-ink-soft">
            Tap again to erase your results and start over. Each visitor gets one set of guesses per day.
          </p>
        )}
      </div>
    </main>
  );
}

/** One AI's note, with mentions of the user's facts highlighted. */
function Note({ r, profile, user }: { r: Ranked; profile: UserProfile; user: Profile5 }) {
  const parts = r.summary ? highlightFacts(r.summary, profile) : [];
  const facts = factsMentioned(r, profile);
  return (
    <div>
      <p className="text-sm font-medium">In its own words</p>
      {r.summary ? (
        <blockquote className="mt-1 text-[17px] leading-relaxed">
          &ldquo;
          {parts.map((part, i) =>
            part.fact ? (
              <mark key={i} className="rounded px-0.5 text-ink" style={{ background: FACT_MARKS[part.fact] }}>
                {part.text}
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
          &rdquo;
        </blockquote>
      ) : (
        <p className="mt-1 text-ink-soft">This AI didn&rsquo;t write a note.</p>
      )}
      <p className="mt-3 text-sm text-ink-soft">
        {facts.size > 0
          ? `It says it went on: ${[...facts].map((f) => FACT_LABELS[f].toLowerCase()).join(", ")}.`
          : "It didn't name any of your facts."}{" "}
        It put you on the same side as your own answers for{" "}
        {DIMENSIONS.filter((d) => sameSide(r.guess[d], user[d])).length} of 5 traits.
      </p>
      {r.noticed.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium">Picked up from what you wrote</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {r.noticed.map((quote) => (
              <li key={quote} className="rounded-full px-3 py-1 text-sm" style={{ background: FACT_MARKS.words }}>
                &ldquo;{quote}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** What the AIs say drove their guesses, next to what the study measured. */
/** How much each fact shaped the guesses by the AIs' own account, next to what the study measured. */
function WhatTheyUsed({ ranked, profile }: { ranked: Ranked[]; profile: UserProfile }) {
  const rated = ranked.filter((r) => r.influence && Object.keys(r.influence).length > 0);
  // Guesses made before the AIs rated each fact have nothing to show.
  if (rated.length === 0) {
    return (
      <p className="text-ink-soft">
        These guesses were made before the AIs started rating what shaped them, so we can&rsquo;t show what they say
        they went on. Start over to see it.
      </p>
    );
  }
  const effects = study.attribute_effect as Record<string, number>;
  const measured: Partial<Record<Fact, number>> = {
    job: effects.occupation,
    age: effects.age,
    gender: effects.gender,
    nationality: effects.nationality,
  };
  const facts: Fact[] = ["job", "age", "gender", "nationality", ...(profile.details ? (["words"] as Fact[]) : [])];
  const rows = facts.map((f) => {
    const weights = rated.map((r) => r.influence![f]).filter((w): w is number => w !== undefined);
    const average = weights.length ? weights.reduce((x, y) => x + y, 0) / weights.length : 0;
    return { f, average, alot: weights.filter((w) => w === 3).length };
  });
  const byClaim = [...rows].sort((x, y) => y.average - x.average);
  const name = (f: Fact) => (f === "words" ? "your own words" : `your ${FACT_LABELS[f].toLowerCase()}`);
  // Facts they say barely mattered, though the study measured them moving the answers.
  const downplayed = rows.filter((row) => row.average < 1 && (measured[row.f] ?? 0) >= 2);

  return (
    <LessonBlock
      title="What they say they went on"
      question="If an AI tells you why it reached a conclusion about you, how could you check whether that's really why?"
      speaker={3}
      answer={
        <>
          <p>
            Change one thing and ask again. If an AI says your job drove its guess, swap the job and see whether the
            guess moves. That is how our study measured influence: one fact changed at a time.
          </p>
          <p>
            An AI&rsquo;s explanation of its own reasoning is more generated text. It can sound convincing without
            describing what actually happened inside the model. Researchers call an explanation that does match
            &ldquo;faithful&rdquo;, and checking it is an open problem in AI safety.
          </p>
        </>
      }
    >
      <p>
        After guessing, each AI rated how much each fact about you shaped its answers, from 0 (not at all) to 3 (a
        lot). By their own account, {name(byClaim[0].f)} mattered most and {name(byClaim[byClaim.length - 1].f)}{" "}
        least.
      </p>
      <div>
        <div className="flex justify-between border-b border-ink pb-1 text-sm font-medium">
          <span>What the AIs say (average of {rated.length})</span>
          <span>Measured in our study</span>
        </div>
        <ul>
          {rows.map(({ f, average, alot }) => (
            <li key={f} className="flex items-center gap-3 border-b border-line py-2.5">
              <div className="min-w-0 flex-1">
                <span className="rounded px-1.5 font-medium" style={{ background: FACT_MARKS[f] }}>
                  {FACT_LABELS[f]}
                </span>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 w-24 shrink-0 rounded-full bg-line/60">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(average / 3) * 100}%` }} />
                  </div>
                  <span className="text-sm text-ink-soft">
                    {INFLUENCE_WORDS[Math.round(average)]}
                    {alot > 0 ? ` · ${alot} said "a lot"` : ""}
                  </span>
                </div>
              </div>
              <span className="w-24 shrink-0 text-right text-sm">
                {measured[f] !== undefined ? (
                  <>
                    <span className="font-medium">{measured[f]}</span> pts
                  </>
                ) : (
                  <span className="text-ink-soft">see below</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-sm text-ink-soft">
          Measured: how far the answers moved, on average, when we changed only that fact.
        </p>
      </div>
      <p>
        {downplayed.length > 0
          ? `They say ${joinWords(downplayed.map((d) => name(d.f)))} barely mattered, but in our study changing ${downplayed.length > 1 ? "each of those" : "it"} still moved the answers. An AI's account of itself and what it actually does can differ.`
          : "Their account roughly matches the order we measured, but only an experiment can show how much each fact really moved the guess."}
      </p>
      {profile.details && (
        <p>
          On your own words: in a small test of ours (one run per AI), hobbies like &ldquo;hiking and board
          games&rdquo; moved the answers only about 6 points, about the size of chance, while describing personality
          directly (&ldquo;I avoid social events&rdquo;) moved them 19 to 35 points.
        </p>
      )}
    </LessonBlock>
  );
}

function joinWords(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0];
}

function SharedAssumption({ ranked, user }: { ranked: Ranked[]; user: Profile5 }) {
  const shared = sharedAssumption(ranked, user);
  const side = TRAIT_NAMES[shared.d][shared.side];
  const all = shared.agreeing === ranked.length;
  // Statements where agreeing points to this side. If most do, a habit of
  // agreeing alone pushes the score that way (see results.md, Limitations).
  const statements = QUESTIONS.filter((q) => q.dimension === shared.d);
  const pointing = statements.filter((q) => q.direction === shared.d[shared.side]).length;
  const testLeans = pointing > statements.length / 2 + 1;
  return (
    <LessonBlock
      title={shared.wrong ? "The assumption they shared" : "What they all got right"}
      question={
        shared.wrong
          ? "What in your profile do you think made them all assume that?"
          : "Was that insight about you, or a safe bet about anyone with your profile?"
      }
      speaker={2}
      answer={
        shared.wrong ? (
          <p>
            Usually the job, sometimes age. In our study the job had by far the biggest effect: describing the same
            person as a salesperson instead of a software engineer made the AIs{" "}
            {Math.round(study.persona_shifts.occupation.salesperson.EI)} points more Extraverted. When every AI makes
            the same leap, it comes from patterns they share (how people like you tend to be written about), not
            from anything they found out about you.
          </p>
        ) : (
          <p>
            Probably a safe bet. The AIs would have guessed the same for anyone with your age, gender, nationality and
            job; they never saw your answers. A guess can be right about you and still be a stereotype, one you
            happen to fit.
          </p>
        )
      }
    >
      <p>
        {all ? "All" : `${shared.agreeing} of`} {ranked.length} AIs guessed you are {side} (on average{" "}
        {lean(shared.d, shared.average)}).{" "}
        {shared.wrong ? (
          <>
            You are actually <strong className="font-medium">{lean(shared.d, user[shared.d])}</strong>.
          </>
        ) : (
          <>You are: {lean(shared.d, user[shared.d])}.</>
        )}
      </p>
      <p>
        {shared.wrong
          ? "When different AIs, built by different companies, make the same wrong guess, it usually comes from the same source: a common idea in their training data of what people like you are like."
          : "Agreement between AIs isn't proof, though: they learned from much of the same text, so they tend to share the same assumptions, right or wrong."}
      </p>
      {testLeans && (
        <p>
          Part of this may be the test itself: {pointing} of its {statements.length} statements on this trait point to{" "}
          {side}, so simply tending to agree pushes the score that way.
        </p>
      )}
    </LessonBlock>
  );
}

function Split({ ranked }: { ranked: Ranked[] }) {
  const split = biggestSplit(ranked);
  if (split.range < 25) return null;
  // The same trait with no persona at all, from the study.
  const defaults = Object.values(study.models as Record<string, { no_persona: Profile5 }>).map(
    (m) => m.no_persona[split.d],
  );
  const opposite = !sameSide(split.low.guess[split.d], split.high.guess[split.d]);
  return (
    <LessonBlock
      title={opposite ? "Same facts, opposite guesses" : "Same facts, very different guesses"}
      question="If the same facts can lead to opposite conclusions, what else is shaping each AI's answer?"
      speaker={6}
      answer={
        <p>
          Each AI&rsquo;s own starting point. Every model has its own default answers, from its training data and from
          how its company tuned it. In our study, with no persona at all, the AIs ranged from{" "}
          {lean(split.d, Math.min(...defaults))} to {lean(split.d, Math.max(...defaults))} on this trait. Your profile
          nudges each one from a different place.
        </p>
      }
    >
      <p>
        On {traitPair(split.d)}, {modelInfo(split.low.model).name} guessed {lean(split.d, split.low.guess[split.d])}{" "}
        and {modelInfo(split.high.model).name} guessed {lean(split.d, split.high.guess[split.d])}: {Math.round(split.range)}{" "}
        points apart, from exactly the same description of you.
      </p>
      <p>Each AI fills the gaps in what it knows with its own assumptions.</p>
    </LessonBlock>
  );
}

function BoldVsRight({ ranked }: { ranked: Ranked[] }) {
  const bold = boldest(ranked);
  return (
    <LessonBlock
      title="Bold is not the same as right"
      question="When an AI sounds certain about you, what would you want to check before believing it?"
      speaker={4}
      answer={
        <p>
          What the guess is based on, and whether it holds up if you ask again. These guesses came from a few facts
          and a single try, and a single run moves by 2 to 6 points. Confident wording is how these models write,
          not a sign they have good evidence.
        </p>
      }
    >
      <p>
        {modelInfo(bold.model).name} made the boldest guess: its answers sat {confidence(bold.guess)}% of the way from
        &ldquo;undecided&rdquo; to the extreme, on average. It came {ordinal(bold.rank)} of {ranked.length} for accuracy.
      </p>
      <p>
        {bold.rank <= 2
          ? "This time boldness paid off, but the AIs write just as confidently when they are wrong, so tone alone tells you nothing."
          : "The AIs write just as confidently when they are wrong as when they are right, so tone alone tells you nothing."}
      </p>
    </LessonBlock>
  );
}

/** R3: does knowing the profile beat knowing nothing at all? */
function Baseline({ ranked, user }: { ranked: Ranked[]; user: Profile5 }) {
  const rows = ranked
    .map((r) => ({ r, base: baseline(r.model, user) }))
    .filter((row): row is { r: Ranked; base: NonNullable<ReturnType<typeof baseline>> } => row.base !== null);
  const helped = rows.filter(({ r, base }) => r.match - base.match >= CHANCE_GAP);
  const hurt = rows.filter(({ r, base }) => base.match - r.match >= CHANCE_GAP);
  return (
    <LessonBlock
      title="Did knowing about you help?"
      question="If an AI guesses you almost as well knowing nothing as knowing your profile, what is the profile adding?"
      speaker={5}
      answer={
        <p>
          Sometimes very little. An AI can score well knowing nothing simply because you happen to be similar to its
          default answers. The profile then mostly pulls the guess towards a stereotype of people like you, which
          helps only if you fit it.
        </p>
      }
    >
      <p>
        In our study each AI also took the test with no persona at all: what it answers when it knows nothing about
        anyone. Knowing your profile clearly helped {helped.length} of {rows.length} AIs
        {hurt.length > 0 ? ` and made ${hurt.length} worse` : ""}; for the rest the difference was under {CHANCE_GAP}{" "}
        points.
      </p>
      <details className="rounded-card border border-line p-3">
        <summary className="cursor-pointer font-medium">See each AI</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead>
              <tr className="border-b border-ink">
                <th className="py-2 pr-2 font-medium">AI</th>
                <th className="py-2 pr-2 text-right font-medium">With your profile</th>
                <th className="py-2 pr-2 text-right font-medium">Knowing nothing</th>
                <th className="py-2 font-medium">Your profile...</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, base }) => {
                const difference = r.match - base.match;
                const verdict =
                  Math.abs(difference) < CHANCE_GAP
                    ? "made no clear difference"
                    : difference > 0
                      ? `helped (+${difference.toFixed(1)})`
                      : `hurt (${difference.toFixed(1)})`;
                return (
                  <tr key={r.model} className="border-b border-line">
                    <td className="py-2 pr-2">
                      <ModelChip model={r.model} />
                    </td>
                    <td className="py-2 pr-2 text-right">{r.match.toFixed(1)}</td>
                    <td className="py-2 pr-2 text-right">{base.match.toFixed(1)}</td>
                    <td className="py-2">{verdict}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          &ldquo;Knowing nothing&rdquo; is the average of {rows[0]?.base.runs ?? 10} runs per AI from our study.
        </p>
      </details>
    </LessonBlock>
  );
}

function ordinal(n: number): string {
  return `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? "th"}`;
}
