"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { pick, type Rng } from "@/lib/rng";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const DIRS = ["up", "down", "left", "right"] as const;
type Dir = (typeof DIRS)[number];

const GLYPH: Record<Dir, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

const KEYMAP: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
  W: "up", S: "down", A: "left", D: "right",
};

const DAILY_LEVELS = 15;
const LIVES = 3;
const WRONG_PENALTY = 1.25; // seconds shaved off the clock per wrong key
const MEMORY_FROM = 9; // levels this deep flash the code, then go dark

function seqLength(level: number): number {
  return Math.min(3 + Math.floor((level - 1) / 2), 10);
}

function perArrowSeconds(level: number): number {
  return Math.max(0.55, 1.15 - (level - 1) * 0.045);
}

function levelDuration(level: number): number {
  return 1.0 + seqLength(level) * perArrowSeconds(level);
}

type Phase = "intro" | "preview" | "input" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
}

export function SequenceGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [level, setLevel] = useState(1);
  const [pos, setPos] = useState(0); // how much of the code is keyed in
  const [lives, setLives] = useState(LIVES);
  const [gap, setGap] = useState<Gap | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [seq, setSeq] = useState<Dir[]>([]);
  const [summary, setSummary] = useState<{
    cleared: number;
    emojis: string[];
    time: number;
  }>({ cleared: 0, emojis: [], time: 0 });

  // Game logic runs off refs so timer/timeout callbacks never read stale data.
  const rngRef = useRef<Rng | null>(null);
  const seqsRef = useRef<Dir[][]>([]);
  const levelRef = useRef(1);
  const posRef = useRef(0);
  const livesRef = useRef(LIVES);
  const clearedRef = useRef(0);
  const attemptsRef = useRef<boolean[]>([]);
  const elapsedRef = useRef(0); // total seconds spent in input phases
  const attemptStartRef = useRef(0);
  const phaseRef = useRef<Phase>("intro");
  const modeRef = useRef<Mode>("daily");
  const timeoutRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const timer = useCountdown();

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  /** Sequences are generated once per level, in order, so the daily run is
      identical for everyone — retries replay the same code. */
  function ensureSeq(lvl: number): Dir[] {
    while (seqsRef.current.length < lvl) {
      const len = seqLength(seqsRef.current.length + 1);
      seqsRef.current.push(
        Array.from({ length: len }, () => pick(rngRef.current!, DIRS))
      );
    }
    return seqsRef.current[lvl - 1];
  }

  function finish(didSurvive: boolean) {
    timer.stop();
    window.clearTimeout(timeoutRef.current);
    const score = clearedRef.current;
    const time = elapsedRef.current;
    const emojis = attemptsRef.current.map((a) => (a ? "✅" : "❌"));
    const display = `Level ${score} · ${time.toFixed(1)}s`;
    const isBest = submitBest("sequence", modeRef.current, {
      score,
      tiebreak: time,
      display,
    });
    if (modeRef.current === "daily") {
      setDailyResult("sequence", dailyNumber(), {
        display,
        emojis: emojis.join(""),
      });
      setStreak(bumpStreak());
    }
    setSummary({ cleared: score, emojis, time });
    setNewBest(isBest);
    setSurvived(didSurvive);
    setPhaseSafe("result");
    if (didSurvive) sfx.fanfare();
    else sfx.gameOver();
  }

  function beginInput(lvl: number) {
    posRef.current = 0;
    setPos(0);
    attemptStartRef.current = performance.now();
    setPhaseSafe("input");
    timer.start(levelDuration(lvl), () => {
      // Channel closed before the code was keyed in.
      elapsedRef.current += (performance.now() - attemptStartRef.current) / 1000;
      attemptsRef.current.push(false);
      livesRef.current -= 1;
      setLives(livesRef.current);
      sfx.error();
      if (livesRef.current <= 0) {
        finish(false);
        return;
      }
      setGap({ ok: false, msg: "CHANNEL CLOSED — RETRY" });
      setPhaseSafe("gap");
      timeoutRef.current = window.setTimeout(
        () => startLevel(levelRef.current),
        900
      );
    });
  }

  function startLevel(lvl: number) {
    window.clearTimeout(timeoutRef.current);
    levelRef.current = lvl;
    setLevel(lvl);
    setGap(null);
    const code = ensureSeq(lvl);
    setSeq(code);
    if (lvl >= MEMORY_FROM) {
      // Flash the code, then it goes dark and must be keyed from memory.
      setPhaseSafe("preview");
      posRef.current = 0;
      setPos(0);
      sfx.reveal();
      const previewMs = (0.8 + code.length * 0.45) * 1000;
      timeoutRef.current = window.setTimeout(() => beginInput(lvl), previewMs);
    } else {
      sfx.reveal();
      beginInput(lvl);
    }
  }

  function handleDir(dir: Dir) {
    if (phaseRef.current !== "input") return;
    const code = seqsRef.current[levelRef.current - 1];
    if (dir === code[posRef.current]) {
      posRef.current += 1;
      setPos(posRef.current);
      sfx.good();
      if (posRef.current >= code.length) {
        // Code re-transmitted in time.
        timer.stop();
        elapsedRef.current +=
          (performance.now() - attemptStartRef.current) / 1000;
        clearedRef.current = levelRef.current;
        attemptsRef.current.push(true);
        sfx.success();
        setFlashKey((k) => k + 1);
        if (modeRef.current === "daily" && levelRef.current >= DAILY_LEVELS) {
          finish(true);
          return;
        }
        setGap({ ok: true, msg: "SIGNAL SENT ✓" });
        setPhaseSafe("gap");
        timeoutRef.current = window.setTimeout(
          () => startLevel(levelRef.current + 1),
          700
        );
      }
    } else {
      // Wrong key: the whole code resets and the clock takes a hit.
      posRef.current = 0;
      setPos(0);
      setShakeKey((k) => k + 1);
      sfx.error();
      timer.shave(WRONG_PENALTY);
    }
  }

  function startRun(m: Mode) {
    modeRef.current = m;
    rngRef.current = rngFor("sequence", m);
    seqsRef.current = [];
    livesRef.current = LIVES;
    clearedRef.current = 0;
    attemptsRef.current = [];
    elapsedRef.current = 0;
    setMode(m);
    setLives(LIVES);
    setNewBest(false);
    setSurvived(false);
    startLevel(1);
  }

  // Desktop keys: arrows + WASD. Handlers only touch refs, so binding once is
  // safe — the first render's closure never goes stale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYMAP[e.key];
      if (!dir || phaseRef.current !== "input") return;
      e.preventDefault(); // arrows must not scroll the page mid-game
      handleDir(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up pending timeouts if the player navigates away mid-run.
  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // just a tap
    const dir: Dir =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";
    handleDir(dir);
  };

  if (phase === "intro") {
    return (
      <IntroScreen
        game="sequence"
        title="SIGNAL RUSH"
        icon="📡"
        tagline="Crack the intercepted code before the channel closes."
        howTo={[
          "Key in the arrow code, in order, before the channel closes.",
          "Deep transmissions flash once then go dark — re-key them from memory. A wrong key resets the code.",
        ]}
        controlsHint="Arrow keys / WASD · swipe or d-pad on touch"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        gameName="Signal Rush"
        path="/sequence"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={`Level ${summary.cleared} ⚡`}
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("sequence", mode)?.display ?? null}
        streak={streak}
        extraStats={[
          { label: "Total time", value: `${summary.time.toFixed(1)}s` },
        ]}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const hidden = phase === "input" && level >= MEMORY_FROM;

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          TRANSMISSION {level}
          {mode === "daily" ? `/${DAILY_LEVELS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "input" ? timer.progress : 1} />

      {/* Signal display */}
      <div
        key={shakeKey}
        className={`${shakeKey > 0 ? "animate-shake" : ""} touch-surface relative flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-line bg-panel p-6 shadow-chunk`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Completion flash */}
        {flashKey > 0 && (
          <div
            key={flashKey}
            className="animate-flash absolute inset-0 rounded-2xl bg-mint"
          />
        )}

        {phase === "gap" && gap ? (
          <p
            className={`animate-pop font-display text-xl ${
              gap.ok ? "text-mint" : "text-coral"
            }`}
          >
            {gap.msg}
          </p>
        ) : (
          <>
            {phase === "preview" && (
              <p className="font-display text-xs text-lemon">
                ⚡ MEMORIZE — SIGNAL GOES DARK
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {seq.map((dir, i) => {
                const entered = i < pos;
                const isNext = i === pos && phase === "input";
                return (
                  <span
                    key={i}
                    className={`font-display text-4xl transition-all ${
                      entered
                        ? "scale-110 text-mint"
                        : hidden
                          ? "text-line"
                          : isNext
                            ? "text-paper"
                            : "text-fog opacity-70"
                    }`}
                    aria-hidden
                  >
                    {entered || !hidden ? GLYPH[dir] : "▪"}
                  </span>
                );
              })}
            </div>
            {phase === "input" && (
              <p className="text-xs text-fog">
                {hidden ? "from memory — you've got this" : "swipe or use keys"}
              </p>
            )}
          </>
        )}
      </div>

      {/* On-screen d-pad */}
      <div className="mx-auto grid w-44 grid-cols-3 gap-1">
        <span />
        <DPadButton dir="up" onDir={handleDir} />
        <span />
        <DPadButton dir="left" onDir={handleDir} />
        <span className="flex items-center justify-center text-xs text-line">
          ✦
        </span>
        <DPadButton dir="right" onDir={handleDir} />
        <span />
        <DPadButton dir="down" onDir={handleDir} />
        <span />
      </div>
    </div>
  );
}

function DPadButton({ dir, onDir }: { dir: Dir; onDir: (d: Dir) => void }) {
  return (
    <button
      type="button"
      aria-label={`input ${dir}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onDir(dir);
      }}
      className="flex h-14 items-center justify-center rounded-lg border-2 border-line bg-panel2 font-display text-xl text-paper shadow-chunk-sm transition-transform active:translate-y-0.5 active:shadow-none"
    >
      {GLYPH[dir]}
    </button>
  );
}
