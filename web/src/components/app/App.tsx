// The core loop: landing -> consent and profile -> the AIs guess (hidden) ->
// the test -> the reveal. The guesses are requested when the profile is
// submitted and arrive in the background while the user takes the test.
import { useCallback, useEffect, useRef, useState } from "react";
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
} from "@/lib/session";
import { Landing } from "@/components/screens/Landing";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { GuessingScreen } from "@/components/screens/GuessingScreen";
import { TestScreen } from "@/components/screens/TestScreen";
import { RevealScreen } from "@/components/screens/RevealScreen";

export default function App() {
  const [session, setSession] = useState<Session>(loadSession);
  const requestId = useRef(0);

  useEffect(() => {
    saveSession(session);
  }, [session]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [session.step]);

  const update = useCallback((change: Partial<Session> | ((s: Session) => Partial<Session>)) => {
    setSession((s) => ({ ...s, ...(typeof change === "function" ? change(s) : change) }));
  }, []);

  function submitProfile(profile: UserProfile) {
    const id = ++requestId.current;
    update({
      profile,
      systemPrompt: profileSystemPrompt(profile),
      predictions: [],
      predictError: null,
      answers: {},
      questionIndex: 0,
      testSubmittedAt: null,
      revealed: false,
      step: "guessing",
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
  }

  switch (session.step) {
    case "landing":
      return <Landing onStart={() => update({ step: "profile" })} />;
    case "profile":
      return <ProfileScreen initial={session.profile} onSubmit={submitProfile} />;
    case "guessing":
      return (
        <GuessingScreen
          answered={session.predictions.length}
          total={MODELS.length}
          error={session.predictError}
          onContinue={() => {
            track("test_started");
            update({ step: "test" });
          }}
          onBack={() => update({ step: "profile", predictError: null })}
        />
      );
    case "test":
      return (
        <TestScreen
          answers={session.answers}
          index={session.questionIndex}
          onChange={(answers, questionIndex) => update({ answers, questionIndex })}
          onFinish={() => {
            track("test_completed");
            update({ step: "reveal", testSubmittedAt: Date.now() });
          }}
        />
      );
    case "reveal":
      return (
        <RevealScreen session={session} onRevealed={() => update({ revealed: true })} onStartOver={startOver} />
      );
  }
}
