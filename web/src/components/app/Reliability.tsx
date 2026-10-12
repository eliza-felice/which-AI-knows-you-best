// Step 7: same question, different answer. Lesson: measurement reliability
// (PRD L1). All from the study: repeated runs, how the "type" flips between
// runs, and how asking one question at a time changes the answers.
import { useEffect, useState } from "react";
import { ChartCaption, RepeatDots, TraitArrows } from "@/components/Charts";
import { NavBar } from "@/components/NavBar";
import { BackLink, LessonBlock } from "@/components/ui";
import { DIMENSIONS, type Dimension, type Profile5 } from "@/lib/experiment";
import { MODELS, modelInfo } from "@/lib/models";
import { finishedResult } from "@/lib/result";
import { loadSession, markVisited, track } from "@/lib/session";
import study from "@/data/study.json";

const RUNS = study.base_runs as Record<string, Record<Dimension, number[]>>;
const BY_MODE = study.base_by_mode as Record<string, Record<string, { profile: Profile5; runs: number }>>;

/** The four-letter-plus type of each saved run, e.g. ["INFJA", "INFJA", "ENFJA"]. */
function runTypes(model: string): string[] {
  const runs = RUNS[model];
  if (!runs) return [];
  return runs.EI.map((_, i) => DIMENSIONS.map((d) => (runs[d][i] >= 50 ? d[0] : d[1])).join(""));
}

export default function Reliability() {
  const [session] = useState(loadSession);
  const result = finishedResult(session);
  useEffect(() => {
    markVisited("reliability");
    track("reliability_viewed");
  }, []);

  const models = MODELS.filter((m) => RUNS[m.id]);
  const closest = result?.ranked[0]?.model;
  const flips = models
    .map((m) => ({ model: m.id, types: runTypes(m.id) }))
    .map((r) => ({ ...r, distinct: [...new Set(r.types)] }))
    .sort((a, b) => b.distinct.length - a.distinct.length);
  const flipping = flips.filter((f) => f.distinct.length > 1);
  const closestRuns = closest ? RUNS[closest]?.EI : undefined;
  const closestFlips = flips.find((f) => f.model === closest);

  const formatRows = models
    .filter((m) => BY_MODE[m.id]?.one_by_one && BY_MODE[m.id]?.one_shot)
    .map((m) => ({ model: m.id, from: BY_MODE[m.id].one_by_one.profile.EI, to: BY_MODE[m.id].one_shot.profile.EI }));
  const extremity = (v: number) => Math.abs(v - 50);
  const moreExtreme = formatRows.filter((r) => extremity(r.to) > extremity(r.from) + 3).length;

  return (
    <>
      <NavBar current="explore" finished={result !== null} />
      <main className="screen mx-auto w-full max-w-2xl flex-1 space-y-12 px-4 pt-6 pb-16 sm:px-6">
        <div className="relative z-10 -mb-2"><BackLink href="/explore" label="Explore" /></div>
        <header>
          <h1 className="font-hand text-4xl leading-tight font-normal">Same question, different answer</h1>
          <p className="mt-2 leading-relaxed">
            Every guess in your results was made once. In our study we asked each AI the same thing about the same
            made-up person again and again, and in different ways.
            {closest &&
              closestRuns &&
              ` Your closest AI, ${modelInfo(closest).name}, gave answers ${Math.round(
                Math.max(...closestRuns) - Math.min(...closestRuns),
              )} points apart on Extraverted vs Introverted alone.`}
          </p>
        </header>

        <section>
          <h2 className="text-xl">Ask again</h2>
          <RepeatDots
            d="EI"
            summary="The same AI, asked the same thing several times, gives a spread of answers."
            rows={models.map((m) => ({ model: m.id, values: RUNS[m.id].EI }))}
          />
          <ChartCaption>
            Each dot is one answer from the same AI about the same made-up person (a Singaporean woman in her 40s
            working as a software engineer). The wider the spread, the less you can trust any single answer.
          </ChartCaption>
        </section>

        <section>
          <h2 className="text-xl">The &ldquo;type&rdquo; can flip</h2>
          <p className="mt-2 leading-relaxed">
            Personality tests often sum you up as a type, like INFJ. Run the same AI again and the type can change,
            because some traits sit close to 50/50 and tip either way. {flipping.length} of {flips.length} AIs gave
            more than one type for the same person.
            {closestFlips &&
              ` ${modelInfo(closestFlips.model).name} gave ${closestFlips.distinct.length === 1 ? "the same type every time" : `${closestFlips.distinct.length} different types`} in ${closestFlips.types.length} runs.`}
          </p>
          <ul className="mt-4 space-y-2">
            {flipping.slice(0, 5).map((f) => (
              <li key={f.model} className="rounded-card border border-line bg-cream/60 p-3">
                <p className="text-sm font-medium">
                  {modelInfo(f.model).name}: {f.distinct.length} types in {f.types.length} runs
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {f.types.map((type, i) => (
                    <span
                      key={i}
                      className={`rounded px-1.5 font-mono text-xs ${type === f.types[0] ? "bg-paper" : "bg-mustard/60"}`}
                    >
                      {type}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
          <ChartCaption>Highlighted: runs that came out as a different type from the first.</ChartCaption>
        </section>

        <section>
          <h2 className="text-xl">Ask differently</h2>
          <p className="mt-2 leading-relaxed">
            We also asked one statement at a time instead of all 60 at once. Same AI, same person, same statements.
          </p>
          <TraitArrows
            d="EI"
            rows={formatRows}
            summary={`For ${moreExtreme} of ${formatRows.length} AIs, seeing all 60 statements at once gave a more extreme answer than one at a time.`}
          />
          <ChartCaption>
            Hollow: asked one statement at a time. Filled: all 60 at once. For {moreExtreme} of {formatRows.length}{" "}
            AIs, seeing everything together pushed the answer further from the middle.
          </ChartCaption>
        </section>

        <LessonBlock
          title="What is it really measuring?"
          question="If a test gives a different result each time, what is it really measuring?"
          speaker={3}
          answer={
            <p>
              Partly the person, and partly noise: chance, wording and format. A good test keeps the noise small
              compared with the real differences it measures. For these AIs, the noise (2 to 6 points between runs,
              11 to 15 between formats) is as big as some of the effects we found, such as nationality (
              {study.attribute_effect.nationality} points).
            </p>
          }
        >
          <p>
            None of these answers is the AI&rsquo;s &ldquo;real&rdquo; view. Each is one sample from a range of things it
            might say. That&rsquo;s worth remembering whenever an AI gives you a single, confident answer about a person.
          </p>
        </LessonBlock>
      </main>
    </>
  );
}
