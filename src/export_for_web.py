"""Export what the web app needs from the experiment.

    python src/export_for_web.py

Writes three files into web/:
    src/data/experiment.json   questions, instructions and model settings, so
                               the app asks exactly what the experiment asked
    src/data/study.json        study findings from experiment_data/ (one_shot):
                               each model's no-persona default, base persona,
                               and how much each attribute shifts the results
    src/data/study-runs.json   every one_shot persona run, by the prompt it
                               used, so the app can reuse them for visitors
                               whose profile gives the same prompt
    tests/parity_fixtures.json prompts and scores worked out by this (Python)
                               code, which the app's tests check its
                               TypeScript port against

Run it again after changing the questions, the prompt or models.json, or
after new one_shot results come in.
"""
import json
import random
from datetime import date

import pandas as pd

import personality_lab as lab
from plot_results import load_results

WEB_DIR = lab.PROJECT_DIR / "web"
DIMENSIONS = ["EI", "SN", "TF", "JP", "AT"]
MODE = "one_shot"
# Bump when the prompt or scoring changes, so results from different
# versions are never mixed (it becomes part of the cache key from V2).
PROMPT_VERSION = 1


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {path.relative_to(lab.PROJECT_DIR)}")


def first_side_column(dimension):
    return f"percentage_{dimension}_{dimension[0]}"


def mean_profile(rows):
    """Mean first-side percentage per dimension, e.g. {"EI": 38.2, ...}."""
    return {d: round(float(rows[first_side_column(d)].mean()), 1) for d in DIMENSIONS}


def export_experiment():
    write_json(WEB_DIR / "src" / "data" / "experiment.json", {
        "prompt_version": PROMPT_VERSION,
        "instructions": lab.INSTRUCTIONS,
        "questions": lab.questions,
        "models": lab.load_models(),
        "personas": lab.load_persona_config(),
    })


def base_by_mode(config, models):
    """{model: {mode: {"profile": {...}, "runs": n}}} for the base persona."""
    df = load_results(config)
    df = df[df["varied_attribute"] == "base"]
    out = {}
    for model in models:
        for mode in ["one_by_one", "chunks_of_5", "one_shot"]:
            rows = df[(df["model"] == model) & (df["experiment_mode"] == mode)]
            if len(rows):
                out.setdefault(model, {})[mode] = {"profile": mean_profile(rows), "runs": len(rows)}
    return out


def export_study():
    config = lab.load_persona_config()
    df = load_results(config)
    df = df[df["experiment_mode"] == MODE]
    models = list(lab.load_models())

    per_model = {}
    for model in models:
        rows = df[df["model"] == model]
        no_persona = rows[rows["varied_attribute"] == "none"]
        base = rows[rows["varied_attribute"] == "base"]
        if no_persona.empty or base.empty:
            continue
        per_model[model] = {
            "no_persona": mean_profile(no_persona),
            "no_persona_runs": len(no_persona),
            "base": mean_profile(base),
            "base_runs": len(base),
        }

    # Shift of each persona from the base persona, per model and dimension:
    # mean(persona) - mean(base). Positive = towards the first side (E, S, T,
    # J, A).
    shifts = []
    for model in per_model:
        rows = df[df["model"] == model]
        base = mean_profile(rows[rows["varied_attribute"] == "base"])
        for persona_name, persona_rows in rows.groupby("persona_name"):
            attribute = persona_rows["varied_attribute"].iloc[0]
            if attribute in ("base", "none"):
                continue
            profile = mean_profile(persona_rows)
            value = persona_rows[f"persona_{attribute}"].iloc[0]
            for dimension in DIMENSIONS:
                shifts.append({
                    "model": model, "attribute": attribute, "value": str(value),
                    "dimension": dimension,
                    "shift": profile[dimension] - base[dimension],
                })
    shifts = pd.DataFrame(shifts)
    shifts["size"] = shifts["shift"].abs()
    # Study-wide figures only from models tested on every attribute, so an
    # average isn't skewed by models that only have some of them.
    attributes = list(config["variations"])
    tested = shifts.groupby("model")["attribute"].nunique()
    complete = sorted(tested[tested == len(attributes)].index)
    shifts = shifts[shifts["model"].isin(complete)]

    attribute_effect = (shifts.groupby("attribute")["size"].mean()
                        .round(1).sort_values(ascending=False).to_dict())
    model_adherence = shifts.groupby("model")["size"].mean().round(1).to_dict()
    # Average over models, per persona value and dimension: the biggest
    # stereotypes (e.g. salesperson -> more Extraverted).
    value_shifts = (shifts.groupby(["attribute", "value", "dimension"])["shift"]
                    .mean().round(1).reset_index())
    persona_shifts = {}
    for (attribute, value), group in value_shifts.groupby(["attribute", "value"]):
        persona_shifts.setdefault(attribute, {})[value] = dict(
            zip(group["dimension"], group["shift"]))

    write_json(WEB_DIR / "src" / "data" / "study.json", {
        "exported": date.today().isoformat(),
        "mode": MODE,
        "base_persona": config["base"],
        "tested_values": config["variations"],
        "models": per_model,
        "attribute_effect": attribute_effect,
        "model_adherence": model_adherence,
        "persona_shifts": persona_shifts,
        "models_in_averages": complete,
        # Every repetition of the base persona, per model: first-side
        # percentages, for the app's "ask again" chart.
        "base_runs": {
            model: {d: [round(float(v), 1) for v in df[(df["model"] == model) & (df["varied_attribute"] == "base")][first_side_column(d)]]
                    for d in DIMENSIONS}
            for model in per_model
        },
        # Base persona at each chunk size (questions per API call), per model:
        # mean first-side percentages, for the "same question, different
        # answer" screen.
        "base_by_mode": base_by_mode(config, list(per_model)),
        # How far the base persona moves each model from its own answers (no
        # persona), averaged over the five traits: how much it "plays along".
        "persona_pull": {
            model: round(float(sum(abs(v["base"][d] - v["no_persona"][d]) for d in DIMENSIONS) / len(DIMENSIONS)), 1)
            for model, v in per_model.items()
        },
        "total_runs": int(len(load_results(config))),
    })
    return attribute_effect


def export_study_runs():
    """Every one_shot run with a persona, grouped by the exact system prompt it
    used, so the app can answer a visitor whose profile gives the same prompt
    from the study instead of calling the model again. Server-side only."""
    config = lab.load_persona_config()
    df = load_results(config)
    df = df[(df["experiment_mode"] == MODE) & (df["varied_attribute"] != "none")]
    runs = {}
    for _, row in df.iterrows():
        persona = {key: row[f"persona_{key}"] for key in config["base"]}
        persona["age"] = int(persona["age"])
        prompt = lab.build_system_prompt(persona)
        runs.setdefault(prompt, {}).setdefault(row["model"], []).append({
            "profile": {d: float(row[first_side_column(d)]) for d in DIMENSIONS},
            "type": row["personality_type"],
        })
    write_json(WEB_DIR / "src" / "data" / "study-runs.json", runs)
    return sum(len(r) for by_model in runs.values() for r in by_model.values())


def export_parity_fixtures():
    """Ten personas and ten answer sets, with what the Python code makes of
    them. web/tests/parity.test.ts checks the TypeScript port gives the same."""
    rng = random.Random(42)
    personas = [
        {"age": 40, "gender": "female", "nationality": "Singaporean", "occupation": "software engineer"},
        {"age": 20, "gender": "male", "nationality": "Indian", "occupation": "artist"},
        {"age": 70, "gender": "female", "nationality": "American", "occupation": "accountant"},
        {"age": 35, "gender": "male", "nationality": "British", "occupation": "nurse"},
        {"age": 18, "gender": "female", "nationality": "Chinese", "occupation": "student"},
        {"age": 59, "gender": "male", "nationality": "Egyptian", "occupation": "electrician"},
        {"age": 26, "gender": "non-binary", "nationality": "Irish", "occupation": "office manager"},
        {"age": 44, "gender": "female", "nationality": "Ukrainian", "occupation": "engineer"},
        {"age": 13, "gender": "male", "nationality": "Australian", "occupation": "student"},
        {"age": 81, "gender": "female", "nationality": "Indonesian", "occupation": "retired teacher"},
    ]
    answer_sets = [{q["id"]: rng.randint(-3, 3) for q in lab.questions} for _ in range(8)]
    answer_sets.append({q["id"]: 3 for q in lab.questions})  # agrees with everything
    answer_sets.append({q["id"]: 0 for q in lab.questions})  # neutral on everything

    scoring = []
    for answers in answer_sets:
        percentages = lab.calculate_percentages(lab.calculate_scores(lab.questions, answers))
        scoring.append({
            "answers": {str(k): v for k, v in answers.items()},
            "percentages": percentages,
            "type": lab.get_personality_type(percentages),
        })

    write_json(WEB_DIR / "tests" / "parity_fixtures.json", {
        "system_prompts": [
            {"persona": p, "prompt": lab.build_system_prompt(p)} for p in personas
        ],
        "no_persona_prompt": lab.build_system_prompt({}),
        "user_prompt": lab.build_user_prompt(lab.questions),
        "scoring": scoring,
    })


if __name__ == "__main__":
    export_experiment()
    effect = export_study()
    print("Average shift by attribute:", effect)
    print("Study runs the app can reuse:", export_study_runs())
    export_parity_fixtures()
