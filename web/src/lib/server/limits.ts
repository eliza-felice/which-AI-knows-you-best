// Server only: cost limits for live model calls.
//
//   LIVE_CALLS_ENABLED=false   stops all live calls (the manual spend switch)
//   RUNS_PER_IP_PER_DAY        full profile runs per visitor per day (default 1
//                              in production, unlimited in development)
//   RUNS_PER_DAY               full profile runs per day for everyone together
//                              (default 200): the app's own spend cap, on top of
//                              the gateway's monthly cap
//
// Counters live in Upstash Redis when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set, so they hold across serverless functions.
// Without them, counts are kept in memory (fine for local use only).
// IP addresses are hashed before use and never stored as they are.
import "server-only";
import { createHash } from "node:crypto";

const DAY_SECONDS = 24 * 60 * 60;
const memory = new Map<string, number>();

function setting(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== "" && process.env[name] !== undefined
    ? value
    : fallback;
}

async function increment(key: string): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const count = (memory.get(key) ?? 0) + 1;
    memory.set(key, count);
    return count;
  }
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(DAY_SECONDS), "NX"],
    ]),
  });
  if (!response.ok) throw new Error(`rate limit store returned ${response.status}`);
  const [{ result }] = await response.json();
  return Number(result);
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Counts one profile run. Returns a message for the user if it isn't allowed. */
export async function claimProfileRun(ip: string): Promise<string | null> {
  if (process.env.LIVE_CALLS_ENABLED === "false") {
    return "Live guesses are paused right now. Please try again later.";
  }
  const day = new Date().toISOString().slice(0, 10);
  const perIp = setting("RUNS_PER_IP_PER_DAY", process.env.NODE_ENV === "production" ? 1 : Infinity);
  const total = setting("RUNS_PER_DAY", 200);

  const ipHash = createHash("sha256").update(`${day}:${ip}`).digest("hex").slice(0, 24);
  if (Number.isFinite(perIp) && (await increment(`runs:${day}:ip:${ipHash}`)) > perIp) {
    return "You've already had today's guesses. Each visitor gets one full run per day, to keep costs down.";
  }
  if ((await increment(`runs:${day}:all`)) > total) {
    return "The app has reached today's limit for live guesses. Please come back tomorrow.";
  }
  return null;
}
