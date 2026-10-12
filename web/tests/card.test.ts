// The share card renders, with no demographic details in its sentence.
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/card/route";
import { cardParams, cardSentence, parseCard } from "@/lib/wrapup";

describe("/api/card", () => {
  it("renders a 1080 x 1350 PNG", async () => {
    const response = await GET(new Request(`http://test/api/card?${cardParams({ winner: "gpt-5-mini", match: 93.4, miss: { d: "EI", side: 1, all: true } })}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    // PNG width and height are bytes 16-23 of the header.
    const view = new DataView(bytes.buffer);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1080, 1350]);
  }, 60000);

  it("rejects unknown models and odd values", async () => {
    expect((await GET(new Request("http://test/api/card?winner=nope&match=90"))).status).toBe(400);
    expect(parseCard(new URLSearchParams("winner=gpt-5-mini&match=150"))).toBeNull();
    expect(parseCard(new URLSearchParams("winner=gpt-5-mini&match=90&miss=XX1a"))).toBeNull();
  });

  it("says which AI won and what they got wrong, nothing about the person", () => {
    expect(cardSentence({ winner: "gpt-5-mini", match: 90, miss: { d: "EI", side: 1, all: true } })).toBe(
      "GPT-5 mini knew me best, but every AI guessed I was Introverted.",
    );
    expect(cardSentence({ winner: "glm-5.2", match: 80 })).toBe("GLM-5.2 knew me best.");
  });
});
