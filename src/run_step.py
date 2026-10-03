"""Run one step of the experiment plan in config/plan.json.

Usage:
    python src/run_step.py                        # pick a step from a menu
    python src/run_step.py 3                      # run step 3
    python src/run_step.py 3 --model gpt-5-mini   # only step 3's gpt-5-mini part

Experiments that are already complete are skipped, and unfinished ones only
run the repetitions they are missing. So you can stop at any time (Ctrl+C)
and run the same command again later to carry on.
"""
import argparse

from personality_lab import (
    CHUNK_SIZES,
    NUM_REPETITIONS,
    calls_per_repetition,
    check_choice,
    choose,
    count_completed_runs,
    load_models,
    load_personas,
    load_plan,
    run_experiment,
    step_experiments,
)


def remaining_work(experiments):
    """[(model, mode, persona, repetitions_still_needed)] for unfinished ones."""
    work = []
    for model, mode, persona_name in experiments:
        missing = NUM_REPETITIONS - count_completed_runs(model, mode, persona_name)
        if missing > 0:
            work.append((model, mode, persona_name, missing))
    return work


def check_plan(plan, models, personas):
    for number, step in plan.items():
        for mode in step["modes"]:
            check_choice(mode, CHUNK_SIZES, f"mode in step {number}")
        for kind, selection, available in [
            ("model", step["models"], models),
            ("persona", step["personas"], personas),
        ]:
            if selection != "all":
                for name in selection:
                    check_choice(name, available, f"{kind} in step {number}")


def main():
    parser = argparse.ArgumentParser(description="Run one step of config/plan.json.")
    parser.add_argument("step", nargs="?", help="step number, e.g. 3")
    parser.add_argument("--model", help="only run this model's part of the step")
    parser.add_argument("-y", "--yes", action="store_true",
                        help="start without asking for confirmation")
    args = parser.parse_args()

    plan = load_plan()
    models = load_models()
    personas = load_personas()
    check_plan(plan, models, personas)

    def describe(number):
        experiments = step_experiments(plan[number], models, personas)
        done = len(experiments) - len(remaining_work(experiments))
        return f"{plan[number]['description']}  [{done}/{len(experiments)} complete]"

    if args.step:
        number = check_choice(args.step, plan, "step")
    else:
        number = choose(list(plan), "Steps:", describe)

    experiments = step_experiments(plan[number], models, personas)
    if args.model:
        check_choice(args.model, models, "model")
        experiments = [e for e in experiments if e[0] == args.model]
    work = remaining_work(experiments)

    print(f"\nStep {number}: {plan[number]['description']}")
    if not work:
        print("Nothing left to run: every experiment in this step is complete.")
        return
    calls = sum(missing * calls_per_repetition(mode) for _, mode, _, missing in work)
    print(f"{len(work)} of {len(experiments)} experiments still to run, "
          f"about {calls:,} API calls.")
    if not args.yes:
        answer = input("Start? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            raise SystemExit("Cancelled.")

    failed = []
    try:
        for index, (model, mode, persona_name, missing) in enumerate(work, start=1):
            print(f"\n=== Experiment {index}/{len(work)} ===")
            try:
                run_experiment(model, models[model], mode, CHUNK_SIZES[mode],
                               persona_name, personas[persona_name], missing)
            except Exception as error:  # Keep going; report at the end.
                print(f"FAILED: {error}")
                failed.append((model, mode, persona_name, str(error)[:200]))
    except KeyboardInterrupt:
        print("\n\nStopped. Finished repetitions are saved; run the same "
              "command again to carry on.")
        return

    print(f"\nStep {number} finished: {len(work) - len(failed)} of {len(work)} "
          "experiments ran successfully.")
    for model, mode, persona_name, error in failed:
        print(f"  Failed: {model} / {mode} / {persona_name}: {error}")
    if failed:
        print("Run the same command again to retry the failed ones.")
    print("To see the results: python src/plot_results.py")


if __name__ == "__main__":
    main()
