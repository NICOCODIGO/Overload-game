import { rngFromString, type Rng } from "./rng";

/**
 * Daily challenge plumbing. All dates are UTC so the whole world flips to the
 * next puzzle at the same moment, Wordle-style.
 */

/** Day 1 of Overload. Daily #N = days since this date + 1. */
const EPOCH_UTC = Date.UTC(2026, 7, 15); // 2026-08-15

const MS_PER_DAY = 86_400_000;

export type GameId =
  | "simon"
  | "sequence"
  | "typing"
  | "clock"
  | "anomaly"
  | "count"
  | "pattern"
  | "scramble"
  | "blink";

export type Mode = "daily" | "survival";

/** Today's date as YYYY-MM-DD in UTC. */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The current daily challenge number (#1 on launch day). */
export function dailyNumber(): number {
  const now = Date.now();
  return Math.max(1, Math.floor((now - EPOCH_UTC) / MS_PER_DAY) + 1);
}

/**
 * Seeded RNG for a game's daily challenge. Identical for every player on the
 * same UTC date.
 */
export function dailyRng(game: GameId): Rng {
  return rngFromString(`overload:${game}:${todayUTC()}`);
}

/** Seeded RNG for survival mode — different every run. */
export function survivalRng(game: GameId): Rng {
  return rngFromString(`overload:${game}:survival:${Date.now()}:${Math.random()}`);
}

export function rngFor(game: GameId, mode: Mode): Rng {
  return mode === "daily" ? dailyRng(game) : survivalRng(game);
}

/**
 * Speed ramp helper: linearly interpolates from `start` to `min` across
 * `totalRounds`, clamped at `min`. Round is 0-indexed.
 */
export function ramp(
  start: number,
  min: number,
  round: number,
  totalRounds: number
): number {
  if (totalRounds <= 1) return min;
  const t = Math.min(1, round / (totalRounds - 1));
  return Math.max(min, start + (min - start) * t);
}
