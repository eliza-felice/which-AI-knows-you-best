# Design: Which AI Knows You Best?

Design language for the app, drawn from two references: a children's drawing-toy site (warm paper background, wobbly ink characters, loose colour fills, hand lettering) and a coffee app (one bold cobalt blue, cream screens, doodle mascots, pill buttons).

## 1. The vibe in one paragraph

A sketchbook, not a dashboard. Warm paper backgrounds, black ink line drawings that look made by hand, and a few flat colours that sit slightly off the lines as if filled in with a marker. Type is a calm, neutral sans for anything the user reads, with hand lettering saved for the moments that should feel personal: the reveal, the lesson titles, the share card. Lots of empty space. One strong blue does the heavy lifting.

The tone matters for the content. The app shows people how AI stereotypes them. A playful, hand-made look keeps that from feeling clinical or accusatory, and it quietly signals "this is a guess, not a verdict".

## 2. Principles

1. **Paper first.** Every screen starts as an empty page. Add only what the step needs.
2. **Ink, then colour.** Draw with black line. Colour is an accent, never a container.
3. **Imperfect on purpose.** Fills miss the outline by a few pixels. Lettering wobbles. Layout grids stay strict so the looseness reads as charm, not mess.
4. **One blue.** Cobalt is the only colour used for actions. The other colours belong to the AI characters.
5. **One idea per screen.** One illustration, one headline, one action.

## 3. Colour

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#EFEDE8` | Default page background |
| `cream` | `#F7F0E3` | Cards, alternate screens, sheets |
| `ink` | `#141414` | Text, line art, outlines |
| `ink-soft` | `#5C5B57` | Secondary text, captions |
| `line` | `#CFCBC2` | Dividers, input borders at rest |
| `cobalt` | `#0B2EA0` | Primary buttons, links, full-bleed hero screens |
| `cobalt-ink` | `#F7F0E3` | Text and line art on cobalt |

Character colours, one per AI model. Used for fills in illustrations, chart series and the small colour dot beside a model's name.

| Token | Hex |
| --- | --- |
| `periwinkle` | `#5B74B8` |
| `tomato` | `#B8343F` |
| `plum` | `#6B3B5E` |
| `forest` | `#2F6B50` |
| `mustard` | `#E2C566` |
| `clay` | `#D98A5F` |
| `sky` | `#9CC3D5` |

Rules:

- Text is always `ink` on `paper` or `cream`, or `cobalt-ink` on `cobalt`. Never set body text in a character colour.
- Never rely on colour alone to tell models apart. Each model also has a name label and a distinct character shape.
- No gradients, no shadows, no glass. Depth comes from outlines and overlap.
- Full cobalt screens are for big moments only: the landing screen, "the AIs have made their guess", and the first-place reveal.

## 4. Typography

| Role | Font | Notes |
| --- | --- | --- |
| Body and UI | DM Sans (or Instrument Sans) | 400 and 500 only. Neutral, slightly rounded. |
| Headings | DM Sans 700 | Tight tracking (-1%), sentence case. |
| Hand lettering | Gochi Hand or Patrick Hand as a web-font stand-in | Ideally replaced by real hand-drawn SVG lettering for the 5 or 6 key headlines. |
| Numbers | DM Sans with tabular figures | For scores and rankings. |


Rules:

- Hand lettering is for short lines only, 8 words or fewer. Mixed caps and lowercase in the same word is welcome ("WHICH Ai KNOWs YOU BEsT").

- Never use hand lettering for data, consent text or anything the user must read carefully.

## 5. Illustration

The illustrations carry the personality of the app.

**Line.** Black, 2.5 to 3px, round caps and joins, slightly uneven like a brush pen. Shapes are simple and a bit wrong: long noses, short legs, dot eyes.

**Fill.** Flat colour blobs placed 3 to 6px off the outline, covering most but not all of the shape. One or two colours per drawing. Leave plenty unfilled.

**The cast.** Each of the 7 AI models is an original character with its own silhouette and colour. Every character wears a simple mask. This ties straight into the lessons: the mask is on while a model plays a persona, and comes off on the "Meet the AI without a mask" screen.

| Slot | Colour | Shape idea |
| --- | --- | --- |
| Model 1 | periwinkle | Tall, long-snouted, shy |
| Model 2 | tomato | Round, loud, arms up |
| Model 3 | plum | Thin, bookish, glasses over the mask |
| Model 4 | forest | Small, quick, always mid-step |
| Model 5 | mustard | Wide, calm, sitting down |
| Model 6 | clay | Lanky, curious, leaning in |
| Model 7 | sky | Tiny, floats slightly off the ground |

Do not use company logos or brand colours for the models. Names in text, characters in pictures.

**Spot scenes.** One per step. Examples: the cast peeking at the user's profile card (step 2), a character scribbling on a clipboard (step 3), three characters on a wobbly podium (step 4), a character trying on different hats (step 5).

**Format.** SVG, drawn on a 400 x 400 artboard, line and fill on separate layers so fills can be recoloured with CSS variables.



## 6. Components

**Buttons**

| Type | Look | Use |
| --- | --- | --- |
| Primary | Solid `cobalt`, `cobalt-ink` text, full pill, 48px tall, DM Sans 500 16px | One per screen |
| Outline pill | 1px `ink` border, transparent, `micro` uppercase label, 32px tall | Secondary actions: skip, share, start over |
| Text link | `ink` or `cobalt`, underlined | "Back", "Why did it guess that?" |
| On cobalt | 1px `cobalt-ink` border, `cobalt-ink` text | Buttons on blue screens |

Pressed state moves the button 1px down. Focus state is a 2px `ink` outline offset by 2px. No hover glow.

**Inputs.** Cream fill, 1px `line` border that turns `ink` on focus, 12px radius, 48px tall. Labels above in `small`. Selects for nationality and job open a full-height sheet with search on mobile.

**Test question card.** The question in `h1`, five round answer dots from "disagree" to "agree" that grow slightly toward the ends. The chosen dot fills with `cobalt`. A thin `ink` progress line with a moving dot sits at the top, like the slider in the first reference.

**Cards.** `cream` on `paper`, 1.5px `ink` outline, 16px radius, 16 to 20px padding. No shadow. Model cards put the character at the top left, breaking out of the card edge by a few pixels.

**Model chip.** A 10px colour dot, then the model name in DM Sans 500.

**Trait bar.** A 1.5px `ink` line with the two trait poles labelled at either end. The user's score is a filled `ink` dot. A model's guess is a dot in its character colour. The gap between them is drawn as a wobbly hand-drawn bracket with the point difference written above.

**Leaderboard row.** Rank in hand lettering, character thumbnail, model name, match score in tabular figures, a thin score bar in the character colour. Rows are separated by `line` dividers.

**Chance note.** `small` text in `ink-soft` with a hand-drawn asterisk: "differences under 5 points may be chance". Appears under any comparison.

**Lesson block.** A hand-lettered title, three sentences of body, then the discussion question inside a hand-drawn speech bubble.

**Charts.** Flat fills, 1.5px `ink` outlines, no grid lines, direct labels instead of legends. Heatmaps from the study use a single-hue scale from `cream` to `cobalt`.

## 7. Motion

- Illustrations "boil": swap between 2 or 3 slightly different line versions at about 6 frames per second. Use on hero characters only.
- Screen changes slide the page like turning a sheet, 250ms, ease-out.
- The reveal: third, second, then first place each hop onto the podium with a small squash and stretch. First place switches the screen to cobalt.
- While models are guessing: characters scribble behind raised hands, looping.
- Respect `prefers-reduced-motion`: turn off boiling and hops, keep simple fades.

## 8. Screen notes

| Step | Background | Illustration | Notes |
| --- | --- | --- | --- |
| Landing | cobalt | Whole cast in cream line art | Hand-lettered title, one primary button on cream |
| 1. Consent and profile | paper | Characters peeking over the form's top edge | "Notice what you're about to share" in hand lettering above the button |
| 2. The AI guesses first | cobalt | Cast hiding their notes | Short screen, then straight into the test |
| 3. Take the test | paper | None, small character beside the progress line | Quiet and fast, one question per screen |
| 4. The reveal | cream, then cobalt for first place | Podium | Full ranking and baseline comparison follow on paper |
| 5. What-if explorer | paper | Character trying on hats | Changed field highlighted with a hand-drawn circle |
| 6. Without a mask | cream | Each character holding its mask | One card per model |
| 7. Same question, different answer | paper | Two copies of one character disagreeing | Simple before/after trait bars |
| 8. How much does each AI play along? | paper | Characters in costumes of varying effort | Leaderboard rows |
| 9. Wrap-up | cream | The user's winning character waving | Quiz, then the share card |

**Share card.** 1080 x 1350, cobalt background, the winning character in cream line art, one hand-lettered sentence ("Gemini knew me best, but stereotyped me as an introvert"), wordmark at the bottom. No demographic details.

## 9. Voice

- Short, warm, a little cheeky. "Seven AIs think they know you. Let's find out."
- The AI "guesses" and "assumes". It never "knows" or "analyses".
- Lessons end with a question, not a moral.
- No exclamation marks in consent or privacy text.

## 10. Accessibility

- `ink` on `paper` and `cobalt-ink` on `cobalt` both pass WCAG AA for body text. Check any new pairing before using it.
- Mustard and sky are fill colours only, never text or thin lines on a light background.
- Tap targets at least 44 x 44px.
- Every illustration has alt text that describes the scene, or is marked decorative.
- Charts have a text summary beneath them.

## 11. Tokens for Tailwind

```js
// tailwind.config.js (theme.extend)
colors: {
  paper: '#EFEDE8',
  cream: '#F7F0E3',
  ink: { DEFAULT: '#141414', soft: '#5C5B57' },
  line: '#CFCBC2',
  cobalt: '#0B2EA0',
  periwinkle: '#5B74B8',
  tomato: '#B8343F',
  plum: '#6B3B5E',
  forest: '#2F6B50',
  mustard: '#E2C566',
  clay: '#D98A5F',
  sky: '#9CC3D5',
},
fontFamily: {
  sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
  hand: ['"Gochi Hand"', '"Patrick Hand"', 'cursive'],
},
borderRadius: { card: '16px', input: '12px', pill: '9999px' },
borderWidth: { ink: '1.5px' },
```

## 12. Do and don't

| Do | Don't |
| --- | --- |
| Leave half the screen empty | Fill space with extra cards or stats |
| Use one cobalt button per screen | Use character colours for buttons |
| Let fills miss the outline | Use clean vector icons from a library |
| Hand-letter a few key lines | Hand-letter paragraphs or data |
| Show models as original characters | Use provider logos or brand colours |
