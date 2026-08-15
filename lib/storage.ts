import type { GameId, Mode } from "./daily";
import { dailyNumber, todayUTC } from "./daily";
import { GAME_ORDER } from "./games";

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
  /** How many times this daily has been finished. Owned by `setDailyResult` —
      callers pass the run, not the count. Absent on records written before the
      field existed; those are read as one prior attempt, never as a first try,
      so a stale record can't hand out an unearned celebration. */
  attempts?: number;
}

export function getDailyResult(game: GameId, day: number): DailyResult | null {
  return get<DailyResult | null>(`daily:${game}:${day}`, null);
}

export function setDailyResult(
  game: GameId,
  day: number,
  result: Omit<DailyResult, "attempts">
) {
  const prev = getDailyResult(game, day);
  const before = prev ? (prev.attempts ?? 1) : 0;
  set(`daily:${game}:${day}`, { ...result, attempts: before + 1 });
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

/** True once every game's daily has been played for the given day. */
function allDailiesDone(day: number): boolean {
  return GAME_ORDER.every((g) => getDailyResult(g, day) !== null);
}

/**
 * Call when a daily challenge is completed. Only actually advances the streak
 * once every game's daily has been played that day — one game a day used to
 * be enough, which let a streak run forever on a single favorite. Returns the
 * current streak either way.
 */
export function bumpStreak(): number {
  if (!allDailiesDone(dailyNumber())) return getStreak();
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

