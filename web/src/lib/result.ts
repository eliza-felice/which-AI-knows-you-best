// The visitor's finished result, if this tab has one: their scores, and the
// AIs ranked by how close they came. Used by the screens after the reveal.
import { QUESTIONS, scoreAnswers } from "@/lib/experiment";
import { rankModels } from "@/lib/match";
import type { Session } from "@/lib/session";

export function finishedResult(session: Session) {
  if (!session.profile || !QUESTIONS.every((q) => session.answers[q.id] !== undefined)) return null;
  const user = scoreAnswers(session.answers);
  return { profile: session.profile, user, ranked: rankModels(session.predictions, user.profile) };
}
