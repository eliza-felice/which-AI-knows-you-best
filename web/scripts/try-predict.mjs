// Calls /api/predict from the command line and prints each model's guess as
// it arrives. Start the app first (npm run dev), then:
//   node scripts/try-predict.mjs
//   node scripts/try-predict.mjs http://localhost:3000
const base = process.argv[2] ?? "http://localhost:3000";
const profile = {
  age: 40,
  gender: "female",
  nationality: "Singaporean",
  job: "software engineer",
  details: process.env.DETAILS ?? "",
};

const started = Date.now();
const response = await fetch(`${base}/api/predict`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ profile }),
});
if (!response.ok) {
  console.error(response.status, await response.text());
  process.exit(1);
}

const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines.filter(Boolean)) {
    const p = JSON.parse(line);
    const at = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `${at.padStart(5)}s  ${p.model.padEnd(28)} ` +
        (p.status === "ok" ? `${p.type}  relied on: ${(p.reliedOn ?? []).join(", ")}` : `didn't answer (${p.reason})`),
    );
  }
}
