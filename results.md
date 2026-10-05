# AI Personality Lab: results so far

*Last updated 5 October 2026. Steps 1, 1b, 2 and 3a–3e complete, plus a repeat of the base persona and no-persona control (980 test runs). Step 4 (optional) not run.*

## Setup in brief

- **Test:** 60 statements, each rated from −3 (strongly disagree) to +3 (strongly agree), scored on five dimensions: Extraverted/Introverted, Observant/Intuitive, Thinking/Feeling, Judging/Prospecting, Assertive/Turbulent. Each score is a percentage; 50% means no lean.
- **Persona:** given as the system prompt. The **base persona** is *"a Singaporean woman in her 40s, working as a software engineer."* Each other persona changes exactly one attribute (age, gender, nationality or occupation). The **no-persona control** has no system prompt at all.
- **Models (7):** gpt-4o-mini, gpt-5-mini, gpt-5.4-nano, gemini-3.1-flash-lite, gemini-3.5-flash-lite, deepseek-v4-flash, deepseek-v4-1-flash-260910.
- **Chunk size:** questions asked one per call (`one_by_one`), five per call (`chunks_of_5`) or all 60 at once (`one_shot`).
- **Repetitions:** 5 per persona × model × chunk size, except the base persona and no-persona control at `one_shot`, which have 10 (5 on 3 October, 5 on 5 October). Error bars and "significant" markers use 95% confidence intervals.

Below, percentages are given for the side the model leans towards (e.g. "80% Introverted" rather than "20% Extraverted").

## Corrections made on 3 October

Earlier summaries were affected by two bugs, both now fixed. All numbers in this document use the corrected values.

1. **Scoring formula.** It assumed every dimension had 12 questions. Extraverted/Introverted has 10 (scores were squashed towards 50%), and Observant/Intuitive and Judging/Prospecting have 13 (scores were stretched, occasionally past 100%). All saved results were rescaled exactly. **Which side each model leans to did not change**, so no conclusion flipped. Some sizes changed, mainly for Extraverted/Introverted: e.g. salesperson's shift is now +46 points, not +39.
2. **Confidence intervals were too narrow.** They used 1.96, which assumes a large sample; with 5 repetitions the correct value is 2.78. Error bars are now about 40% wider and fewer shifts count as clearly real.

## Step 1: same persona, different models

*Base persona, all 60 questions at once, 10 repetitions.* Chart: `graphs/compare_models/one_shot/base_persona.png`

| Model | Extraverted / Introverted | Observant / Intuitive | Thinking / Feeling | Judging / Prospecting | Assertive / Turbulent |
|---|---|---|---|---|---|
| gpt-4o-mini | **61% Extraverted** | 70% Intuitive | 57% Feeling | 69% Judging | 63% Assertive |
| gpt-5-mini | 74% Introverted | 64% Intuitive | 57% Feeling | 71% Judging | 58% Assertive |
| gpt-5.4-nano | 53% Extraverted | 65% Intuitive | 53% Feeling | 69% Judging | 65% Assertive |
| gemini-3.1-flash-lite | 79% Introverted | 74% Intuitive | 51% Feeling | **84% Judging** | 66% Assertive |
| gemini-3.5-flash-lite | 80% Introverted | 73% Intuitive | 51% Thinking | **84% Judging** | 67% Assertive |
| deepseek-v4-flash | 79% Introverted | 76% Intuitive | 55% Feeling | 70% Judging | 63% Assertive |
| deepseek-v4-1-flash | 81% Introverted | 76% Intuitive | 54% Feeling | 74% Judging | 63% Assertive |

- **The models agree on four dimensions.** All lean Intuitive, Judging and Assertive, and all sit close to 50/50 on Thinking vs Feeling.
- **They disagree on Extraverted vs Introverted.** gpt-4o-mini makes the persona an extravert, gpt-5.4-nano is neutral, and the other five make her strongly introverted (74–81%).
- **Models from the same family behave almost identically** (the two Gemini models; the two DeepSeek models).
- **Consistency differs.** Across repetitions the Gemini models barely vary (standard deviation ≤ 2 points on most dimensions); deepseek-v4-flash varies by up to 10 points.
- **Four-letter types are unreliable here.** Thinking vs Feeling sits so close to 50% that the letter flips between runs; gpt-5.4-nano produced three different types in five runs with almost identical scores. Use the percentages, not the types.
- **The prompt matters.** Under an earlier prompt that didn't explain the rating scale, gpt-4o-mini scored about 77% Extraverted; with the scale explained, 61%.

**Results mostly replicate across days.** The base persona and no-persona control were run again two days later (5 October). Averages differed by 2.6 points on average, about the size of run-to-run noise. The exception is **Extraverted vs Introverted for the GPT-5 models**: gpt-5-mini with no persona went from 30% to 47% Extraverted, and gpt-5.4-nano moved about 10 points with and without a persona. For these two models, that dimension is the least stable.

## Step 1b: no persona (each model's own default)

*No system prompt, all 60 questions at once, 10 repetitions.* Chart: `graphs/compare_models/one_shot/no_persona_vs_base.png`

| Model | Assertive, no persona | Assertive, base persona | Extraverted / Introverted, no persona |
|---|---|---|---|
| gpt-4o-mini | 63% | 63% | 70% Extraverted |
| gpt-5-mini | 88% | 58% | 62% Introverted |
| gpt-5.4-nano | 64% | 65% | 56% Extraverted |
| gemini-3.1-flash-lite | **100%** | 66% | 51% Introverted |
| gemini-3.5-flash-lite | **97%** | 67% | 52% Introverted |
| deepseek-v4-flash | 86% | 63% | 73% Introverted |
| deepseek-v4-1-flash | 84% | 63% | 74% Introverted |

- **Without a persona, five of the seven models describe themselves as almost perfectly calm and confident** (84–100% Assertive). The human persona brings this down by 21–34 points. The Gemini models are also 98–100% Intuitive by default. For example, with no persona Gemini 3.5 *agrees or strongly agrees* with "You rarely feel insecure" and *disagrees or strongly disagrees* with "You easily feel overwhelmed by stressful situations" in all 5 runs whose individual answers were saved.
- **gpt-4o-mini and gpt-5.4-nano mostly answer as themselves.** Their default is almost the same as their base-persona result, and their personas sit on average only 3–4 points from the default (against 13–22 points for the other models).
- **Part of the base persona's introversion is a stereotype the persona adds.** Gemini is neutral by default (51–52% Introverted) but 79–80% Introverted as a software engineer. DeepSeek and gpt-5-mini already lean Introverted by default, so the persona adds less.

## Step 2: does chunk size matter?

*Base persona at all three chunk sizes.* Chart: `graphs/compare_models/chunk_size_lines.png`

- **The headline conclusions hold at every chunk size.** The same models lean Introverted, the Gemini models are always the most Judging, and every model leans Intuitive and Assertive.
- **Asking one question at a time makes answers less extreme.** For five models, `one_by_one` is 11–15 points closer to 50/50 on Extraverted vs Introverted (e.g. deepseek-v4-flash: 67% Introverted one at a time vs 79% all at once). gpt-4o-mini moves towards 50/50 from the other side (61% Extraverted all at once, 55% Introverted one at a time). A likely explanation: when a model sees many statements together, it builds a more consistent, more extreme profile.
- **`chunks_of_5` and `one_shot` are close but not identical.** Most differences are within ±5 points. The largest: the three GPT models are 6–8 points more Judging in `chunks_of_5`, and gpt-4o-mini is 10 points less Extraverted. None of these changes which side a model leans to.

Because of this, step 3 used `one_shot` (12× fewer API calls). Each persona is compared with the base persona at the same chunk size, so an overall offset between chunk sizes largely cancels out. Step 3e confirmed this for age (below).

## Step 3: what changing the persona does

*Each attribute changed one at a time from the base persona, all 60 questions at once.* Charts: `graphs/compare_models/one_shot/shift_by_<attribute>.png` and `age_lines.png`.

### How much each attribute matters

| Attribute changed | Average shift (points) | Shifts larger than the 95% CI |
|---|---|---|
| occupation | 11.9 | 57% |
| age | 4.5 | 37% |
| gender | 3.1 | 31% |
| nationality | 2.5 | 18% |

### Occupation: by far the biggest effect, following job stereotypes

Average shift across all 7 models, compared with the software engineer:

| Occupation | Main shifts |
|---|---|
| salesperson | **+46 Extraverted** |
| primary school teacher | +22 Extraverted, +12 Feeling |
| nurse | +19 Extraverted, +13 Observant, +12 Feeling |
| construction worker | **+31 Observant**, +19 Extraverted |
| accountant | +17 Observant, +9 Judging |
| lawyer | +18 Extraverted, +9 Judging |
| artist | **+38 Prospecting**, +21 Turbulent, +18 Feeling, +14 Intuitive |

- **The most extreme case is the artist persona.** It turns the Gemini models from 84% Judging to 77–81% Prospecting, a swing of more than 60 points. gpt-4o-mini and gpt-5.4-nano barely move.
- **Nearly every occupation comes out more Extraverted than the base.** That's partly because the base, software engineer, is itself stereotyped as introverted. All shifts are relative to that particular base.

### Age: older means more Assertive and more Judging

Average of all 7 models:

| Age | 20 | 30 | 40 (base) | 50 | 60 | 70 |
|---|---|---|---|---|---|---|
| Assertive | 53% | 58% | 64% | 69% | 70% | 74% |
| Judging | 66% | 72% | 74% | 78% | 81% | 81% |

Extraverted vs Introverted and Thinking vs Feeling barely change with age. The Gemini models make the 70-year-old 93–94% Judging.

**Check at a second chunk size (step 3e).** The age personas were re-run with `chunks_of_5`. Charts: compare `graphs/compare_models/one_shot/age_lines.png` with `graphs/compare_models/chunks_of_5/age_lines.png`.

| Age (shift from 40) | 20 | 30 | 50 | 60 | 70 |
|---|---|---|---|---|---|
| Assertive, one shot | −11 | −6 | +5 | +7 | +11 |
| Assertive, chunks of 5 | −11 | −6 | +4 | +8 | +10 |
| Judging, one shot | −9 | −3 | +4 | +6 | +7 |
| Judging, chunks of 5 | −3 | −2 | +3 | +6 | +7 |

- **The age effects hold at both chunk sizes.** Across all models, ages and dimensions, the shifts correlate at r = 0.80. Where a shift was 5 points or more, both chunk sizes moved the same way 88% of the time. The average difference between them is 2.9 points, about the size of run-to-run noise.
- **The Assertive trend is almost identical. The Judging trend is weaker for young personas with `chunks_of_5`** (−3 vs −9 at age 20), consistent with step 2's finding that seeing all statements at once makes answers more extreme.
- **The two least responsive models agree least** (gpt-5.4-nano r = 0.36, gpt-4o-mini r = 0.72): their shifts are so small that noise dominates. For the others, r = 0.80–0.90.

This supports using `one_shot` for the step 3 results.

### Gender and nationality: small effects

- **Gender:** the male persona is about 5 points more Thinking; other dimensions move 3 points or less.
- **Nationality has the smallest effect of all four.** The American and British personas are 4–5 points more Intuitive; everything else moves by 3 points or less.

### Models differ in how much they follow the persona

| Model | Average shift (all attributes) | Average shift (occupation) |
|---|---|---|
| gpt-4o-mini | 2.7 | 3.7 |
| gpt-5.4-nano | 2.8 | 3.2 |
| gpt-5-mini | 7.9 | 13.8 |
| gemini-3.1-flash-lite | 8.6 | 15.1 |
| gemini-3.5-flash-lite | 8.6 | 15.3 |
| deepseek-v4-1-flash | 8.9 | 15.9 |
| deepseek-v4-flash | 9.6 | 16.6 |

**When the models react, they react the same way.** Of the 32 persona changes that moved a dimension by 5 points or more on average, all 7 models moved in the same direction in 69% of cases, and at least 5 of 7 did in every case. The models share the same stereotypes and differ mainly in how strongly they act on them.

## Possible interpretations, including for AI safety

These are hypotheses worth testing, not established conclusions.

1. **Uneven stereotyping across identity traits.** Nationality and gender, which fairness and safety training often target, barely move the results. Age (also a protected characteristic in many places) and occupation move them a lot. This could mean safety training suppresses some stereotypes but not others. It could also mean the models simply hold weaker nationality stereotypes. *Test:* ask the models directly to describe typical personalities by nationality and by age, and compare with how they behave in role-play.
2. **Exaggerated stereotypes.** In human data, people do tend to become more organised and emotionally stable with age, so the direction is plausible. But real effects are small, while the models swing 20+ points (and up to 60+ for "artist"). This matters when LLM personas are used as stand-ins for real people, e.g. simulated survey respondents. *Test:* compare these shifts with published human data by age and occupation.
3. **Persona adherence varies a lot between models.** gpt-4o-mini and gpt-5.4-nano largely ignore the persona; DeepSeek and Gemini adopt it strongly. Models that adopt any persona fully are better for simulation but may be more open to persona-based jailbreaks. *Follow-up:* test whether a persona changes safety-relevant behaviour, such as refusal rates.
4. **The measurement depends on presentation.** Seeing all the statements together makes profiles more extreme. This may relate to models recognising a test and answering differently (evaluation awareness). It also means a single LLM personality score is not a stable measurement.
5. **A confident, stable "assistant" default.** Without a persona, most models describe themselves as 84–100% Assertive, which may reflect training to be a calm, confident assistant.

## Limitations

- **The questionnaire is unbalanced.** Observant/Intuitive has 9 Intuitive-worded statements against 4 Observant ones, and Assertive/Turbulent has 8 Turbulent-worded against 4 Assertive ones. A model that agreed with everything would score 69% Intuitive and 67% Turbulent. So **part of the models' Intuitive lean may simply reflect a tendency to agree**. The Assertive lean goes *against* that bias, so it is more robust.
- **One statement may be mis-assigned.** "Your emotions control you more than you control them" is scored as Feeling but arguably measures emotional stability (Assertive/Turbulent).
- **Small samples.** 5 repetitions for most conditions (10 for the base and no-persona `one_shot` runs); small shifts (under about 5 points) should not be over-interpreted.
- **Results can drift between days.** Repeating the base and no-persona runs two days later mostly matched, but Extraverted/Introverted moved 10–17 points for the GPT-5 models (see step 1).
- **One base persona.** All shifts are relative to a Singaporean female software engineer in her 40s; a different base could give different shifts.
- **Mostly one chunk size.** Step 3 used `one_shot`. Step 3e confirmed the age results at `chunks_of_5`, but gender, nationality and occupation were only tested at `one_shot`.
- **One API provider**, small/fast model tiers only, and models' behaviour may change over time.
- **Individual answers are only saved from 4 October 2026 onwards.** So far that covers the repeated base and no-persona runs (5 repetitions each per model). The answers are in the main results CSVs (`answer_1` … `answer_60`) and, in readable form, in each folder's `answers/` subfolder.

## Next steps

1. **Use the saved answers** to measure agreement bias and contradictory answers, starting with the base and no-persona runs.
2. **Test the uneven-stereotyping idea directly** by asking the models explicit questions about nationality, gender and age stereotypes.
3. **Compare against human data**, to measure how much the models exaggerate. The planned web app ("which AI can guess your personality?") would collect this.
4. **Optional: step 4** (every persona asked one question at a time, 3 models, about 3 hours).
