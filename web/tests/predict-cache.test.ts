// Where /api/predict gets each guess (study, cache, live), with the model
// calls faked so the test costs no API credits.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prediction } from "@/lib/match";

vi.mock("server-only", () => ({}));
const predict = vi.fn();
vi.mock("@/lib/server/gateway", () => ({ predict, PROMPT_FINGERPRINT: "test" }));
const recordResponse = vi.fn();
vi.mock("@/lib/server/responses", () => ({ recordResponse }));

const { POST } = await import("@/app/api/predict/route");
const { MODELS } = await import("@/lib/models");

const PROFILE = { age: 24, gender: "female", nationality: "Singaporean", job: "nurse", details: "" };

function guess(model: string): Prediction {
  return {
    model,
    status: "ok",
    profile: { EI: 60, SN: 40, TF: 30, JP: 70, AT: 55 },
    type: "ENFJA",
    summary: "You seem caring.",
    noticed: [],
    influence: { job: 3 },
    seconds: 1,
    source: "live",
  };
}

async function ask(profile: object, ip: string) {
  const response = await POST(
    new Request("http://test/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ profile }),
    }),
  );
  if (!response.ok) return { status: response.status, predictions: [] as Prediction[] };
  const text = await response.text();
  return { status: response.status, predictions: text.trim().split("\n").map((l) => JSON.parse(l) as Prediction) };
}

beforeEach(() => {
  predict.mockReset();
  recordResponse.mockReset();
  predict.mockImplementation(async (model: string) => guess(model));
  vi.stubEnv("RUNS_PER_IP_PER_DAY", "1");
});

describe("shared prediction cache", () => {
  it("asks live the first time, then serves the same profile from the cache", async () => {
    const first = await ask(PROFILE, "1.1.1.1");
    expect(first.predictions).toHaveLength(MODELS.length);
    expect(predict).toHaveBeenCalledTimes(MODELS.length);

    predict.mockClear();
    // Same prompt: age 27 is also "in her 20s". A new visitor, and one whose
    // daily live run is irrelevant because nothing is asked live.
    const second = await ask({ ...PROFILE, age: 27 }, "1.1.1.1");
    expect(second.status).toBe(200);
    expect(predict).not.toHaveBeenCalled();
    expect(second.predictions.every((p) => p.status === "ok" && p.source === "cache")).toBe(true);
  });

  it("saves each live guess as an anonymous record, but not cached ones", async () => {
    const profile = { ...PROFILE, job: "lawyer" };
    await ask(profile, "4.4.4.4");
    expect(recordResponse).toHaveBeenCalledTimes(MODELS.length);
    recordResponse.mockClear();
    vi.stubEnv("RUNS_PER_IP_PER_DAY", "5");
    await ask(profile, "4.4.4.4");
    // Cached guesses reach the route but aren't live, so recordResponse skips them
    // (it's only called for live ones).
    expect(recordResponse).not.toHaveBeenCalled();
  });

  it("answers a profile we tested in the study from the study, with no calls", async () => {
    // The study's base persona: "a Singaporean woman in her 40s, working as a software engineer".
    const base = { age: 44, gender: "female", nationality: "Singaporean", job: "software engineer", details: "" };
    await ask({ ...PROFILE, job: "pilot", age: 33 }, "5.5.5.5"); // uses this visitor's one live run
    predict.mockClear();
    const result = await ask(base, "5.5.5.5");
    expect(result.status).toBe(200); // not refused: nothing was asked live
    expect(predict).not.toHaveBeenCalled();
    expect(result.predictions).toHaveLength(MODELS.length);
    expect(result.predictions.every((p) => p.status === "ok" && p.source === "study")).toBe(true);
  });

  it("never caches failures, and asks only the missing models next time", async () => {
    const profile = { ...PROFILE, job: "pilot" };
    predict.mockImplementation(async (model: string) =>
      model === MODELS[0].id ? { model, status: "failed", reason: "timed out" } : guess(model),
    );
    await ask(profile, "2.2.2.2");

    predict.mockClear();
    predict.mockImplementation(async (model: string) => guess(model));
    vi.stubEnv("RUNS_PER_IP_PER_DAY", "5");
    await ask(profile, "2.2.2.2");
    expect(predict).toHaveBeenCalledTimes(1);
    expect(predict.mock.calls[0][0]).toBe(MODELS[0].id);
  });

  it("always asks live when there are free-text details, and counts it towards the limit", async () => {
    const withDetails = { ...PROFILE, job: "chef", details: "I love hiking." };
    const first = await ask(withDetails, "3.3.3.3");
    expect(first.status).toBe(200);
    expect(predict).toHaveBeenCalledTimes(MODELS.length);

    // Same details again: not cached, so it's a second live run, over the limit of 1.
    const second = await ask(withDetails, "3.3.3.3");
    expect(second.status).toBe(429);
  });
});
