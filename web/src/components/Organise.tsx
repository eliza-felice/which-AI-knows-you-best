"use client";
// Ways to show one thing at a time instead of one long page ("one idea per
// screen", design.md): tabs, and a deck of cards stepped through in order.
// Both are drawn in the app's sketchbook style: ink lines, a cobalt loop or
// dot for "you are here".
import { useRef, useState, type ReactNode } from "react";
import { Circled, Scribble } from "@/components/Doodles";

/**
 * A row of tabs that sticks under the navbar: plain labels, the selected one
 * circled in cobalt, on a hand-drawn rule. The parent shows the panel for `value`.
 */
export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div
      className="sticky z-30 -mx-4 bg-paper/95 px-4 pt-2 backdrop-blur-sm sm:-mx-6 sm:px-6"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
    >
      <div role="tablist" aria-label={label} className="flex gap-2">
        {tabs.map((tab) => {
          const active = value === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={active}
              aria-controls={`panel-${tab.key}`}
              onClick={() => onChange(tab.key)}
              className={`press relative min-h-11 flex-1 px-2 text-[15px] leading-tight ${
                active ? "font-medium text-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              {active && <Circled />}
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <Scribble className="mt-1 block h-2 w-full text-ink" />
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="screen">
      {children}
    </div>
  );
}

/** Cards shown one at a time, with Previous / Next and "2 of 5". */
export function Deck({ cards, label }: { cards: { key: string; title: string; node: ReactNode }[]; label: string }) {
  const [index, setIndex] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const card = cards[Math.min(index, cards.length - 1)];

  function go(next: number) {
    setIndex(next);
    // Back to the top of the new card, but not if it's already in view.
    const box = top.current?.getBoundingClientRect();
    if (box && box.top < 0) top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section aria-label={label} aria-roledescription="carousel">
      <div ref={top} className="scroll-mt-32" />
      <DeckProgress cards={cards} index={index} onGo={go} />
      <div key={card.key} className="screen mt-5" aria-live="polite">
        {card.node}
      </div>
      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="press h-11 rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase disabled:invisible"
        >
          ← Previous
        </button>
        <span className="font-hand text-xl">
          {index + 1} of {cards.length}
        </span>
        {index < cards.length - 1 ? (
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="press h-11 rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase"
          >
            Next →
          </button>
        ) : (
          <span className="w-24" />
        )}
      </div>
    </section>
  );
}

/**
 * Like the test's progress line: a thin ink line with a cobalt dot at the
 * current card, and a small tick for each card that jumps to it.
 */
function DeckProgress({
  cards,
  index,
  onGo,
}: {
  cards: { key: string; title: string }[];
  index: number;
  onGo: (index: number) => void;
}) {
  const at = (i: number) => (cards.length > 1 ? (i / (cards.length - 1)) * 100 : 50);
  return (
    <div className="relative mx-3 h-10" aria-label="Cards">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink" />
      <div className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-ink" style={{ width: `${at(index)}%` }} />
      {cards.map((card, i) => (
        <button
          key={card.key}
          type="button"
          onClick={() => onGo(i)}
          aria-label={`${i + 1}: ${card.title}`}
          aria-current={i === index ? "step" : undefined}
          className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: `${at(i)}%` }}
        >
          {i === index ? (
            <span className="h-4 w-4 rounded-full bg-cobalt transition-[left] duration-200" />
          ) : (
            <svg viewBox="0 0 12 12" className="h-3 w-3 overflow-visible" aria-hidden="true">
              <circle
                cx="6"
                cy="6"
                r="4.5"
                fill={i < index ? "var(--color-ink)" : "var(--color-paper)"}
                stroke="var(--color-ink)"
                strokeWidth="1.5"
                filter="url(#wobble)"
              />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
