import type { GameId, Mode } from "./daily";
import { todayUTC } from "./daily";

/**
 * Client-side persistence, namespaced under `overload:`.
 *
 * Everything routes through get/set so a future backend (accounts,
 * leaderboards) only needs to swap this module's internals — game code never
 * touches localStorage directly.
 */

function get<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`overload:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`overload:${key}`, JSON.stringify(value));
  } catch {
    // Storage full or blocked — play on without persistence.
  }
}

// ---------------------------------------------------------------- best scores

export interface BestScore {
  /** Primary score — higher is better. */
  score: number;
  /** Secondary tiebreak (e.g. total seconds) — lower is better. */
  tiebreak?: number;
  /** Preformatted display string, e.g. "Level 9 · 41.2s". */
  display: string;
  date: string;
}

export function getBest(game: GameId, mode: Mode): BestScore | null {
  const best = get<BestScore | null>(`best:${game}:${mode}`, null);
  if (!best) return null;
  // A daily best is *today's* best. Every day is a different puzzle, so an
  // all-time daily record compares scores on puzzles that never coexisted —
  // and an easy day's 20/20 would sit there unbeatable forever. Unlimited
  // keeps its lifetime record; chasing one is the whole point of that mode.
  if (mode === "daily" && best.date !== todayUTC()) return null;
  // Strip any legacy tiebreak suffix ("Level 15 · 48.8s" → "Level 15") so
  // bests stored before the metric was dropped still display cleanly.
  return { ...best, display: best.display.split(" · ")[0] };
}

/**
 * Records a result. Returns true only when it *beats* an existing best — a
 * genuine "new personal best" worth celebrating. Your very first score has
 * nothing to beat, so it saves as the record but returns false (no fanfare —
 * you can't break a record you just set).
 */
export function submitBest(
  game: GameId,
  mode: Mode,
  entry: Omit<BestScore, "date">
): boolean {
  const prev = getBest(game, mode);
  const beatsPrev =
    !!prev &&
    (entry.score > prev.score ||
      (entry.score === prev.score &&
        entry.tiebreak !== undefined &&
        prev.tiebreak !== undefined &&
        entry.tiebreak < prev.tiebreak));
  // Save the first score (it becomes the record) and any improvement on it.
  if (!prev || beatsPrev) set(`best:${game}:${mode}`, { ...entry, date: todayUTC() });
  return beatsPrev;
}

// -------------------------------------------------------------- daily results

export interface DailyResult {
  display: string;
  emojis: string;
}

export function getDailyResult(game: GameId, day: number): DailyResult | null {
  return get<DailyResult | null>(`daily:${game}:${day}`, null);
}

export function setDailyResult(game: GameId, day: number, result: DailyResult) {
  set(`daily:${game}:${day}`, result);
}

// -------------------------------------------------------------------- streaks

interface StreakState {
  last: string; // YYYY-MM-DD (UTC) of last daily completion
  count: number;
}

export function getStreak(): number {
  const s = get<StreakState | null>("streak", null);
  if (!s) return 0;
  const today = todayUTC();
  const yesterday = new Date(Date.parse(today) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  // A streak survives until a full UTC day passes without a daily completion.
  return s.last === today || s.last === yesterday ? s.count : 0;
}

/** Call when any daily challenge is completed. Returns the current streak. */
export function bumpStreak(): number {
  const today = todayUTC();
  const s = get<StreakState | null>("streak", null);
  if (s?.last === today) return s.count;
  const count = getStreak() + 1;
  set("streak", { last: today, count });
  return count;
}

// ----------------------------------------------------------------------- mute

export function getMuted(): boolean {
  return get("muted", false);
}

export function setMuted(muted: boolean): void {
  set("muted", muted);
}
