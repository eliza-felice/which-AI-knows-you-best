// Server only: cost limits for live model calls.
//
//   LIVE_CALLS_ENABLED=false   stops all live calls (the manual spend switch)
//   RUNS_PER_IP_PER_DAY        full profile runs per visitor per day (default
//                              unlimited: people on shared Wi-Fi share an IP)
//   RUNS_PER_DAY              full profile runs per day for everyone together
//                              (default 200): the app's own spend cap, on top of
//                              the gateway's monthly cap
//   WHATIFS_PER_IP_PER_DAY     live what-ifs per visitor per day (default
//                              unlimited)
//   WHATIFS_PER_DAY            live what-ifs per day for everyone (default 1000)
//
// A request answered entirely from the study or the shared cache makes no live
// calls, so it isn't counted (see lib/server/guesses.ts). Counters are kept in
// store.ts (Upstash Redis in production). IP addresses are hashed before use
// and never stored as they are.
import "server-only";
import { createHash } from "node:crypto";
import { getMany, increment } from "@/lib/server/store";

const DAY_SECONDS = 24 * 60 * 60;

function setting(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== "" && process.env[name] !== undefined ? value : fallback;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

const KINDS = {
  run: {
    perIp: () => setting("RUNS_PER_IP_PER_DAY", Infinity),
    total: () => setting("RUNS_PER_DAY", 200),
    overIp: "You've already had today's guesses. Each visitor gets one full run per day, to keep costs down.",
    overTotal: "The app has reached today's limit for live guesses. Please come back tomorrow.",
  },
  whatif: {
    perIp: () => setting("WHATIFS_PER_IP_PER_DAY", Infinity),
    total: () => setting("WHATIFS_PER_DAY", 1000),
    overIp:
      "You've used today's live what-ifs, to keep costs down. What-ifs we've already seen still work.",
    overTotal: "The app has reached today's limit for live what-ifs. Please come back tomorrow.",
  },
};

type Claim = { refusal: string } | { remaining: number };

/**
 * Counts one request that needs live calls. Returns a message for the user if
 * it isn't allowed, or how many of this kind the visitor has left today.
 */
export async function claim(kind: keyof typeof KINDS, ip: string): Promise<Claim> {
  if (process.env.LIVE_CALLS_ENABLED === "false") {
    return { refusal: "Live guesses are paused right now. Please try again later." };
  }
  const limits = KINDS[kind];
  const day = new Date().toISOString().slice(0, 10);
  const perIp = limits.perIp();
  const ipHash = createHash("sha256").update(`${day}:${ip}`).digest("hex").slice(0, 24);
  let used = 0;
  if (Number.isFinite(perIp)) {
    used = await increment(`${kind}s:${day}:ip:${ipHash}`, DAY_SECONDS);
    if (used > perIp) return { refusal: limits.overIp };
  }
  if ((await increment(`${kind}s:${day}:all`, DAY_SECONDS)) > limits.total()) {
    return { refusal: limits.overTotal };
  }
  return { remaining: Number.isFinite(perIp) ? perIp - used : Infinity };
}

/** How many of this kind the visitor has left today, without using one (null = no limit). */
export async function remaining(kind: keyof typeof KINDS, ip: string): Promise<number | null> {
  const perIp = KINDS[kind].perIp();
  if (!Number.isFinite(perIp)) return null;
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = createHash("sha256").update(`${day}:${ip}`).digest("hex").slice(0, 24);
  const [used] = await getMany([`${kind}s:${day}:ip:${ipHash}`]);
  return Math.max(0, perIp - Number(used ?? 0));
}

/** Counts one full profile run. Returns a message for the user if it isn't allowed. */
export async function claimProfileRun(ip: string): Promise<string | null> {
  const result = await claim("run", ip);
  return "refusal" in result ? result.refusal : null;
}
