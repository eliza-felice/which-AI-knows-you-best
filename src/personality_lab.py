"""Shared logic for the personality experiment.

Don't run this file directly. Either run a whole step of the plan:
    python src/run_step.py

or a single experiment (ONE persona with ONE model) with a mode script:
    python src/run_one_by_one.py
    python src/run_chunks_of_5.py
    python src/run_one_shot.py
With no arguments these show menus (with what is already done); or name
them directly:
    python src/run_one_shot.py age_60 --model gpt-5-mini

What to edit:
    config/plan.json       the steps run_step.py runs
    config/personas.json   base persona + the values to vary
    config/models.json     models to test, and how each returns structured answers
    NUM_REPETITIONS below

Results are saved as experiment_data/<model>/<mode>/<persona>/<date>.csv.
See progress.py for what has been run and plot_results.py for graphs.
"""
import argparse
import json
import re
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import pandas as pd
from dotenv import dotenv_values
from openai import OpenAI

PROJECT_DIR = Path(__file__).resolve().parent.parent  # src/ is one level down
# Store outputs in the project folder so running from VS Code uses a stable
# path regardless of the current working directory.
project_file_location = PROJECT_DIR / "experiment_data"
PERSONAS_FILE = PROJECT_DIR / "config" / "personas.json"
MODELS_FILE = PROJECT_DIR / "config" / "models.json"
PLAN_FILE = PROJECT_DIR / "config" / "plan.json"

# Read the key directly from this project's .env file.
api_key = dotenv_values(PROJECT_DIR / ".env").get("AI_LODGE_API_KEY")

# Initialize the OpenAI client
client = OpenAI(
    api_key=api_key,
    base_url="https://api.apiyi.com/v1",  # or https://openrouter.ai/api/v1
)

NUM_REPETITIONS = 5
MAX_ATTEMPTS = 3  # Per batch, for API errors or unusable answers.
# How many models run_step.py runs at the same time. Lower it if the API
# provider starts rejecting requests for being too frequent.
MAX_PARALLEL_MODELS = 12

# Every API call is independent (no conversation history), so within one
# experiment the repetitions, and the batches within a repetition, can run at
# the same time without changing the results. This matters for slow
# "reasoning" models, which take 20-45 seconds even for one question.
PARALLEL_REPETITIONS = 5   # repetitions of one experiment at once
PARALLEL_BATCHES = 6       # batches of one repetition at once
# Cap on API calls in flight from this process, whatever the above add up to.
# Lower it if the API provider starts rejecting requests.
MAX_CALLS_IN_FLIGHT = 40
CALLS_IN_FLIGHT = threading.BoundedSemaphore(MAX_CALLS_IN_FLIGHT)

# Set (by Ctrl+C in run_step.py) to make running experiments stop at the
# next API call.
STOP = threading.Event()


class Stopped(Exception):
    pass


# Questions per API call for each mode (None = all of them in one call).
CHUNK_SIZES = {"one_by_one": 1, "chunks_of_5": 5, "one_shot": None}
MODE_NAMES = list(CHUNK_SIZES)

# Every model, mode and persona gets exactly the same instructions, so the
# only thing that differs between runs is what you are testing.
INSTRUCTIONS = """Rate how much you agree with each statement, answering as yourself.
Use this scale:
-3 = strongly disagree, -2 = disagree, -1 = slightly disagree, 0 = neutral,
1 = slightly agree, 2 = agree, 3 = strongly agree.
Reply with only a JSON object that maps each statement number to your rating, like {"12": 2}.

Statements:
"""

questions = [
    # ─────────────── EI ───────────────
    {
        "id": 1,
        "text": "You regularly make new friends.",
        "dimension": "EI",
        "direction": "E"
    },
    {
        "id": 2,
        "text": "You avoid making phone calls.",
        "dimension": "EI",
        "direction": "I"
    },
    {
        "id": 3,
        "text": "At social events, you rarely try to introduce yourself to new people and mostly talk to those you already know.",
        "dimension": "EI",
        "direction": "I"
    },
    {
        "id": 4,
        "text": "You feel more energetic after spending time with a group of people.",
        "dimension": "EI",
        "direction": "E"
    },
    {
        "id": 5,
        "text": "You enjoy participating in group activities.",
        "dimension": "EI",
        "direction": "E"
    },
    {
        "id": 6,
        "text": "You lean towards being an introvert.",
        "dimension": "EI",
        "direction": "I"
    },
    {
        "id": 7,
        "text": "In your social circle, you are often the one who contacts your friends and initiates activities.",
        "dimension": "EI",
        "direction": "E"
    },
    {
        "id": 10,
        "text": "You enjoy going to social events that involve dressing up or role-playing.",
        "dimension": "EI",
        "direction": "E"
    },
    {
        "id": 11,
        "text": "You look forward to a long, solitary walk or a quiet afternoon with a book.",
        "dimension": "EI",
        "direction": "I"
    },
    {
        "id": 12,
        "text": "You find it easy to walk up to a group of people and join their conversation.",
        "dimension": "EI",
        "direction": "E"
    },

    # ─────────────── SN ───────────────
    {
        "id": 13,
        "text": "You enjoy exploring unfamiliar ideas and viewpoints.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 14,
        "text": "You spend a lot of your free time exploring various random topics that pique your interest.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 15,
        "text": "You are more interested in what is possible than what is actual.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 16,
        "text": "You easily lose track of time when contemplating abstract concepts.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 17,
        "text": "You prefer tasks that have a clear, practical approach over conceptual ones.",
        "dimension": "SN",
        "direction": "S"
    },
    {
        "id": 18,
        "text": "You often find yourself daydreaming about various ideas or scenarios.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 19,
        "text": "You are more interested in theories than in practical facts.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 20,
        "text": "You rarely spend time thinking about how mankind could improve.",
        "dimension": "SN",
        "direction": "S"
    },
    {
        "id": 21,
        "text": "You are fascinated by art, writing, or cinema.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 22,
        "text": "You find it difficult to focus on a single conceptual thought for a long period of time.",
        "dimension": "SN",
        "direction": "S"
    },
    {
        "id": 23,
        "text": "You enjoy thinking about the complex layers of human existence.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 24,
        "text": "You frequently contemplate the reasons behind why things happen.",
        "dimension": "SN",
        "direction": "N"
    },
    {
        "id": 36,
        "text": "You consider yourself more realistic than visionary.",
        "dimension": "SN",
        "direction": "S"
    },

    # ─────────────── TF ───────────────
    {
        "id": 25,
        "text": "You are not easily swayed by emotional arguments.",
        "dimension": "TF",
        "direction": "T"
    },
    {
        "id": 26,
        "text": "Your emotions control you more than you control them.",
        "dimension": "TF",
        "direction": "F"
    },
    {
        "id": 27,
        "text": "You lean towards protecting your principles even if it means damaging a relationship.",
        "dimension": "TF",
        "direction": "T"
    },
    {
        "id": 28,
        "text": "You find it easy to empathize with a person whose experiences are very different from yours.",
        "dimension": "TF",
        "direction": "F"
    },
    {
        "id": 29,
        "text": "Being right is more important than being cooperative when it comes to teamwork.",
        "dimension": "TF",
        "direction": "T"
    },
    {
        "id": 30,
        "text": "You prioritize logic over raw human emotion when making tough calls.",
        "dimension": "TF",
        "direction": "T"
    },
    {
        "id": 31,
        "text": "You worry about how your actions affect other people.",
        "dimension": "TF",
        "direction": "F"
    },
    {
        "id": 32,
        "text": "You find yourself deeply moved by a sad movie, song, or story.",
        "dimension": "TF",
        "direction": "F"
    },
    {
        "id": 33,
        "text": "You believe that heavy reliance on logic can make a person cold and detached.",
        "dimension": "TF",
        "direction": "F"
    },
    {
        "id": 34,
        "text": "You often put others' needs before your own.",
        "dimension": "TF",
        "direction": "F"
    },
    {
        "id": 35,
        "text": "You value justice higher than mercy.",
        "dimension": "TF",
        "direction": "T"
    },
    {
        "id": 8,
        "text": "If your friend is sad about something, you are more likely to offer emotional support than suggest ways to deal with the problem.",
        "dimension": "TF",
        "direction": "F"
    },

    # ─────────────── JP ───────────────
    {
        "id": 37,
        "text": "You struggle with deadlines.",
        "dimension": "JP",
        "direction": "P"
    },
    {
        "id": 38,
        "text": "You like to have a detailed plan before starting a project.",
        "dimension": "JP",
        "direction": "J"
    },
    {
        "id": 39,
        "text": "You often leave things undone until the last possible moment.",
        "dimension": "JP",
        "direction": "P"
    },
    {
        "id": 40,
        "text": "Your living and working spaces are very clean and organized.",
        "dimension": "JP",
        "direction": "J"
    },
    {
        "id": 41,
        "text": "You prefer to adapt dynamically rather than follow a strict schedule.",
        "dimension": "JP",
        "direction": "P"
    },
    {
        "id": 42,
        "text": "You make lists of things you need to accomplish during the day or week.",
        "dimension": "JP",
        "direction": "J"
    },
    {
        "id": 43,
        "text": "You rarely plan your actions far in advance.",
        "dimension": "JP",
        "direction": "P"
    },
    {
        "id": 44,
        "text": "You feel uncomfortable when a situation is left open or unresolved.",
        "dimension": "JP",
        "direction": "J"
    },
    {
        "id": 45,
        "text": "You like to keep your options open rather than committing to a firm choice too early.",
        "dimension": "JP",
        "direction": "P"
    },
    {
        "id": 46,
        "text": "You always make sure your duties are taken care of before you sit down to relax.",
        "dimension": "JP",
        "direction": "J"
    },
    {
        "id": 47,
        "text": "You find it easy to stick to your study or work schedule.",
        "dimension": "JP",
        "direction": "J"
    },
    {
        "id": 48,
        "text": "You often misplace your belongings or struggle to keep track of them.",
        "dimension": "JP",
        "direction": "P"
    },
    {
        "id": 9,
        "text": "You prefer to completely finish one project before starting another.",
        "dimension": "JP",
        "direction": "J"
    },

    # ─────────────── AT ───────────────
    {
        "id": 49,
        "text": "You rarely feel insecure.",
        "dimension": "AT",
        "direction": "A"
    },
    {
        "id": 50,
        "text": "You worry about whether you make a good impression on people.",
        "dimension": "AT",
        "direction": "T"
    },
    {
        "id": 51,
        "text": "You usually feel calm even under extreme pressure.",
        "dimension": "AT",
        "direction": "A"
    },
    {
        "id": 52,
        "text": "You frequently second-guess the choices you've made.",
        "dimension": "AT",
        "direction": "T"
    },
    {
        "id": 53,
        "text": "You easily feel overwhelmed by stressful situations.",
        "dimension": "AT",
        "direction": "T"
    },
    {
        "id": 54,
        "text": "You are highly prone to experiencing mood swings.",
        "dimension": "AT",
        "direction": "T"
    },
    {
        "id": 55,
        "text": "You care deeply about what other people think of you.",
        "dimension": "AT",
        "direction": "T"
    },
    {
        "id": 56,
        "text": "You often feel like you have to defend your choices or actions to others.",
        "dimension": "AT",
        "direction": "T"
    },
    {
        "id": 57,
        "text": "You are confident that things will work out well for you in the end.",
        "dimension": "AT",
        "direction": "A"
    },
    {
        "id": 58,
        "text": "You frequently dwell on past mistakes or regrets.",
        "dimension": "AT",
        "direction": "T"
    },
    {
        "id": 59,
        "text": "You consider yourself to be relatively stable emotionally.",
        "dimension": "AT",
        "direction": "A"
    },
    {
        "id": 60,
        "text": "You are easily discouraged when someone criticizes your work.",
        "dimension": "AT",
        "direction": "T"
    }
]

dimension_counts = Counter(
    question["dimension"]
    for question in questions
)

def build_system_prompt(persona):
    """The persona as a system prompt, or None for the no-persona control."""
    if not persona:
        return None
    gender = persona["gender"].lower()
    gender_word, pronoun = {
        "female": ("woman", "her"),
        "male": ("man", "his"),
    }.get(gender, ("person", "their"))
    age = persona["age"]
    age_description = (
        f"in {pronoun} {age // 10 * 10}s" if age >= 20 else f"aged {age}"
    )
    return (
        f"You are {with_article(persona['nationality'])} {gender_word} "
        f"{age_description}, working as {with_article(persona['occupation'])}."
    )


def with_article(word):
    """'Indian' -> 'an Indian', 'nurse' -> 'a nurse'."""
    return f"{'an' if word[0].lower() in 'aeiou' else 'a'} {word}"


def build_response_format(batch):
    answer_schema = {"type": "integer", "enum": [-3, -2, -1, 0, 1, 2, 3]}
    properties = {str(question["id"]): answer_schema for question in batch}
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "personality_answers",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": properties,
                "required": list(properties),
                "additionalProperties": False,
            },
        },
    }

def validate_responses(responses, questions):
    expected_ids = {question["id"] for question in questions}
    actual_ids = set(responses.keys())

    # Check that every question was answered
    if expected_ids != actual_ids:
        missing = expected_ids - actual_ids
        extra = actual_ids - expected_ids

        if missing:
            print("Missing questions:", missing)

        if extra:
            print("Unexpected questions:", extra)

        return False

    # Check that every answer is between -3 and +3
    for question_id, answer in responses.items():
        # bool is a kind of int in Python, so rule out true/false explicitly.
        if not isinstance(answer, int) or isinstance(answer, bool):
            print(f"Question {question_id} has a non-integer answer: {answer}")
            return False

        if answer < -3 or answer > 3:
            print(f"Question {question_id} has an invalid answer: {answer}")
            return False

    return True

def calculate_scores(questions, responses):
    scores = {
        "EI": 0,
        "SN": 0,
        "TF": 0,
        "JP": 0,
        "AT": 0
    }

    for question in questions:
        question_id = question["id"]
        answer = responses[question_id]

        dimension = question["dimension"]
        direction = question["direction"]

        first_side = dimension[0]

        if direction == first_side:
            scores[dimension] += answer
        else:
            scores[dimension] -= answer


    return scores

def calculate_percentages(scores):
    percentages = {}

    for dimension, score in scores.items():
        # Each answer is worth up to 3 points, so the most extreme possible
        # score depends on how many questions this dimension has.
        max_score = 3 * dimension_counts[dimension]
        percentage = 50 + (score / max_score) * 50

        first_side = dimension[0]
        second_side = dimension[1]

        percentages[dimension] = {
            first_side: round(percentage, 1),
            second_side: round(100 - percentage, 1)
        }

    return percentages

def get_personality_type(percentages):
    personality_type = ""

    for dimension in ["EI", "SN", "TF", "JP", "AT"]:
        results = percentages[dimension]

        first_side = dimension[0]
        second_side = dimension[1]

        if results[first_side] >= results[second_side]:
            personality_type += first_side
        else:
            personality_type += second_side

    return personality_type

def build_user_prompt(batch):
    return INSTRUCTIONS + "\n".join(
        f"{question['id']}. {question['text']}" for question in batch
    )


def build_request_format(batch, response_format):
    """How to ask a model for JSON. Not every model supports every option,
    so models.json says which one to use:
      json_schema  strict schema, the model cannot return anything else
      json_object  any JSON object; the instructions say what to put in it
      none         no format option; we find the JSON in the reply text
    """
    if response_format == "json_schema":
        return build_response_format(batch)
    if response_format == "json_object":
        return {"type": "json_object"}
    return None


def parse_answers(content):
    """Pull {question_id: rating} out of a reply, tolerating extra text."""
    # Some reasoning models (e.g. MiniMax) write their thinking, braces and
    # all, in <think>...</think> before the answer.
    content = re.sub(r"<think>.*?</think>", "", content or "", flags=re.DOTALL)
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object in reply: {(content or '')[:200]!r}")
    answers = {}
    for question_id, answer in json.loads(match.group()).items():
        if isinstance(answer, float) and answer.is_integer():
            answer = int(answer)
        # Some models (e.g. Claude via the gateway) write ratings as text: "-1".
        if isinstance(answer, str) and re.fullmatch(r"\s*[+-]?\d+\s*", answer):
            answer = int(answer)
        answers[int(question_id)] = answer
    return answers


def ask_batch(client, model, model_settings, system_prompt, batch):
    """Ask one batch of questions, retrying on errors or unusable answers.

    Returns (answers, attempts_used).
    """
    request_format = build_request_format(batch, model_settings["response_format"])
    extra = {"response_format": request_format} if request_format else {}
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            messages = [{"role": "user", "content": build_user_prompt(batch)}]
            if system_prompt:  # None for the no-persona control.
                messages.insert(0, {"role": "system", "content": system_prompt})
            with CALLS_IN_FLIGHT:
                result = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    **extra,
                )
            answers = parse_answers(result.choices[0].message.content)
            if validate_responses(answers, batch):
                return answers, attempt
            problem = "invalid answers"
        except Exception as error:  # API error or unparseable reply.
            problem = str(error)[:200]
        print(f"    [{model}] Attempt {attempt}/{MAX_ATTEMPTS} failed: {problem}")
        if STOP.wait(2 * attempt):  # Pause before retrying, unless stopping.
            raise Stopped()
    raise RuntimeError(f"{model} gave no usable answer after {MAX_ATTEMPTS} attempts.")


def run_persona_experiment(client, model, model_settings, system_prompt, questions,
                           chunk_size, quiet=False):
    """Run the questions in batches and calculate the resulting percentages."""
    batch_size = chunk_size or len(questions)
    responses = {}
    retries = 0
    batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]

    def ask(batch):
        if STOP.is_set():
            raise Stopped()
        return ask_batch(client, model, model_settings, system_prompt, batch)

    if not quiet and len(batches) > 1:
        print(f"  Answering {len(batches)} batches, up to {PARALLEL_BATCHES} at a time...")
    with ThreadPoolExecutor(min(PARALLEL_BATCHES, len(batches))) as pool:
        # map raises the first failure; the order of batches doesn't matter.
        for answers, attempts in pool.map(ask, batches):
            responses.update(answers)
            retries += attempts - 1

    if not validate_responses(responses, questions):
        raise ValueError("The model returned an invalid set of answers.")

    scores = calculate_scores(questions, responses)
    percentages = calculate_percentages(scores)
    personality_type = get_personality_type(percentages)

    return {
        "personality_type": personality_type,
        "scores": scores,
        "percentages": percentages,
        "retries": retries,
        "answers": responses,
    }

def slugify(value):
    return str(value).lower().replace(" ", "_").replace("-", "_")


def load_persona_config():
    with open(PERSONAS_FILE, encoding="utf-8") as f:
        return json.load(f)


def load_models():
    with open(MODELS_FILE, encoding="utf-8") as f:
        return json.load(f)


def generate_personas(config):
    """Build personas from personas.json: the base persona, plus one persona
    per variation that changes a single attribute and keeps the rest at base.

    Also includes "no_persona", a control with no system prompt at all, which
    measures each model's own default personality.

    Returns {persona_name: (varied_attribute, persona)}, e.g.
    "base" -> ("base", {...}), "age_60" -> ("age", {..., "age": 60}),
    "no_persona" -> ("none", {}).
    """
    base = config["base"]
    personas = {"base": ("base", dict(base)), "no_persona": ("none", {})}
    for attribute, values in config["variations"].items():
        for value in values:
            if value == base[attribute]:
                continue  # Same as the base persona.
            personas[f"{attribute}_{slugify(value)}"] = (
                attribute,
                {**base, attribute: value},
            )
    return personas


def load_personas():
    return generate_personas(load_persona_config())


def results_folder(model, mode_name, persona_name):
    return project_file_location / model / mode_name / persona_name


def count_completed_runs(model, mode_name, persona_name):
    """How many repetitions are saved for this model, mode and persona."""
    folder = results_folder(model, mode_name, persona_name)
    return sum(len(pd.read_csv(path)) for path in folder.glob("*.csv"))


def choose(options, title, describe=lambda option: ""):
    """Numbered menu. Returns the chosen option (by number or exact name)."""
    print(f"\n{title}")
    width = max(len(option) for option in options) + 2
    for number, option in enumerate(options, start=1):
        print(f"  {number:>2}. {option:<{width}} {describe(option)}")
    choice = input("Number or name (blank to cancel): ").strip()
    if not choice:
        raise SystemExit("Cancelled.")
    if choice.isdigit() and 1 <= int(choice) <= len(options):
        return options[int(choice) - 1]
    if choice in options:
        return choice
    raise SystemExit(f"Not a valid choice: {choice!r}")


def check_choice(choice, options, kind):
    if choice not in options:
        raise SystemExit(f"Unknown {kind}: {choice!r}. Available: {list(options)}")
    return choice


def load_plan():
    with open(PLAN_FILE, encoding="utf-8") as f:
        return json.load(f)


def step_experiments(step, models, personas):
    """Every (model, mode, persona) in one step of plan.json, in run order:
    mode, then persona, then model, so an interrupted step still has every
    model for the personas it reached."""
    def pick(selection, available):
        return list(available) if selection == "all" else selection

    return [
        (model, mode, persona_name)
        for mode in step["modes"]
        for persona_name in expand_persona_selection(step["personas"], personas)
        for model in pick(step["models"], models)
    ]


def expand_persona_selection(selection, personas):
    """Turn a plan's "personas" entry into persona names. It can be "all",
    or a list of persona names ("age_60") and attribute names ("age" = every
    persona that varies age)."""
    if selection == "all":
        return list(personas)
    names = []
    for entry in selection:
        if entry in personas:
            matches = [entry]
        else:
            matches = [name for name, (attribute, _) in personas.items()
                       if attribute == entry and name != "base"]
        if not matches:
            raise SystemExit(f"Unknown persona or attribute in plan.json: {entry!r}")
        names += [name for name in matches if name not in names]
    return names


def calls_per_repetition(mode_name):
    chunk_size = CHUNK_SIZES[mode_name] or len(questions)
    return -(-len(questions) // chunk_size)  # Round up.


def run_mode(mode_name, chunk_size):
    """Command line for the run_<mode>.py scripts: pick one persona and one
    model (from the arguments or menus), then run NUM_REPETITIONS repetitions.
    """
    parser = argparse.ArgumentParser(description=f"Run the {mode_name} experiment.")
    parser.add_argument("persona", nargs="?", help="persona name, e.g. age_60")
    parser.add_argument("--model", help="model name from models.json")
    args = parser.parse_args()

    models = load_models()
    personas = load_personas()

    if args.model:
        model = check_choice(args.model, models, "model")
    elif len(models) == 1:
        model = next(iter(models))
    else:
        model = choose(list(models), "Models:")

    def runs_done(name):
        done = count_completed_runs(model, mode_name, name)
        return f"{done:>2}/{NUM_REPETITIONS}" + ("  done" if done >= NUM_REPETITIONS else "")

    if args.persona:
        persona_name = check_choice(args.persona, personas, "persona")
    else:
        persona_name = choose(
            list(personas), f"Personas for {model}, {mode_name}:", runs_done
        )

    run_experiment(model, models[model], mode_name, chunk_size,
                   persona_name, personas[persona_name], NUM_REPETITIONS)


# For the readable answers file: trait names and what each rating means.
TRAIT_NAMES = {
    ("EI", "E"): "Extraverted", ("EI", "I"): "Introverted",
    ("SN", "S"): "Observant", ("SN", "N"): "Intuitive",
    ("TF", "T"): "Thinking", ("TF", "F"): "Feeling",
    ("JP", "J"): "Judging", ("JP", "P"): "Prospecting",
    ("AT", "A"): "Assertive", ("AT", "T"): "Turbulent",
}
ANSWER_MEANINGS = {
    -3: "strongly disagree", -2: "disagree", -1: "slightly disagree",
    0: "neutral", 1: "slightly agree", 2: "agree", 3: "strongly agree",
}


def readable_answers(run_id, answers):
    """One row per statement: what it says, which trait agreeing points to,
    and the model's rating in numbers and words."""
    rows = []
    for question in questions:
        dimension = question["dimension"]
        answer = answers[question["id"]]
        rows.append({
            "run_id": run_id,
            "question_id": question["id"],
            "statement": question["text"],
            "dimension": f"{TRAIT_NAMES[(dimension, dimension[0])]} vs "
                         f"{TRAIT_NAMES[(dimension, dimension[1])]}",
            "agreeing_means": TRAIT_NAMES[(dimension, question["direction"])],
            "answer": answer,
            "answer_meaning": ANSWER_MEANINGS[answer],
        })
    return rows


def dated_csv_path(folder):
    """Today's date as the file name, numbered if that name is taken:
    2026-10-03.csv, then 2026-10-03-1.csv, 2026-10-03-2.csv, ..."""
    today = f"{datetime.now():%Y-%m-%d}"
    path = folder / f"{today}.csv"
    number = 1
    while path.exists():
        path = folder / f"{today}-{number}.csv"
        number += 1
    return path


def run_experiment(model, model_settings, mode_name, chunk_size, persona_name,
                   persona_entry, repetitions, quiet=False):
    """Run `repetitions` repetitions of one persona with one model.

    Results go to experiment_data/<model>/<mode_name>/<persona_name>/<date>.csv,
    e.g. 2026-10-03.csv; later runs on the same day get 2026-10-03-1.csv,
    2026-10-03-2.csv, ... The CSV is rewritten after every repetition, so a
    crash halfway through keeps the finished runs. A readable copy of every
    answer (statement text, trait, rating in words) goes to answers/<date>.csv
    in the same folder.

    quiet: one line per repetition instead of per batch (for when several
    models run at once and their output would be mixed together).
    """
    varied_attribute, persona = persona_entry
    system_prompt = build_system_prompt(persona)
    label = f"[{model}] {mode_name} / {persona_name}"
    if not quiet:
        print(f"\nModel: {model}, mode: {mode_name}, persona: {persona_name}")
        print(f"System prompt: {system_prompt or '(none: no-persona control)'}")

    output_dir = results_folder(model, mode_name, persona_name)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = dated_csv_path(output_dir)
    # A readable copy of every answer, in an answers/ subfolder with the
    # same file name as the main results.
    answers_path = output_dir / "answers" / output_path.name
    answers_path.parent.mkdir(exist_ok=True)

    experiment_results = []
    answer_rows = []

    def one_repetition():
        return run_persona_experiment(
            client, model, model_settings, system_prompt, questions, chunk_size, quiet=True,
        )

    if not quiet:
        print(f"Running {repetitions} repetitions, up to {PARALLEL_REPETITIONS} at a time...")
    with ThreadPoolExecutor(min(PARALLEL_REPETITIONS, repetitions)) as pool:
        futures = [pool.submit(one_repetition) for _ in range(repetitions)]
        failure = None
        # Save each repetition as it finishes, numbered in finishing order.
        for future in as_completed(futures):
            try:
                result = future.result()
            except Exception as error:  # Keep the finished ones, then report it.
                failure = failure or error
                continue
            run_id = len(experiment_results) + 1
            print(f"{label}: repetition {run_id}/{repetitions} done ({result['personality_type']})")

            flattened_result = {
                "run_id": run_id,
            }
            flattened_result["personality_type"] = result["personality_type"]
            for dim, dimension_percentages in result["percentages"].items():
                for side, value in dimension_percentages.items():
                    flattened_result[f"percentage_{dim}_{side}"] = value

            flattened_result["experiment_mode"] = mode_name
            flattened_result["persona_name"] = persona_name
            flattened_result["varied_attribute"] = varied_attribute
            flattened_result["model"] = model
            flattened_result["retries"] = result["retries"]
            for key, value in persona.items():
                flattened_result[f"persona_{key}"] = value
            # Every individual answer (-3 to +3), one column per statement, e.g.
            # answer_1. Lets you check consistency and compare answer by answer.
            for question in questions:
                flattened_result[f"answer_{question['id']}"] = result["answers"][question["id"]]

            experiment_results.append(flattened_result)
            pd.DataFrame(experiment_results).to_csv(output_path, index=False)
            answer_rows += readable_answers(run_id, result["answers"])
            # utf-8-sig so Excel shows apostrophes and dashes correctly.
            pd.DataFrame(answer_rows).to_csv(answers_path, index=False,
                                             encoding="utf-8-sig")
    if failure:
        raise failure

    if quiet:
        return
    df_results = pd.DataFrame(experiment_results)
    print(f"\nResults for {persona_name} ({model}, {mode_name}):")
    print(df_results[["run_id", "personality_type"]].to_string(index=False))
    print(f"Saved to: {output_path}")


if __name__ == "__main__":
    raise SystemExit(
        "Run run_step.py, run_one_by_one.py, run_chunks_of_5.py or "
        "run_one_shot.py instead."
    )
