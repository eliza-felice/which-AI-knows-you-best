# AI Personality Lab: results so far

*Last updated 3 October 2026. Steps 1, 1b, 2 and 3a–3d complete (735 test runs). Step 3e (age check at a second chunk size) and step 4 not yet run.*

## Setup in brief

- **Test:** 60 statements, each rated from −3 (strongly disagree) to +3 (strongly agree), scored on five dimensions: Extraverted/Introverted, Observant/Intuitive, Thinking/Feeling, Judging/Prospecting, Assertive/Turbulent. Each score is a percentage; 50% means no lean.
- **Persona:** given as the system prompt. The **base persona** is *"a Singaporean woman in her 40s, working as a software engineer."* Each other persona changes exactly one attribute (age, gender, nationality or occupation). The **no-persona control** has no system prompt at all.
- **Models (7):** gpt-4o-mini, gpt-5-mini, gpt-5.4-nano, gemini-3.1-flash-lite, gemini-3.5-flash-lite, deepseek-v4-flash, deepseek-v4-1-flash-260910.
- **Chunk size:** questions asked one per call (`one_by_one`), five per call (`chunks_of_5`) or all 60 at once (`one_shot`).
- **Repetitions:** 5 per persona × model × chunk size. Error bars and "significant" markers use 95% confidence intervals.

Below, percentages are given for the side the model leans towards (e.g. "80% Introverted" rather than "20% Extraverted").

## Corrections made on 3 October

Earlier summaries were affected by two bugs, both now fixed. All numbers in this document use the corrected values.

1. **Scoring formula.** It assumed every dimension had 12 questions. Extraverted/Introverted has 10 (scores were squashed towards 50%), and Observant/Intuitive and Judging/Prospecting have 13 (scores were stretched, occasionally past 100%). All saved results were rescaled exactly. **Which side each model leans to did not change**, so no conclusion flipped. Some sizes changed, mainly for Extraverted/Introverted: e.g. salesperson's shift is +47 points, not +39.
2. **Confidence intervals were too narrow.** They used 1.96, which assumes a large sample; with 5 repetitions the correct value is 2.78. Error bars are now about 40% wider and fewer shifts count as clearly real.

## Step 1: same persona, different models

*Base persona, all 60 questions at once.* Chart: `graphs/compare_models/one_shot/base_persona.png`

| Model | Extraverted / Introverted | Observant / Intuitive | Thinking / Feeling | Judging / Prospecting | Assertive / Turbulent |
|---|---|---|---|---|---|
| gpt-4o-mini | **60% Extraverted** | 67% Intuitive | 56% Feeling | 70% Judging | 62% Assertive |
| gpt-5-mini | 73% Introverted | 62% Intuitive | 57% Feeling | 70% Judging | 58% Assertive |
| gpt-5.4-nano | 52% Introverted | 66% Intuitive | 52% Feeling | 68% Judging | 64% Assertive |
| gemini-3.1-flash-lite | 79% Introverted | 74% Intuitive | 51% Feeling | **84% Judging** | 65% Assertive |
| gemini-3.5-flash-lite | 80% Introverted | 73% Intuitive | 51% Thinking | **85% Judging** | 66% Assertive |
| deepseek-v4-flash | 82% Introverted | 74% Intuitive | 55% Feeling | 69% Judging | 60% Assertive |
| deepseek-v4-1-flash | 80% Introverted | 77% Intuitive | 54% Feeling | 70% Judging | 62% Assertive |

- **The models agree on four dimensions.** All lean Intuitive, Judging and Assertive, and all sit close to 50/50 on Thinking vs Feeling.
- **They disagree on Extraverted vs Introverted.** gpt-4o-mini makes the persona an extravert, gpt-5.4-nano is neutral, and the other five make her strongly introverted (73–82%).
- **Models from the same family behave almost identically** (the two Gemini models; the two DeepSeek models).
- **Consistency differs.** Across repetitions the Gemini models barely vary (standard deviation ≤ 2 points on most dimensions); deepseek-v4-flash varies by up to 10 points.
- **Four-letter types are unreliable here.** Thinking vs Feeling sits so close to 50% that the letter flips between runs; gpt-5.4-nano produced three different types in five runs with almost identical scores. Use the percentages, not the types.
- **The prompt matters.** Under an earlier prompt that didn't explain the rating scale, gpt-4o-mini scored about 77% Extraverted; with the scale explained, 60%.

## Step 1b: no persona (each model's own default)

*No system prompt, all 60 questions at once.* Chart: `graphs/compare_models/one_shot/no_persona_vs_base.png`

| Model | Assertive, no persona | Assertive, base persona | Extraverted / Introverted, no persona |
|---|---|---|---|
| gpt-4o-mini | 63% | 62% | 72% Extraverted |
| gpt-5-mini | 91% | 58% | 70% Introverted |
| gpt-5.4-nano | 63% | 64% | 51% Extraverted |
| gemini-3.1-flash-lite | **100%** | 65% | 51% Introverted |
| gemini-3.5-flash-lite | **99%** | 66% | 54% Introverted |
| deepseek-v4-flash | 86% | 60% | 73% Introverted |
| deepseek-v4-1-flash | 85% | 62% | 71% Introverted |

- **Without a persona, five of the seven models describe themselves as almost perfectly calm and confident** (85–100% Assertive). The human persona brings this down by 23–35 points. The Gemini models are also 99–100% Intuitive by default.
- **gpt-4o-mini and gpt-5.4-nano mostly answer as themselves.** Their default is almost the same as their base-persona result, and their personas sit on average only 3–4 points from the default (against 13–22 points for the other models).
- **Part of the base persona's introversion is a stereotype the persona adds.** Gemini is neutral by default (51–54% Introverted) but 79–80% Introverted as a software engineer. DeepSeek and gpt-5-mini already lean Introverted by default, so the persona adds less.

## Step 2: does chunk size matter?

*Base persona at all three chunk sizes.* Chart: `graphs/compare_models/chunk_size_lines.png`

- **The headline conclusions hold at every chunk size.** The same models lean Introverted, the Gemini models are always the most Judging, and every model leans Intuitive and Assertive.
- **Asking one question at a time makes answers less extreme.** For five models, `one_by_one` is 10–15 points closer to 50/50 on Extraverted vs Introverted (e.g. deepseek-v4-flash: 67% Introverted one at a time vs 82% all at once). gpt-4o-mini moves towards 50/50 from the other side (60% Extraverted all at once, 55% Introverted one at a time). A likely explanation: when a model sees many statements together, it builds a more consistent, more extreme profile.
- **`chunks_of_5` and `one_shot` are close but not identical.** Most differences are within ±5 points. The largest: the GPT models and deepseek-v4-flash are 5–8 points more Judging in `chunks_of_5`, and gpt-4o-mini is 9 points less Extraverted. None of these changes which side a model leans to.

Because of this, step 3 used `one_shot` (12× fewer API calls). Each persona is compared with the base persona at the same chunk size, so an overall offset between chunk sizes largely cancels out. Step 3e will check this for age.

## Step 3: what changing the persona does

*Each attribute changed one at a time from the base persona, all 60 questions at once.* Charts: `graphs/compare_models/one_shot/shift_by_<attribute>.png` and `age_lines.png`.

### How much each attribute matters

| Attribute changed | Average shift (points) | Shifts larger than the 95% CI |
|---|---|---|
| occupation | 12.2 | 51% |
| age | 4.7 | 31% |
| gender | 3.2 | 20% |
| nationality | 3.0 | 15% |

### Occupation: by far the biggest effect, following job stereotypes

Average shift across all 7 models, compared with the software engineer:

| Occupation | Main shifts |
|---|---|
| salesperson | **+47 Extraverted** |
| primary school teacher | +23 Extraverted, +12 Feeling |
| nurse | +20 Extraverted, +12 Observant, +12 Feeling |
| construction worker | **+30 Observant**, +20 Extraverted |
| accountant | +17 Observant, +10 Judging |
| lawyer | +19 Extraverted, +9 Judging |
| artist | **+37 Prospecting**, +20 Turbulent, +18 Feeling, +15 Intuitive |

- **The most extreme case is the artist persona.** It turns the Gemini models from 84–85% Judging to 77–81% Prospecting, a swing of more than 60 points. gpt-4o-mini and gpt-5.4-nano barely move.
- **Nearly every occupation comes out more Extraverted than the base.** That's partly because the base, software engineer, is itself stereotyped as introverted. All shifts are relative to that particular base.

### Age: older means more Assertive and more Judging

Average of all 7 models:

| Age | 20 | 30 | 40 (base) | 50 | 60 | 70 |
|---|---|---|---|---|---|---|
| Assertive | 53% | 58% | 62% | 69% | 70% | 74% |
| Judging | 66% | 72% | 74% | 78% | 81% | 81% |

Extraverted vs Introverted and Thinking vs Feeling barely change with age. The Gemini models make the 70-year-old 93–94% Judging.

### Gender and nationality: small effects

- **Gender:** the male persona is about 5 points more Thinking and 4 points more Assertive.
- **Nationality has the smallest effect of all four.** The American and British personas are 5–6 points more Intuitive; everything else moves by 4 points or less.

### Models differ in how much they follow the persona

| Model | Average shift (all attributes) | Average shift (occupation) |
|---|---|---|
| gpt-4o-mini | 3.1 | 3.9 |
| gpt-5.4-nano | 3.5 | 4.3 |
| gpt-5-mini | 8.0 | 13.5 |
| gemini-3.1-flash-lite | 8.5 | 14.9 |
| gemini-3.5-flash-lite | 8.6 | 15.1 |
| deepseek-v4-1-flash | 9.4 | 16.6 |
| deepseek-v4-flash | 10.1 | 17.2 |

**When the models react, they react the same way.** Of the 34 persona changes that moved a dimension by 5 points or more on average, all 7 models moved in the same direction in 65% of cases, and at least 5 of 7 did in every case. The models share the same stereotypes and differ mainly in how strongly they act on them.

## Possible interpretations, including for AI safety

These are hypotheses worth testing, not established conclusions.

1. **Uneven stereotyping across identity traits.** Nationality and gender, which fairness and safety training often target, barely move the results. Age (also a protected characteristic in many places) and occupation move them a lot. This could mean safety training suppresses some stereotypes but not others. It could also mean the models simply hold weaker nationality stereotypes. *Test:* ask the models directly to describe typical personalities by nationality and by age, and compare with how they behave in role-play.
2. **Exaggerated stereotypes.** In human data, people do tend to become more organised and emotionally stable with age, so the direction is plausible. But real effects are small, while the models swing 20+ points (and up to 60+ for "artist"). This matters when LLM personas are used as stand-ins for real people, e.g. simulated survey respondents. *Test:* compare these shifts with published human data by age and occupation.
3. **Persona adherence varies a lot between models.** gpt-4o-mini and gpt-5.4-nano largely ignore the persona; DeepSeek and Gemini adopt it strongly. Models that adopt any persona fully are better for simulation but may be more open to persona-based jailbreaks. *Follow-up:* test whether a persona changes safety-relevant behaviour, such as refusal rates.
4. **The measurement depends on presentation.** Seeing all the statements together makes profiles more extreme. This may relate to models recognising a test and answering differently (evaluation awareness). It also means a single LLM personality score is not a stable measurement.
5. **A confident, stable "assistant" default.** Without a persona, most models describe themselves as 85–100% Assertive, which may reflect training to be a calm, confident assistant.

## Limitations

- **The questionnaire is unbalanced.** Observant/Intuitive has 9 Intuitive-worded statements against 4 Observant ones, and Assertive/Turbulent has 8 Turbulent-worded against 4 Assertive ones. A model that agreed with everything would score 69% Intuitive and 67% Turbulent. So **part of the models' Intuitive lean may simply reflect a tendency to agree**. The Assertive lean goes *against* that bias, so it is more robust.
- **One statement may be mis-assigned.** "Your emotions control you more than you control them" is scored as Feeling but arguably measures emotional stability (Assertive/Turbulent).
- **Small samples.** 5 repetitions per condition; small shifts (under about 5 points) should not be over-interpreted.
- **One base persona.** All shifts are relative to a Singaporean female software engineer in her 40s; a different base could give different shifts.
- **Mostly one chunk size.** Step 3 used `one_shot` only; step 3e (age with `chunks_of_5`) is still to run.
- **One API provider**, small/fast model tiers only, and models' behaviour may change over time.
- **Only percentages are saved, not each individual answer**, so item-level analysis (e.g. contradictory answers) isn't possible yet.

## Next steps

1. **Run step 3e** (about 30 minutes) to check that the age effects are the same at a second chunk size.
2. **Save each individual answer**, so agreement bias and contradictory answers can be measured directly.
3. **Test the uneven-stereotyping idea directly** by asking the models explicit questions about nationality, gender and age stereotypes.
4. **Compare against human data**, to measure how much the models exaggerate.
