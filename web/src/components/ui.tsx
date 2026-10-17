// Building blocks from design.md, section 6.
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { DIMENSIONS, TRAIT_NAMES, type Dimension, type Profile5 } from "@/lib/experiment";
import { CHANCE_GAP, describeTrait } from "@/lib/match";
import { modelInfo } from "@/lib/models";
import { Character } from "@/components/Character";
import { Asterisk, GapBracket, SpeechBubble } from "@/components/Doodles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "on-cobalt" | "primary-on-cobalt";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles = {
    // One per screen.
    primary: "h-12 px-7 rounded-full bg-cobalt text-cobalt-ink text-base font-medium disabled:opacity-40",
    // Secondary actions: small uppercase label in an ink outline.
    outline: "h-11 min-w-11 px-4 rounded-full border border-ink text-xs font-medium uppercase tracking-wider",
    "on-cobalt": "h-12 px-7 rounded-full border border-cobalt-ink text-cobalt-ink text-base font-medium",
    // The cream button on the cobalt landing screen.
    "primary-on-cobalt": "h-12 px-7 rounded-full bg-cobalt-ink text-cobalt text-base font-medium",
  }[variant];
  return <button className={`press inline-flex items-center justify-center ${styles} ${className}`} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border-[1.5px] border-ink bg-cream p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function HandTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-hand text-3xl leading-tight font-normal ${className}`}>{children}</h2>;
}

/** "differences under 5 points may be chance", under any comparison. */
export function ChanceNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-sm text-ink-soft ${className}`}>
      <Asterisk /> Differences under {CHANCE_GAP} points may be chance: each AI guessed once, and a single
      guess varies by about 2 to 6 points.
    </p>
  );
}

/**
 * Hand-lettered title, a few sentences, then a discussion question asked by
 * one of the characters, with an answer the user can open.
 */
export function LessonBlock({
  title,
  children,
  question,
  answer,
  speaker,
}: {
  title: string;
  children: ReactNode;
  question: string;
  answer: ReactNode;
  /** Which character (1-7) asks the question. */
  speaker: number;
}) {
  return (
    <section className="space-y-3">
      <HandTitle>{title}</HandTitle>
      <div className="space-y-3 text-[17px] leading-relaxed">{children}</div>
      <div>
        <SpeechBubble>
          <p className="font-medium">{question}</p>
          <details className="group mt-2">
            <summary className="press inline-flex min-h-11 cursor-pointer list-none items-center text-cobalt underline underline-offset-4 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">What do you think? Tap for an answer</span>
              <span className="hidden group-open:inline">Hide the answer</span>
            </summary>
            <div className="mt-1 space-y-2 leading-relaxed">{answer}</div>
          </details>
        </SpeechBubble>
        <div className="-mt-1 pl-2">
          <Character slot={speaker} size={72} />
        </div>
      </div>
    </section>
  );
}

export function ModelChip({ model, className = "" }: { model: string; className?: string }) {
  const info = modelInfo(model);
  return (
    <span className={`inline-flex items-center gap-2 font-medium ${className}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: info.colour }} aria-hidden="true" />
      {info.name}
    </span>
  );
}

/**
 * One trait as a line between its two poles. The first trait (e.g.
 * Extraverted) is on the left. The user's score is an ink dot; the guess is a
 * dot in the model's colour, with the gap bracketed and labelled.
 */
export function TraitBar({
  dimension,
  user,
  guess,
  model,
}: {
  dimension: Dimension;
  user: number;
  guess?: number;
  model?: string;
}) {
  const [left, right] = TRAIT_NAMES[dimension];
  // value = % for the left trait, so 100% sits at the left end.
  const x = (value: number) => 100 - value;
  const gap = guess === undefined ? 0 : Math.abs(guess - user);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm font-medium">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="relative mx-1.5 mt-8 h-6">
        <div className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-ink" />
        <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-ink-soft" aria-hidden="true" />
        {guess !== undefined && (
          <GapBracket from={x(user)} to={x(guess)} label={gap >= 0.5 ? `${Math.round(gap)} pts` : ""} />
        )}
        {guess !== undefined && (
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink"
            style={{ left: `${x(guess)}%`, background: model ? modelInfo(model).colour : "var(--color-cream)" }}
          />
        )}
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-cream"
          style={{ left: `${x(user)}%` }}
        />
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        You: {describeTrait(dimension, user)}
        {guess !== undefined && model && (
          <>
            {" · "}
            {modelInfo(model).name}: {describeTrait(dimension, guess)}
          </>
        )}
      </p>
    </div>
  );
}

/** All five traits for one comparison. */
export function TraitBars({ user, guess, model }: { user: Profile5; guess?: Profile5; model?: string }) {
  return (
    <div className="space-y-4">
      {DIMENSIONS.map((d) => (
        <TraitBar key={d} dimension={d} user={user[d]} guess={guess?.[d]} model={model} />
      ))}
    </div>
  );
}

/**
 * "← Back to ..." at the top of a screen. Goes to the screen's logical parent
 * (not the browser's previous page), so it always lands somewhere sensible,
 * even after a refresh or when the page was opened directly.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="press -ml-1 inline-flex h-11 items-center px-1 text-sm underline underline-offset-4">
      ← {label}
    </Link>
  );
}

/** The one button at the end of every Explore screen. */
export function ExploreFooter() {
  return (
    <footer className="border-t border-line pt-8">
      <Link
        href="/explore"
        className="press inline-flex h-12 items-center rounded-full bg-cobalt px-7 font-medium text-cobalt-ink"
      >
        ← Back to Explore
      </Link>
    </footer>
  );
}
