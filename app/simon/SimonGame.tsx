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
/** How long "GET READY TO TAP…" holds before the real command lands. Long
    enough to read and to tempt an itchy finger, short enough that the round
    never reads as dead air. The countdown is only armed once the hold ends,
    so this costs the player no answer time. */
const FEINT_MS = 700;
/** Longest streak of consecutive rounds allowed to share a verdict.
 *
 * A non-says round is won by sitting still until the clock expires, so a run
 * of them is pure dead air — worst at the start, where the ramp's timers are
 * longest and feints haven't armed yet. Left to an unbiased coin, ~1 daily in
 * 10 opened with four or more of them: about 13 seconds of doing nothing
 * before the game got going. Says streaks are cheaper, but a long one lets the
 * "don't tap" trap go dormant until it reads as a gotcha rather than a test of
 * attention, so it gets a looser cap of its own. */
const MAX_QUIET_RUN = 2;
const MAX_SAYS_RUN = 4;

interface Command {
  simonSays: boolean;
  /** color = match the button's color; label = match the word printed on it. */
  kind: "color" | "label";
  target: SimonColor;
  /** labels[i] is the word printed on button i (buttons stay in COLORS order).
      Identity for rounds 1–4, a derangement from round 5 (the Stroop trap). */
  labels: SimonColor[];
  duration: number;
  /** Opens on "GET READY TO TAP…", then the real command lands. Tapping during
      the hold is an elimination, so the round tests impulse control and *then*
      reaction — where the old version asked the player to sit still and do
      nothing at all for the whole timer. */
  feint?: boolean;
}

function generateCommands(rng: Rng, total: number, survival: boolean): Command[] {
  const commands: Command[] = [];
  let stroopFlip = 0;
  // The verdict the run is currently on, and how long it has held it.
  let runVerdict = false;
  let runLength = 0;
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

    // Feint: opens on "GET READY TO TAP…" before the command shows.
    let feint = r >= 7 && rng() < 0.12;
    // Drawn every round even when the streak cap overrides it below, so a cap
    // never shifts the RNG stream and the seed still fixes the whole daily.
    const says = rng() < 0.62;
    // A feint always follows through. The hold is the trap, so what lands
    // after it has to be a command the player is required to answer —
    // otherwise the round has two "do nothing" answers and no tension.
    let simonSays = feint || says;
    // Break a streak that has run its length, whichever verdict it's on.
    const cap = runVerdict ? MAX_SAYS_RUN : MAX_QUIET_RUN;
    if (runLength >= cap && simonSays === runVerdict) simonSays = !runVerdict;
    // Being capped into a non-say costs the round its feint, since a hold that
    // resolves to "do nothing" is the follow-through the rule above forbids.
    if (!simonSays) feint = false;
    if (simonSays === runVerdict) {
      runLength += 1;
    } else {
      runVerdict = simonSays;
      runLength = 1;
    }
    const kind: "color" | "label" = scrambled
      ? stroopFlip++ % 2 === 0
        ? "color"
        : "label"
      : "color";
    commands.push({
      simonSays,
      kind,
      target: pick(rng, COLORS),
      labels,
      duration,
      feint,
    });
  }
  return commands;
}

function commandText(cmd: Command, t: T): string {
  const color = t.play.colors[cmd.target];
  return cmd.kind === "label"
    ? t.play.tapWord(color)
    : t.play.tapButton(color);
}

type Phase = "intro" | "ready" | "show" | "feedback" | "result";

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
        setPhase(
          commandsRef.current[roundRef.current]?.feint ? "ready" : "show"
        );
      }
    }, 750);
  }

  function handleTap(buttonIndex: number) {
    const cmd = commandsRef.current[roundRef.current];
    if (!cmd || lockedRef.current) return;
    sfx.tap();
    // Still holding on "GET READY TO TAP…" — the command hasn't landed yet.
    if (phase === "ready") {
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
    setPhase(cmds[0]?.feint ? "ready" : "show");
  }

  // Feint rounds hold on "GET READY TO TAP…" first. The countdown isn't armed
  // until this ends and the "show" effect below takes over, so the hold never
  // eats into the player's answer time.
  useEffect(() => {
    if (phase !== "ready") return;
    sfx.reveal();
    const id = window.setTimeout(() => setPhase("show"), FEINT_MS);
    return () => window.clearTimeout(id);
  }, [phase, round]);

  // Each time a round is shown, arm the countdown.
  useEffect(() => {
    if (phase !== "show") return;
    const cmd = commandsRef.current[roundRef.current];
    sfx.reveal();
    timer.start(cmd.duration, () => {
      // Letting the clock run out is only correct when Simon didn't say.
      if (!cmd.simonSays) {
        advance(true, t.fb.didntSayOk);
      } else {
        advance(false, t.fb.tooSlow);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  // Desktop: keys 1–4 map to the four buttons. Live during the feint hold too,
  // or a keyboard player could mash through it unpunished.
  useEffect(() => {
    if (phase !== "show" && phase !== "ready") return;
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

      {/* Full (not empty) during the feint — the clock hasn't started yet. */}
      <TimerBar
        progress={
          phase === "show" ? timer.progress : phase === "ready" ? 1 : 0
        }
      />

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
            /* The stamp is positioned against this wrapper, not the card, so
               it tracks the command text however that text wraps. */
            <div className="relative">
              {cmd.simonSays && (
                /* Out of flow on purpose: in flow it took real height and
                   shoved the command down, so the line moved every time the
                   stamp appeared. Now the text holds its place and the stamp
                   lands across the top of it.

                   Two spans because the animation owns `transform` — putting
                   the centering translate on the same element would let
                   stamp-in overwrite it (and `both` would keep it overwritten
                   after the animation ends). Outer positions, inner animates. */
                /* -translate-y is the overlap dial, as a % of the stamp's own
                   height: 100% sits it flush on the text's top edge, 50% would
                   put its middle on that edge. Kept at 100% so it never covers
                   a glyph — the word it used to land on ("YELLOW", "RED") is
                   the one the player has to read to answer, on a timed round
                   that now costs a life to get wrong. */
                <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full">
                  <span className="animate-stamp inline-block whitespace-nowrap rounded border-2 border-lemon bg-panel px-3 py-1 font-display text-sm text-lemon shadow-chunk-sm">
                    {t.play.simonSays}
                  </span>
                </span>
              )}
              <p className="font-display text-2xl leading-snug" key={round}>
                {phase === "ready" ? t.play.getReady : commandText(cmd, t)}
              </p>
            </div>
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
              disabled={phase !== "show" && phase !== "ready"}
              onPointerDown={() =>
                (phase === "show" || phase === "ready") && handleTap(i)
              }
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

    </div>
  );
}
