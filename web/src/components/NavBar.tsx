"use client";
// The top bar on the paper screens: the wordmark (back to where you were),
// and links to the screens you can visit after the reveal. On phones the
// links fold into a menu. Not shown on the full cobalt moments (landing,
// "the AIs are guessing", the podium).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Character } from "@/components/Character";
import { Scribble } from "@/components/Doodles";

export type NavKey = "results" | "whatif" | "mask" | "lessons" | "test";

export function NavBar({ current, finished }: { current?: NavKey; finished: boolean }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  const links: { key: NavKey; href: string; label: string }[] = [
    ...(finished
      ? [
          { key: "results" as const, href: "/?step=results", label: "My results" },
          { key: "whatif" as const, href: "/what-if", label: "What if?" },
        ]
      : [{ key: "test" as const, href: "/?step=profile", label: "Take the test" }]),
    { key: "mask", href: "/without-mask", label: "Without a mask" },
    { key: "lessons", href: "/lessons", label: "Lessons" },
  ];

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <header
      className="sticky z-40 border-b border-line bg-paper/95 backdrop-blur-sm"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <nav className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-1.5" aria-label="Which AI Knows You Best? Home">
          <Character slot={1} size={34} />
          <span className="font-hand text-xl leading-none">Which Ai knows you?</span>
        </Link>

        <ul className="hidden items-center gap-5 sm:flex">
          {links.map((link) => (
            <li key={link.key}>
              <NavLink href={link.href} label={link.label} active={current === link.key} />
            </li>
          ))}
        </ul>

        <div className="relative sm:hidden" ref={menu}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="nav-menu"
            onClick={() => setOpen(!open)}
            className="press h-11 rounded-full border border-ink px-4 text-xs font-medium tracking-wider uppercase"
          >
            {open ? "Close" : "Menu"}
          </button>
          {open && (
            <ul
              id="nav-menu"
              className="absolute top-12 right-0 w-56 space-y-1 rounded-card border-[1.5px] border-ink bg-cream p-2"
            >
              {links.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={current === link.key ? "page" : undefined}
                    className={`block rounded-input px-3 py-3 ${current === link.key ? "font-medium text-cobalt" : ""}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex h-11 items-center text-sm ${active ? "font-medium text-cobalt" : "hover:text-cobalt"}`}
    >
      {label}
      {active && <Scribble className="absolute -bottom-0.5 left-0 h-2 w-full text-cobalt" />}
    </Link>
  );
}
