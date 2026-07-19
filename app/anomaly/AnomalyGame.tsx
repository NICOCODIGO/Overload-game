"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { pick, randInt, type Rng } from "@/lib/rng";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const ROUNDS = 12;
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

// Emoji crowds: [crowd, target] — visually related, not identical.
const EMOJI_PAIRS: [string, string][] = [
  ["🐶", "🐱"],
  ["🌝", "🌚"],
  ["🍎", "🍅"],
  ["⭐", "🌟"],
  ["🐨", "🐼"],
  ["🙂", "🙃"],
];

// Character crowds: [crowd, target] — the near-identical twins.
const CHAR_PAIRS: [string, string][] = [
  ["O", "Q"],
  ["E", "F"],
  ["S", "5"],
  ["Z", "2"],
  ["b", "d"],
  ["8", "B"],
];

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
  return { kind: "char", count: 150 + (i - 9) * 30, duration: 10 + (i - 9) };
}

function generateRound(rng: Rng, i: number): SearchRound {
  const { kind, count, duration } = roundPlan(i);

  // Pick what the crowd and the anomaly look like.
  let crowd: { glyph: string; color?: string }[];
  let target: { glyph: string; color?: string };
  let rotate = true;
  let mono = false;

  if (kind === "color") {
    const colorA = pick(rng, PALETTE);
    let colorB = pick(rng, PALETTE);
    while (colorB === colorA) colorB = pick(rng, PALETTE);
    crowd = [{ glyph: "●", color: colorA }];
    target = { glyph: "●", color: colorB };
    rotate = false;
  } else if (kind === "shape") {
    const [c, t] = pick(rng, EMOJI_PAIRS);
    crowd = [{ glyph: c }];
    target = { glyph: t };
  } else if (kind === "conjunction") {
    // Crowd shares the target's color OR its shape — never both.
    const colorA = pick(rng, PALETTE);
    let colorB = pick(rng, PALETTE);
    while (colorB === colorA) colorB = pick(rng, PALETTE);
    crowd = [
      { glyph: "●", color: colorA },
      { glyph: "■", color: colorB },
    ];
    target = { glyph: "■", color: colorA };
    rotate = false;
  } else {
    const [c, t] = pick(rng, CHAR_PAIRS);
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

function generateRounds(rng: Rng): SearchRound[] {
  return Array.from({ length: ROUNDS }, (_, i) => generateRound(rng, i));
}

type Phase = "intro" | "scan" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
  reveal: boolean; // ring the target after a timeout
}

export function AnomalyGame() {
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
  const lockedRef = useRef(false);
  const gapTimeoutRef = useRef(0);
  const timer = useCountdown();

  function finish(didSurvive: boolean) {
    timer.stop();
    window.clearTimeout(gapTimeoutRef.current);
    const score = resultsRef.current.filter(Boolean).length;
    const time = elapsedRef.current;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    const display = `${score}/${ROUNDS} · ${time.toFixed(1)}s`;
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
    if (!found) livesRef.current -= 1;
    setLives(livesRef.current);
    setGap({ ok: found, msg, reveal });
    setPhase("gap");
    if (found) sfx.success();
    else sfx.error();

    gapTimeoutRef.current = window.setTimeout(
      () => {
        if (livesRef.current <= 0) {
          finish(false);
        } else if (roundRef.current + 1 >= ROUNDS) {
          finish(true);
        } else {
          roundRef.current += 1;
          lockedRef.current = false;
          setRound(roundRef.current);
          setGap(null);
          beginRound();
        }
      },
      reveal ? 1200 : 700
    );
  }

  function beginRound() {
    const r = roundsRef.current[roundRef.current];
    sfx.reveal();
    setPhase("scan");
    timer.start(r.duration, () =>
      endRound(false, "FEED LOST — IT WAS RINGED", true)
    );
  }

  function handleTap(cell: Cell) {
    if (lockedRef.current || phase !== "scan") return;
    if (cell.isTarget) {
      endRound(true, "ANOMALY CONFIRMED ✓", false);
    } else {
      // Wrong tap: burn time, rattle the feed.
      sfx.error();
      setShakeKey((k) => k + 1);
      timer.shave(WRONG_TAP_PENALTY);
    }
  }

  function startRun(m: Mode) {
    const generated = generateRounds(rngFor("anomaly", m));
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
    return (
      <IntroScreen
        game="anomaly"
        title="ANOMALY"
        tagline="Anomaly detection under pressure. One doesn't belong."
        howTo={[
          "One thing in the crowd doesn't match — find it and tap it before the feed cuts out.",
          "Wrong taps burn a second. Later sectors hide near-identical twins.",
        ]}
        controlsHint="Tap the odd one out — that's it, that's the game"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        game="anomaly"
        gameName="Anomaly"
        path="/anomaly"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={`${summary.score}/${ROUNDS}`}
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("anomaly", mode)?.display ?? null}
        streak={streak}
        extraStats={[
          { label: "Scan time", value: `${summary.time.toFixed(1)}s` },
        ]}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const r = rounds[round];

  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          SECTOR {round + 1}/{ROUNDS}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "scan" ? timer.progress : 1} />

      {/* Target briefing */}
      <div className="flex items-center justify-center gap-3">
        <span className="font-display text-xs text-fog">FIND:</span>
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
        className={`${shakeKey > 0 ? "animate-shake" : ""} touch-surface relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border-2 border-line bg-panel shadow-chunk`}
        style={{ aspectRatio: "4 / 5", containerType: "inline-size" }}
      >
        {r?.cells.map((cell, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            aria-label={cell.isTarget ? "anomaly" : undefined}
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
            {cell.glyph}
          </button>
        ))}

        {/* Between-round overlay */}
        {phase === "gap" && gap && (
          <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
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

      <p className="text-center text-xs text-fog">
        scan in rows — your eyes cheat on diagonals
      </p>
    </div>
  );
}
