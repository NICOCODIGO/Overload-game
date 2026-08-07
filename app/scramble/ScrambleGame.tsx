"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { Lives } from "@/components/Lives";
import { GameTitle } from "@/components/GameTitle";
import { sfx } from "@/lib/audio";
import { UNLIMITED_LIVES } from "@/lib/dev";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { pick, randInt, shuffle, type Rng } from "@/lib/rng";
import { WORD_POOLS } from "@/lib/scramble";
import { useT } from "@/lib/i18n";
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
  /** No-hint rounds pre-place one correct letter as a foothold. Slot position
      is random; -1 means no anchor (hint rounds don't need one). */
  anchorSlot: number;
  /** Index into `tiles` of the locked anchor letter (-1 when no anchor). */
  anchorTile: number;
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
    const showHint = plan.showHint && hint.length > 0;
    // No hint? Lock one correct letter into a random slot as a foothold.
    let anchorSlot = -1;
    let anchorTile = -1;
    if (!showHint) {
      anchorSlot = randInt(rng, 0, word.length - 1);
      anchorTile = tiles.findIndex((t) => t === word[anchorSlot]);
    }
    return {
      word,
      hint,
      showHint,
      tiles,
      duration: plan.duration,
      anchorSlot,
      anchorTile,
    };
  });
}

type Phase = "intro" | "play" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
}

export function ScrambleGame() {
  const t = useT();
  const g = t.games.scramble;
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  // One entry per letter position: the tile index placed there, or null. Fixed
  // slots (not a running list) so the locked anchor can sit at any position.
  const [slots, setSlots] = useState<(number | null)[]>([]);
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
  const slotsRef = useRef<(number | null)[]>([]);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const elapsedRef = useRef(0);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(ROUNDS);
  const phaseRef = useRef<Phase>("intro");
  const lockedRef = useRef(false);
  const gapTimeoutRef = useRef(0);
  const timer = useCountdown();

  /** Score line, in the player's language. Derived from the raw score every
      render, so a record set in English reads correctly in Spanish. */
  const fmt = (score: number, m: Mode) =>
    m === "daily" ? `${score}/${ROUNDS}` : g.unit(score);

  function setPhaseSafe(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function setSlotsSafe(next: (number | null)[]) {
    slotsRef.current = next;
    setSlots(next);
  }

  /** Fresh slots for a round: all empty, with the anchor letter locked in. */
  function initSlots(r: ScrambleRound): (number | null)[] {
    const next: (number | null)[] = Array(r.word.length).fill(null);
    if (r.anchorSlot >= 0) next[r.anchorSlot] = r.anchorTile;
    return next;
  }

  function finish(didSurvive: boolean) {
    timer.stop();
    window.clearTimeout(gapTimeoutRef.current);
    const score = resultsRef.current.filter(Boolean).length;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    const display = fmt(score, modeRef.current);
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
    if (!solved && !UNLIMITED_LIVES) livesRef.current -= 1;
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
    setSlotsSafe(initSlots(r));
    sfx.reveal();
    setPhaseSafe("play");
    // On a timeout the answer gets spelled out in the slots (see render), so
    // the message just names the miss rather than repeating the word.
    timer.start(r.duration, () => endRound(false, t.fb.timesUp));
  }

  /** Called whenever the answer row changes; auto-submits when full. */
  function checkComplete(next: (number | null)[]) {
    const r = roundsRef.current[roundRef.current];
    if (next.some((s) => s === null)) return; // not full yet
    const spelled = next.map((s) => r.tiles[s as number]).join("");
    if (spelled === r.word) {
      endRound(true, t.fb.solved);
    } else {
      // Wrong word: shake, shave time, clear the row — but keep the life (and
      // the locked anchor).
      sfx.error();
      setShakeKey((k) => k + 1);
      timer.shave(WRONG_PENALTY);
      setSlotsSafe(initSlots(r));
    }
  }

  function placeTile(i: number) {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    if (slotsRef.current.includes(i)) return; // tile already placed
    const slot = slotsRef.current.findIndex((s) => s === null);
    if (slot < 0) return; // row full
    sfx.tap();
    const next = [...slotsRef.current];
    next[slot] = i;
    setSlotsSafe(next);
    checkComplete(next);
  }

  function removeAt(slot: number) {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    const r = roundsRef.current[roundRef.current];
    if (slot === r.anchorSlot || slotsRef.current[slot] === null) return;
    sfx.tap();
    const next = [...slotsRef.current];
    next[slot] = null;
    setSlotsSafe(next);
  }

  /** Backspace: clear the last filled (non-anchor) slot. */
  function removeLast() {
    const r = roundsRef.current[roundRef.current];
    for (let s = slotsRef.current.length - 1; s >= 0; s--) {
      if (s !== r.anchorSlot && slotsRef.current[s] !== null) {
        removeAt(s);
        return;
      }
    }
  }

  function typeLetter(ch: string) {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    const r = roundsRef.current[roundRef.current];
    // Consume the first unused tile matching the typed letter.
    const i = r.tiles.findIndex(
      (t, idx) => t === ch && !slotsRef.current.includes(idx)
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
    setSlotsSafe([]);
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
        removeLast();
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
    return <IntroScreen game="scramble" format={fmt} onStart={startRun} />;
  }

  if (phase === "result") {
    const best = getBest("scramble", mode);
    return (
      <ResultScreen
        game="scramble"
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
  const wordLen = r?.word.length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-2.5 py-2 sm:gap-4 sm:py-4">
      <GameTitle game="scramble" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          {g.counter} {round + 1}
          {mode === "daily" ? `/${ROUNDS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "play" ? timer.progress : 1} />

      {/* Hint */}
      <p className="text-center font-pixel text-lg text-fog">
        {r?.showHint ? (
          <>
            {t.play.hintLabel} <span className="text-lemon">{r.hint}</span>
          </>
        ) : (
          <span className="opacity-60">{t.play.noHint}</span>
        )}
      </p>

      {/* Answer slots. On a timeout we spell the missed word straight into the
          slots (coral) so the player sees the answer where they were building
          it, instead of reading it off a line of text. */}
      <div
        key={shakeKey}
        className={`${shakeKey > 0 ? "animate-shake" : ""} flex flex-wrap justify-center gap-1.5`}
      >
        {Array.from({ length: wordLen }, (_, slot) => {
          const revealing = phase === "gap" && gap !== null && !gap.ok;
          const isAnchor = r.anchorSlot === slot;
          const tileIdx = slots[slot];
          const filled = tileIdx != null;
          const letter = revealing
            ? r.word[slot]
            : tileIdx != null
              ? r.tiles[tileIdx]
              : "";
          return (
            <button
              key={slot}
              type="button"
              onPointerDown={() => filled && !isAnchor && removeAt(slot)}
              disabled={phase !== "play" || isAnchor}
              className={`flex h-12 w-10 items-center justify-center rounded-lg border-2 font-display text-2xl sm:h-14 sm:w-12 ${
                isAnchor
                  ? // The free letter — locked in its right spot, always green.
                    "border-mint bg-mint/15 text-mint"
                  : revealing
                    ? "border-coral bg-panel2 text-coral"
                    : gap?.ok
                      ? "border-mint bg-panel2 text-mint"
                      : filled
                        ? "border-lemon bg-panel2 text-paper"
                        : "border-line bg-panel"
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Letter pile — always visible; you need to see the scramble to solve
          it. On a round end the verdict is dropped right on top of it, where
          your eyes already are. */}
      <div className="relative flex flex-wrap justify-center gap-2 rounded-2xl border-2 border-line bg-panel p-4 shadow-chunk">
        {r?.tiles.map((ch, i) => {
          const used = slots.includes(i);
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

        {phase === "gap" && gap && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p
              className={`animate-pop rounded-xl border-2 px-5 py-2.5 font-display text-xl backdrop-blur ${
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
