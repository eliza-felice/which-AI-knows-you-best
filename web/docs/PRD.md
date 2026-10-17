# PRD: Which AI Knows You Best?

## Summary

"Which AI Knows You Best?" is a web app where 7 AI models guess a user's personality from a few demographic facts, the user then takes the test, and the app reveals which model came closest. Each screen that follows uses the user's own result to teach one AI literacy idea: profiling, confidence vs accuracy, stereotyping, anthropomorphism, measurement reliability and persona jailbreaks.

The product rule is to teach through the user's own result. Every lesson starts from something the app just showed the user about themselves, so it never reads like a lecture.

The app is backed by an existing experiment: 7 models, 4 nationalities and 8 jobs, with measured run-to-run noise. Study findings come from that data. Personal results and what-ifs come from live model calls, which are cached and reused from V2 onward.

**Tech Stack:** Next.js (React) on Vercel, serverless API routes as a thin backend, a model gateway for the 7 models, and no database in V1. Postgres arrives in V2 for the prediction cache and in V3 for opt-in saved results. A backend is still required, because model API keys cannot live in the browser.

## Goals and success metrics

**Goals**

- Let a user finish the core loop (profile, AI guesses, test, reveal).
- Teach at least one AI literacy idea per screen, tied to the user's own numbers.
- Present the experiment's findings honestly, including noise and limits.
- Keep running costs low enough for a student project to stay live.

**Non-goals**

- A validated psychological assessment. The test is a teaching device, not a diagnosis.
- User accounts, logins or social features in V1 and V2.
- Ranking which AI model is "best" in general. The leaderboard is per user and per profile.
- A chat interface with the models.

**Success metrics**

- Core loop completion (consent to reveal)
- Reveal wait after test submitted
- Reflection quiz score (V3)
- What-if explorer use (V2)

- Model cost per completed session

## Users and principles

The primary user is a curious non-expert, such as a student or a member of the public, who uses AI tools but has not thought about how they profile people.


A secondary user is an educator or workshop host who runs the app with a group and uses the discussion questions. A third is a reader of the research who wants the findings and method.


## User journey

The journey is nine screens in a fixed order, each carrying one lesson. Steps 1 to 4 are the core loop. Steps 5 to 8 can be visited in any order after the reveal.

| # | Screen | What the user does or sees | Lesson | Version |
| --- | --- | --- | --- | --- |
| 1 | Consent and profile | Enters age, gender, nationality, job and optional extra details. Is told what is sent to the AI providers and that nothing is stored. A save choice is added in V3. | Privacy and data use | V1 |
| 2 | The AI guesses first | All 7 models predict the user's personality. The guesses stay hidden. | Profiling from demographics | V1 |
| 3 | Take the test | Answers the personality questionnaire. | None, this is the measurement | V1 |
| 4 | The reveal | Sees a match score per model, a top 3 countdown, full rankings and a no-information baseline. | Accuracy vs confidence | V1 |
| 5 | What-if explorer | Changes one fact about themselves and watches each model's guess shift. | Stereotyping and bias | V2 |
| 6 | Meet the AI without a mask | Sees each model's result with no persona. | AI self-reports and anthropomorphism | V2 |
| 7 | Same question, different answer | Sees how results change with question format and between runs. | Measurement reliability | V3 |
| 8 | How much does each AI play along? | Sees a leaderboard of persona adoption per model. | Persona adherence and jailbreaks | V3 |
| 9 | Wrap-up | Takes a three-question quiz and gets a shareable summary card. | Reflection | V3 |

The model calls for step 2 start when the profile is submitted and run in the background while the user takes the test. The 15 to 20 second wait is then hidden behind step 3, and the reveal loads instantly.

## Functional requirements

P0 means the version cannot ship without it. P1 means it should ship but can slip.

### 1. Consent and profile (V1)

| ID | Requirement | Priority |
| --- | --- | --- |
| C1 | Collect age (number), gender, nationality and job. Nationality and job are searchable lists with an "Other" free-text option capped at 40 characters. | P0 |
| C2 | Offer one optional free-text field for other details, capped at 200 characters, with a warning not to enter names or contact details. | P1 |
| C3 | Show a plain-language notice: what is collected, that the profile is sent to third-party AI providers, and what is stored. | P0 |
| C4 | State that nothing about the user is stored. In V3, add a clear save choice, off by default, and keep the app fully working when the user declines. | P0 |
| C5 | Show the line "Notice what you're about to share" above the submit button. | P0 |
| C6 | Require the user to confirm they meet the minimum age before continuing. | P0 |

### 2. The AI guesses first (V1)

| ID | Requirement | Priority |
| --- | --- | --- |
| G1 | On submit, request one prediction per model for the user's profile, all 7 in parallel, one repetition each. | P0 |
| G2 | Use the same prompt and scoring as the experiment's one\_shot condition so results are comparable. | P0 |
| G3 | From V2, return a cached prediction when the same profile and model have been run before. V1 always calls live. | P0 |
| G4 | Keep predictions hidden until the test is submitted. Show only "7 AIs have made their guess." | P0 |
| G5 | If a model fails or times out after 30 seconds, mark it "didn't answer" and continue with the rest. | P0 |

### 3. Take the test (V1)

| ID | Requirement | Priority |
| --- | --- | --- |
| T1 | Present the same questionnaire the models answered, one question per screen, with a progress bar. | P0 |
| T2 | Score in the browser into the same per-trait percentages used for the models. | P0 |
| T3 | Keep progress in the browser so a refresh does not lose answers. | P1 |

### 4. The reveal (V1)

| ID | Requirement | Priority |
| --- | --- | --- |
| R1 | Compute a match score per model: 100 minus the average point gap across traits between the model's guess and the user's result. | P0 |
| R2 | Reveal the top 3 one at a time, third to first, then show the full ranking of all 7. | P0 |
| R3 | Show a no-information baseline per model (the same prompt with no demographics) and state whether knowing the profile helped or hurt. | P0 |
| R4 | Show a one-paragraph summary of what each model thinks of the user. | P1 |
| R5 | Flag any gap under 5 points between two models as "may be chance". | P0 |
| R6 | Follow the reveal with the profiling lesson and the accuracy vs confidence lesson. | P0 |

### 5. What-if explorer (V2)

| ID | Requirement | Priority |
| --- | --- | --- |
| W1 | Start from the user's own profile. The user changes exactly one field at a time. | P0 |
| W2 | Show each model's guess before and after, per trait, with the point shift. | P0 |
| W3 | Let the user pick 2 or 3 models to compare. Default to their top 3 from the reveal. | P0 |
| W4 | Serve cached results instantly and call models live otherwise, with a visible progress state. | P0 |
| W5 | Show the study finding next to the user's result, worded as a study finding: 4 nationalities, 8 jobs, 7 models, and the job vs nationality effect size. | P0 |
| W6 | Limit each session to 10 live what-if requests. | P0 |

### 6. Meet the AI without a mask (V2)

| ID | Requirement | Priority |
| --- | --- | --- |
| M1 | Show each model's no-persona result from the experiment data, as a card per model. | P0 |
| M2 | Include the discussion question: does an AI have a personality, or was it trained to present one? | P0 |

### 7 to 9. Remaining lessons and wrap-up (V3)

| ID | Requirement | Priority |
| --- | --- | --- |
| L1 | Reliability page: show the 10 to 15 point drop in extremity when questions are asked one at a time, and type flips between runs. | P0 |
| L2 | Persona adherence page: a leaderboard of how far each model shifts under a persona, with the link to persona jailbreaks. | P0 |
| L3 | Three-question reflection quiz with immediate feedback. | P0 |
| L4 | Shareable summary card as an image, containing no demographic details unless the user adds them. | P0 |
| L5 | Leaderboard across all users who chose to save: which model wins most often. | P1 |
| L6 | Link to the full research findings. | P0 |

## Live model calls and caching

In V1, every personal result is a live call and nothing is stored. From V2, live results are saved and reused, so the app gets faster and cheaper the more it is used. The cache steps and rules below apply from V2. Study findings always come from the fixed experiment data, never from live calls.

**How a prediction request works**

1. The browser sends the profile to the server.
2. The server normalises it: trimmed, lower-cased, job and nationality mapped to list values where possible.
3. For each model, the server looks up the cache by profile, model and prompt version.
4. On a miss, it calls the model once with the one-shot prompt, parses the scores and saves the result.
5. Results stream back to the browser per model as they finish.

**Rules**

- **One repetition per model.** A single run varies by about 2 to 6 points, so the interface always shows the 5-point chance note.
- **Free text is never cached.** A profile with the optional extra-details field filled in is called live and not stored in the shared cache. It is unique to one person and would not be reused anyway.
- **Prompt version is part of the cache key.** Changing the prompt or a model version starts a fresh cache instead of mixing results.
- **Cost limits.** Each visitor gets 1 full profile run and 10 what-if requests per day by IP address. A monthly spend cap on the gateway stops all live calls when reached, and the app falls back to cached and study data.
- **User input is untrusted.** Job, nationality and free text are length-capped and inserted into the prompt as data. Model output is parsed as scores only and rejected if it does not fit the expected format.
- **Failures degrade gracefully.** A model that fails is shown as "didn't answer" and left off that user's ranking.

## Tech stack and architecture

Yes, the app needs a backend, but a small one that lives inside the same Vercel project. Three things cannot be done in the browser: holding model API keys, sharing a prediction cache between users, and enforcing rate limits.

| Layer | Recommendation | Why |
| --- | --- | --- |
| Framework | Next.js (React, TypeScript) | React front end and server routes in one repo and one Vercel deploy. |
| Hosting | Vercel | Already chosen. Preview deploys per branch. |
| Backend | Next.js route handlers running as Vercel functions | No separate server to run. Keeps keys server-side. |
| Model access | One gateway with a single key, such as OpenRouter or Vercel AI Gateway | Reaching 7 models through 5 or more provider accounts is slow to set up. A gateway also gives one spend cap. |
| Database | Hosted Postgres, such as Supabase or Neon | Not needed in V1. Added in V2 for the prediction cache and in V3 for saved results. Free tiers suit this scale. |
| Rate limiting | Upstash Redis | Per-IP counters that work across serverless functions. |
| Study data | Static JSON files in the repo | The experiment results do not change, so no database is needed for them. |
| Charts | Recharts | Covers bars, radar charts and the heatmaps with little code. |
| Styling | Tailwind CSS | Fast to build mobile-first screens. |
| Share card | Vercel OG image generation | Renders the summary card as an image on the server. |
| Analytics | Vercel Analytics plus custom funnel events | Enough to measure the success metrics without tracking individuals. |

These picks are from general knowledge of the tools, not a current price check. Confirm free-tier limits and which gateway carries all 7 of the experiment's exact model versions before committing.

**If plain React is preferred:** Vite with React plus a `/api` folder of Vercel functions gives the same result. Next.js is recommended only because routing, API routes and the share-card image come built in.

**Server endpoints**

| Endpoint | Purpose | Version |
| --- | --- | --- |
| `POST /api/predict` | Takes a profile and a list of models. Returns cached or live predictions, streamed per model. | V1 |
| `POST /api/results` | Saves a result when the user opted in. Ships in V3, not V1. | V3 |
| `GET /api/leaderboard` | Returns which model wins most often across saved results. | V3 |
| `GET /api/card` | Returns the summary card image. | V3 |

**Technical constraints**

- A live run takes 15 to 20 seconds. Check that the Vercel plan's function time limit covers 30 seconds, and stream results so the request is not one long silent wait.
- The existing experiment code is likely Python. Port only the prompt builder and score parser to TypeScript, and keep a test that checks both versions give the same output on 10 fixed personas.
- Test scoring runs in the browser. The user's raw answers never need to reach the server.

## Data and privacy

V1 stores nothing about users or their profiles. Later versions store two things: a shared cache of model predictions that is not linked to any person, and saved results only for users who opt in. There are no accounts, names or emails.

| Table | Fields | Written when |
| --- | --- | --- |
| `predictions` | Profile fields (age, gender, nationality, job), model, prompt version, trait scores, model summary text, created date | From V2, any live call for a profile without free text |
| `results` | Random result ID, profile fields, user's trait scores, match score per model, created date | From V3, only when the user opts in to saving |

**Privacy requirements**

- The consent screen states that the profile is sent to third-party AI providers. This is true even when the user declines saving.
- From V2, the consent screen states that the profile combination and the AI's guess are kept in a shared cache with no link to the user.
- Saved results carry a random ID, with no IP address or device identifier stored beside them.
- Free-text details are never stored.
- A saved result can be deleted by its owner through a link shown on the wrap-up screen.
- The cross-user leaderboard shows only aggregates, and only once at least 20 results exist.
- Nationality and gender are sensitive attributes, and the app is built in Singapore, so check the collection and consent wording against PDPA before launch. If this is tied to university research, check whether ethics review applies.

## Release plan

The app ships in three versions, each usable on its own. V1 proves the core loop, V2 adds the two highest-value lessons, and V3 completes the set.

| Version | Scope | Done when |
| --- | --- | --- |
| V1 | Steps 1 to 4: consent and profile, hidden guesses, test, reveal with baseline. A single lessons page covering privacy, profiling and accuracy vs confidence. Rate limits and spend cap. No database: one serverless function holds the key and calls the models live. | 5 test users finish the loop on a phone without help, and the reveal loads in under 3 seconds. |
| V2 | Step 5 what-if explorer and step 6 no-persona page. Study findings shown beside personal what-if results. Postgres prediction cache added. | A user can change one field and see the shift for 3 models, with the chance note shown. |
| V3 | Steps 7 to 9: reliability and persona adherence lessons, reflection quiz, share card, opt-in saved results, cross-user leaderboard, link to the research. | The quiz and share card work end to end, and the leaderboard shows only aggregates. |

**Build order within V1**

1. Port the prompt builder and score parser, and confirm they match the experiment.
2. Build `/api/predict` as a live-only function, tested from the command line.
3. Build the test and in-browser scoring.
4. Build the consent screen and the reveal.
5. Add rate limits, the spend cap and funnel events.
6. Write the lessons page.


