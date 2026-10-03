"""Run one step of the experiment plan in config/plan.json.

Usage:
    python src/run_step.py                        # pick a step from a menu
    python src/run_step.py 3a                     # run step 3a
    python src/run_step.py 3a --model gpt-5-mini  # only step 3a's gpt-5-mini part
    python src/run_step.py 2 --parallel 3         # at most 3 models at once

Models run at the same time (each model works through its own experiments
one after another), so a step takes about as long as its slowest model.

Experiments that are already complete are skipped, and unfinished ones only
run the repetitions they are missing. So you can stop at any time (Ctrl+C)
and run the same command again later to carry on.
"""
import argparse
import time
from concurrent.futures import ThreadPoolExecutor, wait

from personality_lab import (
    CHUNK_SIZES,
    MAX_PARALLEL_MODELS,
    NUM_REPETITIONS,
    STOP,
    Stopped,
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
        if step["models"] != "all":
            for name in step["models"]:
                check_choice(name, models, f"model in step {number}")
        step_experiments(step, models, personas)  # Checks the personas.


def run_model_queue(model, model_settings, queue, personas, failed):
    """Run one model's experiments one after another. Several of these run
    at the same time, one per model."""
    for _, mode, persona_name, missing in queue:
        try:
            run_experiment(model, model_settings, mode, CHUNK_SIZES[mode],
                           persona_name, personas[persona_name], missing,
                           quiet=True)
            print(f"[{model}] {mode} / {persona_name}: complete")
        except Stopped:
            return
        except Exception as error:  # Keep going; report at the end.
            print(f"[{model}] {mode} / {persona_name}: FAILED: {error}")
            failed.append((model, mode, persona_name, str(error)[:200]))


def main():
    parser = argparse.ArgumentParser(description="Run one step of config/plan.json.")
    parser.add_argument("step", nargs="?", help="step name, e.g. 3a")
    parser.add_argument("--model", help="only run this model's part of the step")
    parser.add_argument("--parallel", type=int, default=MAX_PARALLEL_MODELS,
                        help="how many models to run at once "
                             f"(default {MAX_PARALLEL_MODELS}; 1 = one at a time)")
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
    queues = {}
    for item in work:
        queues.setdefault(item[0], []).append(item)
    parallel = max(1, min(args.parallel, len(queues)))
    print(f"{len(work)} of {len(experiments)} experiments still to run, "
          f"about {calls:,} API calls, {parallel} model(s) at a time.")
    if not args.yes:
        answer = input("Start? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            raise SystemExit("Cancelled.")

    started = time.time()
    failed = []
    executor = ThreadPoolExecutor(max_workers=parallel)
    futures = [
        executor.submit(run_model_queue, model, models[model], queue, personas, failed)
        for model, queue in queues.items()
    ]
    try:
        # Wait in short slices so Ctrl+C is noticed straight away.
        while wait(futures, timeout=0.5).not_done:
            pass
    except KeyboardInterrupt:
        print("\n\nStopping... (finishing the API calls already in progress)")
        STOP.set()
        executor.shutdown(wait=True, cancel_futures=True)
        print("Stopped. Finished repetitions are saved; run the same command "
              "again to carry on.")
        return
    executor.shutdown()

    minutes = (time.time() - started) / 60
    print(f"\nStep {number} finished in {minutes:.0f} min: "
          f"{len(work) - len(failed)} of {len(work)} experiments ran successfully.")
    for model, mode, persona_name, error in failed:
        print(f"  Failed: {model} / {mode} / {persona_name}: {error}")
    if failed:
        print("Run the same command again to retry the failed ones.")
    print("To see the results: python src/plot_results.py")


if __name__ == "__main__":
    main()
