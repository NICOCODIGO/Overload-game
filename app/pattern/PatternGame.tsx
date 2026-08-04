"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { GameTitle } from "@/components/GameTitle";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { UNLIMITED_LIVES } from "@/lib/dev";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { distinctRounds, pick, randInt, shuffle, type Rng } from "@/lib/rng";
import { useT, type RuleSpec } from "@/lib/i18n";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const ROUNDS = 14;
const SURVIVAL_CAP = 100;
const LIVES = 3;

/** A sequence term: plain text, or a glyph at a rotation (arrow patterns). */
type Term = { text: string } | { glyph: string; deg: number };

function termKey(t: Term): string {
  return "text" in t ? t.text : `${t.glyph}@${((t.deg % 360) + 360) % 360}`;
}

const SHAPES = ["●", "■", "▲", "★", "◆"] as const;
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface Generated {
  terms: Term[];
  answer: Term;
  /** Plausible wrong answers, best traps first. Deduped later. */
  wrongs: Term[];
  /** The rule, as data — revealed after a wrong answer so a miss teaches
      instead of just stinging. The sentence is written per language in
      i18n.ts and resolved at render, so it follows the language button. */
  rule: RuleSpec;
  /** One label per gap between terms (last one leads into the "?"), drawn
      between the boxes on a miss so the rule is *visible*, not just stated. */
  steps?: string[];
  /** Interleaved sequences: tint alternating terms to expose the weave. */
  weave?: boolean;
}

type PatternKind =
  | "shapeCycle"
  | "arithmetic"
  | "repeatDigits"
  | "letterSkip"
  | "geometric"
  | "rotation"
  | "secondDiff"
  | "interleave"
  | "letterGrow";

const num = (n: number): Term => ({ text: String(n) });
const letter = (i: number): Term => ({ text: ALPHA[i] });

const GENERATORS: Record<PatternKind, (rng: Rng) => Generated> = {
  /** ● ■ ▲ ● ■ → ▲ — a repeating cycle of 2 or 3 shapes. */
  shapeCycle(rng) {
    const period = randInt(rng, 2, 3);
    const cycle = shuffle(rng, SHAPES).slice(0, period);
    const terms = Array.from({ length: 5 }, (_, i) => ({
      text: cycle[i % period],
    }));
    const answer = { text: cycle[5 % period] };
    const wrongs = SHAPES.filter((s) => s !== answer.text).map((s) => ({
      text: s,
    }));
    return {
      terms,
      answer,
      wrongs,
      rule: { k: "shapeCycle", period },
    };
  },

  /** Constant step, up or down. */
  arithmetic(rng) {
    const down = rng() < 0.3;
    const d = randInt(rng, 2, 9) * (down ? -1 : 1);
    const a = down ? randInt(rng, 40, 60) : randInt(rng, 1, 12);
    const terms = [0, 1, 2, 3].map((i) => num(a + i * d));
    const ans = a + 4 * d;
    const step = `${d > 0 ? "+" : "−"}${Math.abs(d)}`;
    return {
      terms,
      answer: num(ans),
      wrongs: [num(ans + d), num(ans - 1), num(ans + 1), num(a + 3 * d)],
      rule: { k: "step", token: step },
      steps: Array(4).fill(step),
    };
  },

  /** 1, 22, 333, 4444 → 55555. */
  repeatDigits(rng) {
    const start = randInt(rng, 1, 5);
    const terms = [0, 1, 2, 3].map((i) => ({
      text: String(start + i).repeat(i + 1),
    }));
    const ansDigit = start + 4;
    return {
      terms,
      answer: { text: String(ansDigit).repeat(5) },
      wrongs: [
        { text: String(ansDigit).repeat(4) },
        { text: String(ansDigit).repeat(6) },
        { text: String(Math.min(9, ansDigit + 1)).repeat(5) },
        { text: String(ansDigit - 1).repeat(5) },
      ],
      rule: { k: "repeatDigits" },
    };
  },

  /** C, F, I, L → O — constant letter step. */
  letterSkip(rng) {
    const d = randInt(rng, 1, 4);
    const start = randInt(rng, 0, 25 - 4 * d);
    const terms = [0, 1, 2, 3].map((i) => letter(start + i * d));
    const ansIdx = start + 4 * d;
    const wrongIdxs = [ansIdx - 1, ansIdx + 1, ansIdx + d, ansIdx - d].filter(
      (i) => i >= 0 && i < 26 && i !== ansIdx
    );
    return {
      terms,
      answer: letter(ansIdx),
      wrongs: wrongIdxs.map(letter),
      rule: { k: "letterSkip", skip: d - 1 },
      steps: Array(4).fill(`+${d}`),
    };
  },

  /** Multiply by 2 or 3 each step. */
  geometric(rng) {
    const r = rng() < 0.6 ? 2 : 3;
    const a = randInt(rng, 1, r === 3 ? 3 : 5);
    const terms = [0, 1, 2, 3].map((i) => num(a * r ** i));
    const ans = a * r ** 4;
    const last = a * r ** 3;
    return {
      terms,
      answer: num(ans),
      wrongs: [num(last + last / 2), num(ans + a * r), num(last * (r + 1)), num(ans - a)],
      rule: { k: "step", token: `×${r}` },
      steps: Array(4).fill(`×${r}`),
    };
  },

  /** An arrow rotating a fixed amount each step. */
  rotation(rng) {
    const step = pick(rng, [45, 90, -45, -90]);
    const start = randInt(rng, 0, 7) * 45;
    const degs = [0, 1, 2, 3].map((i) => start + i * step);
    const ansDeg = start + 4 * step;
    const arrow = (deg: number): Term => ({ glyph: "➤", deg });
    const wrongDegs = [ansDeg - step, ansDeg + 180, ansDeg + step].filter(
      (d) => termKey(arrow(d)) !== termKey(arrow(ansDeg))
    );
    return {
      terms: degs.map(arrow),
      answer: arrow(ansDeg),
      wrongs: wrongDegs.map(arrow),
      rule: { k: "rotation", deg: Math.abs(step), clockwise: step > 0 },
      steps: Array(4).fill(`${step > 0 ? "↻" : "↺"}${Math.abs(step)}°`),
    };
  },

  /** Steps that grow: +2, +4, +6 → the classic "it was accelerating" trap. */
  secondDiff(rng) {
    const a = randInt(rng, 1, 10);
    const d = randInt(rng, 1, 4);
    const k = randInt(rng, 1, 3);
    const t1 = a + d;
    const t2 = t1 + d + k;
    const t3 = t2 + d + 2 * k;
    const ans = t3 + d + 3 * k;
    return {
      terms: [num(a), num(t1), num(t2), num(t3)],
      answer: num(ans),
      wrongs: [num(t3 + d + 2 * k), num(ans + 1), num(ans - 1), num(ans + k)],
      rule: { k: "secondDiff", growth: k },
      steps: [0, 1, 2, 3].map((n) => `+${d + n * k}`),
    };
  },

  /** Two sequences woven together: 1, 10, 3, 20, 5 → 30. */
  interleave(rng) {
    const a = randInt(rng, 1, 9);
    const d = randInt(rng, 1, 5);
    const b = randInt(rng, 10, 30);
    const e = randInt(rng, 3, 10);
    const terms = [num(a), num(b), num(a + d), num(b + e), num(a + 2 * d)];
    const ans = b + 2 * e;
    return {
      terms,
      answer: num(ans),
      wrongs: [num(a + 3 * d), num(ans + d), num(ans - e), num(ans + 1)],
      rule: { k: "interleave", a: d, b: e },
      weave: true,
    };
  },

  /** Gaps that grow by one letter each time: A, B, D, G, K → P. */
  letterGrow(rng) {
    const start = randInt(rng, 0, 10);
    const idxs = [start];
    for (let gap = 1; gap <= 4; gap++) idxs.push(idxs[idxs.length - 1] + gap);
    const ansIdx = idxs[4] + 5;
    const lastGapRepeat = idxs[4] + 4; // the "constant gap" trap
    const wrongIdxs = [lastGapRepeat, ansIdx - 1, ansIdx + 1].filter(
      (i) => i < 26 && i !== ansIdx
    );
    return {
      terms: idxs.map(letter),
      answer: letter(ansIdx),
      wrongs: wrongIdxs.map(letter),
      rule: { k: "letterGrow" },
      steps: [1, 2, 3, 4, 5].map((n) => `+${n}`),
    };
  },
};

/** Warm-up cycles and simple runs → letters and spins → layered rules. */
function roundPlan(i: number): { kind: PatternKind; duration: number } {
  const plans: { kind: PatternKind; duration: number }[] = [
    { kind: "shapeCycle", duration: 8 },
    { kind: "arithmetic", duration: 8 },
    { kind: "repeatDigits", duration: 8 },
    { kind: "arithmetic", duration: 7.5 },
    { kind: "letterSkip", duration: 9 },
    { kind: "geometric", duration: 8 },
    { kind: "rotation", duration: 8 },
    { kind: "secondDiff", duration: 10 },
    { kind: "interleave", duration: 11 },
    { kind: "letterGrow", duration: 10 },
    { kind: "geometric", duration: 7 },
    { kind: "rotation", duration: 7.5 },
    { kind: "secondDiff", duration: 9 },
    { kind: "interleave", duration: 10 },
  ];
  if (i < plans.length) return plans[i];
  // Survival past the daily's 14: cycle the four hardest rule types forever,
  // solve time grinding down to a floor.
  const laps = i - plans.length;
  const hard: PatternKind[] = ["secondDiff", "interleave", "letterGrow", "geometric"];
  return {
    kind: hard[laps % hard.length],
    duration: Math.max(5.5, 10 - laps * 0.3),
  };
}

interface PatternRound {
  terms: Term[];
  options: Term[]; // 4, shuffled
  answerIdx: number; // index into options
  duration: number;
  rule: RuleSpec;
  steps?: string[];
  weave?: boolean;
}

function generateRound(rng: Rng, i: number): PatternRound {
  const plan = roundPlan(i);
  const g = GENERATORS[plan.kind](rng);
  const seen = new Set([termKey(g.answer)]);
  const wrongs: Term[] = [];
  for (const w of g.wrongs) {
    if (!seen.has(termKey(w))) {
      seen.add(termKey(w));
      wrongs.push(w);
    }
    if (wrongs.length === 3) break;
  }
  // Fallback filler for the rare generator that deduped below 3.
  let bump = 2;
  while (wrongs.length < 3) {
    const base = g.answer;
    const w: Term =
      "text" in base && /^\d+$/.test(base.text)
        ? num(Number(base.text) + bump * 3)
        : "text" in base
          ? { text: pick(rng, SHAPES) }
          : { glyph: base.glyph, deg: base.deg + bump * 45 };
    if (!seen.has(termKey(w))) {
      seen.add(termKey(w));
      wrongs.push(w);
    }
    bump++;
  }
  const options = shuffle(rng, [g.answer, ...wrongs]);
  return {
    terms: g.terms,
    options,
    answerIdx: options.findIndex((o) => termKey(o) === termKey(g.answer)),
    duration: plan.duration,
    rule: g.rule,
    steps: g.steps,
    weave: g.weave,
  };
}

function generateRounds(rng: Rng, total: number): PatternRound[] {
  // The plan deliberately revisits rule *types* (you meet arithmetic twice);
  // what it must never do is serve the identical sequence twice.
  return distinctRounds(
    total,
    (i) => generateRound(rng, i),
    (r) => r.terms.map(termKey).join(",")
  );
}

function TermView({ term, large }: { term: Term; large?: boolean }) {
  const t = useT();
  if ("text" in term) {
    return <span className={large ? "text-2xl" : ""}>{term.text}</span>;
  }
  return (
    <span
      className={`inline-block ${large ? "text-2xl" : ""}`}
      style={{ transform: `rotate(${term.deg}deg)` }}
      aria-label={t.a11y.arrowAt(((term.deg % 360) + 360) % 360)}
    >
      {term.glyph}
    </span>
  );
}

type Phase = "intro" | "scan" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
}

export function PatternGame() {
  const t = useT();
  const g = t.games.pattern;
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [gap, setGap] = useState<Gap | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [rounds, setRounds] = useState<PatternRound[]>([]);
  const [summary, setSummary] = useState<{ score: number; emojis: string[] }>({
    score: 0,
    emojis: [],
  });

  // Game logic runs off refs so timer callbacks never read stale data.
  const roundsRef = useRef<PatternRound[]>([]);
  const roundRef = useRef(0);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(ROUNDS);
  const lockedRef = useRef(false);
  const phaseRef = useRef<Phase>("intro");
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

  function finish(didSurvive: boolean) {
    timer.stop();
    window.clearTimeout(gapTimeoutRef.current);
    const score = resultsRef.current.filter(Boolean).length;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    const display = fmt(score, modeRef.current);
    const isBest = submitBest("pattern", modeRef.current, { score, display });
    if (modeRef.current === "daily") {
      setDailyResult("pattern", dailyNumber(), {
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
    if (!correct && !UNLIMITED_LIVES) livesRef.current -= 1;
    setLives(livesRef.current);
    setGap({ ok: correct, msg });
    setPhaseSafe("gap"); // options stay visible; the right one gets ringed
    if (correct) sfx.success();
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
      // A miss lingers: the rule is on screen and deserves reading time.
      correct ? 650 : 2900
    );
  }

  function beginRound() {
    sfx.reveal();
    setPhaseSafe("scan");
    timer.start(roundsRef.current[roundRef.current].duration, () =>
      endRound(false, t.fb.tooSlow)
    );
  }

  function handlePick(optionIdx: number) {
    if (lockedRef.current || phaseRef.current !== "scan") return;
    const r = roundsRef.current[roundRef.current];
    sfx.tap();
    if (optionIdx === r.answerIdx) {
      endRound(true, t.fb.nice);
    } else {
      endRound(false, t.fb.itsRinged);
    }
  }

  function startRun(m: Mode) {
    totalRef.current = m === "daily" ? ROUNDS : SURVIVAL_CAP;
    const generated = generateRounds(rngFor("pattern", m), totalRef.current);
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

  // Desktop: keys 1–4 pick the four options.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0) handlePick(idx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up the gap timeout if the player navigates away mid-run.
  useEffect(() => () => window.clearTimeout(gapTimeoutRef.current), []);

  if (phase === "intro") {
    return <IntroScreen game="pattern" format={fmt} onStart={startRun} />;
  }

  if (phase === "result") {
    const best = getBest("pattern", mode);
    return (
      <ResultScreen
        game="pattern"
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
  // Only a miss reveals the rule — a correct answer needs no explanation.
  const revealRule = phase === "gap" && gap !== null && !gap.ok;

  return (
    <div className="flex flex-1 flex-col gap-2.5 py-2 sm:gap-4 sm:py-4">
      <GameTitle game="pattern" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          {g.counter} {round + 1}
          {mode === "daily" ? `/${ROUNDS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "scan" ? timer.progress : 1} />

      {/* Verdict — its own row, so nothing overlaps the sequence card.
          Space is reserved during play to keep the layout from jumping. */}
      <div className="flex h-8 items-center justify-center">
        {phase === "gap" && gap && (
          <p
            className={`animate-pop rounded-lg border-2 px-4 py-1 font-display text-sm ${
              gap.ok
                ? "border-mint bg-panel text-mint"
                : "border-coral bg-panel text-coral"
            }`}
          >
            {gap.msg}
          </p>
        )}
      </div>

      {/* The sequence. On a miss the rule is drawn ON the pattern: step
          labels appear between the boxes (and interleaved runs get their
          two woven threads tinted apart). */}
      <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-line bg-panel p-5 shadow-chunk">
        {/* Always one row. The tiles flex to share the row's width equally
            (capped at the desktop size), so any count of terms — and any glyph,
            arrows included — fits on a single line instead of overflowing. */}
        <div className="flex w-full items-center justify-center gap-1">
          {r?.terms.map((term, i) => (
            <Fragment key={i}>
              <span
                className={`flex aspect-square min-w-0 max-w-14 flex-1 items-center justify-center overflow-hidden rounded-xl border-2 bg-panel2 px-1 font-display text-base sm:text-xl ${
                  revealRule && r.weave
                    ? i % 2 === 0
                      ? "border-sky text-sky"
                      : "border-coral text-coral"
                    : "border-line"
                }`}
              >
                <TermView term={term} />
              </span>
              {r?.steps?.[i] && (
                // Rendered (reserving its width) even during play, just hidden,
                // so revealing the rule never re-wraps the row or grows the card.
                <span
                  className={`shrink-0 font-display text-[10px] text-mint sm:text-xs ${
                    revealRule ? "animate-pop" : "invisible"
                  }`}
                >
                  {r.steps[i]}
                </span>
              )}
            </Fragment>
          ))}
          <span className="flex aspect-square min-w-0 max-w-14 flex-1 items-center justify-center overflow-hidden rounded-xl border-2 border-lemon bg-panel2 px-1 font-display text-base text-lemon sm:text-xl">
            ?
          </span>
        </div>

        {r && (
          // Also reserved during play (invisible) so its height is baked into
          // the card from the start — the options never get shoved down.
          <p
            className={`w-full border-t-2 border-line pt-2 text-center text-xs text-fog ${
              revealRule ? "animate-pop" : "invisible"
            }`}
          >
            {t.play.theRule}{" "}
            <span className="text-paper">{t.rule(r.rule)}</span>
          </p>
        )}
      </div>

      {/* Options — during the gap, the correct one gets ringed */}
      <div className="grid grid-cols-2 gap-3">
        {r?.options.map((option, i) => (
          <button
            key={i}
            type="button"
            disabled={phase !== "scan"}
            onPointerDown={() => handlePick(i)}
            className={`h-16 rounded-2xl border-2 font-display text-xl text-paper shadow-chunk transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60 ${
              phase === "gap" && i === r.answerIdx
                ? "border-mint bg-panel2 ring-4 ring-mint/60"
                : "border-line bg-panel2"
            }`}
          >
            <TermView term={option} large />
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-fog">{g.hint}</p>
    </div>
  );
}
