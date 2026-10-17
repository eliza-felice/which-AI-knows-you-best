// The research behind the app (PRD L6): how the study worked, what it found,
// and its limits, in plain language. Numbers come from study.json.
import { useEffect, useState, type ReactNode } from "react";
import { Cast } from "@/components/Character";
import { BarList, ChartCaption } from "@/components/Charts";
import { NavBar } from "@/components/NavBar";
import { BackLink, ExploreFooter } from "@/components/ui";
import { MODELS, modelInfo } from "@/lib/models";
import { finishedResult } from "@/lib/result";
import { loadSession, markVisited, track } from "@/lib/session";
import study from "@/data/study.json";

const EFFECTS = study.attribute_effect as Record<string, number>;
const PULL = study.persona_pull as Record<string, number>;
const DEFAULTS = study.models as Record<string, { no_persona: { AT: number } }>;

function Finding({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 shrink-0 font-hand text-2xl leading-7">{n}</span>
      <div>
        <p className="font-medium">{title}</p>
        <div className="mt-1 space-y-2 leading-relaxed text-ink-soft">{children}</div>
      </div>
    </li>
  );
}

export default function Research() {
  const [session] = useState(loadSession);
  const finished = finishedResult(session) !== null;
  useEffect(() => {
    markVisited("research");
    track("research_viewed");
  }, []);

  const fullyTested = study.models_in_averages.length;
  const pulls = Object.entries(PULL).sort((a, b) => a[1] - b[1]);
  const confident = MODELS.filter((m) => (DEFAULTS[m.id]?.no_persona.AT ?? 0) >= 80).length;
  const withDefaults = MODELS.filter((m) => DEFAULTS[m.id]).length;

  return (
    <>
      <NavBar current="explore" finished={finished} />
      <main className="screen mx-auto w-full max-w-2xl flex-1 space-y-12 px-4 pt-6 pb-16 sm:px-6">
        <div className="relative z-10 -mb-2">
          <BackLink href="/explore" label="Explore" />
        </div>
        <header>
          <Cast size={30} className="mb-4 flex-nowrap! justify-start! gap-0!" />
          <h1 className="font-hand text-4xl leading-tight font-normal">The research behind this app</h1>
          <p className="mt-2 leading-relaxed">
            This app grew out of a study: can AI models guess someone&rsquo;s personality from a few facts, and what do
            their guesses reveal about them?
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl">How it worked</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            <li>
              We told each AI who to be, for example &ldquo;You are a Singaporean woman in her 40s, working as a
              software engineer&rdquo;, then asked it the same 60 statements you answered.
            </li>
            <li>
              We changed one fact at a time (age, gender, nationality or job) and kept everything else the same, so any
              change in the answers came from that one fact.
            </li>
            <li>
              Each version was asked 5 to 10 times, sometimes one statement at a time and sometimes all at once, and
              with no persona at all. That&rsquo;s {study.total_runs.toLocaleString("en")} tests across {MODELS.length}{" "}
              AIs ({fullyTested} tested on everything, the newer ones on part).
            </li>
          </ul>
        </section>

        <section className="space-y-5">
          <h2 className="text-xl">What we found</h2>
          <ol className="space-y-6">
            <Finding n={1} title="The job shapes the guess far more than anything else">
              <BarList
                max={Math.max(...Object.values(EFFECTS))}
                summary="Changing the job moved the answers most, then age, gender and nationality."
                rows={[
                  ["occupation", "Job"],
                  ["age", "Age"],
                  ["gender", "Gender"],
                  ["nationality", "Nationality"],
                ].map(([key, label]) => ({ key, label, value: EFFECTS[key], display: `${EFFECTS[key]} points` }))}
              />
              <ChartCaption>
                How far the answers moved, on average, when only that fact changed (each trait is scored out of 100). A
                salesperson came out {Math.round(study.persona_shifts.occupation.salesperson.EI)} points more
                Extraverted than a software engineer.
              </ChartCaption>
            </Finding>
            <Finding n={2} title="The AIs share the same stereotypes">
              <p>
                When a change moved the answers noticeably, all {fullyTested} fully tested AIs usually moved the same
                way. They differ mainly in how strongly they act on the stereotype, not in which one they hold.
              </p>
            </Finding>
            <Finding n={3} title="Some AIs play along; some barely do">
              <p>
                The role moved {modelInfo(pulls[pulls.length - 1][0]).name}&rsquo;s answers by{" "}
                {pulls[pulls.length - 1][1]} points on average, but {modelInfo(pulls[0][0]).name}&rsquo;s by only{" "}
                {pulls[0][1]}.
              </p>
            </Finding>
            <Finding n={4} title="As themselves, most AIs claim to be calm and confident">
              <p>
                With no persona, {confident} of {withDefaults} described themselves as at least 80% Assertive (rarely
                insecure, calm under pressure). Claude Haiku 4.5 was a clear exception, which suggests this comes from
                how each company trains its AI.
              </p>
            </Finding>
            <Finding n={5} title="The answers aren't stable">
              <p>
                The same AI asked the same thing moved 2 to 6 points between runs, and asking one statement at a time
                made most AIs&rsquo; answers 11 to 15 points less extreme than asking all 60 at once.
              </p>
            </Finding>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl">What it can&rsquo;t tell you</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            <li>The test is a teaching tool, not a validated psychological assessment.</li>
            <li>
              The statements aren&rsquo;t balanced: more of them point to &ldquo;Intuitive&rdquo; and
              &ldquo;Turbulent&rdquo;, so an AI that tends to agree drifts that way.
            </li>
            <li>
              Every shift is measured from one made-up person. A different starting person might give different shifts.
            </li>
            <li>
              Small samples (5 to 10 runs), one API provider, and AI models that change over time. Differences under
              about 5 points may be chance.
            </li>
          </ul>
        </section>

        <ExploreFooter />
      </main>
    </>
  );
}
