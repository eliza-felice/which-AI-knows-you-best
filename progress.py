"""Show which experiments have been run so far.

Usage:
    python progress.py               # overview: every model x chunk size
    python progress.py gpt-5-mini    # detail: every persona for one model

An experiment is one persona x one model x one chunk size, and counts as
complete once it has NUM_REPETITIONS repetitions saved.
"""
import sys

from personality_lab import (
    MODE_NAMES,
    NUM_REPETITIONS,
    check_choice,
    count_completed_runs,
    load_models,
    load_personas,
)

COLUMN = 14


def is_complete(model, mode, persona_name):
    return count_completed_runs(model, mode, persona_name) >= NUM_REPETITIONS


def show_overview(models, personas):
    width = max(len(model) for model in models) + 2
    print(f"Personas complete (of {len(personas)}) per model and chunk size\n")
    print(" " * width + "".join(f"{mode:>{COLUMN}}" for mode in MODE_NAMES))
    finished = 0
    for model in models:
        cells = []
        for mode in MODE_NAMES:
            done = sum(is_complete(model, mode, name) for name in personas)
            finished += done
            cells.append(f"{done}/{len(personas)}" if done else "-")
        print(f"{model:<{width}}" + "".join(f"{cell:>{COLUMN}}" for cell in cells))

    total = len(models) * len(MODE_NAMES) * len(personas)
    print(f"\n{finished} of {total} experiments complete.")
    print("For one model's details: python progress.py <model>")


def show_model(model, personas):
    width = max(len(name) for name in personas) + 2
    print(f"{model}: repetitions done per persona (target {NUM_REPETITIONS})\n")
    print(" " * width + "".join(f"{mode:>{COLUMN}}" for mode in MODE_NAMES))
    current_group = None
    for name, (varied_attribute, _) in personas.items():
        if varied_attribute != current_group:
            current_group = varied_attribute
            print(f"\n[{varied_attribute}]")
        cells = []
        for mode in MODE_NAMES:
            done = count_completed_runs(model, mode, name)
            cells.append(f"{done}/{NUM_REPETITIONS}" if done else "-")
        print(f"{name:<{width}}" + "".join(f"{cell:>{COLUMN}}" for cell in cells))


def main():
    models = load_models()
    personas = load_personas()
    if len(sys.argv) > 1:
        show_model(check_choice(sys.argv[1], models, "model"), personas)
    else:
        show_overview(models, personas)


if __name__ == "__main__":
    main()
