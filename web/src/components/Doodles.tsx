"use client";
// Hand-drawn bits: the ink filters that make lines wobble (and "boil"), and
// small doodles used across the screens.
import { useSyncExternalStore, type ReactNode } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * SVG filters, rendered once in the layout. "wobble" roughens a line so it
 * looks drawn by hand; "boil" does the same but swaps between three versions
 * of the roughness about 6 times a second (off when reduced motion is on).
 */
export function InkFilters() {
  const reduced = usePrefersReducedMotion();
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <filter id="wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="2.5" />
        </filter>
        <filter id="boil">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="1">
            {!reduced && (
              <animate attributeName="seed" values="1;2;3" dur="0.5s" calcMode="discrete" repeatCount="indefinite" />
            )}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="2.5" />
        </filter>
      </defs>
    </svg>
  );
}

/** The hand-drawn asterisk that marks the chance note. */
export function Asterisk({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`inline-block h-3.5 w-3.5 ${className}`} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" filter="url(#wobble)">
        <path d="M10 2.5 L10.4 17.5" />
        <path d="M3.5 6.5 L16.5 13.2" />
        <path d="M16.2 6 L3.8 13.8" />
      </g>
    </svg>
  );
}

/**
 * A speech bubble with a wobbly outline and a tail at the bottom left, so a
 * character placed just below it is the one speaking.
 */
export function SpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-2">
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M6 3 C35 1 70 2 94 4 C98 5 99 9 98.5 50 C98 88 97 94 92 97 C70 98.5 40 98 10 97.5 C5 97 3 95 2.5 92 C1 70 1.5 30 2 9 C2.5 5 3.5 3.5 6 3 Z"
          fill="var(--color-cream)"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {/* The tail: a fixed size, whatever the bubble's height. */}
      <svg className="absolute -bottom-[15px] left-8 h-4 w-7 overflow-visible" viewBox="0 0 28 16" aria-hidden="true">
        <path d="M1 -1 L10 15 L23 -1 Z" fill="var(--color-cream)" />
        <path d="M1 0 L10 15 L23 0" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="relative px-5 py-4 text-[17px]">{children}</div>
    </div>
  );
}

/** A wobbly bracket between two points on a 0-100 track, with a label above. */
export function GapBracket({ from, to, label }: { from: number; to: number; label: string }) {
  const left = Math.min(from, to);
  const right = Math.max(from, to);
  if (right - left < 0.5) return null;
  return (
    <div
      className="pointer-events-none absolute -top-7 h-6"
      style={{ left: `${left}%`, width: `${right - left}%` }}
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 -top-3 text-center text-xs font-medium whitespace-nowrap">{label}</span>
      <svg className="absolute bottom-0 h-3 w-full overflow-visible" viewBox="0 0 100 10" preserveAspectRatio="none">
        <path
          d="M0.5 10 C0.5 4 1 2.5 4 2.5 L96 2 C99 2 99.5 4 99.5 10"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          filter="url(#wobble)"
        />
      </svg>
    </div>
  );
}

/** A hand-drawn underline, for the hand-lettered headline. */
export function Scribble({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 12" className={className} aria-hidden="true" preserveAspectRatio="none">
      <path
        d="M3 8 C40 3 80 4 120 6 C150 7 175 5 197 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#wobble)"
      />
    </svg>
  );
}

/** A hand-drawn loop around whatever it sits in (which needs `position: relative`). */
export function Circled({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute -inset-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)] overflow-visible ${className}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M52 4 C80 3 98 14 97 50 C96 84 76 97 48 96 C18 95 3 82 3 50 C3 20 22 5 58 7"
        fill="none"
        stroke="var(--color-cobalt)"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        filter="url(#wobble)"
      />
    </svg>
  );
}
