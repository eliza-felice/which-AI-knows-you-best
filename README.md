# AI Personality Lab

Do AI models stereotype people? This project gives AI models a persona
("You are a Singaporean woman in her 40s, working as a software engineer"),
has them answer a 60-statement personality test as that person, and measures
how their answers change with age, gender, nationality and job.

It has two parts, each with its own README:

| Folder | What it is | Language |
|---|---|---|
| [`experiment/`](experiment/README.md) | The study: runs the tests on 12 AI models, saves the results and draws the graphs. Findings are in [`experiment/results.md`](experiment/results.md). | Python |
| [`web/`](web/README.md) | The app, "Which AI Knows You Best?": AIs guess a visitor's personality from a few facts, the visitor takes the same test, and the app shows which AI came closest and what that says about AI. | Next.js (TypeScript) |

## How they connect

```
experiment/                                   web/
  config/, src/personality_lab.py   ──┐
  experiment_data/  (study results)   ├─ python experiment/src/export_for_web.py ─▶  src/data/*.json
                                      ┘                                              tests/parity_fixtures.json

  experiment_data/_web_app/  ◀── node scripts/export-responses.mjs (from web/) ──  the app's saved live answers
```

- **Experiment → app:** `export_for_web.py` copies the questions, the prompt,
  the model list and the study's findings into the app, so the app asks
  exactly what the study asked. Run it after changing the questions, the
  prompt or the models, or after new results.
- **App → experiment:** the app saves its live answers anonymously;
  `export-responses.mjs` writes them as a CSV next to the study data.

The two parts don't share code or settings otherwise: each has its own
dependencies and its own API key file (`experiment/.env` and `web/.env.local`).
