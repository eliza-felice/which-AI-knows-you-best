// Step 6: meet the AI without a mask. Lesson: AI self-reports and
// anthropomorphism. Each model's own answers with no persona at all, from the
// study (no API calls), next to its guess about the user if there is one.
import { useEffect, useState } from "react";
import { Character } from "@/components/Character";
import { BarList, ChartCaption } from "@/components/Charts";
import { NavBar } from "@/components/NavBar";
import { BackLink, ExploreFooter, LessonBlock } from "@/components/ui";
import { DIMENSIONS, QUESTIONS, TRAIT_NAMES, scoreAnswers, type Dimension, type Profile5 } from "@/lib/experiment";
import { MODELS } from "@/lib/models";
import { loadSession, markVisited, track, type Session } from "@/lib/session";
import study from "@/data/study.json";

type StudyModel = { no_persona: Profile5; no_persona_runs: number };
const DEFAULTS = study.models as Record<string, StudyModel>;

function lean(d: Dimension, value: number): string {
  return `${Math.round(value >= 50 ? value : 100 - value)}% ${TRAIT_NAMES[d][value >= 50 ? 0 : 1]}`;
}

/** Its two strongest leanings, e.g. "100% Assertive and 98% Intuitive". */
function strongest(profile: Profile5): string {
  const [a, b] = [...DIMENSIONS].sort((x, y) => Math.abs(profile[y] - 50) - Math.abs(profile[x] - 50));
  return `${lean(a, profile[a])} and ${lean(b, profile[b])}`;
}

export default function WithoutMask() {
  const [session] = useState<Session>(loadSession);
  useEffect(() => {
    track("without_mask_viewed");
    markVisited("mask");
  }, []);
  const finished =
    session.profile && QUESTIONS.every((q) => session.answers[q.id] !== undefined);
  const user = finished ? scoreAnswers(session.answers).profile : null;
  const guesses = new Map(
    finished ? session.predictions.flatMap((p) => (p.status === "ok" ? [[p.model, p.profile] as const] : [])) : [],
  );
  const models = MODELS.filter((m) => DEFAULTS[m.id]);
  const confident = models.filter((m) => DEFAULTS[m.id].no_persona.AT >= 80);
  const humble = models.filter((m) => DEFAULTS[m.id].no_persona.AT < 60);

  return (
    <>
      <NavBar current="explore" finished={Boolean(finished)} />
      <main className="screen w-full flex-1 bg-cream">
        <div className="mx-auto max-w-3xl space-y-10 px-4 pt-8 pb-16 sm:px-6">
          <div className="relative z-10 -mb-2"><BackLink href="/explore" label="Explore" /></div>
          <header>
            <h1 className="font-hand text-4xl leading-tight font-normal">Meet the AIs without a mask</h1>
            <p className="mt-2 leading-relaxed">
              Everything so far was the AIs playing a person{finished ? ": you" : ""}. In our study we also gave them the
              same test with no persona at all, only &ldquo;answer as yourself&rdquo;. This is what each one said about
              itself, on average.
            </p>
            <p className="mt-3 font-medium">
              {confident.length} of {models.length} describe themselves as at least 80% calm and confident
              (&ldquo;Assertive&rdquo;)
              {humble.length > 0 &&
                `; ${humble.map((m) => m.name).join(" and ")} ${humble.length > 1 ? "are" : "is"} the exception`}
              .
            </p>
          </header>
  
          <section aria-labelledby="confidence-chart">
            <h2 id="confidence-chart" className="text-xl">
              How calm and confident each AI says it is
            </h2>
            <BarList
              max={100}
              summary={`${confident.length} of ${models.length} AIs describe themselves as at least 80% Assertive.`}
              rows={[...models]
                .sort((a, b) => DEFAULTS[b.id].no_persona.AT - DEFAULTS[a.id].no_persona.AT)
                .map((m) => ({
                  key: m.id,
                  label: m.name,
                  value: DEFAULTS[m.id].no_persona.AT,
                  display: lean("AT", DEFAULTS[m.id].no_persona.AT),
                  colour: m.colour,
                }))}
            />
            <ChartCaption>
              From the Assertive vs Turbulent part of the test, answered as itself. A full bar means &ldquo;never
              insecure, always calm under pressure&rdquo;; half a bar is neither.
            </ChartCaption>
          </section>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft" aria-hidden="true">
            <span>● its own answers</span>
            {guesses.size > 0 && <span>○ its guess about you</span>}
            {user && <span>■ your answers</span>}
          </div>
  
          <ul className="grid gap-4 sm:grid-cols-2">
            {models.map((m) => {
              const own = DEFAULTS[m.id];
              const guess = guesses.get(m.id);
              return (
                <li key={m.id} className="relative rounded-card border-[1.5px] border-ink bg-paper p-4 pt-3">
                  <div className="flex items-end gap-2">
                    <div className="-mt-6 -ml-2">
                      <Character slot={m.character} size={72} unmasked title={`${m.name}, holding its mask`} />
                    </div>
                    <div className="pb-2">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-sm text-ink-soft">{m.company}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">As itself: {strongest(own.no_persona)}.</p>
                  <div className="mt-3 space-y-2.5">
                    {DIMENSIONS.map((d) => (
                      <MiniBar
                        key={d}
                        d={d}
                        own={own.no_persona[d]}
                        guess={guess?.[d]}
                        user={user?.[d]}
                        colour={m.colour}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-ink-soft">Average of {own.no_persona_runs} runs in our study.</p>
                </li>
              );
            })}
          </ul>
  
          <LessonBlock
            title="Whose personality is it?"
            question="Does an AI have a personality, or was it trained to present one?"
            speaker={7}
            answer={
              <>
                <p>
                  Most researchers would say it was trained to present one. A chatbot is tuned by its company to come
                  across a certain way, usually calm, confident and helpful, and that shows up when you ask it to
                  describe itself.
                </p>
                <p>
                  The clue is in the differences. {humble[0]?.name ?? "One model"} describes itself as close to neutral,
                  while most others say they are almost never insecure. Same kind of technology, different training
                  choices. And without a persona, the same AI can give quite different answers from one run to the next.
                </p>
              </>
            }
          >
            <p>
              When an AI says &ldquo;I rarely feel insecure&rdquo;, it isn&rsquo;t reporting a feeling. It&rsquo;s
              producing the kind of answer its training rewarded. Treating that as a real personality is called
              anthropomorphism: seeing human qualities in something that isn&rsquo;t human.
            </p>
          </LessonBlock>
  
          <ExploreFooter />
        </div>
      </main>
    </>
  );
}

function MiniBar({
  d,
  own,
  guess,
  user,
  colour,
}: {
  d: Dimension;
  own: number;
  guess?: number;
  user?: number;
  colour: string;
}) {
  const x = (value: number) => 100 - value; // the first trait is on the left
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-soft">
        <span>{TRAIT_NAMES[d][0]}</span>
        <span>{TRAIT_NAMES[d][1]}</span>
      </div>
      <div className="relative mx-1.5 h-4">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink" />
        <div className="absolute top-1/2 left-1/2 h-2.5 w-px -translate-y-1/2 bg-ink-soft" />
        {user !== undefined && (
          <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 bg-ink" style={{ left: `${x(user)}%` }} />
        )}
        {guess !== undefined && (
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-transparent"
            style={{ left: `${x(guess)}%`, borderColor: colour }}
          />
        )}
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink"
          style={{ left: `${x(own)}%`, background: colour }}
        />
      </div>
    </div>
  );
}
