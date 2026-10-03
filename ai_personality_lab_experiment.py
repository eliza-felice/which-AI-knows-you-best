import json
from collections import Counter
from datetime import datetime
from pathlib import Path

import pandas as pd
from dotenv import dotenv_values
from openai import OpenAI

# Store outputs beside this script so running it from VS Code uses a stable path
# regardless of the current working directory.
project_file_location = Path(__file__).resolve().parent / "experiment_data"
project_file_location.mkdir(parents=True, exist_ok=True)

def get_current_date_time() -> str:
  current_datetime = datetime.now()

  # Format the datetime as a string
  return current_datetime.strftime("%Y%m%d_%H%M%S")

print(f"Project file location: {project_file_location}")

# Read the key directly from this project's .env file.
api_key = dotenv_values(Path(__file__).resolve().parent / ".env").get("AI_LODGE_API_KEY")

# Initialize the OpenAI client
client = OpenAI(
    api_key=api_key,
    base_url="https://api.apiyi.com/v1",  # or https://openrouter.ai/api/v1
)

# Edit these configurations to compare different personas and models.
PERSONAS = {
    "singaporean_software_engineer": {
        "age": 40,
        "gender": "female",
        "nationality": "Singaporean",
        "occupation": "software engineer",
    },
}
MODELS = ["gpt-4o-mini"]
NUM_REPETITIONS = 5
EXPERIMENT_MODES = [
    {"name": "one_by_one", "chunk_size": 1},
    {"name": "chunks_of_5", "chunk_size": 5},
    {"name": "one_shot", "chunk_size": None},
]

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

print("Number of questions:", len(questions))
dimension_counts = Counter(
    question["dimension"]
    for question in questions
)

print(dimension_counts)

def build_system_prompt(persona):
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
        f"You are a {persona['nationality']} {gender_word} {age_description}, "
        f"working as a {persona['occupation']}."
    )


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
        if not isinstance(answer, int):
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
        percentage = 50 + (score / 36) * 50

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

def run_persona_experiment(client, model, system_prompt, questions, chunk_size):
    """Run the questions in batches and calculate the resulting percentages."""
    batch_size = chunk_size or len(questions)
    responses = {}
    batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]

    for batch_number, batch in enumerate(batches, start=1):
        if batch_size == 1:
            user_prompt = batch[0]["text"]
        else:
            user_prompt = "\n".join(
                f"{question['id']}. {question['text']}" for question in batch
            )
        print(f"  Answering batch {batch_number}/{len(batches)}...")
        result = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=build_response_format(batch),
        )
        batch_answers = json.loads(result.choices[0].message.content)
        responses.update(
            {int(question_id): answer for question_id, answer in batch_answers.items()}
        )

    if not validate_responses(responses, questions):
        raise ValueError("The model returned an invalid set of answers.")

    scores = calculate_scores(questions, responses)
    percentages = calculate_percentages(scores)
    personality_type = get_personality_type(percentages)

    return {
        "personality_type": personality_type,
        "scores": scores,
        "percentages": percentages
    }

results_by_mode = {mode["name"]: [] for mode in EXPERIMENT_MODES}

for mode in EXPERIMENT_MODES:
    for persona_name, persona in PERSONAS.items():
        system_prompt = build_system_prompt(persona)
        for model in MODELS:
            for run_id in range(1, NUM_REPETITIONS + 1):
                print(
                    f"Running {mode['name']} for {persona_name} with {model}, "
                    f"repetition {run_id}/{NUM_REPETITIONS}..."
                )
                result = run_persona_experiment(
                    client,
                    model,
                    system_prompt,
                    questions,
                    mode["chunk_size"],
                )

                flattened_result = {
                    "run_id": run_id,
                }
                flattened_result["personality_type"] = result["personality_type"]
                for dim, dimension_percentages in result["percentages"].items():
                    for side, value in dimension_percentages.items():
                        flattened_result[f"percentage_{dim}_{side}"] = value

                flattened_result["experiment_mode"] = mode["name"]
                flattened_result["persona_name"] = persona_name
                flattened_result["model"] = model
                for key, value in persona.items():
                    flattened_result[f"persona_{key}"] = value

                results_by_mode[mode["name"]].append(flattened_result)

timestamp = get_current_date_time()
for mode_name, experiment_results in results_by_mode.items():
    df_results = pd.DataFrame(experiment_results)
    print(f"\nPreview for {mode_name}:")
    print(df_results.head())

    output_filename = f"persona_experiment_{mode_name}_{timestamp}.csv"
    output_path = project_file_location / output_filename
    df_results.to_csv(output_path, index=False)
    print(f"Experiment results saved to: {output_path}")
