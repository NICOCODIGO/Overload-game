import type { GameId } from "./daily";

/**
 * The one place a game is named. Titles and share names stay English in every
 * language — they're the arcade's brand names, not sentences. Everything a
 * game *says* lives in i18n.ts.
 */
export interface GameMeta {
  /** Big arcade-cabinet title, all caps. */
  title: string;
  /** Sentence-case name for share text. */
  name: string;
  path: string;
  /** Tailwind text color class for the menu card's title. */
  accent: string;
}

export const GAMES: Record<GameId, GameMeta> = {
  simon: { title: "SIMON SAYS", name: "Simon Says", path: "/simon", accent: "text-coral" },
  sequence: { title: "SIGNAL RUSH", name: "Signal Rush", path: "/sequence", accent: "text-mint" },
  typing: { title: "PANIC TYPE", name: "Panic Type", path: "/typing", accent: "text-sky" },
  clock: { title: "OVERCLOCKED", name: "Overclocked", path: "/clock", accent: "text-lemon" },
  anomaly: { title: "ANOMALY", name: "Anomaly", path: "/anomaly", accent: "text-coral" },
  count: { title: "HEADCOUNT", name: "Headcount", path: "/count", accent: "text-mint" },
  pattern: { title: "NEXT!", name: "Next!", path: "/pattern", accent: "text-sky" },
  scramble: { title: "SCRAMBLE", name: "Scramble", path: "/scramble", accent: "text-lemon" },
  blink: { title: "BLINK", name: "Blink", path: "/blink", accent: "text-coral" },
};

/** Menu order — the difficulty/variety curve of the arcade floor. */
export const GAME_ORDER: GameId[] = [
  "simon",
  "sequence",
  "typing",
  "clock",
  "anomaly",
  "count",
  "pattern",
  "scramble",
  "blink",
];
