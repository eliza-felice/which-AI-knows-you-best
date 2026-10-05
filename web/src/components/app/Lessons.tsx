// The V1 lessons page: privacy, stereotypes in the study, and how unstable an
// AI's answers are. It adds to the reveal rather than repeating it, using the
// visitor's own profile where the study tested it.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cast } from "@/components/Character";
import { NavBar } from "@/components/NavBar";
import { LessonBlock, ModelChip } from "@/components/ui";
import { QUESTIONS, type Dimension } from "@/lib/experiment";
import { COMPANIES, MODELS, modelInfo } from "@/lib/models";
import type { UserProfile } from "@/lib/profile";
import { loadSession, track, type Session } from "@/lib/session";
import { BASE_PERSONA, biggestShift } from "@/lib/whatif";
import study from "@/data/study.json";

const BASE = BASE_PERSONA;

/**
 * Study findings about the facts this visitor gave, where the study tested
 * them, then the study's most striking examples.
 */
function findingsFor(profile: UserProfile | null): { yours: string[]; examples: string[] } {
  const findings: string[] = [];
  const job = profile && biggestShift("occupation", profile.job);
  if (job) {
    findings.push(
      `“${profile!.job}” instead of “${BASE.occupation}”: ${job.points} points more ${job.side}.`,
    );
  }
  const decade = profile ? String(Math.floor(profile.age / 10) * 10) : "";
  const age = profile && biggestShift("age", decade);
  if (age) findings.push(`In their ${decade}s instead of their 40s: ${age.points} points more ${age.side}.`);
  const nationality = profile && biggestShift("nationality", profile.nationality);
  if (nationality) {
    findings.push(
      `${profile!.nationality} instead of ${BASE.nationality}: ${nationality.points} points more ${nationality.side}.`,
    );
  }
  const yours = findings.length;
  // Fill up with the study's most striking examples.
  for (const [attribute, value, label] of [
    ["occupation", "salesperson", "“salesperson” instead of “software engineer”"],
    ["occupation", "artist", "“artist” instead of “software engineer”"],
    ["age", "70", "In their 70s instead of their 40s"],
  ] as const) {
    if (findings.length >= 3) break;
    if (profile?.job === value) continue;
    const shift = biggestShift(attribute, value)!;
    findings.push(`${label}: ${shift.points} points more ${shift.side}.`);
  }
  return { yours: findings.slice(0, yours), examples: findings.slice(yours) };
}

export default function Lessons() {
  const [session] = useState<Session>(loadSession);
  useEffect(() => {
    track("lessons_viewed");
  }, []);

  const finished =
    session.profile && QUESTIONS.every((q) => session.answers[q.id] !== undefined)
      ? session
      : null;
  const profile = finished?.profile ?? null;
  const adherence = Object.entries(study.model_adherence as Record<string, number>).sort((a, b) => a[1] - b[1]);
  const noPersona = Object.entries(study.models as Record<string, { no_persona: Record<Dimension, number> }>);
  const confidentDefaults = noPersona.filter(([, m]) => m.no_persona.AT >= 80).length;
  const totalRuns = study.total_runs.toLocaleString("en");
  const findings = findingsFor(profile);

  return (
    <>
      <NavBar current="lessons" finished={Boolean(finished)} />
      <main className="screen mx-auto w-full max-w-2xl flex-1 space-y-14 px-4 pt-8 pb-16 sm:px-6">
        <header>
          <Cast size={44} className="mb-4 justify-start!" />
          <h1 className="text-3xl">Beyond your result</h1>
          <p className="mt-2 text-ink-soft">
            Three more ideas about AI and you, from our study of {totalRuns} test runs with {MODELS.length} AIs.
          </p>
        </header>
  
        <LessonBlock
          title="What you shared"
          question="Would you have shared the same things if a stranger had asked you face to face?"
          speaker={1}
          answer={
            <p>
              There&rsquo;s no right answer, but many people tell an app more than they would tell a person, because a
              form feels anonymous. Together, your age, gender, nationality and job narrow down who you are a lot, and
              once sent, you can&rsquo;t take them back.
            </p>
          }
        >
          {finished?.systemPrompt ? (
            <p>
              This went to {MODELS.length} AI models at {COMPANIES.length} companies:{" "}
              <span className="font-medium whitespace-pre-line">&ldquo;{finished.systemPrompt}&rdquo;</span>
            </p>
          ) : (
            <p>
              When you send your profile, it becomes one sentence, such as &ldquo;You are a Singaporean woman in her
              40s, working as a software engineer&rdquo;, sent to {MODELS.length} AI models at {COMPANIES.length} companies.
            </p>
          )}
          <p>
            This app kept nothing that identifies you, and your test answers never left your device. But once text reaches an AI provider,
            what happens to it depends on that provider&rsquo;s policy, which you can&rsquo;t see from here.
          </p>
          <p>
            {profile?.details
              ? "Notice how readily the AIs picked up on what you wrote and built a picture of you from it. Small facts, combined, say more about a person than any one of them alone."
              : "Age, gender and nationality are sensitive details. Small facts like these, combined, can say more about a person than any one of them alone."}
          </p>
        </LessonBlock>
  
        <LessonBlock
          title="Stereotypes, measured"
          question="Which of these feel like fair guesses, and which feel like stereotypes? Where is the line?"
          speaker={2}
          answer={
            <p>
              One way to draw it: a fair guess is small and changes as soon as it learns more about you; a stereotype
              is big and sticks. By that test, a {Math.round(study.persona_shifts.occupation.salesperson.EI)}-point jump
              just for the word &ldquo;salesperson&rdquo; is a stereotype. Real differences between jobs are much smaller,
              and the AIs applied it to someone they knew nothing else about.
            </p>
          }
        >
          <p>
            In our study we described one made-up person, a {BASE.nationality} woman in her 40s working as a{" "}
            {BASE.occupation}, then changed one fact at a time and measured how the AIs&rsquo; answers moved, averaged
            over the {study.models_in_averages.length} AIs we tested on every fact.
          </p>
          {findings.yours.length > 0 && (
            <>
              <p className="font-medium">For facts like yours:</p>
              <ul className="list-disc space-y-1 pl-5">
                {findings.yours.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
            </>
          )}
          <p className="font-medium">{findings.yours.length > 0 ? "And the biggest effects:" : "The biggest effects:"}</p>
          <ul className="list-disc space-y-1 pl-5">
            {findings.examples.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
          <p>
            Real people do differ a little by age and job, but probably far less than this. Some AIs also play along
            far more than others. Average shift when one fact changed, for those{" "}
            {study.models_in_averages.length} AIs:
          </p>
          <ul className="space-y-1">
            {adherence.map(([model, shift]) => (
              <li key={model} className="flex items-center justify-between gap-3 border-b border-line py-1.5">
                <ModelChip model={model} />
                <span className="font-medium">{shift} points</span>
              </li>
            ))}
          </ul>
        </LessonBlock>
  
        <LessonBlock
          title="Ask again, get a different answer"
          question="If a test gives a different result each time, what is it really measuring?"
          speaker={7}
          answer={
            <p>
              Partly the person, and partly noise: chance, wording and format. A good test keeps the noise small
              compared with the real differences it measures. For these AIs, the noise (2 to 6 points between runs, 11
              to 15 between formats) is as big as some of the effects we found, such as nationality ({study.attribute_effect.nationality}{" "}
              points).
            </p>
          }
        >
          <p>
            Every guess you saw was made once. In our study, the same AI with the same prompt moved by about 2 to 6
            points between runs, and {modelInfo("gpt-5-mini").name}&rsquo;s Extraverted score moved 17 points between
            two days.
          </p>
          <p>
            The format matters too: asked one statement at a time instead of all 60 at once, most AIs&rsquo; answers came
            out 11 to 15 points less extreme. Same AI, same person, different number.
          </p>
          <p>
            And with no persona at all, {confidentDefaults} of the {noPersona.length} AIs described themselves as at least
            80% calm and confident (&ldquo;Assertive&rdquo;). That says more about how they were trained to come across
            than about anyone they describe.
          </p>
        </LessonBlock>
  
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/?step=results"
            className="press inline-flex h-12 items-center rounded-full bg-cobalt px-7 font-medium text-cobalt-ink"
          >
            {finished ? "Back to my results" : "Take the test"}
          </Link>
          {[...(finished ? [["/what-if", "Try a what-if"]] : []), ["/without-mask", "Meet the AIs without a mask"]].map(
            ([href, label]) => (
              <Link
                key={href}
                href={href}
                className="press inline-flex h-11 items-center rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase"
              >
                {label}
              </Link>
            ),
          )}
        </div>
      </main>
    </>
  );
}
