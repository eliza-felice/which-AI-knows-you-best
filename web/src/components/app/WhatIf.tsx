// Step 5: the what-if explorer. Lesson: stereotyping and bias. The user
// changes one of their four facts and sees how each chosen AI's guess shifts.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Character } from "@/components/Character";
import { Circled } from "@/components/Doodles";
import { SearchSelect } from "@/components/SearchSelect";
import { Button, ChanceNote, LessonBlock, ModelChip } from "@/components/ui";
import { DIMENSIONS, QUESTIONS, TRAIT_NAMES, scoreAnswers, type Dimension } from "@/lib/experiment";
import { CHANCE_GAP, rankModels, type Prediction } from "@/lib/match";
import { MODELS, modelInfo } from "@/lib/models";
import { GENDERS, JOBS, MAX_AGE, MIN_AGE, NATIONALITIES, type UserProfile } from "@/lib/profile";
import { loadSession, track, type Session } from "@/lib/session";
import {
  BASE_PERSONA,
  MAX_WHATIF_MODELS,
  STUDY_ATTRIBUTE,
  WHATIF_FIELDS,
  biggestShift,
  testedCount,
  type WhatIfField,
} from "@/lib/whatif";
import study from "@/data/study.json";

const FIELD_LABELS: Record<WhatIfField, string> = { age: "Age", gender: "Gender", nationality: "Nationality", job: "Job" };

function show(field: WhatIfField, value: string | number): string {
  if (field === "gender") return GENDERS.find((g) => g.value === value)?.label ?? String(value);
  if (field === "job") return String(value)[0].toUpperCase() + String(value).slice(1);
  return String(value);
}

type Result = {
  field: WhatIfField;
  from: string | number;
  to: string | number;
  before: Map<string, Prediction>;
  after: Map<string, Prediction>;
  done: boolean;
};

export default function WhatIf() {
  const [session] = useState<Session>(loadSession);
  const finished =
    session.profile && session.step === "reveal" && QUESTIONS.every((q) => session.answers[q.id] !== undefined);

  if (!finished || !session.profile) {
    return (
      <main className="screen mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <Character slot={6} size={88} />
        <h1 className="mt-4 text-2xl">Take the test first</h1>
        <p className="mt-2 text-ink-soft">The what-if explorer starts from your own profile and result.</p>
        <Link href="/" className="press mt-6 inline-flex h-12 items-center rounded-full bg-cobalt px-7 font-medium text-cobalt-ink">
          Start
        </Link>
      </main>
    );
  }
  return <Explorer session={session} profile={session.profile} />;
}

function Explorer({ session, profile }: { session: Session; profile: UserProfile }) {
  const topModels = useMemo(() => {
    const user = scoreAnswers(session.answers).profile;
    return rankModels(session.predictions, user).slice(0, MAX_WHATIF_MODELS).map((r) => r.model);
  }, [session]);
  const [field, setField] = useState<WhatIfField>("job");
  const [value, setValue] = useState<string>("");
  const [models, setModels] = useState<string[]>(topModels.length ? topModels : MODELS.slice(0, 3).map((m) => m.id));
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const busy = result !== null && !result.done;

  function pickField(next: WhatIfField) {
    setField(next);
    setValue("");
    setError(null);
  }

  function toggleModel(id: string) {
    setModels((current) =>
      current.includes(id)
        ? current.filter((m) => m !== id)
        : current.length < MAX_WHATIF_MODELS
          ? [...current, id]
          : current,
    );
  }

  async function run() {
    if (!value) return setError(`Choose a new ${FIELD_LABELS[field].toLowerCase()} first.`);
    if (models.length === 0) return setError("Choose at least one AI.");
    setError(null);
    const current: Result = { field, from: profile[field], to: value, before: new Map(), after: new Map(), done: false };
    setResult(current);
    let response: Response;
    try {
      response = await fetch("/api/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { ...profile, details: "" }, change: { field, value }, models }),
      });
    } catch {
      setResult(null);
      return setError("Couldn't reach the server. Check your connection and try again.");
    }
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => null);
      setResult(null);
      return setError(body?.error ?? "Something went wrong. Please try again.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let live = 0;
    for (;;) {
      const chunk = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines.filter((l) => l.trim())) {
        const message = JSON.parse(line);
        if (message.meta) {
          live = message.meta.live;
          if (message.meta.remaining !== null) setLeft(message.meta.remaining);
          continue;
        }
        const { which, ...prediction } = message as { which: "before" | "after" } & Prediction;
        current[which].set(prediction.model, prediction);
        setResult({ ...current });
      }
    }
    setResult({ ...current, done: true });
    track("whatif_run", { field, live });
  }

  return (
    <main className="screen mx-auto w-full max-w-2xl flex-1 space-y-10 px-4 pt-8 pb-16 sm:px-6">
      <header className="flex items-end gap-3">
        <div className="shrink-0">
          <HatCharacter />
        </div>
        <div>
          <h1 className="font-hand text-4xl leading-tight font-normal">What if you were someone else?</h1>
          <p className="mt-1 text-ink-soft">Change one fact about yourself and watch the AIs change their minds.</p>
        </div>
      </header>

      <section aria-labelledby="change">
        <h2 id="change" className="text-xl">
          1. Pick one fact to change
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
          {WHATIF_FIELDS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={field === f}
              onClick={() => pickField(f)}
              className="press relative min-h-16 rounded-card border border-line bg-cream px-3 py-2 text-left"
            >
              {field === f && <Circled />}
              <span className="block text-xs text-ink-soft">{FIELD_LABELS[f]}</span>
              <span className="block font-medium">{show(f, profile[f])}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          {field === "age" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">New age</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_AGE}
                max={MAX_AGE}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-12 w-32 rounded-input border border-line bg-cream px-4 outline-none focus:border-ink"
              />
              <span className="mt-1 block text-sm text-ink-soft">
                The AIs only see your age group (&ldquo;in your 20s&rdquo;), so pick a different decade.
              </span>
            </label>
          )}
          {field === "gender" && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">New gender</legend>
              <div className="flex flex-wrap gap-2">
                {GENDERS.filter((g) => g.value !== profile.gender).map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setValue(g.value)}
                    className={`press h-11 rounded-full border px-4 ${
                      value === g.value ? "border-cobalt bg-cobalt text-cobalt-ink" : "border-ink"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {field === "nationality" && (
            <SearchSelect
              label="New nationality"
              options={NATIONALITIES.filter((n) => n !== profile.nationality)}
              value={value}
              onChange={setValue}
              placeholder="Choose or type"
            />
          )}
          {field === "job" && (
            <SearchSelect
              label="New job"
              options={JOBS.filter((j) => j !== profile.job)}
              value={value}
              onChange={setValue}
              placeholder="Choose or type"
              capitalise
            />
          )}
        </div>
      </section>

      <section aria-labelledby="who">
        <h2 id="who" className="text-xl">
          2. Choose up to {MAX_WHATIF_MODELS} AIs
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Your top {MAX_WHATIF_MODELS} from the reveal are picked to start.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODELS.map((m) => {
            const on = models.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleModel(m.id)}
                disabled={!on && models.length >= MAX_WHATIF_MODELS}
                className={`press min-h-11 rounded-full border px-3 text-sm disabled:opacity-40 ${
                  on ? "border-ink bg-cream" : "border-line"
                }`}
              >
                <ModelChip model={m.id} />
              </button>
            );
          })}
        </div>
      </section>

      <div>
        {error && (
          <p role="alert" className="mb-2 font-medium text-tomato">
            {error}
          </p>
        )}
        <Button onClick={run} disabled={busy}>
          {busy ? "Asking..." : "See what changes"}
        </Button>
        <p className="mt-2 text-sm text-ink-soft">
          Uses only your four facts, not what you wrote. If we&rsquo;ve seen a profile before, or tested it in our
          study, the answer is instant and free; otherwise the changed profile is sent to the AIs you chose.
          {left !== null && ` You have ${left} live what-if${left === 1 ? "" : "s"} left today.`}
        </p>
      </div>

      {result && <ResultView result={result} models={models} />}
    </main>
  );
}

function ResultView({ result, models }: { result: Result; models: string[] }) {
  const expected = models.length * 2;
  const got = result.before.size + result.after.size;
  return (
    <section aria-live="polite" className="space-y-8">
      <h2 className="text-2xl">
        {FIELD_LABELS[result.field]}: {show(result.field, result.from)} → {show(result.field, result.to)}
      </h2>
      {!result.done && (
        <p className="text-ink-soft">
          {got} of {expected} guesses in. A live guess can take up to a minute.
        </p>
      )}
      {models.map((model) => (
        <ModelShift key={model} model={model} before={result.before.get(model)} after={result.after.get(model)} />
      ))}
      {result.done && <ChanceNote />}
      {result.done && <StudyFinding field={result.field} to={String(result.to)} />}
      {result.done && (
        <LessonBlock
          title="One word, a whole new person"
          question="If changing one fact about you changes what an AI assumes about your whole personality, where else could that matter?"
          speaker={6}
          answer={
            <>
              <p>
                Anywhere an AI sorts or judges people: screening job applications, writing references, recommending
                courses or content, or simulating &ldquo;typical&rdquo; people in research.
              </p>
              <p>
                Nobody told these AIs anything about your personality, only a category you belong to. A stereotype
                that is harmless in a quiz can be unfair when it decides who gets an interview.
              </p>
            </>
          }
        >
          <p>
            You changed one fact. Everything else about you stayed the same, and so did you. Any shift you see is the
            AI&rsquo;s idea of what people with that {FIELD_LABELS[result.field].toLowerCase()} are like.
          </p>
        </LessonBlock>
      )}
    </section>
  );
}

function ModelShift({ model, before, after }: { model: string; before?: Prediction; after?: Prediction }) {
  const info = modelInfo(model);
  const ok = before?.status === "ok" && after?.status === "ok";
  const failed = before?.status === "failed" || after?.status === "failed";
  const shifts = ok ? DIMENSIONS.map((d) => Math.abs(after.profile[d] - before.profile[d])) : [];
  const average = shifts.length ? shifts.reduce((a, b) => a + b, 0) / shifts.length : 0;
  return (
    <div className="rounded-card border-[1.5px] border-ink bg-cream p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Character slot={info.character} size={44} />
        <div className="flex-1">
          <p className="font-medium">{info.name}</p>
          <p className="text-sm text-ink-soft">
            {ok
              ? average < CHANCE_GAP
                ? "Barely moved: about the size of chance."
                : `Moved ${Math.round(average)} points per trait on average.`
              : failed
                ? "Didn't answer this time."
                : "Thinking..."}
          </p>
        </div>
      </div>
      {ok && (
        <div className="mt-4 space-y-4">
          {DIMENSIONS.map((d) => (
            <ShiftBar key={d} d={d} before={before.profile[d]} after={after.profile[d]} colour={info.colour} />
          ))}
          <p className="text-xs text-ink-soft">○ before · ● after the change</p>
        </div>
      )}
    </div>
  );
}

function ShiftBar({ d, before, after, colour }: { d: Dimension; before: number; after: number; colour: string }) {
  const [left, right] = TRAIT_NAMES[d];
  const x = (value: number) => 100 - value; // the first trait is on the left
  const change = after - before;
  const label =
    Math.abs(change) < CHANCE_GAP
      ? "no clear change"
      : `${Math.round(Math.abs(change))} points more ${TRAIT_NAMES[d][change > 0 ? 0 : 1]}`;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{left}</span>
        <span className={`text-xs ${Math.abs(change) < CHANCE_GAP ? "text-ink-soft" : "font-medium"}`}>{label}</span>
        <span>{right}</span>
      </div>
      <div className="relative mx-1.5 mt-1 h-5">
        <div className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-ink" />
        <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-ink-soft" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2"
          style={{ left: `${Math.min(x(before), x(after))}%`, width: `${Math.abs(change)}%`, background: colour }}
        />
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-cream"
          style={{ left: `${x(before)}%`, borderColor: colour }}
        />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink"
          style={{ left: `${x(after)}%`, background: colour }}
        />
      </div>
    </div>
  );
}

/** W5: what the study found, worded as a study finding. */
function StudyFinding({ field, to }: { field: WhatIfField; to: string }) {
  const effects = study.attribute_effect as Record<string, number>;
  const models = study.models_in_averages.length;
  // The study tested ages by decade (20, 30, ...), with the base persona in her 40s.
  const studyValue = field === "age" ? String(Math.floor(Number(to) / 10) * 10) : to;
  const tested = biggestShift(STUDY_ATTRIBUTE[field], studyValue);
  const baseValue = BASE_PERSONA[STUDY_ATTRIBUTE[field] as keyof typeof BASE_PERSONA];
  const describe = (value: string | number) =>
    field === "age" ? `being in your ${value}s` : field === "job" ? `“${value}”` : show(field, value);
  return (
    <div className="rounded-card border border-dashed border-ink-soft p-4">
      <p className="text-sm font-medium">What our study found</p>
      <p className="mt-1 leading-relaxed">
        We tested {models} AIs on {testedCount("job")} jobs, {testedCount("nationality")} nationalities,{" "}
        {testedCount("age")} age groups and {testedCount("gender")} genders, changing one fact at a time. Changing the
        job moved their answers about {Math.round(effects.occupation)} points on average, far more than changing the
        nationality (about {effects.nationality}).
        {tested &&
          ` In the study, ${describe(studyValue)} instead of ${describe(baseValue)} made the AIs ${tested.points} points more ${tested.side} on average.`}
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        Your result is one guess per AI, so it can differ from the study&rsquo;s averages.
      </p>
    </div>
  );
}

/** A character trying on a hat (the what-if illustration). */
function HatCharacter() {
  return (
    <div className="relative" aria-hidden="true">
      <Character slot={6} size={88} boil />
      <svg viewBox="0 0 60 40" className="absolute -top-3 left-[52px] w-12 -rotate-12" filter="url(#wobble)">
        <path d="M14 30 L18 8 C24 5 36 5 42 8 L46 30 Z" fill="#B8343F" stroke="var(--color-ink)" strokeWidth="2.5" />
        <path d="M4 31 C20 27 40 27 56 31" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
