"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { dailyNumber, ramp, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { derange, pick, type Rng } from "@/lib/rng";
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

function generateCommands(rng: Rng): Command[] {
  const commands: Command[] = [];
  let stroopFlip = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const duration = ramp(2.7, 1.25, r, ROUNDS);
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

function commandText(cmd: Command): string {
  if (cmd.kind === "wait") return "GET READY TO TAP…";
  if (cmd.kind === "label") return `TAP THE WORD “${cmd.target.toUpperCase()}”`;
  return `TAP THE ${cmd.target.toUpperCase()} BUTTON`;
}

type Phase = "intro" | "show" | "feedback" | "result";

interface Feedback {
  ok: boolean;
  msg: string;
}

export function SimonGame() {
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
  // Blocks double-resolution of a round (e.g. key press racing timer expiry).
  const lockedRef = useRef(false);
  const timer = useCountdown();

  function finish(didSurvive: boolean) {
    timer.stop();
    const score = resultsRef.current.filter(Boolean).length;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    const display = `${score}/${ROUNDS}`;
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
    if (!passed) livesRef.current -= 1;
    setLives(livesRef.current);
    setFeedback({ ok: passed, msg });
    setPhase("feedback");
    if (passed) sfx.success();
    else sfx.error();

    window.setTimeout(() => {
      if (livesRef.current <= 0) {
        finish(false);
      } else if (roundRef.current + 1 >= ROUNDS) {
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
      advance(false, "IT SAID GET READY — NEVER TAP!");
      return;
    }
    if (!cmd.simonSays) {
      advance(false, "SIMON DIDN'T SAY!");
      return;
    }
    const correct =
      cmd.kind === "color"
        ? COLORS[buttonIndex] === cmd.target
        : cmd.labels[buttonIndex] === cmd.target;
    if (correct) {
      advance(true, "NICE ✓");
    } else {
      advance(
        false,
        cmd.kind === "label" ? "THE WORD, NOT THE COLOR!" : "WRONG BUTTON!"
      );
    }
  }

  function startRun(m: Mode) {
    const cmds = generateCommands(rngFor("simon", m));
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
        advance(
          true,
          cmd.kind === "wait" ? "PATIENCE PAYS ✓" : "SIMON DIDN'T SAY ✓"
        );
      } else {
        advance(false, "TOO SLOW!");
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
    return (
      <IntroScreen
        game="simon"
        title="SIMON SAYS"
        tagline="Obedience training for your reflexes."
        howTo={[
          "Only obey a card stamped SIMON SAYS — otherwise freeze and let the clock run out.",
          "From round 5 the button labels lie: check if the card wants the COLOR or the WORD.",
        ]}
        controlsHint="Tap the buttons · keys 1–4 on desktop"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        game="simon"
        gameName="Simon Says"
        path="/simon"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={`${summary.score}/${ROUNDS}`}
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("simon", mode)?.display ?? null}
        streak={streak}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const cmd = commands[round];

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          ROUND {round + 1}/{ROUNDS}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "show" ? timer.progress : 0} />

      {/* Command card */}
      <div className="relative flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-line bg-panel p-6 text-center shadow-chunk">
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
                  SIMON SAYS
                </span>
              )}
              <p className="font-display text-2xl leading-snug" key={round}>
                {commandText(cmd)}
              </p>
            </>
          )
        )}
      </div>

      {/* The four buttons */}
      <div className="grid grid-cols-2 gap-3">
        {COLORS.map((color, i) => (
          <button
            key={color}
            type="button"
            disabled={phase !== "show"}
            onPointerDown={() => phase === "show" && handleTap(i)}
            className={`${BUTTON_BG[color]} h-28 rounded-2xl border-2 border-black/40 font-display text-2xl shadow-chunk transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60 ${
              color === "yellow" || color === "green"
                ? "text-ink"
                : "text-white"
            }`}
            aria-label={`${color} button labeled ${cmd?.labels[i] ?? color}`}
          >
            {(cmd?.labels[i] ?? color).toUpperCase()}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-fog">
        No stamp? Don&apos;t touch anything.
      </p>
    </div>
  );
}
