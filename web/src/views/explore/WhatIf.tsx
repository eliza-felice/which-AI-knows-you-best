// Step 5: the what-if explorer. Lesson: stereotyping and bias.
//
// Two ways in:
//   "Change one thing": change one of your four facts, or your own words, and
//     see how each chosen AI's guess and description shift. Live calls are
//     capped (WHATIFS_PER_IP_PER_DAY); anything the study or the cache already
//     has is free.
//   "Slide through a fact": step through every value the study tested, on the
//     study's test person. Always free (FactSlider.tsx).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Character } from "@/components/Character";
import { Circled } from "@/components/Doodles";
import { NavBar } from "@/components/NavBar";
import { TabPanel, Tabs } from "@/components/Tabs";
import { SearchSelect } from "@/components/SearchSelect";
import { BackLink, Button, ChanceNote, ExploreFooter, LessonBlock, ModelChip } from "@/components/ui";
import { FactSlider } from "@/views/explore/FactSlider";
import { DIMENSIONS, QUESTIONS, TRAIT_NAMES, scoreAnswers, type Dimension } from "@/lib/experiment";
import { CHANCE_GAP, rankModels, type Prediction } from "@/lib/match";
import { MODELS, modelInfo } from "@/lib/models";
import {
  DETAILS_MAX_LENGTH,
  GENDERS,
  JOBS,
  MAX_AGE,
  MIN_AGE,
  NATIONALITIES,
  cleanDetails,
  detailsProblem,
  type UserProfile,
} from "@/lib/profile";
import { loadSession, markVisited, track, type Session } from "@/lib/session";
import {
  BASE_PERSONA,
  MAX_WHATIF_MODELS,
  STUDY_ATTRIBUTE,
  WHATIF_FIELDS,
  biggestShift,
  testedCount,
  type FactField,
  type WhatIfField,
} from "@/lib/whatif";
import study from "@/data/study.json";

const FIELD_LABELS: Record<WhatIfField, string> = {
  age: "Age",
  gender: "Gender",
  nationality: "Nationality",
  job: "Job",
  words: "Your words",
};

function current(profile: UserProfile, field: WhatIfField): string | number {
  return field === "words" ? profile.details : profile[field];
}

function show(field: WhatIfField, value: string | number): string {
  if (field === "gender") return GENDERS.find((g) => g.value === value)?.label ?? String(value);
  if (field === "job") return String(value)[0].toUpperCase() + String(value).slice(1);
  if (field === "words") return value ? `“${value}”` : "nothing written";
  return String(value);
}

type Result = {
  field: WhatIfField;
  from: string | number;
  to: string | number;
  models: string[];
  before: Map<string, Prediction>;
  after: Map<string, Prediction>;
  /** How many guesses needed a live call (0 = free). */
  live: number | null;
  done: boolean;
};

export default function WhatIf() {
  const [session] = useState<Session>(loadSession);
  const finished = session.profile && QUESTIONS.every((q) => session.answers[q.id] !== undefined);

  if (!finished || !session.profile) {
    return (
      <>
        <NavBar finished={false} />
        <main className="screen mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-12 text-center">
          <Character slot={6} size={88} />
          <h1 className="mt-4 text-2xl">Take the test first</h1>
          <p className="mt-2 text-ink-soft">The what-if explorer starts from your own profile and result.</p>
          <Link
            href="/?step=profile"
            className="press mt-6 inline-flex h-12 items-center rounded-full bg-cobalt px-7 font-medium text-cobalt-ink"
          >
            Start
          </Link>
        </main>
      </>
    );
  }
  return <Explorer session={session} profile={session.profile} />;
}

function Explorer({ session, profile }: { session: Session; profile: UserProfile }) {
  useEffect(() => markVisited("whatif"), []);
  const topModels = useMemo(() => {
    const user = scoreAnswers(session.answers).profile;
    return rankModels(session.predictions, user)
      .slice(0, MAX_WHATIF_MODELS)
      .map((r) => r.model);
  }, [session]);
  const [tab, setTab] = useState<"change" | "slide">("change");
  const [field, setField] = useState<WhatIfField>("job");
  const [value, setValue] = useState<string>("");
  const [models, setModels] = useState<string[]>(topModels.length ? topModels : MODELS.slice(0, 3).map((m) => m.id));
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const busy = result !== null && !result.done;
  const resultsTop = useRef<HTMLDivElement>(null);

  // How many live what-ifs are left today, before using one.
  useEffect(() => {
    fetch("/api/whatif")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setLeft(body?.remaining ?? null))
      .catch(() => {});
  }, []);

  function pickField(next: WhatIfField) {
    setField(next);
    setValue(next === "words" ? profile.details : "");
    setError(null);
  }

  function toggleModel(id: string) {
    setModels((chosen) =>
      chosen.includes(id)
        ? chosen.filter((m) => m !== id)
        : chosen.length < MAX_WHATIF_MODELS
          ? [...chosen, id]
          : chosen,
    );
  }

  async function run(runField: WhatIfField = field, runValue: string = value) {
    const words = runField === "words";
    if (!runValue.trim())
      return setError(
        words ? "Write something about yourself first." : `Choose a new ${FIELD_LABELS[runField].toLowerCase()} first.`,
      );
    if (words && cleanDetails(runValue) === profile.details) return setError("Change your words first.");
    if (words && detailsProblem(cleanDetails(runValue))) return setError(detailsProblem(cleanDetails(runValue))!);
    if (models.length === 0) return setError("Choose at least one AI.");
    setError(null);
    const run: Result = {
      field: runField,
      from: current(profile, runField),
      to: words ? cleanDetails(runValue) : runValue,
      models,
      // For your words, "before" is what the AIs said at the reveal: no new call.
      before: words
        ? new Map(
            models.map((m): [string, Prediction] => [
              m,
              session.predictions.find((p) => p.model === m) ?? { model: m, status: "failed", reason: "no guess" },
            ]),
          )
        : new Map(),
      after: new Map(),
      live: null,
      done: false,
    };
    setResult(run);
    setTimeout(() => resultsTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    let response: Response;
    try {
      response = await fetch("/api/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { ...profile, details: "" },
          change: { field: runField, value: runValue },
          models,
        }),
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
    for (;;) {
      const chunk = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines.filter((l) => l.trim())) {
        const message = JSON.parse(line);
        if (message.meta) {
          run.live = message.meta.live;
          if (message.meta.remaining !== null) setLeft(message.meta.remaining);
          continue;
        }
        const { which, ...prediction } = message as { which: "before" | "after" } & Prediction;
        run[which].set(prediction.model, prediction);
        setResult({ ...run });
      }
    }
    setResult({ ...run, done: true });
    track("whatif_run", { field: runField, live: run.live ?? 0 });
  }

  function tryOnMe(fact: FactField, factValue: string) {
    setTab("change");
    setField(fact);
    setValue(factValue);
    run(fact, factValue);
  }

  const outOfLive = left === 0;

  return (
    <>
      <NavBar current="whatif" finished />
      <main className="screen mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 pt-8 pb-16 sm:px-6">
        <div className="relative z-10 -mb-2">
          <BackLink href="/explore" label="Explore" />
        </div>
        <header>
          <h1 className="font-hand text-4xl leading-tight font-normal">What if you were someone else?</h1>
          <p className="mt-1 text-ink-soft">Change one thing about yourself and watch the AIs change their minds.</p>
        </header>

        <aside className="rounded-card border border-dashed border-ink-soft p-4 text-sm leading-relaxed">
          <p className="font-medium">
            {left === null
              ? "Live guesses are limited to keep costs down."
              : outOfLive
                ? "You've used today's live what-ifs."
                : `You have ${left} live what-if${left === 1 ? "" : "s"} left today.`}
          </p>
          <p className="mt-1 text-ink-soft">
            Anything our study or earlier visitors already covered is free and instant; anything new asks the AIs live
            and uses one. Changing your own words always does.
          </p>
        </aside>

        <section aria-labelledby="who">
          <h2 id="who" className="text-lg">
            Which AIs?{" "}
            <span className="font-normal text-ink-soft">
              (up to {MAX_WHATIF_MODELS}; your top {MAX_WHATIF_MODELS} to start)
            </span>
          </h2>
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

        <Tabs
          label="What-if"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "change", label: "Change one thing" },
            { key: "slide", label: "Slide through a fact" },
          ]}
        />

        {tab === "slide" && (
          <TabPanel id="slide">
            <FactSlider models={models} profile={profile} onTryOnMe={tryOnMe} />
          </TabPanel>
        )}

        {tab === "change" && (
          <TabPanel id="change">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="What to change">
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
                    <span className="block truncate font-medium">{show(f, current(profile, f))}</span>
                  </button>
                ))}
              </div>

              <ChangeInput field={field} value={value} onChange={setValue} profile={profile} />

              <div>
                {error && (
                  <p role="alert" className="mb-2 font-medium">
                    ! {error}
                  </p>
                )}
                <Button onClick={() => run()} disabled={busy || (outOfLive && field === "words")}>
                  {busy ? "Asking..." : "See what changes"}
                </Button>
              </div>

              <div ref={resultsTop} className="scroll-mt-20" />
              {result && <ResultView key={`${result.field}:${result.to}:${result.models.join()}`} result={result} />}
            </div>
          </TabPanel>
        )}
        <ExploreFooter />
      </main>
    </>
  );
}

function ChangeInput({
  field,
  value,
  onChange,
  profile,
}: {
  field: WhatIfField;
  value: string;
  onChange: (value: string) => void;
  profile: UserProfile;
}) {
  if (field === "age") {
    return (
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">New age</span>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_AGE}
          max={MAX_AGE}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-32 rounded-input border border-line bg-cream px-4 outline-none focus:border-ink"
        />
        <span className="mt-1 block text-sm text-ink-soft">
          The AIs only see your age group (&ldquo;in your 20s&rdquo;), so pick a different decade.
        </span>
      </label>
    );
  }
  if (field === "gender") {
    return (
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">New gender</legend>
        <div className="flex flex-wrap gap-2">
          {GENDERS.filter((g) => g.value !== profile.gender).map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => onChange(g.value)}
              className={`press h-11 rounded-full border px-4 ${
                value === g.value ? "border-cobalt bg-cobalt text-cobalt-ink" : "border-ink"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }
  if (field === "nationality" || field === "job") {
    return (
      <SearchSelect
        label={`New ${field}`}
        options={(field === "job" ? JOBS : NATIONALITIES).filter((v) => v !== profile[field])}
        value={value}
        onChange={onChange}
        placeholder="Choose or type"
        capitalise={field === "job"}
      />
    );
  }
  const problem = detailsProblem(cleanDetails(value));
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">Describe yourself differently</span>
      <textarea
        value={value}
        maxLength={DETAILS_MAX_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder="e.g. I love meeting new people and I'm always the first to plan a night out"
        className="w-full rounded-input border border-line bg-cream px-4 py-3 outline-none focus:border-ink"
      />
      <span className="mt-1 flex justify-between gap-3 text-sm text-ink-soft">
        <span>Try describing your personality, or something you never mentioned. No names or contact details.</span>
        <span>
          {value.length}/{DETAILS_MAX_LENGTH}
        </span>
      </span>
      {problem && <span className="mt-1 block text-sm font-medium">! {problem}</span>}
    </label>
  );
}

/** How far one AI's guess moved, in words, or null while it's still coming. */
function shiftSummary(before?: Prediction, after?: Prediction): { text: string; points: number } | null {
  if (before?.status === "failed" || after?.status === "failed") return { text: "didn't answer", points: -1 };
  if (before?.status !== "ok" || after?.status !== "ok") return null;
  const shifts = DIMENSIONS.map((d) => Math.abs(after.profile[d] - before.profile[d]));
  const points = shifts.reduce((x, y) => x + y, 0) / shifts.length;
  return { text: points < CHANCE_GAP ? "barely moved" : `moved ${Math.round(points)} pts per trait`, points };
}

function ResultView({ result }: { result: Result }) {
  const { models } = result;
  const [chosen, setChosen] = useState(models[0]);
  // An AI counts as in once both its before and after guesses are.
  const got = models.filter((model) => result.before.has(model) && result.after.has(model)).length;
  const words = result.field === "words";
  return (
    <section aria-live="polite" className="space-y-6">
      <h2 className="text-2xl">
        {FIELD_LABELS[result.field]}: {show(result.field, result.from)} → {show(result.field, result.to)}
      </h2>
      {!result.done && (
        <p className="text-ink-soft">
          {got} of {models.length} AIs have answered. A live guess can take up to a minute.
        </p>
      )}
      {result.done && result.live === 0 && (
        <p className="text-sm text-ink-soft">
          ✓ Free: these guesses came from our study or from earlier visitors, so no AI was asked.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Choose an AI to see its change">
        {models.map((model) => {
          const summary = shiftSummary(result.before.get(model), result.after.get(model));
          return (
            <button
              key={model}
              type="button"
              role="radio"
              aria-checked={chosen === model}
              onClick={() => setChosen(model)}
              className={`press rounded-card border px-3 py-2 text-left ${
                chosen === model ? "border-ink bg-cream" : "border-line"
              }`}
            >
              <ModelChip model={model} className="text-sm" />
              <span className="block text-sm text-ink-soft">{summary?.text ?? "thinking..."}</span>
            </button>
          );
        })}
      </div>
      <ModelShift key={chosen} model={chosen} before={result.before.get(chosen)} after={result.after.get(chosen)} />
      <NotesSideBySide
        key={`notes-${chosen}`}
        before={result.before.get(chosen)}
        after={result.after.get(chosen)}
        beforeLabel={words ? "With your original words" : `As ${show(result.field, result.from)}`}
        afterLabel={words ? "With your new words" : `As ${show(result.field, result.to)}`}
      />
      {result.done && <ChanceNote />}
      {result.done &&
        (words ? <WordsFinding /> : <StudyFinding field={result.field as FactField} to={String(result.to)} />)}
      {result.done && (
        <LessonBlock
          title={words ? "Tell it who you are" : "One word, a whole new person"}
          question={
            words
              ? "If describing yourself changes the guess more than your job does, what does that say about how AIs judge people?"
              : "If changing one fact about you changes what an AI assumes about your whole personality, where else could that matter?"
          }
          speaker={6}
          answer={
            words ? (
              <p>
                That they lean on whatever they&rsquo;re given. With only a job or an age to go on, they fill the gaps
                with stereotypes. Tell them who you are and they mostly repeat it back, which sounds accurate but is
                really just your own words returned to you.
              </p>
            ) : (
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
            )
          }
        >
          <p>
            {words
              ? "You only changed how you described yourself. Your age, gender, nationality and job stayed the same."
              : `You changed one fact. Everything else about you stayed the same, and so did you. Any shift you see is the AI's idea of what people with that ${FIELD_LABELS[result.field].toLowerCase()} are like.`}
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

// Words too common to count as a change in a description.
const COMMON = new Set(
  "about after also and are because being both but can come comes could from have into just like more most much only other really some such than that their them then there these they this very what when which while with would your yours".split(
    " ",
  ),
);

const wordKey = (word: string) => word.toLowerCase().replace(/[^\p{L}'-]/gu, "");

/** The AI's own note before and after, with the words that are new in the "after" note highlighted. */
function NotesSideBySide({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before?: Prediction;
  after?: Prediction;
  beforeLabel: string;
  afterLabel: string;
}) {
  const beforeNote = before?.status === "ok" ? before.summary : "";
  const afterNote = after?.status === "ok" ? after.summary : "";
  if (!before || !after) return null;
  if (!beforeNote || !afterNote) {
    return (
      <p className="text-sm text-ink-soft">
        No side-by-side description for this one: guesses from our study don&rsquo;t come with a note.
      </p>
    );
  }
  const seen = new Set(beforeNote.split(/\s+/).map(wordKey));
  const isNew = (word: string) => {
    const key = wordKey(word);
    return key.length >= 4 && !COMMON.has(key) && !seen.has(key);
  };
  return (
    <section aria-label="In its own words, before and after" className="space-y-2">
      <h3 className="font-medium">In its own words</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <figure className="rounded-card border border-line bg-paper p-3">
          <figcaption className="text-xs font-medium text-ink-soft">{beforeLabel}</figcaption>
          <blockquote className="mt-1 text-sm leading-relaxed">&ldquo;{beforeNote}&rdquo;</blockquote>
        </figure>
        <figure className="rounded-card border-[1.5px] border-ink bg-cream p-3">
          <figcaption className="text-xs font-medium text-ink-soft">{afterLabel}</figcaption>
          <blockquote className="mt-1 text-sm leading-relaxed">
            &ldquo;
            {afterNote.split(/(\s+)/).map((part, i) =>
              isNew(part) ? (
                <mark key={i} className="rounded bg-mustard/60 px-0.5 text-ink">
                  {part}
                </mark>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
            &rdquo;
          </blockquote>
        </figure>
      </div>
      <p className="text-xs text-ink-soft">Highlighted: words that are new in the second description.</p>
    </section>
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
function StudyFinding({ field, to }: { field: FactField; to: string }) {
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

function WordsFinding() {
  return (
    <div className="rounded-card border border-dashed border-ink-soft p-4">
      <p className="text-sm font-medium">What our tests found</p>
      <p className="mt-1 leading-relaxed">
        In a small test of ours (one run per AI), adding hobbies like &ldquo;hiking and board games&rdquo; moved the
        answers only about 6 points, the size of chance. Describing personality directly (&ldquo;I avoid social
        events&rdquo;) moved them 19 to 35 points: more than changing any single fact like the job.
      </p>
    </div>
  );
}
