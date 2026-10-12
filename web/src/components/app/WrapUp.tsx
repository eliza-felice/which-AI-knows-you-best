// Step 9: the wrap-up. Lesson: reflection. A three-question quiz with instant
// feedback (PRD L3), the share card (L4) and the research (L6). Nothing about
// the user is saved here.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Character } from "@/components/Character";
import { NavBar } from "@/components/NavBar";
import { Button, HandTitle } from "@/components/ui";
import { sharedAssumption } from "@/lib/insights";
import { modelInfo } from "@/lib/models";
import { finishedResult } from "@/lib/result";
import { clearSession, loadSession, loadWrapUp, saveWrapUp, track, type WrapUpState } from "@/lib/session";
import { QUIZ, cardParams, type ShareCard } from "@/lib/wrapup";

export default function WrapUp() {
  const [session] = useState(loadSession);
  const result = finishedResult(session);
  const [state, setState] = useState<WrapUpState>(loadWrapUp);

  function update(change: Partial<WrapUpState>) {
    const next = { ...state, ...change };
    setState(next);
    saveWrapUp(next);
  }

  useEffect(() => {
    track("wrapup_viewed");
  }, []);

  if (!result || result.ranked.length === 0) {
    return (
      <>
        <NavBar finished={false} />
        <main className="screen mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-12 text-center">
          <Character slot={2} size={88} />
          <h1 className="mt-4 text-2xl">Take the test first</h1>
          <p className="mt-2 text-ink-soft">The wrap-up looks back at your own result.</p>
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

  const winner = result.ranked[0];
  const shared = sharedAssumption(result.ranked, result.user.profile);
  const card: ShareCard = {
    winner: winner.model,
    match: winner.match,
    ...(shared.wrong && shared.agreeing >= Math.ceil(result.ranked.length * 0.75)
      ? { miss: { d: shared.d, side: shared.side as 0 | 1, all: shared.agreeing === result.ranked.length } }
      : {}),
  };

  return (
    <>
      <NavBar current="wrapup" finished />
      <main className="screen w-full flex-1 bg-cream">
        <div className="mx-auto max-w-2xl space-y-14 px-4 pt-6 pb-16 sm:px-6">
          <header className="flex items-end gap-3">
            <div className="hop shrink-0">
              <Character slot={modelInfo(winner.model).character} size={96} boil title={`${modelInfo(winner.model).name}, waving`} />
            </div>
            <div>
              <h1 className="font-hand text-4xl leading-tight font-normal">That&rsquo;s a wrap</h1>
              <p className="mt-1 text-ink-soft">Three quick questions, then your card to share.</p>
            </div>
          </header>

          <Quiz answers={state.quiz} onAnswer={(quiz) => update({ quiz })} />
          <Card card={card} />

          <section className="space-y-3 border-t border-line pt-8">
            <p>
              Want the details? <Link href="/research" className="text-cobalt underline underline-offset-4">Read about the research</Link>{" "}
              behind this app.
            </p>
            <StartOver />
          </section>
        </div>
      </main>
    </>
  );
}

function Quiz({ answers, onAnswer }: { answers: (number | null)[]; onAnswer: (answers: (number | null)[]) => void }) {
  const done = QUIZ.every((_, i) => answers[i] !== undefined && answers[i] !== null);
  const score = QUIZ.filter((q, i) => answers[i] === q.correct).length;

  function choose(question: number, option: number) {
    if (answers[question] !== undefined && answers[question] !== null) return; // one go per question
    const next = [...answers];
    next[question] = option;
    onAnswer(next);
    if (QUIZ.every((_, i) => next[i] !== undefined && next[i] !== null)) {
      track("quiz_completed", { score: QUIZ.filter((q, i) => next[i] === q.correct).length });
    }
  }

  return (
    <section aria-labelledby="quiz" className="space-y-6">
      <HandTitle>
        <span id="quiz">Three quick questions</span>
      </HandTitle>
      {QUIZ.map((q, i) => {
        const picked = answers[i];
        const answered = picked !== undefined && picked !== null;
        return (
          <div key={q.question} className="rounded-card border-[1.5px] border-ink bg-paper p-4 sm:p-5">
            <p className="font-medium">
              {i + 1}. {q.question}
            </p>
            <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label={`Question ${i + 1}`}>
              {q.options.map((option, j) => {
                const right = j === q.correct;
                const chosen = picked === j;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={answered}
                    onClick={() => choose(i, j)}
                    className={`press min-h-11 rounded-input border px-4 py-2 text-left ${
                      answered && right
                        ? "border-ink bg-mustard/50 font-medium"
                        : chosen
                          ? "border-ink bg-line/60"
                          : "border-line bg-cream"
                    } disabled:cursor-default`}
                  >
                    {answered && right ? "✓ " : chosen ? "✗ " : ""}
                    {option}
                  </button>
                );
              })}
            </div>
            {answered && (
              <p className="screen mt-3 text-sm leading-relaxed" aria-live="polite">
                <span className="font-medium">{picked === q.correct ? "Yes. " : "Not quite. "}</span>
                {q.explain}
              </p>
            )}
          </div>
        );
      })}
      {done && (
        <p className="font-hand text-2xl" aria-live="polite">
          You got {score} of {QUIZ.length}.{score === QUIZ.length ? " Nicely done." : ""}
        </p>
      )}
    </section>
  );
}

function Card({ card }: { card: ShareCard }) {
  const src = `/api/card?${cardParams(card)}`;
  const [note, setNote] = useState("");

  async function share() {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], "which-ai-knows-me.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Which AI knows me best?" });
        track("card_shared");
        return;
      }
      // No share sheet (most desktops): save the image instead.
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "which-ai-knows-me.png";
      link.click();
      URL.revokeObjectURL(link.href);
      setNote("Saved the image to your downloads.");
      track("card_saved");
    } catch {
      setNote("Couldn't share it. Try saving the image instead.");
    }
  }

  return (
    <section aria-labelledby="card-title" className="space-y-4">
      <HandTitle>
        <span id="card-title">Your card</span>
      </HandTitle>
      <p className="text-ink-soft">
        It says which AI knew you best, and nothing about your age, gender, nationality or job.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={1080}
        height={1350}
        alt="Your share card: which AI knew you best, on a blue background with its character."
        className="w-full max-w-xs rounded-card border-[1.5px] border-ink"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={share}>Share my card</Button>
        <a
          href={src}
          download="which-ai-knows-me.png"
          className="press inline-flex h-11 items-center rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase"
        >
          Save image
        </a>
      </div>
      {note && <p className="text-sm text-ink-soft">{note}</p>}
    </section>
  );
}

function StartOver() {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        onClick={() => {
          if (!confirming) return setConfirming(true);
          clearSession();
          router.push("/?step=profile");
        }}
      >
        {confirming ? "Erase my results?" : "Start over"}
      </Button>
      {confirming && (
        <p className="w-full text-sm text-ink-soft">
          Tap again to erase your results in this tab.
        </p>
      )}
    </div>
  );
}
