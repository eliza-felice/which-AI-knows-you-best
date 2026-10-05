"use client";
// Step 4: the reveal. Third, second, then first place hop onto the podium,
// then the results (Results.tsx).
import { useEffect, useMemo, useRef, useState } from "react";
import { Character } from "@/components/Character";
import { Button } from "@/components/ui";
import { Results } from "@/components/screens/Results";
import { scoreAnswers } from "@/lib/experiment";
import { rankModels, type Ranked } from "@/lib/match";
import { MODELS, modelInfo } from "@/lib/models";
import { track, type Session } from "@/lib/session";

const PLACE_NAMES = ["First place", "Second place", "Third place"];
/** Pause between podium places, long enough to read the name and score. */
const PLACE_DELAY_MS = 2200;

export function RevealScreen({
  session,
  onRevealed,
  onStartOver,
}: {
  session: Session;
  onRevealed: () => void;
  onStartOver: () => void;
}) {
  const user = useMemo(() => scoreAnswers(session.answers), [session.answers]);
  const waitingFor = MODELS.length - session.predictions.length;
  const ranked = useMemo(() => rankModels(session.predictions, user.profile), [session.predictions, user.profile]);
  const podium = ranked.slice(0, 3);
  // Countdown position: podium.length - 1 (third place) down to 0 (first);
  // -1 = the full results. null = not started.
  const [chosenPlace, setPlace] = useState<number | null>(session.revealed ? -1 : null);
  const place = chosenPlace ?? podium.length - 1;
  const tracked = useRef(session.revealed);

  const ready = waitingFor <= 0 || session.predictError !== null;
  useEffect(() => {
    if (!ready || tracked.current) return;
    tracked.current = true;
    const waitMs = session.testSubmittedAt ? Date.now() - session.testSubmittedAt : 0;
    track("reveal_viewed", { wait_ms: waitMs, answered: ranked.length });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo(0, 0);
    if (ready && place < 0 && !session.revealed) onRevealed();
  }, [ready, place]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center" aria-live="polite">
        <div className="scribble">
          <Character slot={7} size={72} />
        </div>
        <p className="mt-4 text-lg">
          Waiting for {waitingFor} more {waitingFor === 1 ? "AI" : "AIs"} to finish guessing...
        </p>
        <p className="mt-1 text-sm text-ink-soft">Any AI that takes longer than a minute is skipped.</p>
      </main>
    );
  }

  if (place >= 0) {
    return <Podium podium={podium} place={place} onNext={() => setPlace(place - 1)} />;
  }

  return <Results session={session} user={user} ranked={ranked} onStartOver={onStartOver} />;
}

/** Third, second, then first place, each after a pause; then a button to the results. */
function Podium({ podium, place, onNext }: { podium: Ranked[]; place: number; onNext: () => void }) {
  const first = place === 0;
  useEffect(() => {
    if (first) return;
    const timer = setTimeout(onNext, PLACE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [place]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = podium[place];
  const info = modelInfo(current.model);
  // Podium slots left to right: second, first, third.
  const slots = [1, 0, 2];
  const heights = { 0: "h-28", 1: "h-20", 2: "h-14" } as Record<number, string>;
  const line = first ? "var(--color-cobalt-ink)" : "var(--color-ink)";
  return (
    <main
      className={`flex flex-1 flex-col items-center justify-center px-5 py-10 text-center transition-colors duration-300 ${
        first ? "on-cobalt bg-cobalt text-cobalt-ink" : "bg-cream"
      }`}
    >
      <p className="font-hand text-3xl">{PLACE_NAMES[place]}</p>
      <h1 key={current.model} className="screen mt-1 text-3xl sm:text-4xl">
        {info.name}
      </h1>
      <p className="mt-1 text-lg">
        {current.match.toFixed(1)}% match{first ? ": it guessed closest" : ""}
      </p>

      <div className="mt-8 flex items-end justify-center gap-2" aria-hidden="true">
        {slots.map((slot) => {
          const entry = podium[slot];
          if (!entry) return null;
          const shown = slot >= place;
          return (
            <div key={slot} className="flex w-24 flex-col items-center sm:w-28">
              <div className="h-24">
                {shown && (
                  <div className={slot === place ? "hop" : undefined}>
                    <Character slot={modelInfo(entry.model).character} size={88} line={line} boil={slot === place} />
                  </div>
                )}
              </div>
              <div
                className={`flex w-full items-start justify-center rounded-t-lg border-[1.5px] pt-1 font-hand text-2xl ${heights[slot]}`}
                style={{ borderColor: line }}
              >
                {slot + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Same height either way, so the podium doesn't jump when the button appears. */}
      <div className="mt-10 h-12">
        {first && (
          <Button variant="primary-on-cobalt" className="screen" onClick={onNext}>
            See all the results
          </Button>
        )}
      </div>
    </main>
  );
}
