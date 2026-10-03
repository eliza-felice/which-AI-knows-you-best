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

## Running an experiment

One run is **one persona × one model × one chunk size**, repeated 5 times.
Pick the script for the chunk size you want:

| Script | Chunk size | API calls per run |
|---|---|---|
| `python src/run_one_shot.py` | all 60 questions in one call | 5 |
| `python src/run_chunks_of_5.py` | 5 questions per call | 60 |
| `python src/run_one_by_one.py` | 1 question per call | 300 |

With no arguments, the script shows a menu to pick a model, then a persona.
The persona menu shows how many repetitions are already done:

```
Personas for gpt-5-mini, one_shot:
   1. base                                  5/5  done
   2. age_20                                0/5
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
python src/progress.py               # overview of every model and chunk size
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
| `graphs/compare_models/<mode>/base_persona.png` | every model's result for the base persona |
| `graphs/compare_models/<mode>/shift_by_<attribute>.png` | heatmap: how much each change to the persona moves each model's result, compared with the base persona |
| `graphs/per_model/<model>/mode_comparison.png` | whether chunk size changes one model's result |
| `graphs/per_model/<model>/by_<attribute>.png` | one attribute across all three chunk sizes, for one model |
| `graphs/summary.csv` | every mean and 95% confidence interval as a table |

In the heatmaps, **bold** numbers are shifts larger than the 95% confidence
interval, i.e. unlikely to be just run-to-run noise.

## Suggested order

There are 399 possible experiments (19 personas × 7 models × 3 chunk sizes),
and you don't need all of them. Start cheap and expand:

1. **Base persona, `one_shot`, every model** (35 calls). Shows whether the
   models disagree at all.
2. **Every persona, `one_shot`, every model** (665 calls). Fills in all the
   model comparison heatmaps.
3. **Base persona with `chunks_of_5` and `one_by_one`, on 2–3 models**.
   Checks whether chunk size changes the conclusions.

After each step, run `python src/progress.py` to see what's left and
`python src/plot_results.py` to look at the results.

## Changing the experiment

All settings live in two JSON files and one constant; no other code needs to
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
  personas.json           persona settings
  models.json             model settings
src/
  personality_lab.py      shared code: questions, prompts, scoring, API calls
  run_one_shot.py         \
  run_chunks_of_5.py       } one script per chunk size
  run_one_by_one.py       /
  progress.py             what has been run so far
  plot_results.py         charts and summary table
experiment_data/<model>/<mode>/<persona>/<timestamp>.csv   raw results
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
