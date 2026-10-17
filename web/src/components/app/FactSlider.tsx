// "Slide through a fact": step through every age, job, nationality or gender
// our study tested, on the study's test person, and watch each chosen AI's
// guess move. All from the study (persona_means in study.json), so it's free.
// "Try this on me" hands one value to the normal what-if, which may ask live.
import { useState } from "react";
import { ChartCaption } from "@/components/Charts";
import { ModelChip } from "@/components/ui";
import {
  DIMENSIONS,
  TRAIT_NAMES,
  type Dimension,
  type Profile5,
} from "@/lib/experiment";
import { modelInfo } from "@/lib/models";
import type { UserProfile } from "@/lib/profile";
import { BASE_PERSONA, STUDY_ATTRIBUTE, type FactField } from "@/lib/whatif";
import study from "@/data/study.json";

type Means = Record<string, Record<string, Record<string, Profile5>>>;
const MEANS = study.persona_means as Means;

const FACTS: { field: FactField; label: string }[] = [
  { field: "age", label: "Age" },
  { field: "job", label: "Job" },
  { field: "nationality", label: "Nationality" },
  { field: "gender", label: "Gender" },
];

/** A study value in everyday words, e.g. "40" -> "in her 40s", "nurse" -> "a nurse". */
function describe(field: FactField, value: string): string {
  if (field === "age") return `in her ${value}s`;
  if (field === "gender") return value === "male" ? "a man" : "a woman";
  if (field === "nationality") return value;
  return `${/^[aeiou]/i.test(value) ? "an" : "a"} ${value}`;
}

/** The study value as a what-if value for the user's own profile. */
function forUser(field: FactField, value: string): string {
  return field === "age" ? String(Number(value) + 5) : value;
}

function sameAsUser(
  field: FactField,
  value: string,
  profile: UserProfile,
): boolean {
  if (field === "age")
    return Math.floor(profile.age / 10) * 10 === Number(value);
  return String(profile[field]).toLowerCase() === value.toLowerCase();
}

export function FactSlider({
  models,
  profile,
  onTryOnMe,
}: {
  models: string[];
  profile: UserProfile;
  onTryOnMe: (field: FactField, value: string) => void;
}) {
  const [field, setField] = useState<FactField>("age");
  const attribute = STUDY_ATTRIBUTE[field];
  const values = Object.keys(MEANS[attribute] ?? {});
  const baseValue = String(
    BASE_PERSONA[attribute as keyof typeof BASE_PERSONA],
  );
  const [index, setIndex] = useState(values.indexOf(baseValue));
  const value = values[Math.min(Math.max(index, 0), values.length - 1)];
  const atValue = MEANS[attribute][value] ?? {};
  const atBase = MEANS[attribute][baseValue] ?? {};
  const shown = models.filter((m) => atValue[m] && atBase[m]);
  const untested = models.filter((m) => !atValue[m]);

  function pick(next: FactField) {
    setField(next);
    const nextValues = Object.keys(MEANS[STUDY_ATTRIBUTE[next]] ?? {});
    setIndex(
      nextValues.indexOf(
        String(
          BASE_PERSONA[STUDY_ATTRIBUTE[next] as keyof typeof BASE_PERSONA],
        ),
      ),
    );
  }

  // The trait that moved most, on average, between the test person and this value.
  const moves = DIMENSIONS.map((d) => {
    const changes = shown.map((m) => atValue[m][d] - atBase[m][d]);
    const mean = changes.length
      ? changes.reduce((a, b) => a + b, 0) / changes.length
      : 0;
    return { d, mean };
  }).sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean));
  const top = moves[0];

  return (
    <div className="space-y-6">
      <p className="leading-relaxed">
        Meet our test person: a {BASE_PERSONA.nationality} woman in her 40s,
        working as a {BASE_PERSONA.occupation}. Step through every value we
        tested in our study and watch each AI&rsquo;s guess move. It&rsquo;s all
        from the study, so it&rsquo;s instant and free.
      </p>

      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Fact to slide through"
      >
        {FACTS.map((f) => (
          <button
            key={f.field}
            type="button"
            role="radio"
            aria-checked={field === f.field}
            onClick={() => pick(f.field)}
            className={`press h-11 rounded-full border px-4 text-sm ${
              field === f.field
                ? "border-ink bg-cream font-medium"
                : "border-line"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div>
        <p className="font-hand text-3xl leading-tight">
          {value === baseValue
            ? "Our test person: "
            : field === "gender"
              ? "What if our test person were "
              : "What if she were "}
          {describe(field, value)}
          {value === baseValue ? "" : "?"}
        </p>
        {values.length <= 2 ? (
          // Only two values (e.g. gender): two buttons, not a slider.
          <div
            className="mt-3 flex gap-2"
            role="radiogroup"
            aria-label={FACTS.find((f) => f.field === field)!.label}
          >
            {values.map((v, i) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={index === i}
                onClick={() => setIndex(i)}
                className={`press h-11 flex-1 rounded-full border px-4 capitalize ${
                  index === i
                    ? "border-cobalt bg-cobalt text-cobalt-ink"
                    : "border-ink"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        ) : (
          <>
            <input
              type="range"
              min={0}
              max={values.length - 1}
              step={1}
              value={index}
              onChange={(event) => setIndex(Number(event.target.value))}
              aria-label={`${FACTS.find((f) => f.field === field)!.label}: ${value}`}
              aria-valuetext={value}
              className="mt-3 w-full accent-cobalt"
            />
            <div
              className="mt-1 flex justify-between text-xs text-ink-soft"
              aria-hidden="true"
            >
              <span>{values[0]}</span>
              <span>
                {index + 1} of {values.length}
              </span>
              <span>{values[values.length - 1]}</span>
            </div>
          </>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-ink-soft">
          None of the AIs you picked were tested on this in our study. Pick
          others above.
        </p>
      ) : (
        <div className="space-y-4 rounded-card border-[1.5px] border-ink bg-cream p-4 sm:p-5">
          <div
            className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
            aria-label="AIs shown, top to bottom on each line"
          >
            {shown.map((m) => (
              <ModelChip key={m} model={m} />
            ))}
          </div>
          {DIMENSIONS.map((d) => (
            <SlideBar key={d} d={d} models={shown} at={atValue} base={atBase} />
          ))}
          <p className="text-xs text-ink-soft">
            ○ our test person as she is · ● {describe(field, value)}
          </p>
        </div>
      )}
      {shown.length > 0 && value !== baseValue && (
        <ChartCaption>
          {Math.abs(top.mean) < 5
            ? `For these AIs, this barely changes anything: every trait moves less than 5 points on average.`
            : `Biggest change: ${Math.round(Math.abs(top.mean))} points more ${TRAIT_NAMES[top.d][top.mean > 0 ? 0 : 1]} on average, just from changing ${field === "job" ? "her job" : field === "age" ? "her age" : field === "gender" ? "her gender" : "her nationality"}.`}
        </ChartCaption>
      )}
      {untested.length > 0 && (
        <p className="text-sm text-ink-soft">
          Not tested on this in our study:{" "}
          {untested.map((m) => modelInfo(m).name).join(", ")}.
        </p>
      )}

      {value !== baseValue && (
        <div className="rounded-card border border-dashed border-ink-soft p-4">
          <p className="font-medium">Would they do the same with you?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Runs the same change on your own profile, in the other tab.
          </p>
          <button
            type="button"
            disabled={sameAsUser(field, value, profile)}
            onClick={() => onTryOnMe(field, forUser(field, value))}
            className="press mt-3 h-11 rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase disabled:opacity-40"
          >
            {sameAsUser(field, value, profile)
              ? "That's already you"
              : `Try “${field === "age" ? `${value}s` : value}” on me`}
          </button>
        </div>
      )}
    </div>
  );
}

/** One trait: each AI's guess for the test person (hollow) and at this value (filled), sliding as it changes. */
function SlideBar({
  d,
  models,
  at,
  base,
}: {
  d: Dimension;
  models: string[];
  at: Record<string, Profile5>;
  base: Record<string, Profile5>;
}) {
  const x = (v: number) => 100 - v; // the first trait is on the left
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{TRAIT_NAMES[d][0]}</span>
        <span>{TRAIT_NAMES[d][1]}</span>
      </div>
      <div
        className="relative mx-1.5 mt-1"
        style={{ height: 8 + models.length * 12 }}
      >
        <div className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-ink" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-ink-soft" />
        {models.map((m, i) => {
          const colour = modelInfo(m).colour;
          const top = 4 + i * 12;
          return (
            <div key={m}>
              <span
                className="absolute h-3 w-3 -translate-x-1/2 rounded-full border-2 bg-cream"
                style={{ left: `${x(base[m][d])}%`, top, borderColor: colour }}
              />
              <span
                title={`${modelInfo(m).name}: ${Math.round(at[m][d] >= 50 ? at[m][d] : 100 - at[m][d])}% ${TRAIT_NAMES[d][at[m][d] >= 50 ? 0 : 1]}`}
                className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[1.5px] border-ink transition-[left] duration-300 ease-out"
                style={{
                  left: `${x(at[m][d])}%`,
                  top: top - 1,
                  background: colour,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
