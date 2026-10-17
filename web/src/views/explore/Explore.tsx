// The Explore hub: every screen after the reveal, to visit in any order
// (PRD, steps 5-8), each ticked once seen.
import Link from "next/link";
import { useState } from "react";
import { Character } from "@/components/Character";
import { NavBar } from "@/components/NavBar";
import { BackLink } from "@/components/ui";
import { finishedResult } from "@/lib/result";
import { loadSession, visited, type ExploreKey } from "@/lib/session";

const SCREENS: {
  key: ExploreKey;
  href: string;
  title: string;
  blurb: string;
  slot: number;
  unmasked?: boolean;
  needsResult?: boolean;
}[] = [
  {
    key: "whatif",
    href: "/what-if",
    title: "What if you were someone else?",
    blurb: "Change one fact about yourself and watch the AIs change their minds.",
    slot: 6,
    needsResult: true,
  },
  {
    key: "mask",
    href: "/without-mask",
    title: "Meet the AIs without a mask",
    blurb: "What each AI says about itself when it isn't playing anyone.",
    slot: 1,
    unmasked: true,
  },
  {
    key: "reliability",
    href: "/reliability",
    title: "Same question, different answer",
    blurb: "Ask again, or ask differently, and the answers change.",
    slot: 3,
  },
  {
    key: "playalong",
    href: "/play-along",
    title: "How much does each AI play along?",
    blurb: "Some AIs throw themselves into a role; others barely try.",
    slot: 4,
  },
  {
    key: "lessons",
    href: "/lessons",
    title: "Stereotypes, measured",
    blurb: "What happened when we changed one fact about a made-up person.",
    slot: 5,
  },
  {
    key: "research",
    href: "/research",
    title: "The research behind this",
    blurb: "How our study worked, what it found, and its limits.",
    slot: 7,
  },
];

export default function Explore() {
  const [session] = useState(loadSession);
  const [seen] = useState(visited);
  const result = finishedResult(session);

  return (
    <>
      <NavBar current="explore" finished={result !== null} />
      <main className="screen mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <div>
          <BackLink href={result ? "/?step=results" : "/"} label={result ? "My results" : "Home"} />
        </div>
        <h1 className="font-hand text-4xl leading-tight font-normal">Keep exploring</h1>
        <p className="mt-2 text-ink-soft">
          Each screen looks at one idea about AI and you. Visit them in any order
          {result ? `; you've seen ${seen.length} of ${SCREENS.length}.` : "."}
        </p>

        <ul className="mt-8 grid gap-x-4 gap-y-8 sm:grid-cols-2">
          {SCREENS.map((screen) => {
            const locked = screen.needsResult && !result;
            const done = seen.includes(screen.key);
            return (
              <li key={screen.key}>
                <Link
                  href={locked ? "/?step=profile" : screen.href}
                  className="press relative block h-full rounded-card border-[1.5px] border-ink bg-cream p-4 pt-12 hover:bg-paper"
                >
                  <span className="absolute -top-6 left-3">
                    <Character slot={screen.slot} size={64} unmasked={screen.unmasked} />
                  </span>
                  {done && <span className="absolute top-3 right-4 font-hand text-xl text-ink-soft">✓ seen</span>}
                  <span className="block text-lg font-medium leading-snug">{screen.title}</span>
                  <span className="mt-1 block text-sm text-ink-soft">
                    {locked ? "Take the test first: this starts from your own result." : screen.blurb}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
