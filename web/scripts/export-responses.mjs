// Writes the web app's saved responses (see src/lib/server/responses.ts) to
// ../experiment/experiment_data/_web_app/responses.csv, one row per live guess, oldest
// first. Reads Upstash Redis when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN) are set
// (in .env.local or the environment),
// otherwise the development file .data/responses.jsonl.
//   node scripts/export-responses.mjs
// The folder starts with "_", so the experiment's charts ignore it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
  }
}
loadEnv(".env.local");

async function readRecords() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    const response = await fetch(`${url}/lrange/responses/0/-1`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Upstash returned ${response.status}`);
    const { result } = await response.json();
    console.log("Read from Upstash.");
    return result.map((line) => JSON.parse(line)).reverse(); // the list is newest first
  }
  const file = path.join(".data", "responses.jsonl");
  if (!existsSync(file)) return [];
  console.log(`Read from ${file}.`);
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function csvCell(value) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const records = await readRecords();
if (records.length === 0) {
  console.log("No saved responses yet.");
} else {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const rows = [columns.join(","), ...records.map((record) => columns.map((c) => csvCell(record[c])).join(","))];
  const out = path.join("..", "experiment", "experiment_data", "_web_app", "responses.csv");
  mkdirSync(path.dirname(out), { recursive: true });
  // utf-8 with a BOM so Excel shows apostrophes and dashes correctly.
  writeFileSync(out, "﻿" + rows.join("\n") + "\n");
  console.log(`Wrote ${records.length} responses to ${out}`);
}
