"use client";
// A searchable list with an "Other" option, opening as a full-height sheet on
// phones and a centred panel on larger screens. The sheet is portalled to the
// page body so it always covers the whole screen, above the navbar.
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OTHER_MAX_LENGTH, cleanOther } from "@/lib/profile";

export function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  capitalise = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Show list values with a capital first letter (jobs are stored lower-case). */
  capitalise?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const show = (option: string) => (capitalise ? option[0].toUpperCase() + option.slice(1) : option);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function pick(option: string) {
    onChange(option);
    close();
  }

  const search = query.trim().toLowerCase();
  const matches = options.filter((o) => o.toLowerCase().includes(search));
  const other = cleanOther(query);
  const exact = options.some((o) => o.toLowerCase() === other.toLowerCase());

  return (
    <div>
      <span id={labelId} className="mb-1.5 block text-sm font-medium">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-between rounded-input border border-line bg-cream px-4 text-left focus-visible:border-ink"
      >
        <span className={value ? "" : "text-ink-soft"}>{value ? show(value) : placeholder}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M5 8 L10 13 L15 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open &&
        // Drawn on the page body, so no animated or sticky parent can trap or clip it.
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/30 sm:items-center"
            onClick={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={label}
              onClick={(event) => event.stopPropagation()}
              className="flex h-full w-full flex-col bg-paper sm:h-[70vh] sm:max-w-md sm:rounded-card sm:border-[1.5px] sm:border-ink"
              style={{
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
            >
              <div className="flex items-center gap-2 border-b border-line p-3">
                <input
                  ref={searchRef}
                  value={query}
                  maxLength={OTHER_MAX_LENGTH}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    // Otherwise the Enter also "clicks" the field button once focus returns to it.
                    event.preventDefault();
                    if (search) pick(matches[0] ?? other);
                  }}
                  placeholder="Search or type your own"
                  aria-label={`Search ${label.toLowerCase()}`}
                  className="h-12 min-w-0 flex-1 rounded-input border border-line bg-cream px-4 outline-none focus:border-ink"
                />
                <button
                  type="button"
                  onClick={close}
                  className="press h-11 rounded-full border border-ink px-4 text-xs font-medium uppercase tracking-wider"
                >
                  Close
                </button>
              </div>
              <ul className="flex-1 overflow-y-auto p-2">
                {matches.map((option) => (
                  <li key={option}>
                    <button
                      type="button"
                      onClick={() => pick(option)}
                      className={`w-full rounded-input px-4 py-3 text-left hover:bg-cream ${option === value ? "font-medium text-cobalt" : ""}`}
                    >
                      {show(option)}
                    </button>
                  </li>
                ))}
                {other && !exact && (
                  <li>
                    <button
                      type="button"
                      onClick={() => pick(other)}
                      className="w-full rounded-input px-4 py-3 text-left hover:bg-cream"
                    >
                      Other: use <span className="font-medium">“{other}”</span>
                    </button>
                  </li>
                )}
                {!other && matches.length === 0 && <li className="px-4 py-3 text-ink-soft">Type to add your own.</li>}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
