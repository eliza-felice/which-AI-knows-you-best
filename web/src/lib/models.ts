// How each model appears in the app: a readable name, its company, and the
// character (1-12, see components/Character.tsx) and colour it is drawn with.
// The model ids and their API settings come from experiment/config/models.json via
// experiment.json.
import { MODEL_SETTINGS } from "@/lib/experiment";

export type ModelInfo = {
  id: string;
  name: string;
  company: string;
  character: number;
  colour: string;
};

// Character colours: the 7 from docs/design.md, then 5 more for the added models.
export const CHARACTER_COLOURS = [
  "#5B74B8", // periwinkle
  "#B8343F", // tomato
  "#6B3B5E", // plum
  "#2F6B50", // forest
  "#E2C566", // mustard
  "#D98A5F", // clay
  "#9CC3D5", // sky
  "#D69AAE", // rose
  "#9A9440", // olive
  "#A393D3", // lilac
  "#3D8C8C", // teal
  "#A8D5BA", // mint
];

const DETAILS: Record<string, { name: string; company: string }> = {
  "gpt-4o-mini": { name: "GPT-4o mini", company: "OpenAI" },
  "gpt-5-mini": { name: "GPT-5 mini", company: "OpenAI" },
  "gpt-5.4-nano": { name: "GPT-5.4 nano", company: "OpenAI" },
  "gemini-3.1-flash-lite": { name: "Gemini 3.1 Flash-Lite", company: "Google" },
  "gemini-3.5-flash-lite": { name: "Gemini 3.5 Flash-Lite", company: "Google" },
  "deepseek-v4-flash": { name: "DeepSeek V4 Flash", company: "DeepSeek" },
  "deepseek-v4-1-flash-260910": { name: "DeepSeek V4.1 Flash", company: "DeepSeek" },
  "claude-haiku-4-5-20251001": { name: "Claude Haiku 4.5", company: "Anthropic" },
  "grok-4.3": { name: "Grok 4.3", company: "xAI" },
  "glm-5.2": { name: "GLM-5.2", company: "Zhipu AI" },
  "qwen3.6-flash": { name: "Qwen3.6 Flash", company: "Alibaba" },
  "MiniMax-M2.7": { name: "MiniMax M2.7", company: "MiniMax" },
};

export const MODELS: ModelInfo[] = Object.keys(MODEL_SETTINGS).map((id, index) => ({
  id,
  name: DETAILS[id]?.name ?? id,
  company: DETAILS[id]?.company ?? "another company",
  character: (index % CHARACTER_COLOURS.length) + 1,
  colour: CHARACTER_COLOURS[index % CHARACTER_COLOURS.length],
}));

/** The companies behind the models, e.g. "OpenAI, Google and DeepSeek". */
const COMPANIES = [...new Set(MODELS.map((m) => m.company))];
export const COMPANY_LIST =
  COMPANIES.length > 1 ? `${COMPANIES.slice(0, -1).join(", ")} and ${COMPANIES[COMPANIES.length - 1]}` : COMPANIES[0];

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
/** "Eleven" for the landing line, falling back to digits. */
export function numberWord(n: number, capital = false): string {
  const word = NUMBER_WORDS[n] ?? String(n);
  return capital ? word[0].toUpperCase() + word.slice(1) : word;
}

export function modelInfo(id: string): ModelInfo {
  return (
    MODELS.find((m) => m.id === id) ?? {
      id,
      name: id,
      company: "another company",
      character: 1,
      colour: CHARACTER_COLOURS[0],
    }
  );
}
