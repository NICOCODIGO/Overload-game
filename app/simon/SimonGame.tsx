"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { GameTitle } from "@/components/GameTitle";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { UNLIMITED_LIVES } from "@/lib/dev";
import { dailyNumber, ramp, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { derange, pick, type Rng } from "@/lib/rng";
import { useT, type T } from "@/lib/i18n";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const COLORS = ["red", "blue", "green", "yellow"] as const;
type SimonColor = (typeof COLORS)[number];

const BUTTON_BG: Record<SimonColor, string> = {
  red: "bg-btn-red",
  blue: "bg-btn-blue",
  green: "bg-btn-green",
  yellow: "bg-btn-yellow",
};

const ROUNDS = 30;
const LIVES = 3;
// Survival's practical "endless": 3 lives at sub-second timers never get
// close, and finishing it is a legend-tier RUN COMPLETE.
const SURVIVAL_CAP = 150;

interface Command {
  simonSays: boolean;
  /** color = match the button's color; label = match the word printed on it;
      wait = bait — any tap is an elimination. */
  kind: "color" | "label" | "wait";
  target: SimonColor;
  /** labels[i] is the word printed on button i (buttons stay in COLORS order).
      Identity for rounds 1–4, a derangement from round 5 (the Stroop trap). */
  labels: SimonColor[];
  duration: number;
}

function generateCommands(rng: Rng, total: number, survival: boolean): Command[] {
  const commands: Command[] = [];
  let stroopFlip = 0;
  for (let r = 0; r < total; r++) {
    // Survival squeezes past the daily's 1.25s floor — but stops at 1.15s.
    // A scrambled Stroop card costs ~400ms to read, ~250ms of interference,
    // ~400ms to choose among four, ~150ms to tap: floor any lower and the
    // round is unwinnable no matter how good the player is.
    const duration = survival
      ? Math.max(1.15, 2.7 - r * 0.055)
      : ramp(2.7, 1.25, r, ROUNDS);
    const scrambled = r >= 4;
    const labels = scrambled ? derange(rng, COLORS) : [...COLORS];

    // Idle trap: "SIMON SAYS GET READY…" — the only correct move is stillness.
    if (r >= 7 && rng() < 0.12) {
      commands.push({
        simonSays: true,
        kind: "wait",
        target: "red",
        labels,
        duration: duration + 0.4,
      });
      continue;
    }

    const kind: "color" | "label" = scrambled
      ? stroopFlip++ % 2 === 0
        ? "color"
        : "label"
      : "color";
    commands.push({
      simonSays: rng() < 0.62,
      kind,
      target: pick(rng, COLORS),
      labels,
      duration,
    });
  }
  return commands;
}

function commandText(cmd: Command, t: T): string {
  if (cmd.kind === "wait") return t.play.getReady;
  const color = t.play.colors[cmd.target];
  return cmd.kind === "label"
    ? t.play.tapWord(color)
    : t.play.tapButton(color);
}

type Phase = "intro" | "show" | "feedback" | "result";

interface Feedback {
  ok: boolean;
  msg: string;
}

export function SimonGame() {
  const t = useT();
  const g = t.games.simon;
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [commands, setCommands] = useState<Command[]>([]);
  const [summary, setSummary] = useState<{ score: number; emojis: string[] }>({
    score: 0,
    emojis: [],
  });

  // Game logic runs off refs so timer callbacks never read stale data.
  const commandsRef = useRef<Command[]>([]);
  const resultsRef = useRef<boolean[]>([]);
  const livesRef = useRef(LIVES);
  const roundRef = useRef(0);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(ROUNDS);
  // Blocks double-resolution of a round (e.g. key press racing timer expiry).
  const lockedRef = useRef(false);
  const timer = useCountdown();

  /** Score line, in the player's language. Derived from the raw score every
      render, so a record set in English reads correctly in Spanish. */
  const fmt = (score: number, m: Mode) =>
    m === "daily" ? `${score}/${ROUNDS}` : g.unit(score);

  function finish(didSurvive: boolean) {
    timer.stop();
    const score = resultsRef.current.filter(Boolean).length;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    const display = fmt(score, modeRef.current);
    const isBest = submitBest("simon", modeRef.current, { score, display });
    if (modeRef.current === "daily") {
      setDailyResult("simon", dailyNumber(), {
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
        setPhase("show");
      }
    }, 750);
  }

  function handleTap(buttonIndex: number) {
    const cmd = commandsRef.current[roundRef.current];
    if (!cmd || lockedRef.current) return;
    sfx.tap();
    if (cmd.kind === "wait") {
      advance(false, t.fb.neverTap);
      return;
    }
    if (!cmd.simonSays) {
      advance(false, t.fb.didntSay);
      return;
    }
    const correct =
      cmd.kind === "color"
        ? COLORS[buttonIndex] === cmd.target
        : cmd.labels[buttonIndex] === cmd.target;
    if (correct) {
      advance(true, t.fb.nice);
    } else {
      advance(false, cmd.kind === "label" ? t.fb.wordNotColor : t.fb.wrongButton);
    }
  }

  function startRun(m: Mode) {
    totalRef.current = m === "daily" ? ROUNDS : SURVIVAL_CAP;
    const cmds = generateCommands(rngFor("simon", m), totalRef.current, m !== "daily");
    commandsRef.current = cmds;
    setCommands(cmds);
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
    setPhase("show");
  }

  // Each time a round is shown, arm the countdown.
  useEffect(() => {
    if (phase !== "show") return;
    const cmd = commandsRef.current[roundRef.current];
    sfx.reveal();
    timer.start(cmd.duration, () => {
      // Timer expiry is CORRECT when the move was to do nothing.
      const shouldHold = !cmd.simonSays || cmd.kind === "wait";
      if (shouldHold) {
        advance(true, cmd.kind === "wait" ? t.fb.patience : t.fb.didntSayOk);
      } else {
        advance(false, t.fb.tooSlow);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  // Desktop: keys 1–4 map to the four buttons.
  useEffect(() => {
    if (phase !== "show") return;
    const onKey = (e: KeyboardEvent) => {
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0) handleTap(idx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "intro") {
    return <IntroScreen game="simon" format={fmt} onStart={startRun} />;
  }

  if (phase === "result") {
    const best = getBest("simon", mode);
    return (
      <ResultScreen
        game="simon"
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

  const cmd = commands[round];

  return (
    <div className="flex flex-1 flex-col gap-2.5 py-2 sm:gap-4 sm:py-4">
      <GameTitle game="simon" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          {g.counter} {round + 1}
          {mode === "daily" ? `/${ROUNDS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "show" ? timer.progress : 0} />

      {/* Command card */}
      <div className="relative flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 border-line bg-panel p-4 text-center shadow-chunk sm:min-h-36 sm:p-6">
        {phase === "feedback" && feedback ? (
          <p
            className={`animate-pop font-display text-2xl ${
              feedback.ok ? "text-mint" : "text-coral"
            }`}
          >
            {feedback.msg}
          </p>
        ) : (
          cmd && (
            <>
              {cmd.simonSays && (
                <span className="animate-stamp mb-2 inline-block rounded border-2 border-lemon px-3 py-1 font-display text-sm text-lemon">
                  {t.play.simonSays}
                </span>
              )}
              <p className="font-display text-2xl leading-snug" key={round}>
                {commandText(cmd, t)}
              </p>
            </>
          )
        )}
      </div>

      {/* The four buttons */}
      <div className="grid grid-cols-2 gap-3">
        {COLORS.map((color, i) => {
          // The printed word is the Stroop trap, so it has to be translated
          // alongside the command — otherwise the lie stops reading as a lie.
          const label = t.play.colors[cmd?.labels[i] ?? color];
          return (
            <button
              key={color}
              type="button"
              disabled={phase !== "show"}
              onPointerDown={() => phase === "show" && handleTap(i)}
              className={`${BUTTON_BG[color]} h-20 rounded-2xl border-2 border-black/40 font-display text-2xl shadow-chunk transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60 sm:h-28 ${
                color === "yellow" || color === "green"
                  ? "text-ink"
                  : "text-white"
              }`}
              aria-label={t.play.buttonAria(t.play.colors[color], label)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-fog">{g.hint}</p>
    </div>
  );
}
