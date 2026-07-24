"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { GameTitle } from "@/components/GameTitle";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { UNLIMITED_LIVES } from "@/lib/dev";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { pick, randInt, shuffle, type Rng } from "@/lib/rng";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const ROUNDS = 20;
const LIVES = 3;
const SURVIVAL_CAP = 120;

interface ClockRound {
  hour: number; // 1–12
  minute: number; // 0–55, in 5-minute steps
  options: string[]; // 4 formatted times, shuffled, contains the answer
  answer: string;
  numbered: boolean; // digits printed on the face
  flash: boolean; // timelapse round: hands spin, freeze, then vanish
  reverse: boolean; // flip round: digital time shown, pick the matching face
  duration: number; // answer-phase seconds
}

function parseTime(s: string): { hour: number; minute: number } {
  const [hour, minute] = s.split(":").map(Number);
  return { hour, minute };
}

function fmt(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

/** Add minutes to a clock time, wrapping around the 12-hour dial. */
function shifted(hour: number, minute: number, deltaMinutes: number): string {
  const total = (((hour % 12) * 60 + minute + deltaMinutes) % 720 + 720) % 720;
  const h = Math.floor(total / 60);
  return fmt(h === 0 ? 12 : h, total % 60);
}

/** The classic misread: hour hand taken as minute hand and vice versa. */
function handSwapped(hour: number, minute: number): string {
  const swappedHour = Math.floor(minute / 5) || 12;
  const hourHandAngle = (hour % 12) * 30 + minute * 0.5;
  const swappedMinute = (Math.round(hourHandAngle / 6 / 5) * 5) % 60;
  return fmt(swappedHour, swappedMinute);
}

/** Early rounds get scattered options; later rounds get near-miss traps. */
function buildOptions(
  rng: Rng,
  hour: number,
  minute: number,
  far: boolean,
  minutePool: readonly number[]
): string[] {
  const answer = fmt(hour, minute);
  const seen = new Set([answer]);
  const distractors: string[] = [];

  if (far) {
    // Draw from the same minute pool so options look like the same "class"
    // of time — just far apart on the dial.
    while (distractors.length < 3) {
      const c = fmt(randInt(rng, 1, 12), pick(rng, minutePool));
      if (!seen.has(c)) {
        seen.add(c);
        distractors.push(c);
      }
    }
  } else {
    const traps = shuffle(rng, [
      handSwapped(hour, minute),
      shifted(hour, minute, 5),
      shifted(hour, minute, -5),
      shifted(hour, minute, 10),
      shifted(hour, minute, -10),
      shifted(hour, minute, 15),
      shifted(hour, minute, 60),
      shifted(hour, minute, -60),
    ]);
    for (const c of traps) {
      if (!seen.has(c)) {
        seen.add(c);
        distractors.push(c);
      }
      if (distractors.length === 3) break;
    }
    let fill = 2;
    while (distractors.length < 3) {
      const c = shifted(hour, minute, 25 * fill++);
      if (!seen.has(c)) {
        seen.add(c);
        distractors.push(c);
      }
    }
  }
  return shuffle(rng, [answer, ...distractors]);
}

const FIVES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;

interface StageConfig {
  numbered: boolean;
  flash: boolean;
  far: boolean;
  duration: number;
  /** Allowed minute values — the warm-up rounds stick to easy landmarks. */
  minutePool: readonly number[];
}

function roundConfig(i: number): StageConfig {
  // Warm-up: o'clock and half-past only, generous timers.
  if (i < 3)
    return { numbered: true, flash: false, far: true, duration: 7, minutePool: [0, 30] };
  if (i < 5)
    return { numbered: true, flash: false, far: true, duration: 6.5, minutePool: [0, 15, 30, 45] };
  if (i < 9)
    return { numbered: true, flash: false, far: false, duration: 6, minutePool: FIVES };
  if (i < 13)
    return { numbered: false, flash: false, far: false, duration: 5.5, minutePool: FIVES };
  if (i < 16)
    return { numbered: false, flash: false, far: false, duration: 5, minutePool: FIVES };
  // Timelapse finale: the hands spin, freeze for a blink, then vanish.
  return { numbered: true, flash: true, far: false, duration: 4.5, minutePool: FIVES };
}

/** Past the daily's 20, survival cycles the two hardest stages (bare-face and
    timelapse) forever, shaving time each lap down to a 2.6s floor. */
function survivalConfig(i: number): StageConfig {
  if (i < ROUNDS) return roundConfig(i);
  const laps = Math.floor((i - ROUNDS) / 4);
  const shave = Math.min(2.0, laps * 0.2);
  const flash = i % 4 === 3; // one timelapse every four rounds
  return {
    numbered: flash,
    flash,
    far: false,
    duration: Math.max(2.6, (flash ? 4.5 : 5) - shave),
    minutePool: FIVES,
  };
}

function generateRounds(rng: Rng, total: number, survival: boolean): ClockRound[] {
  return Array.from({ length: total }, (_, i) => {
    const { far, minutePool, ...cfg } = survival
      ? survivalConfig(i)
      : roundConfig(i);
    // Every third mid-game round flips: match the digital time to a face.
    // Scanning four clocks takes longer, so flips get a bonus second.
    // Flip rounds: match the digital time to one of four faces.
    const reverse = !cfg.flash && i >= 5 && i % 3 === 2;
    const hour = randInt(rng, 1, 12);
    const minute = pick(rng, minutePool);
    return {
      ...cfg,
      reverse,
      // Flip rounds mean reading FOUR clocks instead of one — they get a
      // real time bonus, not a token one.
      duration: cfg.duration + (reverse ? 2.5 : 0),
      hour,
      minute,
      answer: fmt(hour, minute),
      options: buildOptions(rng, hour, minute, far, minutePool),
    };
  });
}

// Preview timing for flash rounds: spin-in, then a frozen peek, then gone.
const SPIN_MS = 1300;
const PEEK_MS = 900;

type Phase = "intro" | "preview" | "answer" | "feedback" | "result";

interface Feedback {
  ok: boolean;
  msg: string;
}

export function ClockGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [rounds, setRounds] = useState<ClockRound[]>([]);
  const [summary, setSummary] = useState<{ score: number; emojis: string[] }>({
    score: 0,
    emojis: [],
  });

  // Game logic runs off refs so timer callbacks never read stale data.
  const roundsRef = useRef<ClockRound[]>([]);
  const roundRef = useRef(0);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(ROUNDS);
  const lockedRef = useRef(false);
  const previewTimeoutRef = useRef(0);
  const timer = useCountdown();

  function finish(didSurvive: boolean) {
    timer.stop();
    window.clearTimeout(previewTimeoutRef.current);
    const score = resultsRef.current.filter(Boolean).length;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    const display =
      modeRef.current === "daily" ? `${score}/${ROUNDS}` : `${score} clocks`;
    const isBest = submitBest("clock", modeRef.current, { score, display });
    if (modeRef.current === "daily") {
      setDailyResult("clock", dailyNumber(), {
        display,
        emojis: emojis.join(""),
      });
      setStreak(bumpStreak());
    }
    setSummary({ score, emojis });
    setNewBest(isBest);
    setSurvived(didSurvive);
    setPhase("result");
    if (didSurvive) sfx.fanfare();
    else sfx.gameOver();
  }

  function advance(passed: boolean, msg: string) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    timer.stop();
    resultsRef.current.push(passed);
    if (!passed && !UNLIMITED_LIVES) livesRef.current -= 1;
    setLives(livesRef.current);
    setFeedback({ ok: passed, msg });
    setPhase("feedback");
    if (passed) sfx.success();
    else sfx.error();

    window.setTimeout(() => {
      if (livesRef.current <= 0) {
        finish(false);
      } else if (roundRef.current + 1 >= totalRef.current) {
        finish(true);
      } else {
        roundRef.current += 1;
        lockedRef.current = false;
        setRound(roundRef.current);
        setFeedback(null);
        beginRound();
      }
      // A miss lingers so the highlighted correct answer is readable; a hit
      // stays snappy.
    }, passed ? 800 : 1700);
  }

  function beginRound() {
    const r = roundsRef.current[roundRef.current];
    sfx.reveal();
    // Short and the same for every round — the correct answer button gets
    // highlighted on the reveal, so the message doesn't need to name it.
    const slowMsg = "TOO SLOW!";
    if (r.flash) {
      // Preview: watch the timelapse; the answer clock starts once it's gone.
      setPhase("preview");
      previewTimeoutRef.current = window.setTimeout(() => {
        setPhase("answer");
        timer.start(r.duration, () => advance(false, slowMsg));
      }, SPIN_MS + PEEK_MS);
    } else {
      setPhase("answer");
      timer.start(r.duration, () => advance(false, slowMsg));
    }
  }

  function handlePick(option: string) {
    const r = roundsRef.current[roundRef.current];
    if (!r || lockedRef.current) return;
    sfx.tap();
    if (option === r.answer) {
      advance(true, "NICE ✓");
    } else {
      advance(false, "WRONG!");
    }
  }

  function startRun(m: Mode) {
    totalRef.current = m === "daily" ? ROUNDS : SURVIVAL_CAP;
    const generated = generateRounds(
      rngFor("clock", m),
      totalRef.current,
      m !== "daily"
    );
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
    setFeedback(null);
    setNewBest(false);
    setSurvived(false);
    beginRound();
  }

  // Desktop: keys 1–4 pick the four answers.
  useEffect(() => {
    if (phase !== "answer") return;
    const onKey = (e: KeyboardEvent) => {
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      const r = roundsRef.current[roundRef.current];
      if (idx >= 0 && r) handlePick(r.options[idx]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Clean up the preview timeout if the player navigates away mid-run.
  useEffect(() => () => window.clearTimeout(previewTimeoutRef.current), []);

  if (phase === "intro") {
    return (
      <IntroScreen
        game="clock"
        title="OVERCLOCKED"
        tagline="You learned this in second grade. Prove it."
        howTo={[
          "Tap the time that matches the clock — some rounds flip it and you pick the face that matches the time.",
          "Later faces lose their numbers — and the final clocks spin, freeze, and vanish. Answer from memory.",
        ]}
        controlsHint="Tap an answer · keys 1–4 on desktop"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        game="clock"
        gameName="Overclocked"
        path="/clock"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={
          mode === "daily" ? `${summary.score}/${ROUNDS}` : `${summary.score} clocks`
        }
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("clock", mode)?.display ?? null}
        streak={streak}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const r = rounds[round];
  const hidden = phase === "answer" && (r?.flash ?? false);

  return (
    <div className="flex flex-1 flex-col gap-2.5 py-2 sm:gap-4 sm:py-4">
      <GameTitle game="clock" title="OVERCLOCKED" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          CLOCK {round + 1}
          {mode === "daily" ? `/${ROUNDS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "answer" ? timer.progress : 1} />

      {/* Clock card. One fixed height per round type — compact for flip rounds
          (the four faces live below), clock-sized otherwise — so swapping in
          the feedback message never resizes the card and shoves everything
          down. */}
      <div
        className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-line bg-panel p-4 shadow-chunk ${
          r?.reverse ? "min-h-28" : "min-h-[240px] sm:min-h-[320px]"
        }`}
      >
        {phase === "feedback" && feedback ? (
          <p
            className={`animate-pop text-center font-display text-2xl ${
              feedback.ok ? "text-mint" : "text-coral"
            }`}
          >
            {feedback.msg}
          </p>
        ) : r?.reverse ? (
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="font-display text-xs text-fog">MATCH THIS TIME</p>
            <p className="font-display text-5xl text-lemon">{r.answer}</p>
          </div>
        ) : (
          <>
            {phase === "preview" && (
              <p className="font-display text-xs text-lemon">
                ⚡ MEMORIZE — IT WON&apos;T STAY
              </p>
            )}
            {r && (
              <ClockFace
                hour={r.hour}
                minute={r.minute}
                numbered={r.numbered}
                hidden={hidden}
                spin={r.flash && phase === "preview"}
              />
            )}
          </>
        )}
      </div>

      {/* Answer buttons: times normally, mini clock faces on flip rounds */}
      <div
        className={`grid grid-cols-2 gap-3 ${
          r?.reverse ? "mx-auto w-full max-w-lg" : ""
        }`}
      >
        {(r?.options ?? []).map((option) => {
          const t = parseTime(option);
          return (
            <button
              key={option}
              type="button"
              disabled={phase !== "answer"}
              onPointerDown={() => phase === "answer" && handlePick(option)}
              className={`rounded-2xl border-2 font-display text-2xl text-paper shadow-chunk transition-transform active:translate-y-1 active:shadow-none ${
                phase === "feedback" && option === r?.answer
                  ? // The answer that should've been tapped, ringed on the reveal.
                    "border-mint bg-panel2 ring-4 ring-mint/60"
                  : "border-line bg-panel2 disabled:opacity-40"
              } ${
                r?.reverse ? "flex items-center justify-center p-1 sm:p-2" : "h-14 sm:h-16"
              }`}
            >
              {r?.reverse ? (
                // Always numbered: matching a digital time against four bare
                // faces is a reading test, not a clock test.
                <ClockFace
                  hour={t.hour}
                  minute={t.minute}
                  numbered
                  hidden={false}
                  spin={false}
                  mini
                />
              ) : (
                option
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-fog">
        short &amp; thick = <span className="text-paper">HOUR</span> · long
        arrow = <span className="text-lemon">MINUTE</span>
      </p>
    </div>
  );
}

/**
 * SVG analog clock. Hands are rotated via inline styles so the timelapse
 * rounds can spin them in with a CSS transition (killed automatically by the
 * prefers-reduced-motion global rule).
 */
function ClockFace({
  hour,
  minute,
  numbered,
  hidden,
  spin,
  mini = false,
}: {
  hour: number;
  minute: number;
  numbered: boolean;
  hidden: boolean;
  spin: boolean;
  /** Small answer-button rendering: major ticks only, chunkier digits. */
  mini?: boolean;
}) {
  const hourRef = useRef<SVGGElement>(null);
  const minuteRef = useRef<SVGGElement>(null);
  const hourDeg = ((hour % 12) + minute / 60) * 30;
  const minuteDeg = minute * 6;

  // Direct DOM writes: set the start angle, force a style flush, then hand the
  // final angle to a transition — the hands visibly race around the dial.
  useEffect(() => {
    const hg = hourRef.current;
    const mg = minuteRef.current;
    if (!hg || !mg) return;
    hg.style.transition = "none";
    mg.style.transition = "none";
    if (spin) {
      hg.style.transform = `rotate(${hourDeg - 720}deg)`;
      mg.style.transform = `rotate(${minuteDeg - 1440}deg)`;
      void hg.getBoundingClientRect(); // commit the jump before animating
      const ease = `transform ${SPIN_MS}ms cubic-bezier(0.22, 0.8, 0.3, 1)`;
      hg.style.transition = ease;
      mg.style.transition = ease;
    }
    hg.style.transform = `rotate(${hourDeg}deg)`;
    mg.style.transform = `rotate(${minuteDeg}deg)`;
  }, [hourDeg, minuteDeg, spin]);

  const handStyle = {
    transformBox: "view-box",
    transformOrigin: "50% 50%",
  } as const;

  return (
    <svg
      viewBox="0 0 200 200"
      className={
        mini
          ? "h-32 w-32 max-w-full sm:h-40 sm:w-40"
          : "h-52 w-52 max-w-full sm:h-72 sm:w-72"
      }
      role="img"
      aria-label={hidden ? "hidden clock" : "analog clock"}
    >
      {/* Case, bezel, dial */}
      <circle
        cx="100"
        cy="100"
        r="96"
        fill="var(--color-line)"
        stroke="var(--color-line)"
        strokeWidth="2"
      />
      <circle cx="100" cy="100" r="90" fill="var(--color-panel2)" />
      <circle
        cx="100"
        cy="100"
        r="79"
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="1"
        opacity="0.7"
      />
      {/* Ticks — 12/3/6/9 get lemon anchors so the eye can orient instantly.
          Minute ticks stay on minis too; they're the reading aid. */}
      {Array.from({ length: 60 }, (_, i) => {
        const cardinal = i % 15 === 0;
        const major = i % 5 === 0;
        return (
          <line
            key={i}
            x1="100"
            y1={cardinal ? "11" : major ? "13" : "16"}
            x2="100"
            y2={major ? "22" : "20"}
            stroke={
              cardinal
                ? "var(--color-lemon)"
                : major
                  ? "var(--color-paper)"
                  : "var(--color-fog)"
            }
            strokeWidth={cardinal ? 5 : major ? 3.5 : mini ? 1.6 : 1.2}
            strokeLinecap="round"
            opacity={major ? 1 : 0.55}
            transform={`rotate(${i * 6} 100 100)`}
          />
        );
      })}
      {/* Numbers — bold, bright, cardinal ones in lemon */}
      {numbered &&
        Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const a = (n * 30 * Math.PI) / 180;
          return (
            <text
              key={n}
              x={100 + 66 * Math.sin(a)}
              y={100 - 66 * Math.cos(a)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={mini ? 24 : 19}
              fontWeight="800"
              fill={n % 3 === 0 ? "var(--color-lemon)" : "var(--color-paper)"}
            >
              {n}
            </text>
          );
        })}
      {hidden ? (
        <text
          x="100"
          y="100"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="44"
          fill="var(--color-lemon)"
        >
          ?
        </text>
      ) : (
        <>
          {/* Hour hand: SHORT and tapered — reaches only ~40% of the dial,
              so length alone tells it apart from the minute hand. */}
          <g ref={hourRef} style={handStyle}>
            <polygon
              points="96.6,106 96.6,72 100,60 103.4,72 103.4,106"
              fill="var(--color-paper)"
              stroke="var(--color-paper)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </g>
          {/* Minute hand: LONG and thin with a needle tip that stops just
              inside the numbers — never covering the digit it points at. */}
          <g ref={minuteRef} style={handStyle}>
            <line
              x1="100"
              y1="106"
              x2="100"
              y2="56"
              stroke="var(--color-lemon)"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <polygon points="100,44 96.2,58 103.8,58" fill="var(--color-lemon)" />
          </g>
          {/* Center pin */}
          <circle cx="100" cy="100" r="6.5" fill="var(--color-coral)" />
          <circle cx="100" cy="100" r="2.4" fill="var(--color-panel2)" />
        </>
      )}
    </svg>
  );
}
