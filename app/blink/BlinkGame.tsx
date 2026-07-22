"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { GameTitle } from "@/components/GameTitle";
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

const ROUNDS = 10;
const SURVIVAL_CAP = 99;
const LIVES = 3;
const WRONG_TAP_PENALTY = 1.5; // seconds

const COLORS = [
  "var(--color-coral)",
  "var(--color-mint)",
  "var(--color-lemon)",
  "var(--color-sky)",
  "var(--color-paper)",
] as const;

// Late rounds swap between near-neighbor hues — brutal to spot mid-flicker.
const SUBTLE_COLOR_PAIR: Record<number, number> = { 0: 2, 2: 0, 1: 3, 3: 1 };

const SHAPES = ["●", "■", "▲", "★", "◆"] as const;

// Similar-silhouette swaps for glyph-change rounds.
const GLYPH_PAIR: Record<string, string> = {
  "■": "◆",
  "◆": "■",
  "▲": "★",
  "★": "▲",
  "●": "■",
};

type ChangeKind = "color" | "glyph" | "size" | "subtleColor";

interface BlinkItem {
  glyph: string;
  colorIdx: number;
  x: number; // percent
  y: number; // percent
}

interface BlinkRound {
  items: BlinkItem[];
  changedIdx: number;
  change: ChangeKind;
  altGlyph: string;
  altColorIdx: number;
  altBig: boolean;
  duration: number;
  cols: number;
}

/** Escalation: loud recolors → silhouette swaps → size creep → subtle hues. */
function roundPlan(i: number): { change: ChangeKind; count: number; duration: number } {
  const counts = [12, 14, 16, 16, 18, 20, 22, 24, 26, 28];
  const durations = [10, 10, 11, 11, 12, 12, 13, 13, 14, 14];
  if (i < counts.length) {
    const change: ChangeKind =
      i < 3 ? "color" : i < 6 ? "glyph" : i < 8 ? "size" : "subtleColor";
    return { change, count: counts[i], duration: durations[i] };
  }
  // Survival past the daily's 10: the two subtlest changes (glyph swap &
  // near-neighbor hue) alternate, mob toward a cap, time toward a floor.
  const laps = i - counts.length;
  return {
    change: laps % 2 === 0 ? "subtleColor" : "glyph",
    count: Math.min(40, 28 + laps),
    duration: Math.max(7, 14 - laps * 0.3),
  };
}

function generateRound(rng: Rng, i: number): BlinkRound {
  const plan = roundPlan(i);
  const cols = Math.ceil(Math.sqrt(plan.count * (4 / 3)));
  const rows = Math.ceil(plan.count / cols);
  const items: BlinkItem[] = Array.from({ length: plan.count }, (_, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      glyph: pick(rng, SHAPES),
      colorIdx:
        plan.change === "subtleColor"
          ? randInt(rng, 0, 3) // keep to hues that have a subtle partner
          : randInt(rng, 0, COLORS.length - 1),
      x: Math.min(94, Math.max(6, ((col + 0.5 + (rng() - 0.5) * 0.5) / cols) * 100)),
      y: Math.min(92, Math.max(8, ((row + 0.5 + (rng() - 0.5) * 0.5) / rows) * 100)),
    };
  });

  const changedIdx = randInt(rng, 0, plan.count - 1);
  const target = items[changedIdx];
  let altGlyph = target.glyph;
  let altColorIdx = target.colorIdx;
  let altBig = false;
  if (plan.change === "color") {
    const shift = randInt(rng, 1, COLORS.length - 1);
    altColorIdx = (target.colorIdx + shift) % COLORS.length;
  } else if (plan.change === "glyph") {
    altGlyph = GLYPH_PAIR[target.glyph];
  } else if (plan.change === "size") {
    altBig = true;
  } else {
    altColorIdx = SUBTLE_COLOR_PAIR[target.colorIdx];
  }

  return {
    items,
    changedIdx,
    change: plan.change,
    altGlyph,
    altColorIdx,
    altBig,
    duration: plan.duration,
    cols,
  };
}

function generateRounds(rng: Rng, total: number): BlinkRound[] {
  return Array.from({ length: total }, (_, i) => generateRound(rng, i));
}

// Flicker rhythm: frame, blank, altered frame, blank, repeat.
type Frame = "a" | "blank1" | "b" | "blank2";
const FRAME_MS: Record<Frame, number> = { a: 750, blank1: 230, b: 750, blank2: 230 };
const NEXT_FRAME: Record<Frame, Frame> = {
  a: "blank1",
  blank1: "b",
  b: "blank2",
  blank2: "a",
};

type Phase = "intro" | "scan" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
  reveal: boolean;
}

export function BlinkGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [gap, setGap] = useState<Gap | null>(null);
  const [frame, setFrame] = useState<Frame>("a");
  const [shakeKey, setShakeKey] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [rounds, setRounds] = useState<BlinkRound[]>([]);
  const [summary, setSummary] = useState<{
    score: number;
    emojis: string[];
    time: number;
  }>({ score: 0, emojis: [], time: 0 });

  // Game logic runs off refs so timer callbacks never read stale data.
  const roundsRef = useRef<BlinkRound[]>([]);
  const roundRef = useRef(0);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const elapsedRef = useRef(0);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(ROUNDS);
  const lockedRef = useRef(false);
  const phaseRef = useRef<Phase>("intro");
  const gapTimeoutRef = useRef(0);
  const timer = useCountdown();

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function finish(didSurvive: boolean) {
    timer.stop();
    window.clearTimeout(gapTimeoutRef.current);
    const score = resultsRef.current.filter(Boolean).length;
    const time = elapsedRef.current;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    // Time still breaks ties internally, but the shown score stays clean.
    const display =
      modeRef.current === "daily" ? `${score}/${ROUNDS}` : `${score} spotted`;
    const isBest = submitBest("blink", modeRef.current, {
      score,
      tiebreak: time,
      display,
    });
    if (modeRef.current === "daily") {
      setDailyResult("blink", dailyNumber(), {
        display,
        emojis: emojis.join(""),
      });
      setStreak(bumpStreak());
    }
    setSummary({ score, emojis, time });
    setNewBest(isBest);
    setSurvived(didSurvive);
    setPhaseSafe("result");
    if (didSurvive) sfx.fanfare();
    else sfx.gameOver();
  }

  function endRound(found: boolean, msg: string, reveal: boolean) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const budget = roundsRef.current[roundRef.current].duration;
    elapsedRef.current += Math.max(0, budget - timer.remaining());
    timer.stop();
    resultsRef.current.push(found);
    if (!found) livesRef.current -= 1;
    setLives(livesRef.current);
    setGap({ ok: found, msg, reveal });
    setPhaseSafe("gap");
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
      reveal ? 1400 : 700
    );
  }

  function beginRound() {
    const r = roundsRef.current[roundRef.current];
    sfx.reveal();
    setFrame("a");
    setPhaseSafe("scan");
    timer.start(r.duration, () =>
      endRound(false, "MISSED IT — RINGED", true)
    );
  }

  function handleTap(idx: number) {
    if (lockedRef.current || phaseRef.current !== "scan") return;
    const r = roundsRef.current[roundRef.current];
    if (idx === r.changedIdx) {
      endRound(true, "GOT IT ✓", false);
    } else {
      sfx.error();
      setShakeKey((k) => k + 1);
      timer.shave(WRONG_TAP_PENALTY);
    }
  }

  function startRun(m: Mode) {
    totalRef.current = m === "daily" ? ROUNDS : SURVIVAL_CAP;
    const generated = generateRounds(rngFor("blink", m), totalRef.current);
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

  // The flicker loop: A → blank → B → blank. Timeout-driven so the first
  // frame is set by beginRound and only transitions happen here.
  useEffect(() => {
    if (phase !== "scan") return;
    let cur: Frame = "a";
    let t = window.setTimeout(function tick() {
      cur = NEXT_FRAME[cur];
      setFrame(cur);
      t = window.setTimeout(tick, FRAME_MS[cur]);
    }, FRAME_MS[cur]);
    return () => window.clearTimeout(t);
  }, [phase, round]);

  // Clean up the gap timeout if the player navigates away mid-run.
  useEffect(() => () => window.clearTimeout(gapTimeoutRef.current), []);

  if (phase === "intro") {
    return (
      <IntroScreen
        game="blink"
        title="BLINK"
        tagline="Something changed. You almost saw it."
        howTo={[
          "The scene flashes, blinks, and flashes again — one thing is different between flashes. Tap it.",
          "Wrong taps burn time. Colors change loudly at first, then the changes get sneakier.",
        ]}
        controlsHint="Tap the thing that changes — on either flash"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        game="blink"
        gameName="Blink"
        path="/blink"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={
          mode === "daily" ? `${summary.score}/${ROUNDS}` : `${summary.score} spotted`
        }
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("blink", mode)?.display ?? null}
        streak={streak}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const r = rounds[round];
  const blank = phase === "scan" && (frame === "blank1" || frame === "blank2");
  const altered = phase === "scan" ? frame === "b" : true; // gap shows frame B

  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      <GameTitle game="blink" title="BLINK" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          SCENE {round + 1}
          {mode === "daily" ? `/${ROUNDS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "scan" ? timer.progress : 1} />

      {/* The flickering scene */}
      <div
        key={shakeKey}
        className={`${shakeKey > 0 ? "animate-shake" : ""} touch-surface relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border-2 border-line bg-panel shadow-chunk`}
        style={{ aspectRatio: "4 / 3", containerType: "inline-size" }}
      >
        {!blank &&
          r?.items.map((item, i) => {
            const isChanged = i === r.changedIdx;
            const glyph = isChanged && altered ? r.altGlyph : item.glyph;
            const colorIdx =
              isChanged && altered ? r.altColorIdx : item.colorIdx;
            const big = isChanged && altered && r.altBig;
            return (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                aria-label={isChanged ? "the thing that changes" : undefined}
                onPointerDown={() => handleTap(i)}
                className={`absolute select-none leading-none ${
                  gap?.reveal && isChanged
                    ? "z-10 rounded-full ring-4 ring-coral"
                    : ""
                }`}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  transform: `translate(-50%, -50%) scale(${big ? 1.45 : 1})`,
                  fontSize: `${(66 / r.cols).toFixed(2)}cqw`,
                  color: COLORS[colorIdx],
                  padding: "0.14em",
                }}
              >
                {glyph}
              </button>
            );
          })}

        {/* Between-round overlay */}
        {phase === "gap" && gap && (
          <div className="absolute inset-x-0 top-4 z-20 flex justify-center">
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
        the blink is doing this — your eyes need the cut to hide the change
      </p>
    </div>
  );
}
