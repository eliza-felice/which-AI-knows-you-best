// The cast: one original character per AI model (design.md, "The cast").
// Black ink outline, a flat colour blob placed a few pixels off the line, and a
// simple mask, because each model is playing a persona.
import { CHARACTER_COLOURS, MODELS } from "@/lib/models";

type Shape = {
  /** Body outline; the colour fill reuses it, shifted off the line. */
  body: string;
  /** Extra lines: limbs, glasses, a book... */
  extras: string[];
  /** Mask centre and half-width. */
  mask: [number, number, number];
  /** Shadow under a floating character. */
  floats?: boolean;
};

// Drawn on a 120 x 120 artboard; the ground is at y = 112.
const SHAPES: Shape[] = [
  // 1 periwinkle: tall, long-snouted, shy (arms held in close).
  {
    body: "M44 104 C38 80 36 52 44 30 C50 16 66 12 74 26 C84 30 96 36 101 42 C98 49 86 50 75 50 C77 70 76 88 70 104 Z",
    extras: ["M48 104 L47 112", "M65 104 L66 112", "M48 70 C54 76 62 76 66 70"],
    mask: [61, 33, 12],
  },
  // 2 tomato: round, loud, arms up.
  {
    body: "M60 34 C80 34 92 48 91 66 C90 86 76 97 59 96 C40 95 29 82 30 65 C31 47 42 34 60 34 Z",
    extras: [
      "M34 56 L17 30", "M17 30 L12 27 M17 30 L15 24",
      "M86 56 L103 30", "M103 30 L108 27 M103 30 L105 24",
      "M50 96 L48 110", "M70 96 L72 110", "M54 76 C57 80 63 80 66 76",
    ],
    mask: [60, 58, 16],
  },
  // 3 plum: thin, bookish, glasses over the mask, holding a book.
  {
    body: "M50 104 C47 80 46 50 48 32 C49 20 56 14 61 14 C67 14 72 20 72 32 C73 52 72 80 70 104 Z",
    extras: [
      "M48 34 C48 28 58 28 58 34 C58 40 48 40 48 34 Z",
      "M63 34 C63 28 73 28 73 34 C73 40 63 40 63 34 Z",
      "M58 33 L63 33",
      "M33 60 L46 63 L45 79 L32 76 Z", "M39.5 61.5 L38.5 77.5",
      "M54 104 L53 112", "M66 104 L67 112",
    ],
    mask: [60.5, 34, 13],
  },
  // 4 forest: small, quick, always mid-step.
  {
    body: "M44 90 C38 76 42 60 56 56 C70 52 80 62 78 76 C77 88 66 96 56 96 C50 96 46 94 44 90 Z",
    extras: ["M52 95 L42 111", "M66 94 L79 109", "M22 70 L33 70", "M20 80 L31 80", "M24 90 L33 90"],
    mask: [64, 70, 11],
  },
  // 5 mustard: wide, calm, sitting down.
  {
    body: "M22 100 C20 72 36 48 60 48 C84 48 100 70 98 100 C80 102 40 102 22 100 Z",
    extras: ["M36 100 C32 104 30 108 34 111", "M84 100 C88 104 90 108 86 111", "M48 84 C54 88 66 88 72 84", "M14 112 L106 112"],
    mask: [60, 68, 15],
  },
  // 6 clay: lanky, curious, leaning in, one arm reaching out.
  {
    body: "M40 108 C42 84 46 60 58 40 C64 28 76 20 86 24 C94 28 92 40 84 46 C74 56 64 80 58 108 Z",
    extras: ["M44 108 L41 114", "M56 108 L59 114", "M64 62 C74 60 86 62 96 70", "M96 70 L101 68 M96 70 L99 75"],
    mask: [82, 32, 10],
  },
  // 7 sky: tiny, floats slightly off the ground.
  {
    body: "M60 42 C72 42 78 50 77 60 C76 70 68 75 59 74 C49 73 43 66 44 57 C45 48 51 42 60 42 Z",
    extras: ["M45 60 L36 54", "M76 60 L85 54", "M55 74 L54 80", "M64 74 L65 80"],
    mask: [60, 56, 11],
    floats: true,
  },
  // 8 rose: pear-shaped, waving one arm.
  {
    body: "M60 30 C70 30 74 40 72 50 C84 58 90 72 88 88 C86 100 74 106 60 106 C46 106 34 100 32 88 C30 72 36 58 48 50 C46 40 50 30 60 30 Z",
    extras: ["M86 66 L100 52", "M100 52 L104 46 M100 52 L106 54", "M34 74 L26 84", "M52 106 L51 112", "M68 106 L69 112", "M54 66 C57 69 63 69 66 66"],
    mask: [60, 42, 11],
  },
  // 9 olive: a box with an antenna.
  {
    body: "M34 46 C46 44 74 44 86 46 C88 62 88 86 86 102 C72 104 48 104 34 102 C32 86 32 62 34 46 Z",
    extras: ["M60 45 L58 30", "M58 30 C54 26 60 22 62 27 C63 30 60 31 58 30 Z", "M44 102 L43 112", "M76 102 L77 112", "M50 84 L70 84"],
    mask: [60, 64, 16],
  },
  // 10 lilac: a tall cone, like a wizard's hat, with tiny feet.
  {
    body: "M60 12 C66 30 78 70 86 102 C70 105 50 105 34 102 C42 70 54 30 60 12 Z",
    extras: ["M50 103 L48 111", "M70 103 L72 111", "M40 82 L28 76", "M80 82 L92 76", "M54 88 C58 91 62 91 66 88"],
    mask: [60, 64, 13],
  },
  // 11 teal: a bean hopping on one leg, arms out for balance.
  {
    body: "M58 28 C72 26 80 38 78 56 C77 74 72 90 60 92 C48 94 40 82 40 64 C40 44 46 30 58 28 Z",
    extras: ["M58 92 L62 112", "M58 100 L50 98", "M41 58 L22 50", "M77 56 L98 48", "M52 72 C56 76 62 76 66 72"],
    mask: [60, 46, 13],
  },
  // 12 mint: round, spiky-haired, arms crossed.
  {
    body: "M60 40 C78 40 90 54 89 72 C88 92 76 104 59 104 C42 104 30 92 31 72 C32 54 44 40 60 40 Z",
    extras: [
      "M42 46 L40 30 L50 41 L54 24 L61 40 L68 25 L71 42 L80 31 L78 47",
      "M38 80 C48 86 72 86 82 80", "M44 84 L56 76", "M76 84 L64 76",
      "M50 104 L49 112", "M70 104 L71 112",
    ],
    mask: [60, 62, 15],
  },
];

export function Character({
  slot,
  size = 96,
  boil = false,
  line = "var(--color-ink)",
  className = "",
  title,
  unmasked = false,
  plain = false,
  holes = "var(--color-cream)",
  pupils = "var(--color-ink)",
}: {
  /** 1 to 12. */
  slot: number;
  size?: number;
  /** Animate the line ("boiling"). Use on hero characters only. */
  boil?: boolean;
  /** Line colour; cream on cobalt screens. */
  line?: string;
  className?: string;
  /** Alt text. Without it the drawing is decorative. */
  title?: string;
  /** Mask off, held in a hand ("Meet the AI without a mask"). */
  unmasked?: boolean;
  /** No wobble filter (for the share card image, which can't draw SVG filters). */
  plain?: boolean;
  /** Eye-hole and pupil colours (plain values for the share card, which can't read CSS variables). */
  holes?: string;
  pupils?: string;
}) {
  const shape = SHAPES[(slot - 1) % SHAPES.length];
  const colour = CHARACTER_COLOURS[(slot - 1) % CHARACTER_COLOURS.length];
  const [mx, my, mw] = shape.mask;
  const filter = plain ? undefined : `url(#${boil ? "boil" : "wobble"})`;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {shape.floats && <ellipse cx="60" cy="106" rx="13" ry="2.5" fill={line} opacity="0.25" />}
      {/* Colour blob, a few pixels off the outline. */}
      <path d={shape.body} fill={colour} transform="translate(4 3) scale(0.97)" style={{ transformOrigin: "60px 60px" }} />
      <g fill="none" stroke={line} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" filter={filter}>
        <path d={shape.body} />
        {shape.extras.map((d) => (
          <path key={d} d={d} />
        ))}
        {/* Mask strings. */}
        {!unmasked && <path d={`M${mx - mw} ${my} L${mx - mw - 4} ${my - 2} M${mx + mw} ${my} L${mx + mw + 4} ${my - 2}`} />}
      </g>
      {unmasked ? (
        <g>
          {/* Bare face: just the dot eyes. */}
          <circle cx={mx - mw / 2} cy={my + 0.3} r="1.8" fill={line} />
          <circle cx={mx + mw / 2} cy={my + 0.3} r="1.8" fill={line} />
          {/* The mask, held off to the side. */}
          <g filter={filter} transform="translate(97 94) rotate(-20) scale(1.15)">
            <path d="M-12 0 C-12 -6 -3 -6 0 -3 C3 -6 12 -6 12 0 C12 6 3 6 0 3 C-3 6 -12 6 -12 0 Z" fill={line} />
            <ellipse cx="-6" cy="0" rx="3" ry="2.4" fill={holes} />
            <ellipse cx="6" cy="0" rx="3" ry="2.4" fill={holes} />
            <path d="M12 0 L18 6" stroke={line} strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </g>
      ) : (
        <g>
        {/* The mask: an ink band with two eye holes and dot eyes. */}
        <g filter={filter}>
          <path
            d={`M${mx - mw} ${my} C${mx - mw} ${my - 6} ${mx - 3} ${my - 6} ${mx} ${my - 3} C${mx + 3} ${my - 6} ${mx + mw} ${my - 6} ${mx + mw} ${my} C${mx + mw} ${my + 6} ${mx + 3} ${my + 6} ${mx} ${my + 3} C${mx - 3} ${my + 6} ${mx - mw} ${my + 6} ${mx - mw} ${my} Z`}
            fill={line}
          />
          <ellipse cx={mx - mw / 2} cy={my} rx={mw / 4} ry="2.4" fill={holes} />
          <ellipse cx={mx + mw / 2} cy={my} rx={mw / 4} ry="2.4" fill={holes} />
          <circle cx={mx - mw / 2} cy={my + 0.3} r="1.3" fill={pupils} />
          <circle cx={mx + mw / 2} cy={my + 0.3} r="1.3" fill={pupils} />
        </g>
        </g>
      )}
    </svg>
  );
}

/** The whole cast in a row: one character per model. */
export function Cast({
  size = 64,
  line,
  boil = false,
  className = "",
  scribble = false,
}: {
  size?: number;
  line?: string;
  boil?: boolean;
  className?: string;
  scribble?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-center gap-1 ${className}`} aria-hidden="true">
      {MODELS.map((model, i) => (
        <div key={model.id} className={scribble ? "scribble" : undefined} style={scribble ? { animationDelay: `${i * 70}ms` } : undefined}>
          <Character slot={model.character} size={size} line={line} boil={boil} />
        </div>
      ))}
    </div>
  );
}
