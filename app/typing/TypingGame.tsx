"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { shuffle, type Rng } from "@/lib/rng";
import { MEDIUM_WORDS, PHRASES, SHORT_WORDS } from "@/lib/words";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const PROMPTS = 20;
const LIVES = 3;

/**
 * 20 prompts escalating from single short words to full punctuated phrases.
 * Pools are shuffled (not sampled) so a daily run never repeats a prompt.
 */
function generatePrompts(rng: Rng): string[] {
  const short = shuffle(rng, SHORT_WORDS);
  const medium = shuffle(rng, MEDIUM_WORDS);
  const phrases = shuffle(rng, PHRASES)
    .slice(0, 8)
    .sort((a, b) => a.length - b.length);
  return [
    ...short.slice(0, 6), // 1–6: quick single words
    ...medium.slice(0, 4), // 7–10: longer words
    ...[0, 1].map((i) => `${short[6 + i]} ${medium[4 + i]}`), // 11–12: pairs
    ...phrases, // 13–20: phrases, shortest first
  ];
}

/** Per-prompt time: generous for early rounds, stingier every prompt. */
function promptDuration(index: number, text: string): number {
  const perChar = Math.max(0.3, 0.46 - index * 0.008);
  return 1.2 + text.length * perChar;
}

type Phase = "intro" | "typing" | "result";

export function TypingGame() {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useCountdown();

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
    const display = `${score}/${PROMPTS} · ${acc}%`;
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
    sfx.reveal();
    const text = promptsRef.current[idx];
    timer.start(promptDuration(idx, text), () => {
      // Clock beat the fingers.
      resultsRef.current.push(false);
      livesRef.current -= 1;
      setLives(livesRef.current);
      sfx.error();
      if (livesRef.current <= 0) {
        finish(false);
      } else if (idx + 1 >= PROMPTS) {
        finish(true);
      } else {
        nextPrompt(idx + 1);
      }
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
      if (indexRef.current + 1 >= PROMPTS) {
        finish(true);
      } else {
        nextPrompt(indexRef.current + 1);
      }
    }
  }

  function startRun(m: Mode) {
    const generated = generatePrompts(rngFor("typing", m));
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

  if (phase === "intro") {
    return (
      <IntroScreen
        game="typing"
        title="PANIC TYPE"
        tagline="Precision typing with a gun to your deadline."
        howTo={[
          "Type each prompt exactly — capitals, punctuation, everything — before the bar empties.",
          "Typos flash red and must be backspaced. Miss the clock and you lose a life.",
        ]}
        controlsHint="Just type · on-screen keyboard on mobile"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        game="typing"
        gameName="Panic Type"
        path="/typing"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={`${summary.score}/${PROMPTS} · ${summary.acc}%`}
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("typing", mode)?.display ?? null}
        streak={streak}
        extraStats={[{ label: "Accuracy", value: `${summary.acc}%` }]}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const target = prompts[index] ?? "";

  return (
    <div
      className="flex flex-1 flex-col gap-4 py-4"
      onPointerDown={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          PROMPT {index + 1}/{PROMPTS}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={timer.progress} />

      {/* Target text, graded per character */}
      <div
        key={errKey}
        className={`${
          errKey > 0 ? "animate-shake" : ""
        } flex min-h-36 items-center justify-center rounded-2xl border-2 border-line bg-panel p-6 shadow-chunk`}
      >
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
        aria-label="Type the prompt here"
        placeholder="type here…"
        className="w-full rounded-xl border-2 border-line bg-panel2 px-4 py-3 text-center font-mono text-xl text-paper placeholder:text-fog/50 focus:border-lemon focus:outline-none"
      />

      <p className="text-center text-xs text-fog">
        exact match — capitals &amp; punctuation count
      </p>
    </div>
  );
}
