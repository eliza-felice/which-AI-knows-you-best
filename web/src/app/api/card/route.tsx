// GET /api/card?winner=gpt-5-mini&match=93&miss=EI1a
//
// The shareable summary card (design.md, "Share card"): 1080 x 1350, cobalt,
// the winning AI's character in cream line art, one hand-lettered sentence
// and the wordmark. It contains no demographic details: only which AI came
// closest, its match score and, optionally, the trait most AIs got wrong.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { Character } from "@/components/Character";
import { modelInfo } from "@/lib/models";
import { cardSentence, parseCard } from "@/lib/wrapup";

const COBALT = "#0B2EA0";
const CREAM = "#F7F0E3";

export async function GET(request: Request) {
  const card = parseCard(new URL(request.url).searchParams);
  if (!card) return new Response("Invalid card", { status: 400 });
  const hand = await readFile(path.join(process.cwd(), "src/assets/fonts/GochiHand-Regular.ttf"));
  const info = modelInfo(card.winner);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: COBALT,
          color: CREAM,
          padding: "90px 80px 70px",
          fontFamily: "Gochi Hand",
        }}
      >
        <div style={{ fontSize: 44, opacity: 0.85 }}>my result</div>
        <Character slot={info.character} size={560} line={CREAM} holes={COBALT} pupils={CREAM} plain />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ fontSize: 84, lineHeight: 1.05, textAlign: "center" }}>{cardSentence(card)}</div>
          <div style={{ fontSize: 44, opacity: 0.85 }}>{`${Math.round(card.match)}% match`}</div>
        </div>
        <div style={{ fontSize: 48, letterSpacing: 1 }}>WHICH Ai KNOWs YOU BEsT?</div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [{ name: "Gochi Hand", data: hand, weight: 400, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
