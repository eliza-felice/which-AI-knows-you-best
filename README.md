# Which AI Knows You Best?

**12 AIs pretend to be you. Which one knows you best, and what did they assume?**

Live app: https://which-ai-knows-you-best.vercel.app


Visitors give four facts about themselves (age, gender, nationality, job). Twelve AI
models each take a 60-statement personality test *as* that person. The visitor then
takes the same test, and the app reveals which AI came closest, and how much of
each AI's answers came from stereotypes rather than from the person.

Behind the app is a study of 1,372 test runs measuring how AI models change their
answers when one fact about a persona changes.

## Problem statement

**What problem are we solving?** More and more, people tell AI assistants about
themselves: their job, their age, where they're from. The AI builds a picture of
who they are, and that picture shapes its answers. But nobody sees that picture,
so nobody can tell how much of it is actually the person and how much is an assumption.

**Who experiences it?** Anyone who uses AI chatbots. The
effect is hardest to spot for people who aren't AI specialists, who are also the
people least likely to read research papers on AI bias.

**Why is it worth solving?**  The study demonstrates how evaluations can change based on simple facts about a person. Changing only a persona's job
moved the models' answers by about 12 points on average, more than age, gender
and nationality put together. A "salesperson" came out 46 points more extraverted
than a "software engineer". People should be able to see this for themselves,
with their own profile, not just read about it.

## Solution overview

The project has two parts:

1. **A study** ([`experiment/`](experiment/README.md), Python). Gives AI models a persona
   (e.g. *"a Singaporean woman in her 40s, working as a software engineer"*), has
   them answer a 60-statement personality test as that person, and changes one
   fact at a time to measure what shifts. Findings are in
   [`experiment/results.md`](experiment/results.md).
2. **An app** ([`web/`](web/README.md), Next.js). Turns the study into something anyone
   can try: AIs take the test as *you*, you take it yourself, and you see who got
   closest. The screens after the reveal then show *why*: what each AI assumed, and
   what changes when you change one fact about yourself.

Instead of telling people "AI stereotypes", the app lets them watch it happen to
their own profile.

## Key features

- **The reveal.** 12 AIs take the test as you while you take it yourself; a podium
  shows which came closest, compared with a "no information" baseline so you
  can tell real knowledge from luck.
- **What each AI assumed.** Each AI writes a short note on how it pictured you and
  rates how much each fact shaped its answers. The app shows this next to how
  much those facts *actually* moved the answers in the study, which often
  differs.
- **What if…?** Change one fact (your job, age, nationality, gender or your own
  description) and watch up to 3 AIs' answers shift, trait by trait, with their
  before and after descriptions of you side by side. A slider steps through
  every age, job and nationality from the study, free of charge.
- **Meet the AIs without a mask.** How each AI answers when it isn't pretending to
  be anyone (most describe themselves as almost perfectly calm and confident).
- **Same question, different answer.** How much an AI's answers vary when asked the
  exact same thing again.
- **How much does each AI play along?** A ranking of how strongly each model takes
  on a persona..
- **The research.** The study behind the app, in plain language, with its limits.

## AI integration

AI is used in three places:

| Where | How |
|---|---|
| **The study** ([`experiment/src/personality_lab.py`](experiment/src/personality_lab.py)) | Each model gets a persona as its system prompt and the 60 statements, and replies with a JSON object rating each statement from −3 to +3. Answers are scored on five traits (Extraverted/Introverted, Observant/Intuitive, Thinking/Feeling, Judging/Prospecting, Assertive/Turbulent). Each setup is repeated 5–10 times. |
| **The app's guesses** ([`web/src/lib/server/guesses.ts`](web/src/lib/server/guesses.ts), [`gateway.ts`](web/src/lib/server/gateway.ts)) | The same prompt as the study, built from the visitor's profile. After its ratings, each model also adds a short note: what it assumed, a 0–3 rating of how much each fact mattered, and up to 3 quotes from the visitor's description. All 12 models are called in parallel and their answers are streamed back as they arrive. |
| **What if…?** ([`web/src/app/api/whatif`](web/src/app/api/whatif)) | The same call for the original and the changed profile, for up to 3 models. |

**Where each AI answer comes from.** To keep costs down and results consistent,
the app uses the first of:

1. **The study's saved runs**, if the visitor's profile matches a persona we tested.
2. **A shared cache** of earlier live answers for the same profile (30 days).
3. **A live call**, which is then cached.

The scoring is deliberately *not* AI: the app scores answers with the same fixed
formula as the study, and automated tests check that the TypeScript version gives
exactly the same results as the Python one.

## External tools & datasets

**AI models** (all called through one OpenAI-compatible gateway,
[apiyi](https://api.apiyi.com)):

| Company | Models |
|---|---|
| OpenAI | gpt-4o-mini, gpt-5-mini, gpt-5.4-nano |
| Google | gemini-3.1-flash-lite, gemini-3.5-flash-lite |
| DeepSeek | deepseek-v4-flash, deepseek-v4-1-flash |
| Anthropic | claude-haiku-4-5 |
| xAI | grok-4.3 |
| Zhipu AI | glm-5.2 |
| Alibaba | qwen3.6-flash |
| MiniMax | MiniMax-M2.7 |

**Data**

- **Questionnaire:** 60 statements in the style of popular five-trait personality
  tests, 10–13 per trait, defined in
  [`experiment/src/personality_lab.py`](experiment/src/personality_lab.py).
  
- **Study data:** our own, 1,372 runs, saved in
  [`experiment/experiment_data/`](experiment/experiment_data/). No external
  dataset is used.

**Tools**

- Study: Python, `openai` (client library), `pandas`, `matplotlib`, `python-dotenv`.
- App: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, Prettier, ESLint.
- Hosting and storage: Vercel (hosting, analytics), Upstash Redis (cache and rate
  limits).

## Installation & setup

You need an API key for an OpenAI-compatible gateway that offers the models above.
Both parts work without one for everything that doesn't call a model (the tests,
the study's graphs, the app's study-backed screens).

### The app

Requires Node.js 20 or later.

```bash
git clone https://github.com/eliza-felice/ai_personality_experiment.git
cd ai_personality_experiment/web
npm install
cp .env.example .env.local      # then set MODEL_GATEWAY_API_KEY in .env.local
npm run dev                     # open http://localhost:3000
```

Optional settings (daily limits, cache length, Upstash) are listed in
[`web/.env.example`](web/.env.example). Without Upstash, the cache and limits are
kept in memory, which is fine locally.

Useful commands, run from `web/`:

| Command | What it does |
|---|---|
| `npm test` | runs the tests (model calls are faked, so no API credits are used) |
| `npm run check` | type check, lint and tests in one go |
| `npm run build` | production build |

To deploy on Vercel: import the repo, set **Root Directory** to `web`, add the
variables from `.env.example`, and connect an Upstash Redis database (Storage
tab) so the limits and cache work across servers.

### The study

Requires Python 3.10 or later.

```bash
cd experiment
pip install -r requirements.txt
echo "AI_LODGE_API_KEY=your-key-here" > .env
python src/run_step.py          # pick a step from a menu; shows the number of API calls and asks before running
```

The results already in `experiment_data/` mean you don't need to rerun anything to
use the app. See [`experiment/README.md`](experiment/README.md) for each step.

### How the two parts connect

```
experiment/                                   web/
  config/, src/personality_lab.py   ──┐
  experiment_data/  (study results)   ├─ python experiment/src/export_for_web.py ─▶  src/data/*.json
                                      ┘                                              tests/parity_fixtures.json

  experiment_data/_web_app/  ◀── node scripts/export-responses.mjs (from web/) ──  the app's saved live answers
```

- **Experiment → app:** `export_for_web.py` copies the questions, the prompt, the
  model list and the study's findings into the app, so the app asks exactly what
  the study asked. Run it after changing the questions, the prompt or the models,
  or after new results.
- **App → experiment:** the app saves its live answers anonymously;
  `export-responses.mjs` writes them as a CSV next to the study data.

The two parts don't share code otherwise; each has its own dependencies and its own
key file (`experiment/.env` and `web/.env.local`, both git-ignored).

## AI safety & limitations

### Risks and limitations

- **It shows stereotypes on purpose.** The app makes AIs act out assumptions
  about age, gender, nationality and job. The app always frames these answers as *the AI's
  assumptions*, never as facts about the person or about groups of people.
- **It's not a real personality assessment.** The 60 statements are not a
  validated psychological test, and the "type" is unreliable even for the AIs
  (it flips between runs). Results are for exploring AI behaviour, not for
  learning about yourself.
- **AI answers vary.** The same model can answer the same prompt differently.
  The study measures this (5–10 repetitions per setup) and the app shows it, but
  any single answer in the app is one sample.

- **Limited coverage.** The study tested a fixed set of ages, genders (male and
  female only), nationalities and jobs, starting from one base persona, and the
  findings may not generalise beyond them. Three of the 12 models (GLM, Qwen,
  MiniMax) are only partly tested and are left out of the study averages due to credit limitations.
  Models are updated over time, so results can change.
- **Free text could be misused.** Visitors can describe themselves in their own
  words, which reaches the models, so someone could try prompt injection.

### Guardrails

- **Privacy.** No accounts and no names. Visitors confirm they're 18 or over, and
  see exactly what will be sent to the AIs before sending it. Progress stays in
  the browser tab and is gone when it closes. The free-text description is
  checked for email addresses and phone numbers, which are blocked. Answers from
  profiles with a description are never cached or saved. The only saved record
  of a live answer is the age group, gender, nationality, job and the AI's
  answer, with nothing that identifies the visitor.
- **Input limits.** All inputs are cleaned and length-limited on the server (age
  18–100, nationality and job 40 characters of letters only, description 200
  characters of plain text with quotes and control characters removed).
- **Output checks.** Model replies must be valid JSON with a whole-number rating
  for each of the 60 statements; anything else counts as a failed answer rather
  than a guessed one. Quotes a model claims to have "noticed" in your
  description are dropped unless they're really in it.
- **Cost and abuse limits.** Live AI use is capped per visitor per day (by a
  one-way hash of the IP address, not the address itself) and site-wide per
  day. Live calls can be switched off entirely with one setting
  (`LIVE_CALLS_ENABLED=false`). Study and cached answers are reused wherever
  possible, so most visits make no live calls.
- **Secrets.** API keys live only in git-ignored files and in Vercel's
  secret environment variables.


