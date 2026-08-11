/**
 * The shapes, drawn instead of typed.
 *
 * They used to be the Unicode characters ● ■ ▲ ★ ◆ set in `font-display`.
 * Two problems with that, and Headcount's "COUNT THE TINY ONES" round tripped
 * over both:
 *
 * 1. A font's idea of how big each of those characters should be is wildly
 *    inconsistent. Measured in the shipped build, at one identical font-size,
 *    ◆ inked ~0.46em across while ▲ inked ~0.95em — so a *tiny* triangle
 *    (0.95 × 0.5) came out 0.47em, pixel-for-pixel the same size as a *normal*
 *    diamond. The size classes the round is asking about did not survive
 *    contact with the glyph metrics.
 * 2. Bungee has none of these characters, so every one of them was rendered by
 *    whatever the OS handed back — Apple Symbols here, Segoe UI Symbol on
 *    Windows, Noto elsewhere. Different metrics per platform, so no table of
 *    per-character correction factors could have been right everywhere.
 *
 * Drawing them fixes the size question for good: every shape is authored in the
 * same 100×100 box, so 1em means the same thing for all five on every device.
 *
 * Sizes are normalized between equal-AREA and equal-BOX. Neither alone works:
 * equal-box leaves a star looking far lighter than a square, equal-area makes
 * the pointy shapes sprawl so wide they read as the bigger ones. The blend was
 * tuned against a rendered side-by-side (all five at one size class) until no
 * shape stood out — the pointed shapes ended up nearer their box target than
 * their area one, i.e. the eye weights outline extent more than fill here.
 * Final spread: box 0.66em…0.79em, area 2530…4301 square units.
 */

/** The shape keys. Still the characters themselves: they're the id everywhere
    else — i18n's shape names, round de-duplication keys, the games' pools.
    Since nothing renders these as text any more, a key only has to be unique;
    whether the running device owns a font for it stopped mattering. */
export const SHAPES = ["●", "■", "▲", "★", "◆", "⬢", "✚"] as const;

export type ShapeKey = (typeof SHAPES)[number];

export function isShape(glyph: string): glyph is ShapeKey {
  return (SHAPES as readonly string[]).includes(glyph);
}

/**
 * Half the drawn extent of each shape, as a fraction of 1em, with slack for the
 * per-item wobble. Scattering code needs this to keep a shape off the walls of
 * a clipping field — a flat guess overhangs the wide shapes and wastes the
 * field on the narrow ones.
 */
export const SHAPE_HALF: Record<ShapeKey, { w: number; h: number }> = {
  "●": { w: 0.375, h: 0.375 },
  "■": { w: 0.35, h: 0.35 },
  "▲": { w: 0.415, h: 0.37 },
  "★": { w: 0.415, h: 0.395 },
  "◆": { w: 0.415, h: 0.415 },
  "⬢": { w: 0.36, h: 0.41 },
  "✚": { w: 0.41, h: 0.41 },
};

/** Star: outer radius 41.5, inner 20.75, point up, box-centered (which is why
    the polygon's own center sits at y=53.97 — a star's points and its valleys
    are not symmetric about its middle, so centering the ring would hang it
    low). */
const STAR_POINTS =
  "50,12.47 62.20,37.18 89.47,41.15 69.73,60.38 74.39,87.54 " +
  "50,74.72 25.61,87.54 30.27,60.38 10.53,41.15 37.80,37.18";

const PATHS: Record<ShapeKey, React.ReactNode> = {
  // d=71 → area 3959
  "●": <circle cx="50" cy="50" r="35.5" />,
  // 66×66, lightly rounded to sit with the game's chunky borders → area ~4301
  "■": <rect x="17" y="17" width="66" height="66" rx="8" />,
  // 79 wide × 70 tall → area 2765
  "▲": <polygon points="50,15 89.5,85 10.5,85" />,
  // 78.9 wide × 75.1 tall → area 2530
  "★": <polygon points={STAR_POINTS} />,
  // diagonals 79 × 79 → area 3120
  "◆": <polygon points="50,10.5 89.5,50 50,89.5 10.5,50" />,
  // Pointy-top regular hexagon, circumradius 39 → 67.5 wide × 78 tall,
  // area 3951. Reads clearly apart from ● at a glance because the flats catch
  // the eye where a circle has none.
  "⬢": (
    <polygon points="50,11 16.23,30.5 16.23,69.5 50,89 83.77,69.5 83.77,30.5" />
  ),
  // 78 × 78 with 28-wide arms → area 3584. The only shape here with a concave
  // outline, which is what keeps it unmistakable at the tiny size class.
  "✚": (
    <polygon points="36,11 64,11 64,36 89,36 89,64 64,64 64,89 36,89 36,64 11,64 11,36 36,36" />
  ),
};

/**
 * One shape, 1em square, inked in the inherited text color — so it drops into
 * any place a character used to go and follows the same `fontSize` and `color`.
 */
export function ShapeGlyph({ shape }: { shape: ShapeKey }) {
  return (
    <svg
      // Block, not inline: an inline SVG sits on the text baseline and carries
      // descender space below it, which would throw off every centering
      // translate the callers do.
      className="block h-[1em] w-[1em]"
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden
    >
      {PATHS[shape]}
    </svg>
  );
}
