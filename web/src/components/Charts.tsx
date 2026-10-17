// Small charts for people who aren't AI specialists: positions on a familiar
// trait line, and simple bars. Drawn like the rest of the app (docs/design.md,
// "Charts"): ink lines, flat character colours, no grid lines, direct labels
// instead of legends, and a plain-language caption under each chart.
import type { ReactNode } from "react";
import { TRAIT_NAMES, type Dimension } from "@/lib/experiment";
import { modelInfo } from "@/lib/models";

/** The first trait (e.g. Extraverted) is on the left, as on every trait line in the app. */
const x = (value: number) => 100 - value;

export function ChartCaption({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</p>;
}

function TraitEnds({ d }: { d: Dimension }) {
  return (
    <div className="flex justify-between text-sm font-medium">
      <span>← {TRAIT_NAMES[d][0]}</span>
      <span>{TRAIT_NAMES[d][1]} →</span>
    </div>
  );
}

/**
 * Every AI's guess on one trait line, as dots that stack up where they
 * crowd together, and the user as a black square underneath.
 */
export function TraitDots({
  d,
  points,
  user,
  summary,
}: {
  d: Dimension;
  points: { model: string; value: number }[];
  user?: number;
  /** What the chart shows, in one sentence, for screen readers. */
  summary: string;
}) {
  // Stack dots that would overlap: each goes in the lowest row with room.
  const rows: number[][] = [];
  const placed = [...points]
    .sort((a, b) => x(a.value) - x(b.value))
    .map((p) => {
      let row = rows.findIndex((r) => x(p.value) - r[r.length - 1] >= 5);
      if (row === -1) row = rows.push([]) - 1;
      rows[row].push(x(p.value));
      return { ...p, row };
    });
  const height = Math.max(1, rows.length) * 18 + 10;
  return (
    <figure role="img" aria-label={summary} className="my-2">
      <TraitEnds d={d} />
      <div className="relative mx-2" style={{ height: height + 40 }}>
        {placed.map((p) => {
          const info = modelInfo(p.model);
          return (
            <span
              key={p.model}
              title={`${info.name}: ${Math.round(p.value >= 50 ? p.value : 100 - p.value)}% ${TRAIT_NAMES[d][p.value >= 50 ? 0 : 1]}`}
              className="absolute h-4 w-4 -translate-x-1/2 rounded-full border-[1.5px] border-ink"
              style={{ left: `${x(p.value)}%`, bottom: 40 + p.row * 18, background: info.colour }}
            />
          );
        })}
        <div className="absolute inset-x-0 h-[1.5px] bg-ink" style={{ bottom: 32 }} />
        <div className="absolute left-1/2 h-3 w-px -translate-x-1/2 bg-ink-soft" style={{ bottom: 27 }} />
        {(user === undefined || Math.abs(user - 50) > 8) && (
          <span className="absolute left-1/2 -translate-x-1/2 text-[11px] text-ink-soft" style={{ bottom: 12 }}>
            50/50
          </span>
        )}
        {user !== undefined && (
          <span
            className="absolute flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${x(user)}%`, bottom: 0 }}
          >
            <span className="h-3 w-3 bg-ink" />
            <span className="text-xs font-medium">You</span>
          </span>
        )}
      </div>
    </figure>
  );
}

/** Simple horizontal bars, each labelled directly, longest first. */
export function BarList({
  rows,
  max,
  summary,
}: {
  rows: { key: string; label: ReactNode; value: number; display: string; colour?: string; note?: string }[];
  max: number;
  summary: string;
}) {
  return (
    <figure role="img" aria-label={summary} className="my-2 space-y-2.5">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 font-medium">
              {row.display}
              {row.note && <span className="ml-2 font-normal text-ink-soft">{row.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-2.5 w-full rounded-full bg-line/50">
            <div
              className="h-full rounded-full border border-ink"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                background: row.colour ?? "var(--color-ink)",
              }}
            />
          </div>
        </div>
      ))}
    </figure>
  );
}

/**
 * Per AI, where it started (hollow) and where it ended up (filled), with an
 * arrow between: e.g. its match knowing nothing vs knowing your profile.
 */
export function ArrowRows({
  rows,
  from,
  to,
  summary,
  fromLabel,
  toLabel,
}: {
  rows: { model: string; from: number; to: number }[];
  from: number;
  to: number;
  summary: string;
  fromLabel: string;
  toLabel: string;
}) {
  const at = (v: number) => ((v - from) / (to - from)) * 100;
  return (
    <figure role="img" aria-label={summary} className="my-2">
      <div className="mb-2 flex flex-wrap gap-x-4 text-xs text-ink-soft" aria-hidden="true">
        <span>○ {fromLabel}</span>
        <span>● {toLabel}</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const info = modelInfo(row.model);
          const left = Math.min(at(row.from), at(row.to));
          const width = Math.abs(at(row.to) - at(row.from));
          const up = row.to >= row.from;
          return (
            <div key={row.model} className="grid grid-cols-[8.5rem_1fr] items-center gap-2 sm:grid-cols-[10rem_1fr]">
              <span className="text-[13px] leading-tight">{info.name}</span>
              <div className="relative h-5">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                <div
                  className="absolute top-1/2 h-[3px] -translate-y-1/2"
                  style={{ left: `${left}%`, width: `${width}%`, background: info.colour }}
                />
                {width > 3 && (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 text-[10px] leading-none"
                    style={{ left: `calc(${at(row.to)}% ${up ? "- 14px" : "+ 6px"})`, color: "var(--color-ink)" }}
                    aria-hidden="true"
                  >
                    {up ? "▶" : "◀"}
                  </span>
                )}
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-paper"
                  style={{ left: `${at(row.from)}%`, borderColor: info.colour }}
                />
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink"
                  style={{ left: `${at(row.to)}%`, background: info.colour }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-[8.5rem_1fr] gap-2 text-[11px] text-ink-soft sm:grid-cols-[10rem_1fr]">
        <span />
        <span className="flex justify-between">
          <span>{from}</span>
          <span>{to}</span>
        </span>
      </div>
    </figure>
  );
}

/** Each AI's repeated answers to the same question, as dots on one trait line. */
export function RepeatDots({
  d,
  rows,
  summary,
}: {
  d: Dimension;
  rows: { model: string; values: number[] }[];
  summary: string;
}) {
  return (
    <figure role="img" aria-label={summary} className="my-2">
      <div className="grid grid-cols-[8.5rem_1fr] gap-2 sm:grid-cols-[10rem_1fr]">
        <span />
        <TraitEnds d={d} />
      </div>
      <div className="mt-1 space-y-1.5">
        {rows.map((row) => {
          const info = modelInfo(row.model);
          const low = Math.min(...row.values);
          const high = Math.max(...row.values);
          return (
            <div key={row.model} className="grid grid-cols-[8.5rem_1fr] items-center gap-2 sm:grid-cols-[10rem_1fr]">
              <span className="text-[13px] leading-tight">{info.name}</span>
              <div className="relative h-5">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-ink-soft" />
                <div
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-35"
                  style={{ left: `${x(high)}%`, width: `${Math.max(0.5, high - low)}%`, background: info.colour }}
                />
                {row.values.map((v, i) => (
                  <span
                    key={i}
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink"
                    style={{ left: `${x(v)}%`, background: info.colour }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/**
 * Per AI, its answer on one trait asked two ways: hollow for the first,
 * filled for the second, joined by a line. The first trait is on the left.
 */
export function TraitArrows({
  d,
  rows,
  summary,
}: {
  d: Dimension;
  rows: { model: string; from: number; to: number }[];
  summary: string;
}) {
  return (
    <figure role="img" aria-label={summary} className="my-2">
      <div className="grid grid-cols-[8.5rem_1fr] gap-2 sm:grid-cols-[10rem_1fr]">
        <span />
        <TraitEnds d={d} />
      </div>
      <div className="mt-1 space-y-1.5">
        {rows.map((row) => {
          const info = modelInfo(row.model);
          const left = Math.min(x(row.from), x(row.to));
          return (
            <div key={row.model} className="grid grid-cols-[8.5rem_1fr] items-center gap-2 sm:grid-cols-[10rem_1fr]">
              <span className="text-[13px] leading-tight">{info.name}</span>
              <div className="relative h-5">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-ink-soft" />
                <div
                  className="absolute top-1/2 h-[3px] -translate-y-1/2"
                  style={{ left: `${left}%`, width: `${Math.abs(row.to - row.from)}%`, background: info.colour }}
                />
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-paper"
                  style={{ left: `${x(row.from)}%`, borderColor: info.colour }}
                />
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink"
                  style={{ left: `${x(row.to)}%`, background: info.colour }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
