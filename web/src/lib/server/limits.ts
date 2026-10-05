// Server only: cost limits for live model calls.
//
//   LIVE_CALLS_ENABLED=false   stops all live calls (the manual spend switch)
//   RUNS_PER_IP_PER_DAY        full profile runs per visitor per day (default 1
//                              in production, unlimited in development)
//   RUNS_PER_DAY               full profile runs per day for everyone together
//                              (default 200): the app's own spend cap, on top of
//                              the gateway's monthly cap
//
// A run answered entirely from the shared cache makes no live calls, so it
// isn't counted (see route.ts). Counters are kept in store.ts (Upstash Redis
// in production). IP addresses are hashed before use and never stored as they are.
import "server-only";
import { createHash } from "node:crypto";
import { increment } from "@/lib/server/store";

const DAY_SECONDS = 24 * 60 * 60;

function setting(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== "" && process.env[name] !== undefined
    ? value
    : fallback;
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
  if (Number.isFinite(perIp) && (await increment(`runs:${day}:ip:${ipHash}`, DAY_SECONDS)) > perIp) {
    return "You've already had today's guesses. Each visitor gets one full run per day, to keep costs down.";
  }
  if ((await increment(`runs:${day}:all`, DAY_SECONDS)) > total) {
    return "The app has reached today's limit for live guesses. Please come back tomorrow.";
  }
  return null;
}
