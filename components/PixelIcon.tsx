import type { GameId } from "@/lib/daily";

/**
 * 8-bit icons drawn as inline SVG pixel grids — identical on every browser
 * and OS, unlike emoji (which render from each platform's own font).
 * Game sprites are 16×16; UI sprites (check, trophy, flame…) are 12×12.
 * "." is transparent, other chars index into each sprite's color legend.
 */

export type UiIcon =
  | "check"
  | "x"
  | "trophy"
  | "flame"
  | "target"
  | "sound"
  | "muted"
  | "globe"
  | "github"
  | "instagram"
  | "xsocial"
  | "youtube"
  | "mail";

export type IconName = GameId | UiIcon;

interface IconDef {
  rows: string[];
  colors: Record<string, string>;
  /** Per-character animation classes — lets parts of a sprite move on their
      own (radio waves radiating, clock hands spinning…) when `animated`. */
  parts?: Record<string, string>;
  /** Extra grids stacked over `rows`, one per animation frame. Where `parts`
      can only move cells that are already there, layers can swap the whole
      shape — Scramble's tile flipping between letters. Static renders show
      only the first layer; stacked, they'd be an unreadable smudge. */
  layers?: { rows: string[]; className: string }[];
}

const INK = "var(--color-ink)";
const PAPER = "var(--color-paper)";
const LEMON = "var(--color-lemon)";
const CORAL = "var(--color-coral)";
const MINT = "var(--color-mint)";
const SKY = "var(--color-sky)";

// Headcount's "1 2 3" is assembled from digit stamps so the rows stay honest.
const DIGIT_1 = ["..#.", ".##.", "..#.", "..#.", "..#.", "..#.", ".###"];
const DIGIT_2 = [".##.", "#..#", "...#", "..#.", ".#..", "#...", "####"];
const DIGIT_3 = ["###.", "...#", ".##.", "...#", "...#", "#..#", ".##."];
const COUNT_ROWS = [
  ...Array(4).fill("................"),
  ...DIGIT_1.map(
    (row, i) =>
      `.${row}.${DIGIT_2[i].replace(/#/g, "o")}.${DIGIT_3[i].replace(/#/g, "x")}.`
  ),
  ...Array(5).fill("................"),
];

// Scramble's tile face cycles through letters, so each one ships as its own
// 6×7 stamp rather than being baked into the tile.
const SCRAMBLE_LETTERS: Record<string, string[]> = {
  A: [".oooo.", "o....o", "o....o", "oooooo", "o....o", "o....o", "o....o"],
  S: [".ooooo", "o.....", "o.....", ".oooo.", ".....o", ".....o", "ooooo."],
  E: ["oooooo", "o.....", "o.....", "ooooo.", "o.....", "o.....", "oooooo"],
  R: ["ooooo.", "o....o", "o....o", "ooooo.", "o..o..", "o...o.", "o....o"],
  T: ["oooooo", "..oo..", "..oo..", "..oo..", "..oo..", "..oo..", "..oo.."],
};

/** Drops a letter stamp into the tile's blank face — cols 4–9, rows 3–9. */
function letterLayer(letter: string, className: string) {
  const blank = "................";
  return {
    rows: [
      ...Array(3).fill(blank),
      ...SCRAMBLE_LETTERS[letter].map((row) => `....${row}......`),
      ...Array(6).fill(blank),
    ],
    className,
  };
}

const ICONS: Record<IconName, IconDef> = {
  // Pointing finger with a cuff
  simon: {
    rows: [
      "......##........",
      ".....#oo#.......",
      ".....#oo#.......",
      ".....#oo#.......",
      ".....#oo#.......",
      ".....#oo####....",
      ".....#oo#oo##...",
      ".....#oooooo##..",
      "...###oooooooo#.",
      "..#ooooooooooo#.",
      "..#ooooooooooo#.",
      "..#oooooooooo#..",
      "...#oooooooo#...",
      "....########....",
      "....#xxxxxx#....",
      "....########....",
    ],
    colors: { "#": INK, o: LEMON, x: CORAL },
  },
  // Radio tower with two-tone signal waves
  sequence: {
    rows: [
      ".......##.......",
      "..x....##....x..",
      ".x.....##.....x.",
      "x..o...##...o..x",
      "x..o...##...o..x",
      ".x.o...##...o.x.",
      "..x....##....x..",
      "......####......",
      ".....#o##o#.....",
      ".....#.##.#.....",
      "....#..##..#....",
      "....#..##..#....",
      "...#...##...#...",
      "...#...##...#...",
      "..#....##....#..",
      "################",
    ],
    colors: { "#": MINT, o: LEMON, x: CORAL },
    parts: { o: "px-wave-inner", x: "px-wave-outer" },
  },
  // Keyboard — keys carry three different chars so they can flash in waves
  typing: {
    rows: [
      "................",
      "................",
      "................",
      "################",
      "#..............#",
      "#.kk.ll.mm.kk..#",
      "#..............#",
      "#..ll.mm.kk....#",
      "#..............#",
      "#...xxxxxxx....#",
      "#..............#",
      "################",
      "................",
      "................",
      "................",
      "................",
    ],
    colors: { "#": SKY, k: PAPER, l: PAPER, m: PAPER, x: LEMON },
    parts: { k: "px-key1", l: "px-key2", m: "px-key3", x: "px-key2" },
  },
  // Analog clock. The two hands are separate chars ("m" long, "h" short) so
  // each can sweep at its own speed — 12 minute laps per hour lap, like the
  // real thing. Both pivot on the coral "x".
  clock: {
    rows: [
      ".....######.....",
      "...##......##...",
      "..#..........#..",
      ".#.....m......#.",
      ".#.....m......#.",
      "#......m.......#",
      "#......m.......#",
      "#......xhh.....#",
      "#..............#",
      "#..............#",
      ".#............#.",
      ".#............#.",
      "..#..........#..",
      "...##......##...",
      ".....######.....",
      "................",
    ],
    colors: { "#": LEMON, m: PAPER, h: PAPER, x: CORAL },
    parts: { m: "px-hand-minute", h: "px-hand-hour" },
  },
  // Magnifying glass with a shine
  anomaly: {
    rows: [
      "....######......",
      "...#......#.....",
      "..#........#....",
      ".#....o.....#...",
      ".#...o......#...",
      ".#..........#...",
      ".#..........#...",
      ".#..........#...",
      "..#........#....",
      "...#......#.....",
      "....######x.....",
      "..........xx....",
      "...........xx...",
      "............xx..",
      ".............xx.",
      "................",
    ],
    colors: { "#": SKY, o: PAPER, x: CORAL },
    parts: { o: "px-glint" },
  },
  // 1 2 3 — each digit is its own char so they can hop in order
  count: {
    rows: COUNT_ROWS,
    colors: { "#": CORAL, o: LEMON, x: MINT },
    parts: { "#": "px-hop1", o: "px-hop2", x: "px-hop3" },
  },
  // Puzzle piece with knobs and a bottom notch
  pattern: {
    rows: [
      "................",
      "....####........",
      "....#oo#........",
      "..###oo###......",
      "..#oooooo#......",
      "..#oooooo####...",
      "..#ooooooooo#...",
      "..#oooooooooo#..",
      "..#oooooooooo#..",
      "..#ooooooooo#...",
      "..#oooooo####...",
      "..#oooooo#......",
      "..#oo..oo#......",
      "..###..###......",
      "................",
      "................",
    ],
    colors: { "#": PAPER, o: SKY },
  },
  // A Scrabble-style letter tile. The face is drawn blank — the letter is a
  // stack of layers that swap on hover, so the tile reads as "scrambling".
  scramble: {
    rows: [
      "................",
      ".############...",
      ".#..........#...",
      ".#..........#...",
      ".#..........#...",
      ".#..........#...",
      ".#..........#...",
      ".#..........#...",
      ".#..........#...",
      ".#..........#...",
      ".#..........#...",
      ".#........xx#...",
      ".#........xx#...",
      ".############...",
      "................",
      "................",
    ],
    colors: { "#": LEMON, o: PAPER, x: CORAL },
    layers: ["A", "S", "E", "R", "T"].map((ch, i) =>
      letterLayer(ch, `px-scram-${i + 1}`)
    ),
  },
  // Pair of eyes
  blink: {
    rows: [
      "................",
      "................",
      "................",
      "................",
      ".####....####...",
      "#oooo#..#oooo#..",
      "#oppo#..#oppo#..",
      "#oppo#..#oppo#..",
      "#oooo#..#oooo#..",
      ".####....####...",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    colors: { "#": CORAL, o: PAPER, p: INK },
  },

  // ------------------------------------------------------------ UI sprites
  check: {
    rows: [
      "............",
      "..........##",
      ".........##.",
      "........##..",
      ".##....##...",
      "..##..##....",
      "...####.....",
      "....##......",
      "............",
      "............",
      "............",
      "............",
    ],
    colors: { "#": MINT },
  },
  x: {
    rows: [
      "............",
      "............",
      ".##......##.",
      "..##....##..",
      "...##..##...",
      "....####....",
      "....####....",
      "...##..##...",
      "..##....##..",
      ".##......##.",
      "............",
      "............",
    ],
    colors: { "#": CORAL },
  },
  trophy: {
    rows: [
      "..########..",
      ".#oooooooo#.",
      "h#oooooooo#h",
      "h#oooooooo#h",
      "h#oooooooo#h",
      ".h#oooooo#h.",
      "..#oooooo#..",
      "...#oooo#...",
      "....#oo#....",
      "...xxxxxx...",
      "..xxxxxxxx..",
      "..xxxxxxxx..",
    ],
    colors: { "#": LEMON, o: PAPER, h: LEMON, x: CORAL },
  },
  flame: {
    rows: [
      ".....#......",
      "....##......",
      "....###.....",
      "...#####....",
      "..######....",
      "..###o##....",
      ".###oo###...",
      ".##oooo##...",
      ".##oooo##...",
      "..#oooo#....",
      "...####.....",
      "............",
    ],
    colors: { "#": CORAL, o: LEMON },
  },
  target: {
    rows: [
      "............",
      "...######...",
      "..#......#..",
      ".#..####..#.",
      ".#.#....#.#.",
      ".#.#.oo.#.#.",
      ".#.#.oo.#.#.",
      ".#.#....#.#.",
      ".#..####..#.",
      "..#......#..",
      "...######...",
      "............",
    ],
    colors: { "#": SKY, o: CORAL },
  },
  sound: {
    rows: [
      "............",
      "............",
      ".....#......",
      "....##..o...",
      ".#####...o..",
      ".#####.o.o..",
      ".#####.o.o..",
      ".#####...o..",
      "....##..o...",
      ".....#......",
      "............",
      "............",
    ],
    colors: { "#": PAPER, o: MINT },
  },
  muted: {
    rows: [
      "............",
      "............",
      ".....#......",
      "....##......",
      ".#####.x..x.",
      ".#####..xx..",
      ".#####..xx..",
      ".#####.x..x.",
      "....##......",
      ".....#......",
      "............",
      "............",
    ],
    colors: { "#": PAPER, x: CORAL },
  },
  globe: {
    rows: [
      "............",
      "...######...",
      "..#..##..#..",
      ".#...##...#.",
      "#....##....#",
      "############",
      "#....##....#",
      ".#...##...#.",
      "..#..##..#..",
      "...######...",
      "............",
      "............",
    ],
    colors: { "#": PAPER },
  },
  // Octocat as a one-color arcade-cabinet sprite: silhouette, punched-out
  // eyes, curled tentacle.
  github: {
    rows: [
      "..##........##..",
      "..###......###..",
      "..############..",
      ".##############.",
      ".##############.",
      "################",
      "###..######..###",
      "###..######..###",
      "################",
      "################",
      ".##############.",
      "..############..",
      "...##########...",
      "......##........",
      ".....##.........",
      "......###.......",
    ],
    colors: { "#": PAPER },
  },
  instagram: {
    rows: [
      ".##########.",
      "#..........#",
      "#........o.#",
      "#...####...#",
      "#..#....#..#",
      "#..#....#..#",
      "#..#....#..#",
      "#...####...#",
      "#..........#",
      ".##########.",
      "............",
      "............",
    ],
    colors: { "#": CORAL, o: LEMON },
  },
  xsocial: {
    rows: [
      "............",
      "............",
      ".##......##.",
      "..##....##..",
      "...##..##...",
      "....####....",
      "....####....",
      "...##..##...",
      "..##....##..",
      ".##......##.",
      "............",
      "............",
    ],
    colors: { "#": PAPER },
  },
  youtube: {
    rows: [
      "............",
      "............",
      ".##########.",
      "############",
      "####o#######",
      "####ooo#####",
      "####ooo#####",
      "####o#######",
      "############",
      ".##########.",
      "............",
      "............",
    ],
    colors: { "#": CORAL, o: PAPER },
  },
  // Envelope with a lemon fold — the feedback button's sprite.
  mail: {
    rows: [
      "............",
      "............",
      "############",
      "#oo......oo#",
      "#.oo....oo.#",
      "#..oo..oo..#",
      "#...oooo...#",
      "#..........#",
      "#..........#",
      "############",
      "............",
      "............",
    ],
    colors: { "#": PAPER, o: LEMON },
  },
};

/** Cells grouped by character so each part can animate as one unit. */
function cellsByChar(rows: string[]): Record<string, { x: number; y: number }[]> {
  const cells: Record<string, { x: number; y: number }[]> = {};
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ".") (cells[ch] ??= []).push({ x, y });
    })
  );
  return cells;
}

export function PixelIcon({
  name,
  size = 40,
  className,
  animated = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  /** Attach per-part animation classes (they only run under .group:hover). */
  animated?: boolean;
}) {
  const def = ICONS[name];
  const grid = def.rows.length;
  const allLayers = def.layers ?? [];
  // Only the animated icon stacks every frame; a static one shows frame 1.
  const layers = animated ? allLayers : allLayers.slice(0, 1);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      shapeRendering="crispEdges"
      aria-hidden
      className={className}
    >
      {Object.entries(cellsByChar(def.rows)).map(([ch, pts]) => (
        <g key={ch} className={animated ? def.parts?.[ch] : undefined}>
          {pts.map((p) => (
            <rect
              key={`${p.x}-${p.y}`}
              x={p.x}
              y={p.y}
              width="1"
              height="1"
              fill={def.colors[ch]}
            />
          ))}
        </g>
      ))}
      {layers.map((layer) => (
        <g
          key={layer.className}
          className={animated ? layer.className : undefined}
        >
          {Object.entries(cellsByChar(layer.rows)).flatMap(([ch, pts]) =>
            pts.map((p) => (
              <rect
                key={`${ch}-${p.x}-${p.y}`}
                x={p.x}
                y={p.y}
                width="1"
                height="1"
                fill={def.colors[ch]}
              />
            ))
          )}
        </g>
      ))}
    </svg>
  );
}
