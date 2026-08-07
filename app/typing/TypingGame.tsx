"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { GameTitle } from "@/components/GameTitle";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { UNLIMITED_LIVES } from "@/lib/dev";
import { haptics } from "@/lib/haptics";
import { useKeyboardFit } from "@/lib/hooks";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { shuffle, type Rng } from "@/lib/rng";
import { MEDIUM_WORDS, PHRASES, SHORT_WORDS } from "@/lib/words";
import { useT } from "@/lib/i18n";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const PROMPTS = 20;
const LIVES = 3;
const SURVIVAL_CAP = 150;

/**
 * Swap "smart" typography for keys a player actually has — em/en dashes,
 * curly quotes, and ellipsis are unfair to demand in a typing game.
 */
function typeable(s: string): string {
  return s
    .replace(/[—–]/g, "-") // em/en dash → hyphen
    .replace(/[“”]/g, '"') // curly double quotes → straight
    .replace(/[‘’]/g, "'") // curly single quotes → straight
    .replace(/…/g, "..."); // ellipsis → three dots
}

/**
 * 20 prompts escalating from single short words to full punctuated phrases.
 * Pools are shuffled (not sampled) so a run never repeats a prompt.
 */
function generatePrompts(rng: Rng, total: number): string[] {
  const short = shuffle(rng, SHORT_WORDS);
  const medium = shuffle(rng, MEDIUM_WORDS);
  const phrases = shuffle(rng, PHRASES);
  const prompts = [
    ...short.slice(0, 6), // 1–6: quick single words
    ...medium.slice(0, 4), // 7–10: longer words
    ...[0, 1].map((i) => `${short[6 + i]} ${medium[4 + i]}`), // 11–12: pairs
    // 13–20: phrases, shortest first
    ...phrases.slice(0, 8).sort((a, b) => a.length - b.length),
  ];
  // Unlimited: keep cycling word → phrase → pair forever, timers shrinking.
  // Cursors pick up past what the opening 20 already consumed and walk the
  // shuffled pools in order, so a run works through the whole pool before
  // repeating anything. Sampling with `pick` served duplicate phrases within
  // the first handful of prompts no matter how large the pool got.
  const at = (pool: readonly string[], cursor: number) =>
    pool[cursor % pool.length];
  let si = 8;
  let mi = 6;
  let pi = 8;
  for (let i = prompts.length; i < total; i++) {
    const cyc = i % 3;
    prompts.push(
      cyc === 0
        ? at(medium, mi++)
        : cyc === 1
          ? at(phrases, pi++)
          : `${at(short, si++)} ${at(medium, mi++)}`
    );
  }
  return prompts.map(typeable);
}

/**
 * Per-prompt time: generous early, stingier every prompt, with a hard floor.
 * At 0.26s/char plus the 1.2s read-in, a 30-char phrase allows ~9s — about
 * 45 WPM sustained with zero typos. Demanding but humanly typeable; below
 * this, survival would end on arithmetic rather than skill.
 */
function promptDuration(index: number, text: string): number {
  const perChar = Math.max(0.26, 0.46 - index * 0.008);
  return 1.2 + text.length * perChar;
}

type Phase = "intro" | "typing" | "miss" | "result";

export function TypingGame() {
  const t = useT();
  const g = t.games.typing;
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [lives, setLives] = useState(LIVES);
  const [errKey, setErrKey] = useState(0); // bumps on wrong char → red flash
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [prompts, setPrompts] = useState<string[]>([]);
  const [summary, setSummary] = useState<{
    score: number;
    acc: number;
    emojis: string[];
  }>({ score: 0, acc: 100, emojis: [] });

  // Game logic runs off refs so timer callbacks never read stale data.
  const promptsRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const totalKeysRef = useRef(0);
  const correctKeysRef = useRef(0);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(PROMPTS);
  const inputRef = useRef<HTMLInputElement>(null);
  const missTimeoutRef = useRef(0);
  const timer = useCountdown();

  /** Score line, in the player's language. Derived from the raw score every
      render, so a record set in English reads correctly in Spanish. */
  const fmt = (score: number, m: Mode) =>
    m === "daily" ? `${score}/${PROMPTS}` : g.unit(score);

  function accuracy(): number {
    return totalKeysRef.current === 0
      ? 100
      : Math.round((correctKeysRef.current / totalKeysRef.current) * 100);
  }

  function finish(didSurvive: boolean) {
    timer.stop();
    const score = resultsRef.current.filter(Boolean).length;
    const acc = accuracy();
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    // Accuracy still breaks ties internally, but the shown score stays clean.
    const display = fmt(score, modeRef.current);
    const isBest = submitBest("typing", modeRef.current, {
      score,
      tiebreak: 100 - acc, // higher accuracy breaks ties
      display,
    });
    if (modeRef.current === "daily") {
      setDailyResult("typing", dailyNumber(), {
        display,
        emojis: emojis.join(""),
      });
      setStreak(bumpStreak());
    }
    setSummary({ score, acc, emojis });
    setNewBest(isBest);
    setSurvived(didSurvive);
    setPhase("result");
    if (didSurvive) sfx.fanfare();
    else sfx.gameOver();
  }

  function nextPrompt(idx: number) {
    indexRef.current = idx;
    setIndex(idx);
    setValue("");
    setPhase("typing");
    sfx.reveal();
    const text = promptsRef.current[idx];
    timer.start(promptDuration(idx, text), () => {
      // Clock beat the fingers.
      resultsRef.current.push(false);
      if (!UNLIMITED_LIVES) livesRef.current -= 1;
      setLives(livesRef.current);
      sfx.error();
      haptics.fail();
      // A short beat on the miss: the next prompt doesn't snap in under your
      // fingers, so keystrokes still finishing the old word don't corrupt it.
      setPhase("miss");
      missTimeoutRef.current = window.setTimeout(() => {
        if (livesRef.current <= 0) {
          finish(false);
        } else if (idx + 1 >= totalRef.current) {
          finish(true);
        } else {
          nextPrompt(idx + 1);
        }
      }, 1200);
    });
    inputRef.current?.focus();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (phase !== "typing") return;
    const target = promptsRef.current[indexRef.current];
    const prev = value;
    const next = e.target.value;

    // Count every added character; grade it against its landing position.
    if (next.length > prev.length) {
      let sawError = false;
      for (let i = prev.length; i < next.length; i++) {
        totalKeysRef.current += 1;
        if (next[i] === target[i]) correctKeysRef.current += 1;
        else sawError = true;
      }
      if (sawError) {
        setErrKey((k) => k + 1);
        sfx.error();
        // The one cue that reaches a player watching their own thumbs.
        haptics.error();
      } else {
        sfx.tap();
      }
    }
    setValue(next);

    if (next === target) {
      // Exact match — prompt survived.
      timer.stop();
      resultsRef.current.push(true);
      sfx.success();
      if (indexRef.current + 1 >= totalRef.current) {
        finish(true);
      } else {
        nextPrompt(indexRef.current + 1);
      }
    }
  }

  function startRun(m: Mode) {
    totalRef.current = m === "daily" ? PROMPTS : SURVIVAL_CAP;
    const generated = generatePrompts(rngFor("typing", m), totalRef.current);
    promptsRef.current = generated;
    setPrompts(generated);
    resultsRef.current = [];
    livesRef.current = LIVES;
    totalKeysRef.current = 0;
    correctKeysRef.current = 0;
    modeRef.current = m;
    setMode(m);
    setLives(LIVES);
    setNewBest(false);
    setSurvived(false);
    setPhase("typing");
    nextPrompt(0);
  }

  // Keep the input focused for the whole run — taps anywhere refocus it.
  useEffect(() => {
    if (phase === "typing") inputRef.current?.focus();
  }, [phase, index]);

  // …and keep the phone's keyboard from shoving the title and timer offscreen
  // (held through the brief miss beat so the layout doesn't jump).
  useKeyboardFit(phase === "typing" || phase === "miss");

  // Clean up the miss-grace timeout if the player leaves mid-beat.
  useEffect(() => () => window.clearTimeout(missTimeoutRef.current), []);

  if (phase === "intro") {
    return <IntroScreen game="typing" format={fmt} onStart={startRun} />;
  }

  if (phase === "result") {
    const best = getBest("typing", mode);
    return (
      <ResultScreen
        game="typing"
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

  const target = prompts[index] ?? "";

  return (
    // min-h-0 + overflow-hidden: with the keyboard up there may only be a few
    // hundred px to work with, and nothing here is worth scrolling to reach.
    <div
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden py-2 sm:gap-4 sm:py-4"
      onPointerDown={() => inputRef.current?.focus()}
    >
      <GameTitle game="typing" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          {g.counter} {index + 1}
          {mode === "daily" ? `/${PROMPTS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={timer.progress} />

      {/* Target text, graded per character */}
      <div
        key={errKey}
        className={`${
          errKey > 0 ? "animate-shake" : ""
        } flex min-h-24 flex-1 items-center justify-center overflow-hidden rounded-2xl border-2 border-line bg-panel p-4 shadow-chunk sm:min-h-36 sm:flex-none sm:p-6`}
      >
        {phase === "miss" ? (
          <p className="animate-pop text-center font-display text-3xl text-coral">
            {t.fb.timesUp}
          </p>
        ) : (
        <p className="text-center font-mono text-2xl leading-relaxed tracking-wide break-words">
          {target.split("").map((ch, i) => {
            const typed = i < value.length;
            const correct = typed && value[i] === ch;
            const isCaret = i === value.length;
            return (
              <span
                key={i}
                className={
                  correct
                    ? "text-mint"
                    : typed
                      ? "rounded bg-coral/40 text-coral"
                      : isCaret
                        ? "rounded bg-panel2 text-paper underline decoration-lemon decoration-4 underline-offset-4"
                        : "text-fog"
                }
              >
                {/* Highlighted spaces need visible width */}
                {ch === " " && (isCaret || (typed && !correct)) ? " " : ch}
              </span>
            );
          })}
          {/* Overtyped tail beyond the target */}
          {value.length > target.length && (
            <span className="rounded bg-coral/40 text-coral">
              {value.slice(target.length)}
            </span>
          )}
        </p>
        )}
      </div>

      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onPaste={(e) => e.preventDefault()}
        onBlur={() => setTimeout(() => inputRef.current?.focus(), 0)}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="go"
        aria-label={t.play.typeAria}
        placeholder={t.play.typeHere}
        className="w-full rounded-xl border-2 border-line bg-panel2 px-4 py-3 text-center font-mono text-xl text-paper placeholder:text-fog/50 focus:border-lemon focus:outline-none"
      />

      {/* Flavour only, and the intro already says it — on a phone the space
          it costs is better spent on the prompt. */}
    </div>
  );
}
