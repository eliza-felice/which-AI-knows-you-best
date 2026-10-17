// Server only: a small key-value store for the rate limits and the shared
// prediction cache. Uses Upstash Redis when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set (or KV_REST_API_URL and KV_REST_API_TOKEN,
// the names Vercel's Upstash integration may use), so data holds across serverless functions;
// otherwise keeps it in memory (fine for local use only).
import "server-only";

const memory = new Map<string, { value: string; expires: number }>();

function upstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function pipeline(commands: string[][]): Promise<unknown[]> {
  const { url, token } = upstash()!;
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`store returned ${response.status}`);
  const results: { result?: unknown; error?: string }[] = await response.json();
  return results.map((r) => {
    if (r.error) throw new Error(`store error: ${r.error}`);
    return r.result;
  });
}

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

/** Adds 1 to a counter that expires ttlSeconds after it was first set. */
export async function increment(key: string, ttlSeconds: number): Promise<number> {
  if (!upstash()) {
    const count = Number(memoryGet(key) ?? 0) + 1;
    const expires = memory.get(key)?.expires ?? Date.now() + ttlSeconds * 1000;
    memory.set(key, { value: String(count), expires });
    return count;
  }
  const [count] = await pipeline([
    ["INCR", key],
    ["EXPIRE", key, String(ttlSeconds), "NX"],
  ]);
  return Number(count);
}

/** Values for several keys at once; null where there is none. */
export async function getMany(keys: string[]): Promise<(string | null)[]> {
  if (keys.length === 0) return [];
  if (!upstash()) return keys.map(memoryGet);
  const values = await pipeline(keys.map((key) => ["GET", key]));
  return values.map((value) => (typeof value === "string" ? value : null));
}

export async function set(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!upstash()) {
    memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
    return;
  }
  await pipeline([["SET", key, value, "EX", String(ttlSeconds)]]);
}

const memoryLists = new Map<string, string[]>();

/** Adds a value to the front of a list, keeping at most maxLength entries. */
export async function pushToList(key: string, value: string, maxLength: number): Promise<void> {
  if (!upstash()) {
    const list = [value, ...(memoryLists.get(key) ?? [])].slice(0, maxLength);
    memoryLists.set(key, list);
    return;
  }
  await pipeline([
    ["LPUSH", key, value],
    ["LTRIM", key, "0", String(maxLength - 1)],
  ]);
}

export function usesUpstash(): boolean {
  return upstash() !== null;
}
