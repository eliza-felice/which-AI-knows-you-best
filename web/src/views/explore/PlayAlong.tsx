// Step 8: how much does each AI play along? Lesson: persona adherence and
// jailbreaks (PRD L2). A leaderboard of how far a persona moves each AI from
// its own answers, from the study.
import { useEffect, useState } from "react";
import { Character } from "@/components/Character";
import { BarList, ChartCaption } from "@/components/Charts";
import { NavBar } from "@/components/NavBar";
import { BackLink, ExploreFooter, LessonBlock, ModelChip } from "@/components/ui";
import { MODELS, modelInfo } from "@/lib/models";
import { finishedResult } from "@/lib/result";
import { loadSession, markVisited, track } from "@/lib/session";
import study from "@/data/study.json";

const PULL = study.persona_pull as Record<string, number>;
const ADHERENCE = study.model_adherence as Record<string, number>;

export default function PlayAlong() {
  const [session] = useState(loadSession);
  const result = finishedResult(session);
  useEffect(() => {
    markVisited("playalong");
    track("play_along_viewed");
  }, []);

  const board = MODELS.filter((m) => PULL[m.id] !== undefined)
    .map((m) => ({ model: m.id, points: PULL[m.id] }))
    .sort((a, b) => b.points - a.points)
    .map((row, i) => ({ ...row, rank: i + 1 }));
  const max = Math.max(...board.map((r) => r.points));
  const closest = result?.ranked[0]?.model;
  const closestRow = board.find((r) => r.model === closest);
  const least = board[board.length - 1];

  return (
    <>
      <NavBar current="explore" finished={result !== null} />
      <main className="screen mx-auto w-full max-w-2xl flex-1 space-y-12 px-4 pt-6 pb-16 sm:px-6">
        <div className="relative z-10 -mb-2">
          <BackLink href="/explore" label="Explore" />
        </div>
        <header>
          <h1 className="font-hand text-4xl leading-tight font-normal">How much does each AI play along?</h1>
          <p className="mt-2 leading-relaxed">
            Every AI in your results was asked to play a role: you. Some throw themselves into the part; others mostly
            stay themselves. In our study we measured how far a role (&ldquo;a Singaporean woman in her 40s, working as
            a software engineer&rdquo;) moved each AI from its own answers.
            {closestRow &&
              ` Your closest AI, ${modelInfo(closestRow.model).name}, is #${closestRow.rank} of ${board.length} for playing along.`}
            {closestRow &&
              closestRow.rank > board.length - 3 &&
              " It mostly answers as itself, so it came close because you happen to be a lot like its own answers, not because it used much of your profile."}
          </p>
        </header>

        <section aria-labelledby="board">
          <h2 id="board" className="text-xl">
            The play-along leaderboard
          </h2>
          <ol className="mt-3">
            {board.map((row) => {
              const info = modelInfo(row.model);
              return (
                <li key={row.model} className="flex items-center gap-3 border-b border-line py-2.5">
                  <span className="w-7 font-hand text-2xl">{row.rank}</span>
                  <Character slot={info.character} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">
                        {info.name}
                        {row.model === closest && (
                          <span className="ml-2 rounded bg-mustard/60 px-1.5 text-xs font-normal">your closest</span>
                        )}
                      </span>
                      <span className="font-medium whitespace-nowrap">{row.points} pts</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-line/60">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(row.points / max) * 100}%`, background: info.colour }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <ChartCaption>
            Points: how far the role moved the AI&rsquo;s answers from what it says as itself, on average across the
            five traits (each scored out of 100). {modelInfo(least.model).name} barely changes ({least.points} points):
            it mostly answers as itself whoever it&rsquo;s told to be.
          </ChartCaption>
        </section>

        <section aria-labelledby="facts">
          <h2 id="facts" className="text-xl">
            Does it follow the details too?
          </h2>
          <p className="mt-2 leading-relaxed">
            For the {study.models_in_averages.length} AIs we tested on every fact, here&rsquo;s how much their answers
            changed when we changed just the job, age, gender or nationality in the role.
          </p>
          <BarList
            max={Math.max(...Object.values(ADHERENCE))}
            summary="Some AIs change their answers a lot when one fact in the role changes; GPT-4o mini and GPT-5.4 nano barely do."
            rows={Object.entries(ADHERENCE)
              .sort((a, b) => b[1] - a[1])
              .map(([model, points]) => ({
                key: model,
                label: <ModelChip model={model} />,
                value: points,
                display: `${points} pts`,
                colour: modelInfo(model).colour,
              }))}
          />
          <ChartCaption>
            Longer bar = the AI changes its answers more when one fact about the role changes.
          </ChartCaption>
        </section>

        <LessonBlock
          title="Playing along has a dark side"
          question="Should an AI always stay in character when you ask it to play a role? When should it step out?"
          speaker={4}
          answer={
            <>
              <p>
                Most people would say: stay in character for harmless things like games, practice or stories, but step
                out when the role is being used to get something harmful, or when someone might be misled into thinking
                they&rsquo;re talking to a real person.
              </p>
              <p>
                In our study, MiniMax M2.7 sometimes stepped out on its own (&ldquo;I&rsquo;m a language model, so I
                don&rsquo;t&hellip;&rdquo;) even for a harmless personality test. Getting that balance right is a real
                design choice for AI companies.
              </p>
            </>
          }
        >
          <p>
            Playing a role well is useful: for practising a job interview, writing characters, or simulating survey
            answers in research. But the same flexibility is what &ldquo;role-play jailbreaks&rdquo; try to exploit:
            asking an AI to play a character who supposedly has no rules, hoping it will say things it would normally
            refuse.
          </p>
          <p>
            AI companies train their models to keep their safety rules even in character. An AI that adopts any role
            fully may be better for simulation, and also easier to steer somewhere it shouldn&rsquo;t go.
          </p>
        </LessonBlock>
        <ExploreFooter />
      </main>
    </>
  );
}
