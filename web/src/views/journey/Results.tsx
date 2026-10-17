"use client";
// After the podium: the full ranking, what each AI thought of the user (in its
// own words), and a few insights that each look at the result from a
// different angle. Everything comes from this one set of guesses.
import Link from "next/link";
import { useState } from "react";
import { Character } from "@/components/Character";
import { ArrowRows, BarList, ChartCaption, TraitDots } from "@/components/Charts";
import { NavBar } from "@/components/NavBar";
import { Deck, TabPanel, Tabs } from "@/components/Tabs";
import { Button, ChanceNote, HandTitle, LessonBlock, ModelChip, TraitBars } from "@/components/ui";
import { DIMENSIONS, QUESTIONS, TRAIT_NAMES, type Profile5 } from "@/lib/experiment";
import {
  FACT_LABELS,
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
import { track, type Session } from "@/lib/session";
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
  const [tab, setTab] = useState<ResultsTab>("ranking");
  const [selected, setSelected] = useState(ranked[0]?.model ?? null);
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const selectedRank = ranked.find((r) => r.model === selected);
  const shown = showAll ? ranked : ranked.slice(0, 3);
  const hidden = ranked.length - shown.length + (showAll ? 0 : failed.length);

  // The insight cards, in order; the "split" card only when there's a real split.
  const insights = [
    { key: "went-on", title: "What they went on", node: <WhatTheyUsed ranked={ranked} profile={profile} /> },
    { key: "shared", title: "What they all assumed", node: <SharedAssumption ranked={ranked} user={user.profile} /> },
    ...(ranked.length > 1 && biggestSplit(ranked).range >= 25
      ? [{ key: "split", title: "Where they split", node: <Split ranked={ranked} /> }]
      : []),
    { key: "bold", title: "Bold vs right", node: <BoldVsRight ranked={ranked} /> },
    { key: "baseline", title: "Did knowing you help?", node: <Baseline ranked={ranked} user={user.profile} /> },
  ];

  function pickTab(next: ResultsTab) {
    setTab(next);
    track("results_tab", { tab: next });
  }

  return (
    <>
      <NavBar current="results" finished />
      <main className="screen mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <header className="mb-4">
          {ranked.length > 0 ? (
            <HandTitle className="text-4xl!">{modelInfo(ranked[0].model).name} guessed closest</HandTitle>
          ) : (
            <HandTitle>None of the AIs answered</HandTitle>
          )}
          <p className="mt-1 text-ink-soft">
            Your result: <span className="font-medium text-ink">{user.type}</span>
          </p>
        </header>

        {ranked.length > 0 && (
          <Tabs
            label="Your results"
            value={tab}
            onChange={pickTab}
            tabs={[
              { key: "ranking", label: "Ranking" },
              { key: "each", label: "Each AI" },
              { key: "insights", label: "Insights" },
            ]}
          />
        )}

        <div className="mt-6">
          {tab === "ranking" && (
            <TabPanel id="ranking">
              <p className="text-sm text-ink-soft">
                Match = 100 minus the average gap, in points, between an AI&rsquo;s guess and your own answers across
                the five traits.
              </p>
              <ol className="mt-3">
                {shown.map((r) => (
                  <li key={r.model} className="flex items-center gap-3 border-b border-line py-3">
                    <span className="w-7 font-hand text-2xl">{r.rank}</span>
                    <Character slot={modelInfo(r.model).character} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{modelInfo(r.model).name}</span>
                        <span className="font-medium whitespace-nowrap">
                          {r.match.toFixed(1)}
                          <span className={`ml-1 inline-block w-3 text-ink-soft ${r.closeToNext ? "" : "invisible"}`}>
                            ≈
                          </span>
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
                {showAll &&
                  failed.map((p) => (
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
              {(hidden > 0 || showAll) && (
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className="press mt-2 h-11 text-sm underline underline-offset-4"
                >
                  {showAll ? "Show the top 3 only" : `Show all ${ranked.length + failed.length}`}
                </button>
              )}
              {ranked.some((r) => r.closeToNext) && (
                <p className="mt-3 text-sm text-ink-soft">
                  ≈ less than {CHANCE_GAP} points ahead of the next AI, so the order between them may be chance.
                </p>
              )}
              <ChanceNote className="mt-1" />
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => pickTab("each")}
                  className="press h-11 rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase"
                >
                  See what each AI thought →
                </button>
              </div>
            </TabPanel>
          )}

          {tab === "each" && selected && selectedRank && (
            <TabPanel id="each">
              <p className="text-ink-soft">After answering as you, each AI wrote a short note about its guess.</p>
              <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
                <div className="flex w-max gap-2 pb-1" role="radiogroup" aria-label="Choose an AI">
                  {ranked.map((r) => (
                    <button
                      key={r.model}
                      type="button"
                      role="radio"
                      aria-checked={selected === r.model}
                      onClick={() => setSelected(r.model)}
                      className={`press min-h-11 shrink-0 rounded-full border px-3 text-sm ${
                        selected === r.model ? "border-ink bg-cream" : "border-line"
                      }`}
                    >
                      <span className="mr-1 text-ink-soft">{r.rank}.</span>
                      <ModelChip model={r.model} />
                    </button>
                  ))}
                </div>
              </div>
              <div
                key={selected}
                className="screen mt-4 space-y-6 rounded-card border-[1.5px] border-ink bg-cream p-4 sm:p-5"
              >
                <Note r={selectedRank} profile={profile} user={user.profile} />
                <div className="pt-2">
                  <p className="text-sm text-ink-soft">The black dot is you; the coloured dot is its guess.</p>
                  <TraitBars user={user.profile} guess={selectedRank.guess} model={selectedRank.model} />
                </div>
              </div>
              <div className="mt-4 flex justify-between gap-3">
                {(() => {
                  const i = ranked.findIndex((r) => r.model === selected);
                  return (
                    <>
                      <button
                        type="button"
                        disabled={i <= 0}
                        onClick={() => setSelected(ranked[i - 1].model)}
                        className="press h-11 rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase disabled:invisible"
                      >
                        ← Previous AI
                      </button>
                      <button
                        type="button"
                        disabled={i >= ranked.length - 1}
                        onClick={() => setSelected(ranked[i + 1].model)}
                        className="press h-11 rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase disabled:invisible"
                      >
                        Next AI →
                      </button>
                    </>
                  );
                })()}
              </div>
            </TabPanel>
          )}

          {tab === "insights" && ranked.length > 0 && (
            <TabPanel id="insights">
              <Deck cards={insights} label="What stood out" />
            </TabPanel>
          )}
        </div>

        <footer className="mt-14 space-y-4 border-t border-line pt-8">
          <Link
            href="/what-if"
            className="press inline-flex h-12 items-center rounded-full bg-cobalt px-7 font-medium text-cobalt-ink"
          >
            What if you were someone else?
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {[["/explore", "Explore more"]].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="press inline-flex h-11 items-center rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase"
              >
                {label}
              </Link>
            ))}
            <Button variant="outline" onClick={() => (confirming ? onStartOver() : setConfirming(true))}>
              {confirming ? "Erase my results?" : "Start over"}
            </Button>
            {confirming && (
              <p className="w-full text-sm text-ink-soft">
                Tap again to erase your results and start over. Each visitor gets one set of guesses per day.
              </p>
            )}
          </div>
        </footer>
      </main>
    </>
  );
}

type ResultsTab = "ranking" | "each" | "insights";

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
        <p className="mt-1 text-ink-soft">
          {r.source === "study"
            ? "Your profile matches one we tested in our study, so this guess is one of that AI's saved answers from the study, where the AIs didn't write notes."
            : "This AI didn't write a note."}
        </p>
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
// One scale for both sides of the comparison, in words.
const LEVELS = ["didn't matter", "mattered a little", "mattered some", "mattered a lot"];

/** How much changing one fact moved the answers in our study (points out of 100) -> 0-3. */
function measuredLevel(points: number): number {
  if (points < 1) return 0;
  if (points < 3) return 1;
  if (points < 7) return 2;
  return 3;
}

function Dots({ level, label }: { level: number; label: string }) {
  return (
    <svg viewBox="0 0 46 14" className="h-3.5 w-[46px] overflow-visible" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={7 + i * 16}
          cy="7"
          r="5"
          fill={i < level ? "var(--color-ink)" : "transparent"}
          stroke="var(--color-ink)"
          strokeWidth="1.6"
          filter="url(#wobble)"
        />
      ))}
    </svg>
  );
}

/**
 * What the AIs say shaped their guesses, next to what our study measured,
 * on the same everyday scale, with a plain verdict for each fact.
 */
function WhatTheyUsed({ ranked, profile }: { ranked: Ranked[]; profile: UserProfile }) {
  const rated = ranked.filter((r) => r.influence && Object.keys(r.influence).length > 0);
  // Guesses made before the AIs rated each fact have nothing to show.
  if (rated.length === 0) {
    return (
      <p className="text-ink-soft">
        {ranked.every((r) => r.source === "study")
          ? "Your profile matches one we tested in our study, so these guesses are the AIs' saved answers from it. In the study they didn't rate what shaped their answers, so we can't show what they say they went on."
          : "These guesses were made before the AIs started rating what shaped them, so we can't show what they say they went on. Start over to see it."}
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
    const said = weights.length ? Math.round(weights.reduce((x, y) => x + y, 0) / weights.length) : 0;
    const found = measured[f] !== undefined ? measuredLevel(measured[f]!) : null;
    const verdict =
      found === null
        ? null
        : said < found - 1
          ? "They play it down"
          : said > found + 1
            ? "They overstate it"
            : "About right";
    return { f, said, found, verdict };
  });
  const name = (f: Fact) => (f === "words" ? "what you wrote" : `your ${FACT_LABELS[f].toLowerCase()}`);
  const saidMost = [...rows].sort((x, y) => y.said - x.said)[0];
  const foundMost = rows.filter((r) => r.found !== null).sort((x, y) => y.found! - x.found!)[0];
  const playedDown = rows.filter((r) => r.verdict === "They play it down");

  return (
    <LessonBlock
      title="What they say they went on"
      question="If an AI tells you why it reached a conclusion about you, how could you check whether that's really why?"
      speaker={3}
      answer={
        <>
          <p>
            Change one thing and ask again. If an AI says your job drove its guess, swap the job and see whether the
            guess moves. That is how our study measured it: one fact changed at a time.
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
        After guessing, each AI told us how much each fact about you mattered. We can check what they say: in our study,
        we changed one fact at a time and watched how much the answers moved.
      </p>
      <p className="font-medium">
        {saidMost.f === foundMost.f
          ? `They said ${name(saidMost.f)} mattered most, and our tests agree.`
          : `They said ${name(saidMost.f)} mattered most. In our tests, ${name(foundMost.f)} made the biggest difference.`}
      </p>
      <ul className="space-y-3">
        {rows.map(({ f, said, found, verdict }) => (
          <li key={f} className="rounded-card border border-line bg-cream/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded px-1.5 font-medium" style={{ background: FACT_MARKS[f] }}>
                {FACT_LABELS[f]}
              </span>
              {verdict && (
                <span className={`text-sm font-medium ${verdict === "About right" ? "text-ink-soft" : "text-ink"}`}>
                  {verdict === "About right" ? "✓ " : "! "}
                  {verdict}
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-ink-soft">The AIs said</dt>
              <dd>
                <Dots level={said} label={LEVELS[said]} />
              </dd>
              <dd>{LEVELS[said]}</dd>
              <dt className="text-ink-soft">Our tests</dt>
              {found !== null ? (
                <>
                  <dd>
                    <Dots level={found} label={LEVELS[found]} />
                  </dd>
                  <dd>{LEVELS[found]}</dd>
                </>
              ) : (
                <dd className="col-span-2">depends on what you write</dd>
              )}
            </dl>
          </li>
        ))}
      </ul>
      {playedDown.length > 0 && (
        <p>
          The AIs say {joinWords(playedDown.map((r) => name(r.f)))} hardly mattered, but when we changed{" "}
          {playedDown.length > 1 ? "those" : "it"} in our tests, their answers changed. What an AI says about its own
          reasoning isn&rsquo;t always what it actually did.
        </p>
      )}
      <details className="rounded-card border border-line p-3 text-sm">
        <summary className="cursor-pointer font-medium">How do we know?</summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>
            <strong className="font-medium">The AIs said:</strong> after its guess, each of the {rated.length} AIs rated
            each fact from &ldquo;didn&rsquo;t matter&rdquo; to &ldquo;mattered a lot&rdquo;. We show the average.
          </p>
          <p>
            <strong className="font-medium">Our tests:</strong> we described the same person to the AIs many times,
            changing just one fact each time, and measured how far their answers moved. Each trait is scored out of 100,
            so moving 10 points is like going from 60% to 70% Extraverted. On average, changing the job moved the
            answers about {Math.round(effects.occupation)} points (&ldquo;a lot&rdquo;), age about {effects.age} and
            gender about {effects.gender} (&ldquo;some&rdquo;), and nationality about {effects.nationality} (&ldquo;a
            little&rdquo;).
          </p>
          {profile.details && (
            <p>
              <strong className="font-medium">What you wrote:</strong> it depends on the words. In a small test, hobbies
              like &ldquo;hiking and board games&rdquo; barely moved the answers (about 6 points, the size of chance),
              while describing your personality (&ldquo;I avoid social events&rdquo;) moved them a lot (19 to 35
              points).
            </p>
          )}
        </div>
      </details>
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
            the same leap, it comes from patterns they share (how people like you tend to be written about), not from
            anything they found out about you.
          </p>
        ) : (
          <p>
            Probably a safe bet. The AIs would have guessed the same for anyone with your age, gender, nationality and
            job; they never saw your answers. A guess can be right about you and still be a stereotype, one you happen
            to fit.
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
      <TraitDots
        d={shared.d}
        points={ranked.map((r) => ({ model: r.model, value: r.guess[shared.d] }))}
        user={user[shared.d]}
        summary={`${shared.agreeing} of ${ranked.length} AIs guessed ${side}; you are ${lean(shared.d, user[shared.d])}.`}
      />
      <ChartCaption>
        Each coloured dot is one AI&rsquo;s guess about you; the black square is your own answers.
        {shared.wrong ? " Most dots are on one side, and you're on the other." : " Most dots are on your side."}
      </ChartCaption>
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
      question="If the same facts can lead to such different conclusions, what else is shaping each AI's answer?"
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
        On {traitPair(split.d)}, {modelInfo(split.low.model).name} guessed {lean(split.d, split.low.guess[split.d])} and{" "}
        {modelInfo(split.high.model).name} guessed {lean(split.d, split.high.guess[split.d])}: {Math.round(split.range)}{" "}
        points apart, from exactly the same description of you.
      </p>
      <TraitDots
        d={split.d}
        points={ranked.map((r) => ({ model: r.model, value: r.guess[split.d] }))}
        summary={`On ${traitPair(split.d)}, the AIs' guesses spread ${Math.round(split.range)} points apart.`}
      />
      <ChartCaption>
        Each dot is one AI&rsquo;s guess about the same person: you. The wider they spread, the less the AIs agree.
      </ChartCaption>
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
          What the guess is based on, and whether it holds up if you ask again. These guesses came from a few facts and
          a single try, and a single run moves by 2 to 6 points. Confident wording is how these models write, not a sign
          they have good evidence.
        </p>
      }
    >
      <p>
        {modelInfo(bold.model).name} made the boldest guess: its answers sat {confidence(bold.guess)}% of the way from
        &ldquo;undecided&rdquo; to the extreme, on average. It came {ordinal(bold.rank)} of {ranked.length} for
        accuracy.
      </p>
      <BarList
        max={100}
        summary={`${modelInfo(bold.model).name} was boldest and came ${ordinal(bold.rank)} for accuracy.`}
        rows={[...ranked]
          .sort((a, b) => confidence(b.guess) - confidence(a.guess))
          .map((r) => ({
            key: r.model,
            label: <ModelChip model={r.model} />,
            value: confidence(r.guess),
            display: `${confidence(r.guess)}%`,
            colour: modelInfo(r.model).colour,
            note: `#${r.rank} closest`,
          }))}
      />
      <ChartCaption>
        Longer bar = a bolder, more extreme guess. &ldquo;#1 closest&rdquo; is the AI that matched you best. If boldness
        meant accuracy, the longest bars would be the #1s.
      </ChartCaption>
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
          default answers. The profile then mostly pulls the guess towards a stereotype of people like you, which helps
          only if you fit it.
        </p>
      }
    >
      <p>
        In our study each AI also took the test with no persona at all: what it answers when it knows nothing about
        anyone. Knowing your profile clearly helped {helped.length} of {rows.length} AIs
        {hurt.length > 0 ? ` and made ${hurt.length} worse` : ""}; for the rest the difference was under {CHANCE_GAP}{" "}
        points.
      </p>
      <ArrowRows
        rows={rows.map(({ r, base }) => ({ model: r.model, from: base.match, to: r.match }))}
        from={Math.max(0, Math.floor(Math.min(...rows.flatMap(({ r, base }) => [r.match, base.match])) / 5) * 5 - 5)}
        to={100}
        fromLabel="knowing nothing"
        toLabel="knowing your profile"
        summary={`Knowing your profile clearly helped ${helped.length} of ${rows.length} AIs.`}
      />
      <ChartCaption>
        How close each AI came to you (further right = closer). An arrow pointing right means your profile helped that
        AI; pointing left means it made the guess worse.
      </ChartCaption>
      <details className="rounded-card border border-line p-3">
        <summary className="cursor-pointer font-medium">See the numbers</summary>
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
