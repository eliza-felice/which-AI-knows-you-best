// Development only: saves and loads your own test answers, so you don't have
// to answer all 60 statements every time you try the app.
//   GET  /api/dev/answers                  -> {answers: {"1": 2, ...}} or 404
//   POST /api/dev/answers {answers: {...}} -> saves them
// The file is web/.data/my-answers.json (git-ignored). Returns 404 outside
// `npm run dev`, so it never exists in the deployed app.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAnswers, type Answers } from "@/lib/experiment";

const FILE = path.join(process.cwd(), ".data", "my-answers.json");
const devOnly = () => process.env.NODE_ENV !== "development";

function toAnswers(raw: unknown): Answers | null {
  if (typeof raw !== "object" || raw === null) return null;
  const answers: Answers = {};
  for (const [id, value] of Object.entries(raw)) answers[Number(id)] = value as number;
  return validateAnswers(answers) ? answers : null;
}

export async function GET() {
  if (devOnly()) return new Response(null, { status: 404 });
  try {
    const answers = toAnswers(JSON.parse(await readFile(FILE, "utf8")));
    if (!answers) return Response.json({ error: `${FILE} isn't a complete set of answers.` }, { status: 422 });
    return Response.json({ answers });
  } catch {
    return Response.json({ error: "No saved answers yet." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  if (devOnly()) return new Response(null, { status: 404 });
  const answers = toAnswers((await request.json().catch(() => null))?.answers);
  if (!answers) return Response.json({ error: "Expected all 60 answers, each from -3 to 3." }, { status: 400 });
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(answers, null, 2) + "\n");
  return Response.json({ saved: Object.keys(answers).length });
}
