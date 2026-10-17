"use client";
// Step 1: consent and profile. Lesson: privacy and data use. The user sees
// exactly what will be sent before sending it.
import { useState, type FormEvent } from "react";
import { Cast } from "@/components/Character";
import { SearchSelect } from "@/components/SearchSelect";
import { Button, Card } from "@/components/ui";
import {
  DETAILS_MAX_LENGTH,
  GENDERS,
  JOBS,
  MAX_AGE,
  MIN_AGE,
  NATIONALITIES,
  cleanDetails,
  detailsProblem,
  normaliseProfile,
  profileSystemPrompt,
  type Gender,
  type UserProfile,
} from "@/lib/profile";
import { COMPANY_LIST, MODELS, numberWord } from "@/lib/models";

export function ProfileScreen({
  initial,
  onSubmit,
  onBack,
}: {
  initial: UserProfile | null;
  onSubmit: (profile: UserProfile) => void;
  onBack: () => void;
}) {
  const [age, setAge] = useState(initial ? String(initial.age) : "");
  const [gender, setGender] = useState<Gender | "">(initial?.gender ?? "");
  const [nationality, setNationality] = useState(initial?.nationality ?? "");
  const [job, setJob] = useState(initial?.job ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  // Already confirmed if they're coming back to a profile they sent.
  const [oldEnough, setOldEnough] = useState(initial !== null);
  const [error, setError] = useState<string | null>(null);

  const checked = normaliseProfile({ age, gender, nationality, job, details });
  const preview = "profile" in checked ? profileSystemPrompt(checked.profile) : null;
  const detailsWarning = detailsProblem(cleanDetails(details));

  function submit(event: FormEvent) {
    event.preventDefault();
    if ("error" in checked) return setError(checked.error);
    if (!oldEnough) return setError(`Please confirm you are ${MIN_AGE} or older.`);
    onSubmit(checked.profile);
  }

  return (
    <main className="screen mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-16 sm:px-6">
      <button type="button" onClick={onBack} className="press -ml-1 h-11 px-1 text-sm underline underline-offset-4">
        ← Back
      </button>
      <h1 className="mt-2 text-3xl">Tell the AIs about yourself</h1>
      <p className="mt-2 text-ink-soft">
        {numberWord(MODELS.length, true)} AIs will guess your personality from these few facts. Then you take the same
        test and see who came closest.
      </p>

      {/* The cast peeking over the top edge of the form. */}
      <Cast
        size={Math.min(44, Math.floor(330 / MODELS.length))}
        className="relative z-10 -mb-2 mt-8 flex-nowrap! justify-start! gap-0! pl-3"
      />
      <form onSubmit={submit} noValidate>
        <Card className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Age</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_AGE}
              max={MAX_AGE}
              value={age}
              onChange={(event) => setAge(event.target.value)}
              className="h-12 w-32 rounded-input border border-line bg-cream px-4 outline-none focus:border-ink"
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Gender</legend>
            <div className="flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <label
                  key={g.value}
                  className={`press flex h-11 cursor-pointer items-center rounded-full border px-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink ${
                    gender === g.value ? "border-cobalt bg-cobalt text-cobalt-ink" : "border-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={g.value}
                    checked={gender === g.value}
                    onChange={() => setGender(g.value)}
                    className="sr-only"
                  />
                  {g.label}
                </label>
              ))}
            </div>
          </fieldset>

          <SearchSelect
            label="Nationality"
            options={NATIONALITIES}
            value={nationality}
            onChange={setNationality}
            placeholder="Choose or type"
          />
          <SearchSelect
            label="Job"
            options={JOBS}
            value={job}
            onChange={setJob}
            placeholder="Choose or type"
            capitalise
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Anything else about you? <span className="font-normal text-ink-soft">(optional)</span>
            </span>
            <textarea
              value={details}
              maxLength={DETAILS_MAX_LENGTH}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              placeholder="e.g. I have two cats and I love hiking"
              className="w-full rounded-input border border-line bg-cream px-4 py-3 outline-none focus:border-ink"
            />
            <span className="mt-1 flex justify-between gap-3 text-sm text-ink-soft">
              <span>Don&rsquo;t include your name or contact details.</span>
              <span>
                {details.length}/{DETAILS_MAX_LENGTH}
              </span>
            </span>
            {detailsWarning && <span className="mt-1 block text-sm font-medium text-tomato">{detailsWarning}</span>}
          </label>
        </Card>

        <section className="mt-8 space-y-3" aria-labelledby="what-happens">
          <h2 id="what-happens" className="text-xl">
            What happens to this
          </h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            <li>
              <strong className="font-medium">What is sent:</strong> your age, gender, nationality, job and anything you
              write above, turned into one sentence. Nothing else.
            </li>
            <li>
              <strong className="font-medium">Who receives it:</strong> {MODELS.length} AI models run by third-party
              companies ({COMPANY_LIST}), reached through an API gateway. They may keep it under their own policies.
            </li>
            <li>
              <strong className="font-medium">What this app stores:</strong> nothing that identifies you. If you leave
              the &ldquo;anything else&rdquo; box empty, your age group, gender, nationality and job, with the
              AIs&rsquo; guesses, are kept with no link to you: reused for 30 days for anyone with the same combination,
              and saved as anonymous data for our study. If someone with your combination has already been guessed, or
              we tested it in our study, those guesses are reused instead of asking the AIs again. Anything you write in
              the box is never kept. Your test answers never leave your device; your progress is kept only in this
              browser tab and deleted when you close it.
            </li>
          </ul>

          <div className="rounded-card border border-dashed border-ink-soft p-4">
            <p className="text-sm font-medium">Exactly what the AIs will see:</p>
            {preview ? (
              <blockquote className="mt-2 border-l-2 border-cobalt pl-3 leading-relaxed whitespace-pre-line">
                {preview}
              </blockquote>
            ) : (
              <p className="mt-1 text-ink-soft">Fill in the form to see it.</p>
            )}
            <p className="mt-2 text-sm text-ink-soft">…followed by the 60 statements of the test.</p>
          </div>
        </section>

        <label className="mt-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={oldEnough}
            onChange={(event) => setOldEnough(event.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 accent-cobalt"
          />
          <span>I am {MIN_AGE} or older, and I agree to my profile being sent to these AI providers.</span>
        </label>

        <p className="mt-8 font-hand text-2xl">Notice what you&rsquo;re about to share.</p>
        {error && (
          <p role="alert" className="mt-2 font-medium text-tomato">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-3 w-full sm:w-auto">
          Send to the AIs
        </Button>
      </form>
    </main>
  );
}
