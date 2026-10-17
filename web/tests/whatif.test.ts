// /api/whatif with the model calls faked, so the test costs no API credits.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prediction } from "@/lib/match";

vi.mock("server-only", () => ({}));
const predict = vi.fn();
vi.mock("@/lib/server/gateway", () => ({ predict, PROMPT_FINGERPRINT: "whatif-test" }));
vi.mock("@/lib/server/responses", () => ({ recordResponse: vi.fn() }));

const { GET, POST } = await import("@/app/api/whatif/route");

const ME = { age: 24, gender: "female", nationality: "Singaporean", job: "nurse", details: "I love cats." };
const TWO = ["gpt-5-mini", "glm-5.2"];

function guess(model: string): Prediction {
  return {
    model,
    status: "ok",
    profile: { EI: 60, SN: 40, TF: 30, JP: 70, AT: 55 },
    type: "ENFJA",
    summary: "",
    noticed: [],
    influence: {},
    seconds: 1,
    source: "live",
  };
}

async function whatIf(change: object, models: string[] = TWO, profile: object = ME, ip = "9.9.9.9") {
  const response = await POST(
    new Request("http://test/api/whatif", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ profile, change, models }),
    }),
  );
  if (!response.ok) return { status: response.status, error: (await response.json()).error as string, lines: [] };
  const lines = (await response.text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  return { status: response.status, error: null, lines };
}

beforeEach(() => {
  predict.mockReset();
  predict.mockImplementation(async (model: string) => guess(model));
  vi.stubEnv("WHATIFS_PER_IP_PER_DAY", "1");
});

describe("/api/whatif", () => {
  it("returns a before and an after guess for each chosen AI, ignoring free text", async () => {
    const result = await whatIf({ field: "job", value: "lawyer" }, TWO, ME, "1.0.0.1");
    expect(result.status).toBe(200);
    expect(result.lines[0]).toEqual({ meta: { live: 4, remaining: 0 } });
    const guesses = result.lines.slice(1);
    expect(
      guesses
        .filter((l) => l.which === "before")
        .map((l) => l.model)
        .sort(),
    ).toEqual([...TWO].sort());
    expect(
      guesses
        .filter((l) => l.which === "after")
        .map((l) => l.model)
        .sort(),
    ).toEqual([...TWO].sort());
    // Free text never reaches a what-if: the prompts have no description.
    for (const [, systemPrompt, details] of predict.mock.calls) {
      expect(details).toBe("");
      expect(systemPrompt).not.toContain("cats");
    }
  });

  it("rejects a change the AIs can't see, and too many AIs", async () => {
    expect((await whatIf({ field: "age", value: 27 })).status).toBe(400); // still "in her 20s"
    expect((await whatIf({ field: "job", value: "lawyer" }, ["a", "b"])).status).toBe(400);
    const four = ["gpt-4o-mini", "gpt-5-mini", "gpt-5.4-nano", "glm-5.2"];
    expect((await whatIf({ field: "job", value: "lawyer" }, four)).status).toBe(400);
  });

  it("counts only live what-ifs towards the daily limit", async () => {
    // Base persona -> nurse: both are personas the original models were tested
    // on in our study, so it's free. (GLM wasn't tested on jobs, so it would be live.)
    const base = { age: 45, gender: "female", nationality: "Singaporean", job: "software engineer" };
    const tested = ["gpt-5-mini", "gpt-4o-mini"];
    for (let i = 0; i < 3; i++) {
      const free = await whatIf({ field: "job", value: "nurse" }, tested, base, "2.0.0.2");
      expect(free.status).toBe(200);
      expect(free.lines[0].meta.live).toBe(0);
    }
    expect(predict).not.toHaveBeenCalled();

    const first = await whatIf({ field: "job", value: "chef" }, TWO, base, "2.0.0.2");
    expect(first.status).toBe(200);
    const second = await whatIf({ field: "job", value: "pilot" }, TWO, base, "2.0.0.2");
    expect(second.status).toBe(429);
  });

  it("asks only the 'after' guesses for your own words, live, and counts each try", async () => {
    vi.stubEnv("WHATIFS_PER_IP_PER_DAY", "2");
    const words = "I love meeting new people.";
    const first = await whatIf({ field: "words", value: words }, TWO, ME, "3.0.0.3");
    expect(first.status).toBe(200);
    expect(first.lines[0]).toEqual({ meta: { live: 2, remaining: 1 } });
    expect(first.lines.slice(1).every((l) => l.which === "after")).toBe(true);
    for (const [, systemPrompt, details] of predict.mock.calls) {
      expect(details).toBe(words);
      expect(systemPrompt).toContain(words);
    }
    // The same words again aren't cached (free text never is), so it's another live try.
    expect((await whatIf({ field: "words", value: words }, TWO, ME, "3.0.0.3")).status).toBe(200);
    expect((await whatIf({ field: "words", value: words }, TWO, ME, "3.0.0.3")).status).toBe(429);
  });

  it("rejects empty words and contact details", async () => {
    expect((await whatIf({ field: "words", value: "   " })).status).toBe(400);
    expect((await whatIf({ field: "words", value: "email me at a@b.com" })).status).toBe(400);
  });

  it("says how many live what-ifs are left without using one", async () => {
    vi.stubEnv("WHATIFS_PER_IP_PER_DAY", "10");
    const check = async () =>
      (await GET(new Request("http://test/api/whatif", { headers: { "x-forwarded-for": "4.0.0.4" } }))).json();
    expect(await check()).toEqual({ remaining: 10 });
    expect(await check()).toEqual({ remaining: 10 });
    await whatIf({ field: "job", value: "chef" }, TWO, ME, "4.0.0.4");
    expect(await check()).toEqual({ remaining: 9 });
  });
});
