"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { Lives } from "@/components/Lives";
import { GameTitle } from "@/components/GameTitle";
import { sfx } from "@/lib/audio";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { pick, shuffle, type Rng } from "@/lib/rng";
import { WORD_POOLS } from "@/lib/scramble";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const ROUNDS = 15;
const LIVES = 3;
const SURVIVAL_CAP = 120;
const WRONG_PENALTY = 1.5; // seconds shaved for a wrong completed word
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface ScrambleRound {
  word: string; // the answer, uppercase
  hint: string;
  showHint: boolean;
  tiles: string[]; // scrambled letters + decoys
  duration: number;
}

/** Difficulty by round: length grows, decoys grow, the hint eventually hides. */
function roundPlan(i: number, survival: boolean): {
  len: number;
  decoys: number;
  showHint: boolean;
  duration: number;
} {
  if (!survival) {
    const daily: { len: number; decoys: number; showHint: boolean }[] = [
      { len: 4, decoys: 0, showHint: true },
      { len: 4, decoys: 0, showHint: true },
      { len: 4, decoys: 1, showHint: true },
      { len: 5, decoys: 1, showHint: true },
      { len: 5, decoys: 1, showHint: true },
      { len: 5, decoys: 2, showHint: true },
      { len: 6, decoys: 1, showHint: true },
      { len: 6, decoys: 2, showHint: true },
      { len: 6, decoys: 2, showHint: false },
      { len: 7, decoys: 2, showHint: true },
      { len: 7, decoys: 2, showHint: false },
      { len: 7, decoys: 3, showHint: false },
      { len: 8, decoys: 2, showHint: true },
      { len: 8, decoys: 3, showHint: false },
      { len: 8, decoys: 3, showHint: false },
    ];
    const p = daily[i];
    // Generous time — anagramming with decoys is slow. Scales with length.
    return { ...p, duration: 4 + p.len * 1.4 };
  }
  // Survival: cycle 6–8 letters, decoys climb, hint gone, timer grinds down.
  const len = 6 + (i % 3);
  const laps = Math.floor(i / 3);
  const decoys = Math.min(4, 2 + Math.floor(laps / 2));
  const duration = Math.max(6, 4 + len * 1.4 - laps * 0.4);
  return { len, decoys, showHint: false, duration };
}

/** Draw words without repeats by walking pre-shuffled per-length decks. */
function makeDrawer(rng: Rng) {
  const decks: Record<number, string[]> = {};
  const hints: Record<string, string> = {};
  const cursor: Record<number, number> = {};
  for (const len of [4, 5, 6, 7, 8]) {
    const pool = WORD_POOLS[len].filter((e) => e.w.length === len);
    for (const e of pool) hints[e.w] = e.h;
    decks[len] = shuffle(rng, pool.map((e) => e.w));
    cursor[len] = 0;
  }
  return (len: number): { word: string; hint: string } => {
    const deck = decks[len];
    const word = deck[cursor[len] % deck.length];
    cursor[len]++;
    return { word, hint: hints[word] };
  };
}

function generateRounds(rng: Rng, total: number, survival: boolean): ScrambleRound[] {
  const draw = makeDrawer(rng);
  return Array.from({ length: total }, (_, i) => {
    const plan = roundPlan(i, survival);
    const { word, hint } = draw(plan.len);
    const letters = word.split("");
    // Decoys: random letters (may coincide with real ones — that's fair game).
    const decoys = Array.from({ length: plan.decoys }, () =>
      pick(rng, ALPHABET.split(""))
    );
    let tiles = shuffle(rng, [...letters, ...decoys]);
    // Make sure the pile isn't accidentally already spelling the word.
    if (plan.decoys === 0 && tiles.join("") === word) {
      tiles = shuffle(rng, tiles);
      if (tiles.join("") === word) tiles = [...tiles.slice(1), tiles[0]];
    }
    return {
      word,
      hint,
      showHint: plan.showHint && hint.length > 0,
      tiles,
      duration: plan.duration,
    };
  });
}

type Phase = "intro" | "play" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
}

export function ScrambleGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [placed, setPlaced] = useState<number[]>([]); // tile indices, in order
  const [gap, setGap] = useState<Gap | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  const [rounds, setRounds] = useState<ScrambleRound[]>([]);
  const [summary, setSummary] = useState<{ score: number; emojis: string[] }>({
    score: 0,
    emojis: [],
  });

  // Game logic runs off refs so timer callbacks never read stale data.
  const roundsRef = useRef<ScrambleRound[]>([]);
  const roundRef = useRef(0);
  const placedRef = useRef<number[]>([]);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const elapsedRef = useRef(0);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(ROUNDS);
  const phaseRef = useRef<Phase>("intro");
  const lockedRef = useRef(false);
  const gapTimeoutRef = useRef(0);
  const timer = useCountdown();

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function setPlacedSafe(next: number[]) {
    placedRef.current = next;
    setPlaced(next);
  }

  function finish(didSurvive: boolean) {
    timer.stop();
    window.clearTimeout(gapTimeoutRef.current);
    const score = resultsRef.current.filter(Boolean).length;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    const display =
      modeRef.current === "daily" ? `${score}/${ROUNDS}` : `${score} words`;
    const isBest = submitBest("scramble", modeRef.current, {
      score,
      tiebreak: Math.round(elapsedRef.current), // total solve time breaks ties
      display,
    });
    if (modeRef.current === "daily") {
      setDailyResult("scramble", dailyNumber(), {
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

  function endRound(solved: boolean, msg: string) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const budget = roundsRef.current[roundRef.current].duration;
    elapsedRef.current += Math.max(0, budget - timer.remaining());
    timer.stop();
    resultsRef.current.push(solved);
    if (!solved) livesRef.current -= 1;
    setLives(livesRef.current);
    setGap({ ok: solved, msg });
    setPhaseSafe("gap");
    if (solved) sfx.success();
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
      solved ? 800 : 1400
    );
  }

  function beginRound() {
    const r = roundsRef.current[roundRef.current];
    setPlacedSafe([]);
    sfx.reveal();
    setPhaseSafe("play");
    timer.start(r.duration, () => endRound(false, `TIME! — ${r.word}`));
  }

  /** Called whenever the answer row changes; auto-submits when full. */
  function checkComplete(next: number[]) {
    const r = roundsRef.current[roundRef.current];
    if (next.length < r.word.length) return;
    const spelled = next.map((i) => r.tiles[i]).join("");
    if (spelled === r.word) {
      endRound(true, "SOLVED ✓");
    } else {
      // Wrong word: shake, shave time, clear the row — but keep the life.
      sfx.error();
      setShakeKey((k) => k + 1);
      timer.shave(WRONG_PENALTY);
      setPlacedSafe([]);
    }
  }

  function placeTile(i: number) {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    const r = roundsRef.current[roundRef.current];
    if (placedRef.current.includes(i)) return;
    if (placedRef.current.length >= r.word.length) return;
    sfx.tap();
    const next = [...placedRef.current, i];
    setPlacedSafe(next);
    checkComplete(next);
  }

  function removeAt(slot: number) {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    sfx.tap();
    const next = placedRef.current.filter((_, idx) => idx !== slot);
    setPlacedSafe(next);
  }

  function typeLetter(ch: string) {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    const r = roundsRef.current[roundRef.current];
    // Consume the first unused tile matching the typed letter.
    const i = r.tiles.findIndex(
      (t, idx) => t === ch && !placedRef.current.includes(idx)
    );
    if (i >= 0) placeTile(i);
  }

  function startRun(m: Mode) {
    totalRef.current = m === "daily" ? ROUNDS : SURVIVAL_CAP;
    const generated = generateRounds(rngFor("scramble", m), totalRef.current, m !== "daily");
    roundsRef.current = generated;
    setRounds(generated);
    resultsRef.current = [];
    elapsedRef.current = 0;
    livesRef.current = LIVES;
    roundRef.current = 0;
    lockedRef.current = false;
    modeRef.current = m;
    setMode(m);
    setLives(LIVES);
    setRound(0);
    setPlacedSafe([]);
    setGap(null);
    setNewBest(false);
    setSurvived(false);
    beginRound();
  }

  // Desktop: type letters, backspace to undo. Handlers read refs only.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        if (placedRef.current.length > 0) removeAt(placedRef.current.length - 1);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        typeLetter(e.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => window.clearTimeout(gapTimeoutRef.current), []);

  if (phase === "intro") {
    return (
      <IntroScreen
        game="scramble"
        title="SCRAMBLE"
        tagline="Unscramble the word. Ignore the junk."
        howTo={[
          "Tap the letter tiles to spell the hidden word before the clock runs out.",
          "Decoy letters are mixed into the pile — and the hint disappears once it gets hard.",
        ]}
        controlsHint="Tap the tiles · type on desktop · backspace to undo"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        game="scramble"
        gameName="Scramble"
        path="/scramble"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={
          mode === "daily" ? `${summary.score}/${ROUNDS}` : `${summary.score} words`
        }
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("scramble", mode)?.display ?? null}
        streak={streak}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const r = rounds[round];
  const wordLen = r?.word.length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-2.5 py-2 sm:gap-4 sm:py-4">
      <GameTitle game="scramble" title="SCRAMBLE" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          WORD {round + 1}
          {mode === "daily" ? `/${ROUNDS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "play" ? timer.progress : 1} />

      {/* Hint */}
      <p className="text-center font-pixel text-lg text-fog">
        {r?.showHint ? (
          <>
            hint: <span className="text-lemon">{r.hint}</span>
          </>
        ) : (
          <span className="opacity-60">no hint — you&apos;re on your own</span>
        )}
      </p>

      {/* Answer slots */}
      <div
        key={shakeKey}
        className={`${shakeKey > 0 ? "animate-shake" : ""} flex flex-wrap justify-center gap-1.5`}
      >
        {Array.from({ length: wordLen }, (_, slot) => {
          const tileIdx = placed[slot];
          const filled = tileIdx !== undefined;
          return (
            <button
              key={slot}
              type="button"
              onPointerDown={() => filled && removeAt(slot)}
              disabled={phase !== "play"}
              className={`flex h-12 w-10 items-center justify-center rounded-lg border-2 font-display text-2xl sm:h-14 sm:w-12 ${
                gap?.ok
                  ? "border-mint bg-panel2 text-mint"
                  : filled
                    ? "border-lemon bg-panel2 text-paper"
                    : "border-line bg-panel"
              }`}
            >
              {filled ? r.tiles[tileIdx] : ""}
            </button>
          );
        })}
      </div>

      {/* Letter pile */}
      <div className="flex flex-wrap justify-center gap-2 rounded-2xl border-2 border-line bg-panel p-4 shadow-chunk">
        {r?.tiles.map((ch, i) => {
          const used = placed.includes(i);
          return (
            <button
              key={i}
              type="button"
              onPointerDown={() => placeTile(i)}
              disabled={phase !== "play" || used}
              className={`flex h-12 w-10 items-center justify-center rounded-lg border-2 font-display text-2xl shadow-chunk-sm transition-transform active:translate-y-0.5 active:shadow-none sm:h-14 sm:w-12 ${
                used
                  ? "border-line bg-panel text-transparent"
                  : "border-line bg-panel2 text-paper hover:border-lemon"
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      {phase === "gap" && gap && (
        <p
          className={`animate-pop text-center font-display text-xl ${
            gap.ok ? "text-mint" : "text-coral"
          }`}
        >
          {gap.msg}
        </p>
      )}

      <p className="text-center font-pixel text-base text-fog">
        tap a slot to send a letter back · some tiles are junk
      </p>
    </div>
  );
}
