// The lessons page: stereotypes measured in the study. It adds to
// the reveal rather than repeating it, using the visitor's own profile where
// the study tested it. (How unstable the answers are is on /reliability; how
// much each AI plays along is on /play-along.)
import { useEffect, useState } from "react";
import { Cast } from "@/components/Character";
import { BarList, ChartCaption } from "@/components/Charts";
import { NavBar } from "@/components/NavBar";
import { BackLink, ExploreFooter, LessonBlock } from "@/components/ui";
import { QUESTIONS } from "@/lib/experiment";
import { MODELS } from "@/lib/models";
import type { UserProfile } from "@/lib/profile";
import { loadSession, markVisited, track, type Session } from "@/lib/session";
import { BASE_PERSONA, biggestShift } from "@/lib/whatif";
import study from "@/data/study.json";

const BASE = BASE_PERSONA;

/** The study's attributes, with everyday labels, in the order shown. */
const FACT_ROWS: [string, string][] = [
  ["occupation", "Job"],
  ["age", "Age"],
  ["gender", "Gender"],
  ["nationality", "Nationality"],
];

/**
 * Study findings about the facts this visitor gave, where the study tested
 * them, then the study's most striking examples.
 */
function findingsFor(profile: UserProfile | null): {
  yours: string[];
  examples: string[];
} {
  const findings: string[] = [];
  const job = profile && biggestShift("occupation", profile.job);
  if (job) {
    findings.push(`“${profile!.job}” instead of “${BASE.occupation}”: ${job.points} points more ${job.side}.`);
  }
  const decade = profile ? String(Math.floor(profile.age / 10) * 10) : "";
  const age = profile && biggestShift("age", decade);
  if (age) findings.push(`In their ${decade}s instead of their 40s: ${age.points} points more ${age.side}.`);
  const nationality = profile && biggestShift("nationality", profile.nationality);
  if (nationality) {
    findings.push(
      `${profile!.nationality} instead of ${BASE.nationality}: ${nationality.points} points more ${nationality.side}.`,
    );
  }
  const yours = findings.length;
  // Fill up with the study's most striking examples.
  for (const [attribute, value, label] of [
    ["occupation", "salesperson", "“salesperson” instead of “software engineer”"],
    ["occupation", "artist", "“artist” instead of “software engineer”"],
    ["age", "70", "In their 70s instead of their 40s"],
  ] as const) {
    if (findings.length >= 3) break;
    if (profile?.job === value) continue;
    const shift = biggestShift(attribute, value)!;
    findings.push(`${label}: ${shift.points} points more ${shift.side}.`);
  }
  return { yours: findings.slice(0, yours), examples: findings.slice(yours) };
}

export default function Lessons() {
  const [session] = useState<Session>(loadSession);
  useEffect(() => {
    track("lessons_viewed");
    markVisited("lessons");
  }, []);

  const finished = session.profile && QUESTIONS.every((q) => session.answers[q.id] !== undefined) ? session : null;
  const profile = finished?.profile ?? null;
  const effects = study.attribute_effect as Record<string, number>;
  const totalRuns = study.total_runs.toLocaleString("en");
  const findings = findingsFor(profile);

  return (
    <>
      <NavBar current="explore" finished={Boolean(finished)} />
      <main className="screen mx-auto w-full max-w-2xl flex-1 space-y-14 px-4 pt-8 pb-16 sm:px-6">
        <div className="relative z-10 -mb-2">
          <BackLink href="/explore" label="Explore" />
        </div>
        <header>
          <Cast size={30} className="mb-4 flex-nowrap! justify-start! gap-0!" />
          <h1 className="font-hand text-4xl leading-tight font-normal">Stereotypes, measured</h1>
          <p className="mt-2 text-ink-soft">
            What happened in our study when we changed just one fact about a made-up person: {totalRuns} test runs with{" "}
            {MODELS.length} AIs.
          </p>
        </header>

        <LessonBlock
          title="Fair guess or stereotype?"
          question="Which of these feel like fair guesses, and which feel like stereotypes? Where is the line?"
          speaker={2}
          answer={
            <p>
              One way to draw it: a fair guess is small and changes as soon as it learns more about you; a stereotype is
              big and sticks. By that test, a {Math.round(study.persona_shifts.occupation.salesperson.EI)}
              -point jump just for the word &ldquo;salesperson&rdquo; is a stereotype. Real differences between jobs are
              much smaller, and the AIs applied it to someone they knew nothing else about.
            </p>
          }
        >
          <p>
            In our study we described one made-up person, a {BASE.nationality} woman in her 40s working as a{" "}
            {BASE.occupation}, then changed one fact at a time and measured how the AIs&rsquo; answers moved, averaged
            over the {study.models_in_averages.length} AIs we tested on every fact.
          </p>
          <BarList
            max={Math.max(...Object.values(effects))}
            summary="Changing the job moved the AIs' answers far more than changing age, gender or nationality."
            rows={FACT_ROWS.map(([attribute, label]) => ({
              key: attribute,
              label,
              value: effects[attribute],
              display: `${effects[attribute]} points`,
            }))}
          />
          <ChartCaption>
            How far the AIs&rsquo; answers moved, on average, when we changed only that one fact. Each trait is scored
            out of 100.
          </ChartCaption>
          {findings.yours.length > 0 && (
            <>
              <p className="font-medium">For facts like yours:</p>
              <ul className="list-disc space-y-1 pl-5">
                {findings.yours.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
            </>
          )}
          <p className="font-medium">
            {findings.yours.length > 0 ? "And the biggest effects:" : "The biggest effects:"}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {findings.examples.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
          <p>Real people do differ a little by age and job, but probably far less than this.</p>
        </LessonBlock>

        <ExploreFooter />
      </main>
    </>
  );
}
