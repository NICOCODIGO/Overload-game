"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { GameTitle } from "@/components/GameTitle";
import { Lives } from "@/components/Lives";
import { SHAPES, ShapeGlyph, isShape } from "@/components/ShapeGlyph";
import { sfx } from "@/lib/audio";
import { UNLIMITED_LIVES } from "@/lib/dev";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { makeBag, pick, randInt, type Rng } from "@/lib/rng";
import { useT } from "@/lib/i18n";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const ROUNDS = 14;
const SURVIVAL_CAP = 120;
const LIVES = 3;
const WRONG_TAP_PENALTY = 1.0; // seconds

interface Cell {
  glyph: string;
  color?: string; // CSS color; undefined = inherit
  x: number; // percent
  y: number; // percent
  rot: number; // degrees
  scale: number;
  isTarget: boolean;
}

interface SearchRound {
  cells: Cell[];
  target: { glyph: string; color?: string };
  duration: number;
  mono: boolean; // character rounds render in the mono font
  cols: number; // grid density, used to size glyphs
}

const PALETTE = [
  "var(--color-coral)",
  "var(--color-sky)",
  "var(--color-mint)",
  "var(--color-lemon)",
];

// Emoji crowds: [crowd, target] — visually related, not identical. Kept to
// single-codepoint emoji (no skin tones, no variation selectors) so every
// platform renders the same silhouette.
const EMOJI_PAIRS: [string, string][] = [
  ["🐶", "🐱"],
  ["🌝", "🌚"],
  ["🍎", "🍅"],
  ["⭐", "🌟"],
  ["🐨", "🐼"],
  ["🙂", "🙃"],
  ["🐸", "🐢"],
  ["🍋", "🍊"],
  ["🐝", "🐞"],
  ["🚗", "🚙"],
  ["🌸", "🌺"],
  ["🐟", "🐬"],
  ["🍕", "🍔"],
  ["🎈", "🎁"],
  ["🐰", "🐭"],
  ["🌍", "🌎"],
  ["😀", "😃"],
  ["🦊", "🐺"],
  ["🍒", "🍓"],
  ["🌙", "🌛"],
  ["🐮", "🐷"],
  ["🦁", "🐯"],
  ["🐔", "🐣"],
  ["🐧", "🐦"],
  ["🦉", "🦅"],
  ["🐴", "🦓"],
  ["🐘", "🦏"],
  ["🐙", "🦑"],
  ["🦋", "🐛"],
  ["🍇", "🫐"],
  ["🍐", "🍏"],
  ["🥕", "🌶"],
  ["🥦", "🥬"],
  ["🍞", "🥐"],
  ["🍩", "🍪"],
  ["🎂", "🧁"],
  ["☕", "🍵"],
  ["🚌", "🚐"],
  ["🚲", "🛵"],
  ["✈", "🚀"],
  ["⛵", "🚤"],
  ["🏠", "🏡"],
  ["🌲", "🌳"],
  ["🌻", "🌼"],
  ["🍁", "🍂"],
  ["❄", "💧"],
  ["🔥", "💥"],
  ["⚽", "🏀"],
  ["🎸", "🎻"],
  ["🔔", "🔕"],
  ["🔑", "🔒"],
];

/**
 * Shape crowds for the colour and conjunction stages. These used to be a
 * hardcoded ● and ■, so every conjunction sector anyone ever played was the
 * same circle-and-square field with only the colours moving — which is exactly
 * what makes the game feel like it has less content than it does.
 *
 * Drawn from ShapeGlyph rather than typed, for the reason that file documents:
 * Bungee has none of these characters, so as text they fall through to whatever
 * symbol font the OS supplies and change size per platform.
 */
const SHAPE_PAIRS: [string, string][] = SHAPES.flatMap((a) =>
  SHAPES.filter((b) => b !== a).map((b) => [a, b] as [string, string])
);

// Character crowds: [crowd, target] — the near-identical twins. Every pair has
// to stay two *distinct* glyphs in a mono font; 0/O and 1/l are excluded
// because some monospace faces render them near-identically, which would make
// the round unwinnable rather than hard.
const CHAR_PAIRS: [string, string][] = [
  ["O", "Q"],
  ["E", "F"],
  ["S", "5"],
  ["Z", "2"],
  ["b", "d"],
  ["8", "B"],
  ["p", "q"],
  ["C", "G"],
  ["U", "V"],
  ["M", "W"],
  ["h", "n"],
  ["i", "j"],
  ["c", "e"],
  ["P", "R"],
  ["K", "X"],
  ["a", "o"],
  ["t", "f"],
  ["V", "Y"],
  ["3", "8"],
  ["u", "v"],
  ["m", "n"],
  ["r", "n"],
  ["g", "q"],
  ["y", "v"],
  ["J", "j"],
  ["D", "O"],
  ["Q", "G"],
  ["N", "M"],
  ["T", "Y"],
  ["A", "R"],
  ["H", "N"],
  ["6", "9"],
  ["9", "g"],
  ["4", "A"],
  ["7", "T"],
  ["2", "7"],
  ["5", "6"],
  ["k", "x"],
  ["w", "v"],
  ["z", "s"],
];

/** Ordered crowd/target color pairs — 12 of them, so a 3-round color stage
    never draws the same combination twice. */
const COLOR_PAIRS: [string, string][] = PALETTE.flatMap((a) =>
  PALETTE.filter((b) => b !== a).map((b) => [a, b] as [string, string])
);

/** Sector plan: color pop → emoji odd-one-out → conjunction → character twins. */
function roundPlan(i: number): {
  kind: "color" | "shape" | "conjunction" | "char";
  count: number;
  duration: number;
} {
  if (i < 3) return { kind: "color", count: 50 + i * 20, duration: 5 + i * 0.5 };
  if (i < 6) return { kind: "shape", count: 100 + (i - 3) * 20, duration: 7 + (i - 3) * 0.5 };
  if (i < 9)
    return { kind: "conjunction", count: 140 + (i - 6) * 25, duration: 9 + (i - 6) * 0.5 };
  // Char twins to the finish — denser every sector and, unlike before, with
  // *less* time each round, so the final sectors are the cruelest.
  if (i < 14)
    return { kind: "char", count: 150 + (i - 9) * 30, duration: 11 - (i - 9) * 0.5 };
  // Survival past the daily: the two hardest kinds (conjunction & char)
  // alternate, density creeps toward a cap, time grinds down to a floor.
  const laps = i - 14;
  return {
    kind: laps % 2 === 0 ? "char" : "conjunction",
    count: Math.min(300, 250 + laps * 4),
    duration: Math.max(5.5, 10 - laps * 0.4),
  };
}

/** Run-scoped decks: every stage draws its look without repeating itself. */
interface LookBags {
  color: () => [string, string];
  conjunction: () => [string, string];
  shape: () => [string, string];
  emoji: () => [string, string];
  chars: () => [string, string];
}

function generateRound(rng: Rng, i: number, bags: LookBags): SearchRound {
  const { kind, count, duration } = roundPlan(i);

  // What the crowd and the anomaly look like, drawn without replacement.
  let crowd: { glyph: string; color?: string }[];
  let target: { glyph: string; color?: string };
  let rotate = true;
  let mono = false;

  if (kind === "color") {
    const [colorA, colorB] = bags.color();
    // The shape is irrelevant to the question — it only has to be the SAME
    // for crowd and target, so colour is the only difference. Drawing it
    // anyway means three colour sectors don't all look like the same field.
    const shape = bags.shape()[0];
    crowd = [{ glyph: shape, color: colorA }];
    target = { glyph: shape, color: colorB };
    rotate = false;
  } else if (kind === "shape") {
    const [c, t] = bags.emoji();
    crowd = [{ glyph: c }];
    target = { glyph: t };
  } else if (kind === "conjunction") {
    // Crowd shares the target's color OR its shape — never both.
    const [colorA, colorB] = bags.conjunction();
    const [shapeA, shapeB] = bags.shape();
    crowd = [
      { glyph: shapeA, color: colorA },
      { glyph: shapeB, color: colorB },
    ];
    target = { glyph: shapeB, color: colorA };
    rotate = false;
  } else {
    const [c, t] = bags.chars();
    crowd = [{ glyph: c, color: "var(--color-paper)" }];
    target = { glyph: t, color: "var(--color-paper)" };
    rotate = false; // rotated letters would make twins ambiguous
    mono = true;
  }

  // Jittered grid keeps the field dense without heavy overlap.
  const cols = Math.ceil(Math.sqrt(count * 0.8));
  const rows = Math.ceil(count / cols);
  const targetIndex = randInt(rng, 0, count - 1);
  const cells: Cell[] = Array.from({ length: count }, (_, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const isTarget = idx === targetIndex;
    const look = isTarget ? target : pick(rng, crowd);
    return {
      glyph: look.glyph,
      color: look.color,
      x: Math.min(97, Math.max(3, ((col + 0.5 + (rng() - 0.5) * 0.55) / cols) * 100)),
      y: Math.min(97, Math.max(3, ((row + 0.5 + (rng() - 0.5) * 0.55) / rows) * 100)),
      rot: rotate ? (rng() - 0.5) * 40 : 0,
      scale: 0.85 + rng() * 0.3,
      isTarget,
    };
  });

  return { cells, target, duration, mono, cols };
}

function generateRounds(rng: Rng, total: number): SearchRound[] {
  const bags: LookBags = {
    color: makeBag(rng, COLOR_PAIRS),
    conjunction: makeBag(rng, COLOR_PAIRS),
    shape: makeBag(rng, SHAPE_PAIRS),
    emoji: makeBag(rng, EMOJI_PAIRS),
    chars: makeBag(rng, CHAR_PAIRS),
  };
  // The bags alone are enough here: each stage draws its crowd/target pair
  // from its own deck, so a sector can't repeat until that deck is spent.
  // A reject-and-retry pass on top would rebuild a 300-glyph field per
  // attempt — ~100ms of stutter on an unlimited run for no extra freshness.
  return Array.from({ length: total }, (_, i) => generateRound(rng, i, bags));
}

type Phase = "intro" | "scan" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
  reveal: boolean; // ring the target after a timeout
}

export function AnomalyGame() {
  const t = useT();
  const g = t.games.anomaly;
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [gap, setGap] = useState<Gap | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [rounds, setRounds] = useState<SearchRound[]>([]);
  const [summary, setSummary] = useState<{
    score: number;
    emojis: string[];
    time: number;
  }>({ score: 0, emojis: [], time: 0 });

  // Game logic runs off refs so timer callbacks never read stale data.
  const roundsRef = useRef<SearchRound[]>([]);
  const roundRef = useRef(0);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const elapsedRef = useRef(0);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(ROUNDS);
  const lockedRef = useRef(false);
  const gapTimeoutRef = useRef(0);
  const timer = useCountdown();

  /** Score line, in the player's language. Derived from the raw score every
      render, so a record set in English reads correctly in Spanish. */
  const fmt = (score: number, m: Mode) =>
    m === "daily" ? `${score}/${ROUNDS}` : g.unit(score);

  function finish(didSurvive: boolean) {
    timer.stop();
    window.clearTimeout(gapTimeoutRef.current);
    const score = resultsRef.current.filter(Boolean).length;
    const time = elapsedRef.current;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    // Time still breaks ties internally, but the shown score stays clean.
    const display = fmt(score, modeRef.current);
    const isBest = submitBest("anomaly", modeRef.current, {
      score,
      tiebreak: time,
      display,
    });
    if (modeRef.current === "daily") {
      setDailyResult("anomaly", dailyNumber(), {
        display,
        emojis: emojis.join(""),
      });
      setStreak(bumpStreak());
    }
    setSummary({ score, emojis, time });
    setNewBest(isBest);
    setSurvived(didSurvive);
    setPhase("result");
    if (didSurvive) sfx.fanfare();
    else sfx.gameOver();
  }

  function endRound(found: boolean, msg: string, reveal: boolean) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    // Scan time = round budget minus what was left (penalties included).
    const budget = roundsRef.current[roundRef.current].duration;
    elapsedRef.current += Math.max(0, budget - timer.remaining());
    timer.stop();
    resultsRef.current.push(found);
    if (!found && !UNLIMITED_LIVES) livesRef.current -= 1;
    setLives(livesRef.current);
    setGap({ ok: found, msg, reveal });
    setPhase("gap");
    if (found) sfx.success();
    else sfx.error();

    gapTimeoutRef.current = window.setTimeout(
      () => {
        if (livesRef.current <= 0) {
          finish(false);
        } else if (roundRef.current + 1 >= totalRef.current) {
          finish(true);
        } else {
          roundRef.current += 1;
          lockedRef.current = false;
          setRound(roundRef.current);
          setGap(null);
          beginRound();
        }
      },
      // A reveal is only worth showing if there's time to actually spot the
      // ring in a field of 200 glyphs.
      reveal ? 1600 : 700
    );
  }

  function beginRound() {
    const r = roundsRef.current[roundRef.current];
    sfx.reveal();
    setPhase("scan");
    timer.start(r.duration, () => endRound(false, t.fb.failed, true));
  }

  function handleTap(cell: Cell) {
    if (lockedRef.current || phase !== "scan") return;
    if (cell.isTarget) {
      endRound(true, t.fb.anomalyFound, false);
    } else {
      // Wrong tap: burn time, rattle the feed.
      sfx.error();
      setShakeKey((k) => k + 1);
      timer.shave(WRONG_TAP_PENALTY);
    }
  }

  function startRun(m: Mode) {
    totalRef.current = m === "daily" ? ROUNDS : SURVIVAL_CAP;
    const generated = generateRounds(rngFor("anomaly", m), totalRef.current);
    roundsRef.current = generated;
    setRounds(generated);
    resultsRef.current = [];
    livesRef.current = LIVES;
    roundRef.current = 0;
    elapsedRef.current = 0;
    lockedRef.current = false;
    modeRef.current = m;
    setMode(m);
    setLives(LIVES);
    setRound(0);
    setGap(null);
    setNewBest(false);
    setSurvived(false);
    beginRound();
  }

  // Clean up the gap timeout if the player navigates away mid-run.
  useEffect(() => () => window.clearTimeout(gapTimeoutRef.current), []);

  if (phase === "intro") {
    return <IntroScreen game="anomaly" format={fmt} onStart={startRun} />;
  }

  if (phase === "result") {
    const best = getBest("anomaly", mode);
    return (
      <ResultScreen
        game="anomaly"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={fmt(summary.score, mode)}
        bestDisplay={best ? fmt(best.score, mode) : null}
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        streak={streak}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const r = rounds[round];
  // Park the banner in whichever half of the field the anomaly isn't in.
  const targetY = r?.cells.find((c) => c.isTarget)?.y ?? 50;
  const bannerSpot = !gap?.reveal
    ? "top-1/2 -translate-y-1/2"
    : targetY > 50
      ? "top-3"
      : "bottom-3";

  return (
    <div className="flex flex-1 flex-col gap-2 py-2 sm:gap-3 sm:py-4">
      <GameTitle game="anomaly" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          {g.counter} {round + 1}
          {mode === "daily" ? `/${ROUNDS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "scan" ? timer.progress : 1} />

      {/* Target briefing */}
      <div className="flex items-center justify-center gap-3">
        <span className="font-display text-xs text-fog">{t.play.find}</span>
        <span
          className={`rounded-lg border-2 border-lemon bg-panel px-3 py-1 text-2xl leading-none ${
            r?.mono ? "font-mono" : ""
          }`}
          style={{ color: r?.target.color }}
        >
          {r?.target.glyph}
        </span>
      </div>

      {/* The field */}
      <div
        key={shakeKey}
        className={`${shakeKey > 0 ? "animate-shake" : ""} touch-surface relative mx-auto max-h-[48dvh] w-full max-w-sm overflow-hidden rounded-2xl border-2 border-line bg-panel shadow-chunk sm:max-h-none`}
        style={{ aspectRatio: "4 / 5", containerType: "inline-size" }}
      >
        {r?.cells.map((cell, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            aria-label={cell.isTarget ? t.a11y.theAnomaly : undefined}
            onPointerDown={() => handleTap(cell)}
            className={`absolute select-none leading-none ${
              r.mono ? "font-mono font-bold" : ""
            } ${
              gap?.reveal && cell.isTarget
                ? "z-10 rounded-full ring-4 ring-coral"
                : ""
            }`}
            style={{
              left: `${cell.x}%`,
              top: `${cell.y}%`,
              transform: `translate(-50%, -50%) rotate(${cell.rot}deg) scale(${cell.scale})`,
              fontSize: `${(82 / r.cols).toFixed(2)}cqw`,
              color: cell.color,
              padding: "0.12em",
              // The anomaly's hit area must win when glyphs overlap.
              zIndex: cell.isTarget ? 1 : 0,
            }}
          >
            {isShape(cell.glyph) ? (
              <ShapeGlyph shape={cell.glyph} />
            ) : (
              cell.glyph
            )}
          </button>
        ))}

        {/* Between-round overlay. On a reveal it gets out of the way of the
            ring — there's no point pointing at the anomaly and then standing
            in front of it. */}
        {phase === "gap" && gap && (
          <div
            className={`absolute inset-x-0 z-20 flex justify-center ${bannerSpot}`}
          >
            <p
              className={`animate-pop rounded-xl border-2 px-4 py-2 font-display text-lg backdrop-blur ${
                gap.ok
                  ? "border-mint bg-ink/80 text-mint"
                  : "border-coral bg-ink/80 text-coral"
              }`}
            >
              {gap.msg}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
