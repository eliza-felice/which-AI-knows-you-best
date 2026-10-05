// The core loop: landing -> consent and profile -> the AIs guess (hidden) ->
// the test -> the reveal. The guesses are requested when the profile is
// submitted and arrive in the background while the user takes the test.
//
// Each screen has its own address (/?step=profile, /?step=test, ...), so the
// browser's Back and Forward buttons move between screens. A screen you
// haven't reached yet (e.g. the results before finishing the test) falls back
// to the furthest one you have. Plain "/" picks up where you left off.
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QUESTIONS } from "@/lib/experiment";
import type { Prediction } from "@/lib/match";
import { MODELS } from "@/lib/models";
import { profileSystemPrompt, type UserProfile } from "@/lib/profile";
import {
  EMPTY_SESSION,
  clearSession,
  loadSession,
  requestPredictions,
  saveSession,
  track,
  type Session,
  type Step,
} from "@/lib/session";
import { NavBar } from "@/components/NavBar";
import { Landing } from "@/components/screens/Landing";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { GuessingScreen } from "@/components/screens/GuessingScreen";
import { TestScreen } from "@/components/screens/TestScreen";
import { RevealScreen } from "@/components/screens/RevealScreen";

// Screen names in the address bar.
const URL_NAMES: Record<Step, string> = {
  landing: "start",
  profile: "profile",
  guessing: "guessing",
  test: "test",
  reveal: "results",
};
const FROM_URL = Object.fromEntries(Object.entries(URL_NAMES).map(([step, name]) => [name, step])) as Record<
  string,
  Step
>;

export function hasFinishedTest(session: Session): boolean {
  return session.profile !== null && QUESTIONS.every((q) => session.answers[q.id] !== undefined);
}

/** The requested screen if it's been reached, otherwise the furthest one that has. */
function allowedStep(requested: Step, session: Session): Step {
  const order: Step[] = ["landing", "profile", "guessing", "test", "reveal"];
  const reached = hasFinishedTest(session) ? "reveal" : session.profile ? "test" : "profile";
  return order.indexOf(requested) <= order.indexOf(reached) ? requested : reached;
}

function sameProfile(a: UserProfile | null, b: UserProfile): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b);
}

export default function App() {
  const [session, setSession] = useState<Session>(loadSession);
  const requestId = useRef(0);
  const params = useSearchParams();
  const requested = FROM_URL[params.get("step") ?? ""] ?? session.step;
  const step = allowedStep(requested, session);

  const update = useCallback((change: Partial<Session> | ((s: Session) => Partial<Session>)) => {
    setSession((s) => ({ ...s, ...(typeof change === "function" ? change(s) : change) }));
  }, []);

  // Saved with the screen actually shown, so plain "/" resumes there.
  useEffect(() => {
    saveSession({ ...session, step });
  }, [session, step]);

  // Keep the address bar in line with the screen shown, without adding a
  // history entry (e.g. "/" -> "/?step=test" when resuming).
  useEffect(() => {
    if (params.get("step") !== URL_NAMES[step]) {
      window.history.replaceState(null, "", `/?step=${URL_NAMES[step]}`);
    }
    window.scrollTo(0, 0);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Moves to another screen, as a new entry in the browser's history. */
  const go = useCallback(
    (next: Step, change: Partial<Session> = {}) => {
      update({ ...change, step: next });
      window.history.pushState(null, "", `/?step=${URL_NAMES[next]}`);
    },
    [update],
  );

  function submitProfile(profile: UserProfile) {
    // Same profile as before (e.g. after going back to check it): keep the
    // guesses already made rather than asking the AIs again.
    if (sameProfile(session.profile, profile) && !session.predictError && session.predictions.length > 0) {
      go("guessing");
      return;
    }
    const id = ++requestId.current;
    go("guessing", {
      profile,
      systemPrompt: profileSystemPrompt(profile),
      predictions: [],
      predictError: null,
      answers: {},
      questionIndex: 0,
      testSubmittedAt: null,
      revealed: false,
    });
    track("profile_submitted", { has_details: profile.details ? 1 : 0 });
    requestPredictions(profile, (prediction) => {
      if (id !== requestId.current) return;
      update((s) => ({ predictions: [...s.predictions, prediction] }));
    }).then((error) => {
      if (id !== requestId.current) return;
      if (error) {
        update({ predictError: error });
        return;
      }
      // Anyone missing when the stream ends didn't answer.
      update((s) => {
        const answered = new Set(s.predictions.map((p) => p.model));
        const missing = MODELS.filter((m) => !answered.has(m.id)).map(
          (m): Prediction => ({ model: m.id, status: "failed", reason: "no reply" }),
        );
        return { predictions: [...s.predictions, ...missing] };
      });
    });
  }

  function startOver() {
    requestId.current++;
    clearSession();
    setSession({ ...EMPTY_SESSION, step: "profile" });
    window.history.pushState(null, "", `/?step=${URL_NAMES.profile}`);
  }

  const finished = hasFinishedTest(session);
  const view = { ...session, step };

  switch (step) {
    case "landing":
      return <Landing onStart={() => go("profile")} />;
    case "profile":
      return (
        <>
          <NavBar finished={finished} />
          <ProfileScreen initial={session.profile} onSubmit={submitProfile} onBack={() => go("landing")} />
        </>
      );
    case "guessing":
      return (
        <GuessingScreen
          answered={session.predictions.length}
          total={MODELS.length}
          error={session.predictError}
          onContinue={() => {
            track("test_started");
            go("test");
          }}
          onBack={() => go("profile", { predictError: null })}
        />
      );
    case "test":
      return (
        <>
          <NavBar current="test" finished={finished} />
          <TestScreen
            answers={session.answers}
            index={session.questionIndex}
            onChange={(answers, questionIndex) => update({ answers, questionIndex })}
            onFinish={() => {
              track("test_completed");
              go("reveal", { testSubmittedAt: Date.now() });
            }}
          />
        </>
      );
    case "reveal":
      return (
        <RevealScreen session={view} onRevealed={() => update({ revealed: true })} onStartOver={startOver} />
      );
  }
}
