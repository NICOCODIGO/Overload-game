"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { randInt, type Rng } from "@/lib/rng";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const ROUNDS = 12;
const LIVES = 3;

type IllusionType = "muller" | "ebbinghaus" | "vh" | "ponzo" | "contrast";

/** truth: 0 = first option (top/left/vertical), 1 = same, 2 = second option. */
interface IllusionRound {
  type: IllusionType;
  truth: 0 | 1 | 2;
  delta: number; // real fractional difference when truth ≠ same
  flip: boolean; // mirrors which side carries the illusion's bias
  j1: number; // small deterministic jitters, -1..1
  j2: number;
  duration: number;
}

const QUESTIONS: Record<IllusionType, { q: string; labels: [string, string, string] }> = {
  muller: { q: "WHICH LINE IS ACTUALLY LONGER?", labels: ["TOP", "SAME", "BOTTOM"] },
  ebbinghaus: { q: "WHICH CENTER CIRCLE IS ACTUALLY BIGGER?", labels: ["LEFT", "SAME", "RIGHT"] },
  vh: { q: "WHICH LINE IS ACTUALLY LONGER?", labels: ["VERTICAL", "SAME", "HORIZONTAL"] },
  ponzo: { q: "WHICH BAR IS ACTUALLY LONGER?", labels: ["TOP", "SAME", "BOTTOM"] },
  contrast: { q: "WHICH INNER SQUARE IS ACTUALLY LIGHTER?", labels: ["LEFT", "SAME", "RIGHT"] },
};

/** The real difference shrinks toward the illusion's strength — late rounds
    sit right where your eyes stop being trustworthy. */
function roundPlan(i: number): { type: IllusionType; duration: number; deltaBase: number; deltaSpread: number } {
  const types: IllusionType[] = [
    "muller", "ebbinghaus", "vh", "ponzo", "contrast",
    "muller", "ebbinghaus", "ponzo", "contrast",
    "muller", "ebbinghaus", "vh",
  ];
  const durations = [8, 8, 7.5, 7.5, 7, 6.5, 6.5, 6.5, 6, 6, 5.5, 5.5];
  const deltaBase = i < 5 ? 0.11 : i < 9 ? 0.06 : 0.035;
  const deltaSpread = i < 5 ? 0.04 : i < 9 ? 0.03 : 0.015;
  return { type: types[i], duration: durations[i], deltaBase, deltaSpread };
}

function generateRounds(rng: Rng): IllusionRound[] {
  return Array.from({ length: ROUNDS }, (_, i) => {
    const plan = roundPlan(i);
    return {
      type: plan.type,
      truth: randInt(rng, 0, 2) as 0 | 1 | 2,
      delta: plan.deltaBase + rng() * plan.deltaSpread,
      flip: rng() < 0.5,
      j1: rng() * 2 - 1,
      j2: rng() * 2 - 1,
      duration: plan.duration,
    };
  });
}

/** Sizes for the two compared things: index 0 = first option, 1 = second. */
function pair(base: number, truth: 0 | 1 | 2, delta: number): [number, number] {
  if (truth === 0) return [base, base * (1 - delta)];
  if (truth === 2) return [base * (1 - delta), base];
  return [base * (1 - delta / 2), base * (1 - delta / 2)];
}

// ---------------------------------------------------------------- stimuli

function MullerLyer({ r }: { r: IllusionRound }) {
  const [lenTop, lenBot] = pair(180, r.truth, r.delta);
  const fins = (cx: number, y: number, len: number, out: boolean) => {
    const x1 = cx - len / 2;
    const x2 = cx + len / 2;
    const d = out ? -15 : 15;
    return (
      <g stroke="var(--color-paper)" strokeWidth="4" strokeLinecap="round">
        <line x1={x1} y1={y} x2={x2} y2={y} />
        <line x1={x1} y1={y} x2={x1 + d} y2={y - 14} />
        <line x1={x1} y1={y} x2={x1 + d} y2={y + 14} />
        <line x1={x2} y1={y} x2={x2 - d} y2={y - 14} />
        <line x1={x2} y1={y} x2={x2 - d} y2={y + 14} />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 320 180" className="w-full">
      {fins(160 + r.j1 * 8, 55, lenTop, r.flip)}
      {fins(160 + r.j2 * 8, 125, lenBot, !r.flip)}
    </svg>
  );
}

function Ebbinghaus({ r }: { r: IllusionRound }) {
  const [rL, rR] = pair(20, r.truth, r.delta);
  const ring = (cx: number, cy: number, n: number, dist: number, radius: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return (
        <circle
          key={i}
          cx={cx + dist * Math.cos(a)}
          cy={cy + dist * Math.sin(a)}
          r={radius}
          fill="var(--color-line)"
        />
      );
    });
  // One center sits among giants (looks small), the other among dots.
  const bigRingLeft = r.flip;
  return (
    <svg viewBox="0 0 320 180" className="w-full">
      {ring(85, 90, 6, 52, bigRingLeft ? 24 : 8)}
      {ring(235, 90, bigRingLeft ? 8 : 6, bigRingLeft ? 34 : 52, bigRingLeft ? 8 : 24)}
      <circle cx="85" cy="90" r={rL} fill="var(--color-mint)" />
      <circle cx="235" cy="90" r={rR} fill="var(--color-mint)" />
    </svg>
  );
}

function VerticalHorizontal({ r }: { r: IllusionRound }) {
  const [lenV, lenH] = pair(105, r.truth, r.delta);
  return (
    <svg viewBox="0 0 320 180" className="w-full">
      <g stroke="var(--color-paper)" strokeWidth="4" strokeLinecap="round">
        <line x1={160 - lenH / 2} y1="150" x2={160 + lenH / 2} y2="150" />
        <line x1="160" y1="150" x2="160" y2={150 - lenV} />
      </g>
    </svg>
  );
}

function Ponzo({ r }: { r: IllusionRound }) {
  const [lenTop, lenBot] = pair(85, r.truth, r.delta);
  return (
    <svg viewBox="0 0 320 180" className="w-full">
      <g stroke="var(--color-line)" strokeWidth="3">
        <line x1="60" y1="175" x2="140" y2="5" />
        <line x1="260" y1="175" x2="180" y2="5" />
      </g>
      <g fill="var(--color-lemon)">
        <rect x={160 + r.j1 * 6 - lenTop / 2} y="42" width={lenTop} height="7" rx="3" />
        <rect x={160 + r.j2 * 6 - lenBot / 2} y="128" width={lenBot} height="7" rx="3" />
      </g>
    </svg>
  );
}

function Contrast({ r }: { r: IllusionRound }) {
  const [vL, vR] = pair(150, r.truth, r.delta).map(Math.round) as [number, number];
  const darkLeft = r.flip;
  return (
    <svg viewBox="0 0 320 180" className="w-full">
      <rect x="0" y="0" width="160" height="180" fill={darkLeft ? "#0d0a22" : "#9086c9"} />
      <rect x="160" y="0" width="160" height="180" fill={darkLeft ? "#9086c9" : "#0d0a22"} />
      <rect x="57" y="67" width="46" height="46" rx="4" fill={`rgb(${vL},${vL},${vL})`} />
      <rect x="217" y="67" width="46" height="46" rx="4" fill={`rgb(${vR},${vR},${vR})`} />
    </svg>
  );
}

function Stimulus({ r }: { r: IllusionRound }) {
  switch (r.type) {
    case "muller":
      return <MullerLyer r={r} />;
    case "ebbinghaus":
      return <Ebbinghaus r={r} />;
    case "vh":
      return <VerticalHorizontal r={r} />;
    case "ponzo":
      return <Ponzo r={r} />;
    case "contrast":
      return <Contrast r={r} />;
  }
}

// ------------------------------------------------------------------- game

type Phase = "intro" | "scan" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
}

export function IllusionGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [gap, setGap] = useState<Gap | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [rounds, setRounds] = useState<IllusionRound[]>([]);
  const [summary, setSummary] = useState<{ score: number; emojis: string[] }>({
    score: 0,
    emojis: [],
  });

  // Game logic runs off refs so timer callbacks never read stale data.
  const roundsRef = useRef<IllusionRound[]>([]);
  const roundRef = useRef(0);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const modeRef = useRef<Mode>("daily");
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
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    const display = `${score}/${ROUNDS}`;
    const isBest = submitBest("illusion", modeRef.current, { score, display });
    if (modeRef.current === "daily") {
      setDailyResult("illusion", dailyNumber(), {
        display,
        emojis: emojis.join(""),
      });
      setStreak(bumpStreak());
    }
    setSummary({ score, emojis });
    setNewBest(isBest);
    setSurvived(didSurvive);
    setPhaseSafe("result");
    if (didSurvive) sfx.fanfare();
    else sfx.gameOver();
  }

  function endRound(correct: boolean, msg: string) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    timer.stop();
    resultsRef.current.push(correct);
    if (!correct) livesRef.current -= 1;
    setLives(livesRef.current);
    setGap({ ok: correct, msg });
    setPhaseSafe("gap");
    if (correct) sfx.success();
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
      correct ? 700 : 1200
    );
  }

  function beginRound() {
    sfx.reveal();
    setPhaseSafe("scan");
    const r = roundsRef.current[roundRef.current];
    timer.start(r.duration, () => {
      const { labels } = QUESTIONS[r.type];
      endRound(
        false,
        r.truth === 1 ? "TOO SLOW — SAME" : `TOO SLOW — ${labels[r.truth]}`
      );
    });
  }

  function handlePick(idx: 0 | 1 | 2) {
    if (lockedRef.current || phaseRef.current !== "scan") return;
    const r = roundsRef.current[roundRef.current];
    sfx.tap();
    if (idx === r.truth) {
      endRound(true, r.truth === 1 ? "CORRECT — SAME ✓" : "CORRECT ✓");
    } else {
      const { labels } = QUESTIONS[r.type];
      endRound(
        false,
        r.truth === 1 ? "THEY WERE THE SAME" : `IT WAS ${labels[r.truth]}`
      );
    }
  }

  function startRun(m: Mode) {
    const generated = generateRounds(rngFor("illusion", m));
    roundsRef.current = generated;
    setRounds(generated);
    resultsRef.current = [];
    livesRef.current = LIVES;
    roundRef.current = 0;
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

  // Desktop: keys 1–3 pick the three answers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx >= 0) handlePick(idx as 0 | 1 | 2);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up the gap timeout if the player navigates away mid-run.
  useEffect(() => () => window.clearTimeout(gapTimeoutRef.current), []);

  if (phase === "intro") {
    return (
      <IntroScreen
        game="illusion"
        title="DOUBLE TAKE"
        tagline="Your eyes are lying. Answer anyway."
        howTo={[
          "Every round is an optical illusion with a factual question — which is ACTUALLY longer, bigger, lighter?",
          "Sometimes the illusion lies. Sometimes it tells the truth. Sometimes they're the same. Trust nothing.",
        ]}
        controlsHint="Tap an answer · keys 1–3 on desktop"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        game="illusion"
        gameName="Double Take"
        path="/illusion"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={`${summary.score}/${ROUNDS}`}
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("illusion", mode)?.display ?? null}
        streak={streak}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const r = rounds[round];
  const question = r ? QUESTIONS[r.type] : null;

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          ILLUSION {round + 1}/{ROUNDS}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "scan" ? timer.progress : 1} />

      <p className="text-center font-display text-lg leading-snug">
        {question?.q}
      </p>

      {/* Stimulus */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-line bg-panel shadow-chunk">
        {r && <Stimulus r={r} />}

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

      {/* The three answers */}
      <div className="grid grid-cols-3 gap-3">
        {question?.labels.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={phase !== "scan"}
            onPointerDown={() => handlePick(i as 0 | 1 | 2)}
            className="h-14 rounded-2xl border-2 border-line bg-panel2 px-1 font-display text-sm text-paper shadow-chunk transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60 sm:text-base"
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-fog">
        measure with your brain, not your eyes
      </p>
    </div>
  );
}
