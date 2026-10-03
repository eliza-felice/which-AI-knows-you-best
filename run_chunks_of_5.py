"""Run the personality experiment with 5 questions per API call.

Usage:
    python run_chunks_of_5.py                            # pick model and persona from menus
    python run_chunks_of_5.py age_60 --model gpt-5-mini  # or name them directly
"""
from personality_lab import run_mode

run_mode("chunks_of_5", chunk_size=5)
