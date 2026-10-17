"""Run the personality experiment with one question per API call.

Usage:
    python src/run_one_by_one.py                            # pick model and persona from menus
    python src/run_one_by_one.py age_60 --model gpt-5-mini  # or name them directly
"""
from personality_lab import run_mode

run_mode("one_by_one", chunk_size=1)
