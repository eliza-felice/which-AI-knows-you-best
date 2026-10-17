"use client";
// Step 3: the same 60 statements the AIs answered, one per screen, on the same
// -3 to +3 scale, scored in the browser.
import { useEffect, useRef, useState } from "react";
import { Character } from "@/components/Character";
import { Button } from "@/components/ui";
import { ANSWER_MEANINGS, type Answers } from "@/lib/experiment";
import { TEST_ORDER } from "@/lib/session";

const SCALE = [-3, -2, -1, 0, 1, 2, 3];
// Dots grow towards the ends of the scale.
const DOT_SIZES = [40, 32, 25, 20, 25, 32, 40];

export function TestScreen({
  answers,
  index,
  onChange,
  onFinish,
}: {
  answers: Answers;
  index: number;
  onChange: (answers: Answers, index: number) => void;
  onFinish: () => void;
}) {
  const question = TEST_ORDER[index];
  const answer = answers[question.id];
  const total = TEST_ORDER.length;
  const isLast = index === total - 1;
  const allAnswered = TEST_ORDER.every((q) => answers[q.id] !== undefined);
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined);

  function choose(value: number) {
    const next = { ...answers, [question.id]: value };
    onChange(next, index);
    clearTimeout(advance.current);
    // Move on after a moment, so the choice is visible first.
    if (!isLast) advance.current = setTimeout(() => onChange(next, index + 1), 250);
  }

  useEffect(() => () => clearTimeout(advance.current), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      const number = Number(event.key);
      if (number >= 1 && number <= 7) choose(SCALE[number - 1]);
      if (event.key === "ArrowLeft" && index > 0) onChange(answers, index - 1);
      if (event.key === "ArrowRight" && answer !== undefined && !isLast) onChange(answers, index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const progress = (index / (total - 1)) * 100;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-6 pb-10 sm:px-6">
      {process.env.NODE_ENV === "development" && (
        <DevAnswers answers={allAnswered ? answers : null} onLoad={(saved) => onChange(saved, total - 1)} />
      )}
      {/* Progress: a thin ink line with a moving dot, and a small character beside it. */}
      <div className="flex items-center gap-3">
        <div
          className="relative h-6 flex-1"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          aria-label="Progress"
        >
          <div className="absolute inset-x-0 top-1/2 h-px bg-ink" />
          <div className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-ink" style={{ width: `${progress}%` }} />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cobalt transition-[left] duration-200"
            style={{ left: `${progress}%` }}
          />
        </div>
        <span className="w-14 text-right text-sm text-ink-soft">
          {index + 1}/{total}
        </span>
        <Character slot={3} size={40} />
      </div>

      <div key={question.id} className="screen flex flex-1 flex-col justify-center py-10">
        <h1 className="text-2xl leading-snug sm:text-3xl">{question.text}</h1>

        <div className="mt-10" role="radiogroup" aria-label="How much do you agree?">
          <div className="flex items-center justify-between">
            {SCALE.map((value, i) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={answer === value}
                aria-label={ANSWER_MEANINGS[value]}
                onClick={() => choose(value)}
                className="press flex h-12 w-11 items-center justify-center rounded-full"
              >
                <span
                  className={`block rounded-full border-[1.5px] ${
                    answer === value ? "border-cobalt bg-cobalt" : "border-ink bg-cream"
                  }`}
                  style={{ width: DOT_SIZES[i], height: DOT_SIZES[i] }}
                />
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-sm font-medium">
            <span>Disagree</span>
            <span>Agree</span>
          </div>
          <p className="mt-4 h-6 text-center text-ink-soft" aria-live="polite">
            {answer !== undefined ? ANSWER_MEANINGS[answer] : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(answers, index - 1)}
          disabled={index === 0}
          className="press h-11 underline underline-offset-4 disabled:invisible"
        >
          Back
        </button>
        {isLast && allAnswered ? (
          <Button onClick={onFinish}>See who knew you best</Button>
        ) : (
          answer !== undefined &&
          !isLast && (
            <button
              type="button"
              onClick={() => onChange(answers, index + 1)}
              className="press h-11 underline underline-offset-4"
            >
              Next
            </button>
          )
        )}
        {isLast && !allAnswered && (
          <button
            type="button"
            onClick={() =>
              onChange(
                answers,
                TEST_ORDER.findIndex((q) => answers[q.id] === undefined),
              )
            }
            className="press h-11 underline underline-offset-4"
          >
            Go to unanswered statement
          </button>
        )}
      </div>
    </main>
  );
}

/**
 * Development only (`npm run dev`): save your answers once, then fill them in
 * on later runs instead of answering all 60 again. Stored in
 * web/.data/my-answers.json via /api/dev/answers.
 */
function DevAnswers({ answers, onLoad }: { answers: Answers | null; onLoad: (answers: Answers) => void }) {
  const [saved, setSaved] = useState<Answers | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/dev/answers")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setSaved(body?.answers ?? null))
      .catch(() => {});
  }, []);

  async function save() {
    const response = await fetch("/api/dev/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setMessage(response.ok ? "Saved to web/.data/my-answers.json" : "Couldn't save");
    if (response.ok) setSaved(answers);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-input border border-dashed border-ink-soft px-3 py-2 text-sm">
      <span className="font-medium">Dev:</span>
      {saved && (
        <button type="button" onClick={() => onLoad(saved)} className="underline underline-offset-4">
          Use saved answers
        </button>
      )}
      {answers && (
        <button type="button" onClick={save} className="underline underline-offset-4">
          Save my answers
        </button>
      )}
      {!saved && !answers && <span className="text-ink-soft">answer all 60 once, then save them here</span>}
      {message && <span className="text-ink-soft">{message}</span>}
    </div>
  );
}
