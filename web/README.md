# Which AI Knows You Best? (web app, V1)

Twelve AI models (every model in `config/models.json`) guess a visitor's personality from their age, gender,
nationality and job. The visitor then takes the same 60-statement test, and
the app reveals which model came closest. Each screen teaches one idea about
AI. The product spec is [`../PRD.md`](../PRD.md) and the visual design is
[`../design.md`](../design.md).

V1 covers the core loop: consent and profile, hidden guesses, the test, the
reveal with a no-information baseline, and a lessons page on privacy,
profiling and accuracy vs confidence. Nothing that identifies a user is
stored. The AIs' guesses for a profile without free text are cached and
reused, to cut API costs. Each model's guess comes from the first of:

1. **The study**, if the profile gives exactly the prompt of a persona we
   tested, e.g. a Singaporean woman in her 30s working as a software engineer
   (`src/lib/server/studyRuns.ts`, data from `src/data/study-runs.json`). One
   of that model's saved runs is picked at random. These have no note.
2. **The shared cache** of earlier live guesses for the same prompt, kept 30
   days (`src/lib/server/cache.ts`).
3. **A live call**, which is then cached, and saved as an anonymous record:
   age group, gender, nationality, job, the guess, the AI's note, the date
   (`src/lib/server/responses.ts`). `node scripts/export-responses.mjs` writes
   these to `../experiment_data/_web_app/responses.csv`.

Only live calls count towards a visitor's daily limit. Profiles with free text
are always asked live and never cached or saved.

## Running it locally

```
cd web
npm install
cp .env.example .env.local     # then fill in MODEL_GATEWAY_API_KEY
npm run dev                    # http://localhost:3000
```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | checks the TypeScript prompt builder and scoring against the Python experiment code |
| `node scripts/try-predict.mjs` | calls `/api/predict` from the command line (dev server running) and prints each model's guess as it arrives; makes one live call per model. `DETAILS="..."` adds a description |
| `node scripts/export-responses.mjs` | writes the saved live responses to `../experiment_data/_web_app/responses.csv` |
| `npm run build` | production build |

In development there is no daily limit. Set `RUNS_PER_IP_PER_DAY=1` in
`.env.local` to try the limit.

## How it connects to the experiment

The app asks exactly what the experiment's `one_shot` condition asked. To keep
the two in step, `python src/export_for_web.py` (run from the project folder)
writes:

- `src/data/experiment.json`: the questions, instructions and model settings,
  taken from `src/personality_lab.py` and `config/models.json`.
- `src/data/study.json`: study findings used by the reveal and lessons: each
  model's no-persona default (the baseline), and how much each attribute
  shifts the results.
- `tests/parity_fixtures.json`: prompts and scores worked out by the Python
  code. `npm test` checks the TypeScript port gives the same.

Run the exporter again after changing the questions, the prompt or
`models.json`, or after new `one_shot` results. If the prompt or scoring
changes, also increase `PROMPT_VERSION` in the exporter.

## Deploying to Vercel

1. Import the GitHub repo in Vercel and set **Root Directory** to `web`.
2. Add the environment variables from `.env.example`: the gateway key, and an
   Upstash Redis database (the free tier is enough) so the per-visitor limit
   and the guess cache work across serverless functions. Without Upstash
   both are only in memory, which doesn't hold up on Vercel: limits wouldn't
   be enforced and almost every visit would make live calls.
3. Set a monthly spend cap with the model gateway as well. `RUNS_PER_DAY`
   (default 200) is the app's own daily cap; `LIVE_CALLS_ENABLED=false` stops
   all live calls at once.
4. Turn on Web Analytics in the Vercel project to see the funnel events:
   `profile_submitted`, `test_started`, `test_completed`, `reveal_viewed`
   (with `wait_ms`) and `lessons_viewed`. Custom events need a paid Vercel
   plan; page views work on the free plan.

`/api/predict` can take up to 60 seconds (`MODEL_TIMEOUT_MS`; `maxDuration` is 90), so check
that the Vercel plan allows that.

## Files

```
src/app/page.tsx, lessons/page.tsx   pages (render in the browser only)
src/app/api/predict/route.ts         asks every model in parallel, streams each guess back
src/components/app/                  App.tsx (the core loop), Lessons.tsx
src/components/screens/              one file per screen
src/components/Character.tsx         the masked characters, one per model (12 drawn so far)
src/components/Doodles.tsx           hand-drawn bits: wobbly line filters, speech bubble, bracket
src/components/ui.tsx                buttons, cards, trait bars, lesson blocks
src/lib/experiment.ts                prompt builder and scoring, ported from Python
src/lib/profile.ts                   lists, input checks, the system prompt for a profile
src/lib/match.ts                     match score, ranking, baseline, summaries
src/lib/models.ts                    display names and characters per model
src/lib/session.ts                   progress in this browser tab, the /api/predict client
src/lib/server/                      gateway call, guess cache, cost limits, key-value store (server only)
```

## Choices made where the PRD left room

- **Age limit:** visitors confirm they are 18 or older (`MIN_AGE` in
  `src/lib/profile.ts`). Check against PDPA and any ethics review before launch.
- **Answer scale:** 7 dots, not the 5 in design.md, so people answer on the
  same −3 to +3 scale as the models and the scores are directly comparable.
- **Question order:** the same 60 statements, but taking one trait at a time
  in turn, so people don't get ten extraversion questions in a row. (The
  models saw them grouped by trait.)
- **Baseline:** each model's average no-persona result from the study (10
  runs), not a live call, so it costs nothing and is less noisy.
- **"What each model thinks of you" (R4):** in the same call, after its 60
  ratings, each model adds a note: a few sentences on what it assumed and why;
  a rating from 0 (not at all) to 3 (a lot) of how much each fact (age,
  gender, nationality, job, the user's own words) shaped its answers; and up
  to 3 quotes from the user's description (quotes not actually in it are
  dropped). This is the one change from the experiment's prompt
  (`NOTES_INSTRUCTION` in `src/lib/server/gateway.ts`). The ratings come
  first in the reply, so they're written before the note. A check on the base
  persona found the scores moved about 4 points on average with the note,
  within normal run-to-run noise.
- **"What they say they went on"** shows those 0-3 ratings next to how much
  each fact moved the answers in the study. They often differ: with a
  description, the AIs rate it "a lot" and gender and nationality near 0.
- **Timeout:** 60 seconds per model, not the PRD's 30. The slowest models
  (Qwen3.6 Flash, MiniMax M2.7, GPT-5 mini, DeepSeek V4.1) need 25 to 45
  seconds; the wait is hidden behind the test.
- **Insights on the reveal** come from this one set of guesses plus the study
  data, with no extra calls (`src/lib/insights.ts`): which facts each AI says
  it went on, next to what the study measured; the trait they all assumed; the
  trait they split on; the boldest guess vs its accuracy; and the
  no-information baseline. Each card only shows what the data supports, e.g.
  the "opposite guesses" card appears only when the AIs are 25+ points apart.
- **Gateway:** apiyi (the experiment's), since it serves all the exact model
  versions. Any OpenAI-compatible gateway works via `MODEL_GATEWAY_URL`.
- **"Another gender"** is offered; the prompt then says "person". The study
  only tested female and male.
- **Free-text details** are length-capped, stripped of quotes and control
  characters, refused if they contain an email or phone number, and added
  after the persona sentence as quoted data.
- **Illustrations** are simple SVG stand-ins drawn in code, with a "boiling"
  line effect that turns off under reduced motion. They can be replaced by
  hand-drawn SVGs later.
