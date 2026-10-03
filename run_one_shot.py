"""Run the personality experiment with all questions in a single API call.

Usage:
    python run_one_shot.py                            # pick model and persona from menus
    python run_one_shot.py age_60 --model gpt-5-mini  # or name them directly
"""
from personality_lab import run_mode

run_mode("one_shot", chunk_size=None)
