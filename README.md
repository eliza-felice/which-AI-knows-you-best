# AI Personality Lab

Gives an AI model a persona in its system prompt (e.g. *"You are a Singaporean
woman in her 40s, working as a software engineer"*), has it answer a
60-statement personality questionnaire, and scores the result on five
dimensions: E/I, S/N, T/F, J/P and A/T.

The experiment compares three things:

- **Persona**: does changing one attribute (age, gender, nationality or
  occupation) change the result?
- **Model**: do different AI models respond differently to the same persona?
- **Chunk size**: does it matter whether the questions are asked one at a
  time, five at a time, or all at once?

## Setup

1. Install the dependencies:
   ```
   pip install -r requirements.txt
   ```
2. Create a file called `.env` in this folder containing your API key:
   ```
   AI_LODGE_API_KEY=your-key-here
   ```
   `.env` is git-ignored, so the key is never committed.

## Running the plan

An **experiment** is one persona × one model × one chunk size, repeated 5
times. Experiments are grouped into steps in
[`config/plan.json`](config/plan.json). Run them in order, looking at the
graphs between steps. Times are estimates with all 7 models running at once:

| Step | What | API calls | Time | What it tells you |
|---|---|---|---|---|
| 1 | base persona, `one_shot`, every model | ~35 | ~5 min | whether the models disagree at all |
| 1b | no persona (control), `one_shot`, every model | ~35 | ~2 min | each model's own default personality, to compare the personas against |
| 2 | base persona, `chunks_of_5` and `one_by_one`, every model | ~2,500 | ~20 min | whether chunk size changes the result |
| 3a | age personas, `one_shot`, every model | ~175 | ~7 min | how age shifts each model |
| 3b | gender personas, `one_shot`, every model | ~35 | ~2 min | how gender shifts each model |
| 3c | nationality personas, `one_shot`, every model | ~140 | ~6 min | how nationality shifts each model |
| 3d | occupation personas, `one_shot`, every model | ~245 | ~10 min | how occupation shifts each model |
| 3e | age personas, `chunks_of_5`, every model (check) | ~2,100 | ~30 min | whether the age shifts from 3a are the same at a different chunk size |
| 4 | every persona, `one_by_one`, 3 models (optional) | ~15,300 | ~3 hours | whether step 3's conclusions hold when each question is asked on its own |

Steps 3a–3e are independent: run them in any order, whenever you like. Each
attribute's graphs appear as soon as its sub-step is done.

**Why step 3 uses `one_shot`, with a check in 3e.** Step 2 showed that
`one_shot` and `chunks_of_5` give the same overall picture for the base
persona (mostly within ±5 points, never flipping which side a model leans
to), while `one_shot` needs 12× fewer API calls. Step 3 measures how each
persona *shifts* a model compared with the base persona at the same chunk
size, so an overall offset between chunk sizes largely cancels out. Step 3e
checks this directly: it re-runs the age personas with `chunks_of_5`. Compare
`graphs/compare_models/one_shot/age_lines.png` with
`graphs/compare_models/chunks_of_5/age_lines.png` (or the two
`shift_by_age.png` heatmaps). If the shifts match, the step 3 results don't
depend on chunk size.

```
python src/run_step.py                         # pick a step from a menu
python src/run_step.py 3a                      # run step 3a
python src/run_step.py 3a --model gpt-5-mini   # only the gpt-5-mini part of step 3a
python src/run_step.py 2 --parallel 3          # at most 3 models at once
```

Before starting, it shows how many experiments and API calls are left and
asks you to confirm. **All models run at the same time**, each working
through its own experiments, so a step takes about as long as its slowest
model. If the API provider starts rejecting requests, use `--parallel` with
a lower number (or change `MAX_PARALLEL_MODELS` in `src/personality_lab.py`).

Experiments that are already complete are skipped, so **you can stop at any
time with Ctrl+C and run the same command later to carry on**. (A repetition
that was halfway through when you stopped is discarded and run again.) If a
model keeps failing, the step continues with the rest and lists the failures
at the end; running the command again retries them.

Each heatmap compares personas with the base persona **under the same chunk
size**, which is why every step that runs other personas also includes the
base persona (it is skipped if it's already done). Don't compare results
across chunk sizes; chunk size alone can move scores by several points.

To change which models step 4 uses, or to add a step, edit `plan.json`.
`"all"` means every model in `models.json` or every persona generated from
`personas.json`. In `"personas"`, you can list persona names (`"age_60"`) or
attribute names (`"age"` = every age persona).

## Running a single experiment

To run one persona with one model outside the plan, pick the script for the
chunk size you want:

| Script | Chunk size | API calls per run |
|---|---|---|
| `python src/run_one_shot.py` | all 60 questions in one call | 5 |
| `python src/run_chunks_of_5.py` | 5 questions per call | 60 |
| `python src/run_one_by_one.py` | 1 question per call | 300 |

With no arguments, the script shows a menu to pick a model, then a persona.
The persona menu shows how many repetitions are already done:

```
Personas for gpt-5-mini, one_shot:
   1. base                       5/5  done
   2. age_20                     0/5
   ...
Number or name (blank to cancel):
```

Or skip the menus by naming both:

```
python src/run_one_shot.py age_60 --model gpt-5-mini
```

Results are saved after every repetition, so if a run is interrupted, the
finished repetitions are kept. Running the same experiment again adds more
repetitions; it doesn't overwrite earlier results.

## Checking progress

```
python src/progress.py               # each step of the plan, then every model and chunk size
python src/progress.py gpt-5-mini    # every persona for one model
```

## Making graphs

```
python src/plot_results.py
```

This reads everything in `experiment_data/` and redraws all the charts in
`graphs/`. A chart only appears once there is data for it, so run this
whenever you like.

| File | What it shows |
|---|---|
| `graphs/compare_models/chunk_size_lines.png` | line graph: how each model's result changes with chunk size (base persona) |
| `graphs/compare_models/<mode>/age_lines.png` | line graph: how each model's result changes with age |
| `graphs/compare_models/<mode>/base_persona.png` | every model's result for the base persona |
| `graphs/compare_models/<mode>/no_persona_vs_base.png` | each model's default (no persona) next to the base persona: how far the persona moves the model |
| `graphs/compare_models/<mode>/shift_by_<attribute>.png` | heatmap: how much each change to the persona moves each model's result, compared with the base persona |
| `graphs/per_model/<model>/mode_comparison.png` | whether chunk size changes one model's result |
| `graphs/per_model/<model>/by_<attribute>.png` | one attribute across all three chunk sizes, for one model |
| `graphs/summary.csv` | every mean and 95% confidence interval as a table |

In the heatmaps, **bold** numbers are shifts larger than the 95% confidence
interval, i.e. unlikely to be just run-to-run noise.

## Changing the experiment

All settings live in three JSON files and one constant; no other code needs to
change.

**Personas: [`config/personas.json`](config/personas.json)**
```json
{
  "base": {"age": 40, "gender": "female", "nationality": "Singaporean", "occupation": "software engineer"},
  "variations": {
    "age": [20, 30, 40, 50, 60, 70],
    ...
  }
}
```
Each persona changes **one** attribute and keeps the rest as in `base`, so
any difference in the result comes from that one attribute. Adding a value to
a list adds a persona (e.g. adding `"Japanese"` creates
`nationality_japanese`).

**Models: [`config/models.json`](config/models.json)**
```json
"gpt-5-mini": {"response_format": "json_schema"}
```
To add a model, add a line with its exact name from the API provider. The
`response_format` setting tells the code how to ask that model for its
answers in JSON:

- `json_schema`: strict format; use this if the model supports it.
- `json_object`: for models that reject `json_schema`.
- `none`: for models that support neither; the code finds the answers in the
  reply text.

If you're unsure, try `json_schema` with `python src/run_one_shot.py base`. If
it fails, switch to `json_object`. Retries are recorded in the `retries`
column of the results.

**Repetitions:** `NUM_REPETITIONS` near the top of
[`src/personality_lab.py`](src/personality_lab.py) (default 5).

## File layout

```
config/
  plan.json               the steps run_step.py runs
  personas.json           persona settings
  models.json             model settings
src/
  personality_lab.py      shared code: questions, prompts, scoring, API calls
  run_step.py             run one step of the plan
  run_one_shot.py         \
  run_chunks_of_5.py       } one script per chunk size
  run_one_by_one.py       /
  progress.py             what has been run so far
  plot_results.py         charts and summary table
experiment_data/<model>/<mode>/<persona>/<date>.csv        raw results
graphs/                                                     generated charts
```

Run the scripts from the project folder (e.g. `python src/run_one_shot.py`).
They find `config/`, `experiment_data/` and `graphs/` on their own, so they
also work from VS Code's Run button.

Folders in `experiment_data/` that start with `_` are ignored by the charts.
`_old_prompt/` holds early results from a version of the prompt that didn't
explain the rating scale, so they aren't comparable with newer runs.

## How the prompt works

- **System prompt:** the persona only, e.g. *"You are an Indian woman in her
  40s, working as a software engineer."*
- **User prompt:** the same instructions for every model and chunk size:
  rate each statement from −3 (strongly disagree) to +3 (strongly agree) and
  reply with a JSON object, followed by the numbered statements.

Each answer is added to or subtracted from its dimension's score, depending
on which side the statement points to, then converted to a percentage. 50%
means no lean either way.
