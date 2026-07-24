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

const ROUNDS = 14;
const SURVIVAL_CAP = 120;
const LIVES = 3;

const COLORS = [
  { name: "CORAL", css: "var(--color-coral)" },
  { name: "MINT", css: "var(--color-mint)" },
  { name: "LEMON", css: "var(--color-lemon)" },
  { name: "SKY", css: "var(--color-sky)" },
  { name: "WHITE", css: "var(--color-paper)" },
] as const;

/**
 * Glyph families. Each family only gets questions it can honestly support:
 * shapes never spin or tilt — a tilted square IS a diamond, which would
 * corrupt the counts.
 */
type Family = "numbers" | "shapes";

const NUMBER_POOL = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

// Rotate a 6 far enough and it's a 9 — so both wear a bar under the digit
// that turns with them. Whichever end the bar is on is the bottom.
const BARRED_DIGITS = new Set(["6", "9"]);

const SHAPE_POOL = ["●", "■", "▲", "★", "◆"] as const;
const SHAPE_NAMES: Record<string, string> = {
  "●": "CIRCLES",
  "■": "SQUARES",
  "▲": "TRIANGLES",
  "★": "STARS",
  "◆": "DIAMONDS",
};

type Size = "huge" | "normal" | "tiny";

// Wide gap on purpose: this has to read as "obviously bigger/smaller" at a
// glance, not require a side-by-side comparison.
const SIZE_SCALE: Record<Size, number> = { huge: 2.1, normal: 1.0, tiny: 0.5 };

// Small glyphs stack above big ones so a huge one can never bury a tiny one
// completely — every item stays countable.
const SIZE_Z: Record<Size, number> = { huge: 1, normal: 2, tiny: 3 };

interface CountItem {
  glyph: string;
  colorIdx: number;
  size: Size;
  spin: boolean;
  x: number; // percent
  y: number; // percent
  wobble: number; // small per-item scale variance
  match: boolean; // satisfies the question — the ones that had to be counted
}

type QuestionKind =
  | "color" // count color C
  | "glyph" // count glyph G — "how many 7s / triangles?"
  | "huge"
  | "tiny"
  | "spin" // numbers only — shapes must stay upright
  | "hugeColor" // combo: huge AND color C
  | "glyphColor" // combo: glyph G AND color C
  | "hugeGlyph"; // combo: huge AND glyph G

interface QuestionPart {
  text: string;
  color?: string;
  /** Render as a bordered chip — used for digit targets so "5" never reads
      as part of the sentence. */
  chip?: boolean;
  /** Underline: marks the exact thing being counted, so "COUNT THE CORAL
      TRIANGLES" can't be skimmed as "coral shapes". */
  emph?: boolean;
}

interface CountRound {
  family: Family;
  kind: QuestionKind;
  answer: number;
  items: CountItem[];
  duration: number;
  cols: number;
  parts: QuestionPart[];
}

/** Escalation: easy pops → glyph hunts → sizes & spinners → cruel combos,
    rotating through the three families so no two rounds feel alike. */
function roundPlan(i: number): {
  family: Family;
  kind: QuestionKind;
  count: number;
  duration: number;
} {
  const plans: ReturnType<typeof roundPlan>[] = [
    { family: "numbers", kind: "color", count: 10, duration: 8 },
    { family: "shapes", kind: "color", count: 12, duration: 8 },
    { family: "numbers", kind: "glyph", count: 14, duration: 9 },
    { family: "shapes", kind: "glyph", count: 16, duration: 8.5 },
    { family: "numbers", kind: "huge", count: 16, duration: 8 },
    { family: "shapes", kind: "tiny", count: 18, duration: 8 },
    { family: "numbers", kind: "spin", count: 18, duration: 8 },
    { family: "shapes", kind: "color", count: 20, duration: 7 },
    { family: "numbers", kind: "glyph", count: 20, duration: 8 },
    { family: "shapes", kind: "glyphColor", count: 20, duration: 10 },
    { family: "numbers", kind: "hugeColor", count: 20, duration: 11 },
    { family: "numbers", kind: "hugeGlyph", count: 22, duration: 11 },
    // Two more to finish: the nastiest combos, denser and with less time.
    { family: "shapes", kind: "glyphColor", count: 24, duration: 9.5 },
    { family: "numbers", kind: "hugeColor", count: 26, duration: 9.5 },
  ];
  if (i < plans.length) return plans[i];
  // Survival past the daily's 12: cycle the four combo/hunt kinds forever,
  // mob creeping toward a cap, timer grinding down to a floor.
  const laps = i - plans.length;
  const rotation = [
    { family: "numbers" as Family, kind: "hugeColor" as QuestionKind },
    { family: "shapes" as Family, kind: "glyphColor" as QuestionKind },
    { family: "numbers" as Family, kind: "hugeGlyph" as QuestionKind },
    { family: "numbers" as Family, kind: "glyph" as QuestionKind },
  ];
  // Time bottoms out at 6s (round ~32), but the mob keeps growing to 46 —
  // so a god-tier player past round 35 still faces a rising wall: more to
  // scan in the same seconds. Capped at 46 because beyond that the glyphs
  // shrink below a comfortable tap/read size on a phone.
  return {
    ...rotation[laps % rotation.length],
    count: Math.min(46, 24 + laps),
    duration: Math.max(6, 11 - laps * 0.25),
  };
}

function colorExcept(rng: Rng, avoid: number): number {
  const idx = randInt(rng, 0, COLORS.length - 2);
  return idx >= avoid ? idx + 1 : idx;
}

function glyphExcept(rng: Rng, pool: readonly string[], avoidIdx: number): string {
  const idx = randInt(rng, 0, pool.length - 2);
  return pool[idx >= avoidIdx ? idx + 1 : idx];
}

interface RoundMeta {
  family: Family;
  kind: QuestionKind;
  pool: readonly string[];
  colorIdx: number;
  glyphIdx: number; // index into pool of the queried glyph
}

/**
 * Build one item. `match` decides whether it satisfies the round's question;
 * non-matching items for combo rounds are deliberately near-misses (right
 * color wrong size, right glyph wrong color…) so lazy counting gets punished.
 */
function makeItem(
  rng: Rng,
  meta: RoundMeta,
  match: boolean
): Omit<CountItem, "x" | "y" | "wobble" | "match"> {
  const { family, kind, pool, colorIdx, glyphIdx } = meta;
  const target = pool[glyphIdx];
  // Default size is always "normal" — size only varies on rounds that ask
  // about size, so it's never a red herring on a color/glyph/spin question.
  let item = {
    glyph: pick(rng, pool),
    colorIdx: randInt(rng, 0, COLORS.length - 1),
    size: "normal" as Size,
    spin: family === "shapes" ? false : rng() < 0.2,
  };
  if (kind === "color") {
    item.colorIdx = match ? colorIdx : colorExcept(rng, colorIdx);
  } else if (kind === "glyph") {
    item.glyph = match ? target : glyphExcept(rng, pool, glyphIdx);
  } else if (kind === "huge") {
    // Binary field on purpose: huge vs normal, never a third tier.
    item.size = match ? "huge" : "normal";
  } else if (kind === "tiny") {
    item.size = match ? "tiny" : "normal";
  } else if (kind === "spin") {
    item.spin = match;
  } else if (kind === "hugeColor") {
    if (match) {
      item = { ...item, size: "huge", colorIdx };
    } else {
      const r = rng();
      if (r < 0.35) item = { ...item, size: "normal", colorIdx };
      else if (r < 0.7)
        item = { ...item, size: "huge", colorIdx: colorExcept(rng, colorIdx) };
      else
        item = {
          ...item,
          size: "normal",
          colorIdx: colorExcept(rng, colorIdx),
        };
    }
  } else if (kind === "glyphColor") {
    if (match) {
      item = { ...item, glyph: target, colorIdx };
    } else {
      const r = rng();
      if (r < 0.35)
        item = { ...item, glyph: target, colorIdx: colorExcept(rng, colorIdx) };
      else if (r < 0.7)
        item = { ...item, glyph: glyphExcept(rng, pool, glyphIdx), colorIdx };
      else
        item = {
          ...item,
          glyph: glyphExcept(rng, pool, glyphIdx),
          colorIdx: colorExcept(rng, colorIdx),
        };
    }
  } else {
    // hugeGlyph
    if (match) {
      item = { ...item, size: "huge", glyph: target };
    } else {
      const r = rng();
      if (r < 0.35) item = { ...item, size: "normal", glyph: target };
      else if (r < 0.7)
        item = {
          ...item,
          size: "huge",
          glyph: glyphExcept(rng, pool, glyphIdx),
        };
      else
        item = {
          ...item,
          size: "normal",
          glyph: glyphExcept(rng, pool, glyphIdx),
        };
    }
  }
  return item;
}

/** Question banner, split into parts so color words render in their color. */
function buildParts(meta: RoundMeta): QuestionPart[] {
  const c = COLORS[meta.colorIdx];
  const g = meta.pool[meta.glyphIdx];
  switch (meta.kind) {
    case "color":
      return [
        { text: "COUNT THE " },
        { text: c.name, color: c.css, emph: true },
        { text: meta.family === "shapes" ? " SHAPES" : " NUMBERS" },
      ];
    case "glyph":
      return meta.family === "numbers"
        ? [{ text: "HOW MANY" }, { text: g, chip: true }, { text: "?" }]
        : [
            { text: "HOW MANY " },
            { text: SHAPE_NAMES[g], emph: true },
            { text: "?" },
          ];
    case "huge":
      return [{ text: "COUNT THE " }, { text: "HUGE", emph: true }, { text: " ONES" }];
    case "tiny":
      return [{ text: "COUNT THE " }, { text: "TINY", emph: true }, { text: " ONES" }];
    case "spin":
      return [
        { text: "COUNT THE " },
        { text: "SPINNING", emph: true },
        { text: " ONES" },
      ];
    case "hugeColor":
      return [
        { text: "COUNT THE " },
        { text: "HUGE", emph: true },
        { text: " " },
        { text: c.name, color: c.css, emph: true },
        { text: " ONES" },
      ];
    case "glyphColor":
      return [
        { text: "COUNT THE " },
        { text: c.name, color: c.css, emph: true },
        { text: " " },
        { text: SHAPE_NAMES[g], emph: true },
      ];
    case "hugeGlyph":
      return meta.family === "numbers"
        ? [
            { text: "COUNT THE " },
            { text: "HUGE", emph: true },
            { text: " " },
            { text: g, chip: true },
          ]
        : [
            { text: "COUNT THE " },
            { text: "HUGE", emph: true },
            { text: " " },
            { text: SHAPE_NAMES[g], emph: true },
          ];
  }
}

function generateRound(rng: Rng, i: number): CountRound {
  const plan = roundPlan(i);
  const pool: readonly string[] =
    plan.family === "numbers" ? NUMBER_POOL : SHAPE_POOL;
  const meta: RoundMeta = {
    family: plan.family,
    kind: plan.kind,
    pool,
    colorIdx: randInt(rng, 0, COLORS.length - 1),
    glyphIdx: randInt(rng, 0, pool.length - 1),
  };
  const answer = randInt(rng, 2, Math.min(8, plan.count - 4));

  const looks = shuffle(
    rng,
    Array.from({ length: plan.count }, (_, idx) => {
      const match = idx < answer;
      return { ...makeItem(rng, meta, match), match };
    })
  );

  // Wider-than-tall field: the keypad needs the bottom of the screen.
  const cols = Math.ceil(Math.sqrt(plan.count * (4 / 3)));
  const rows = Math.ceil(plan.count / cols);
  const items: CountItem[] = looks.map((look, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      ...look,
      x: Math.min(94, Math.max(6, ((col + 0.5 + (rng() - 0.5) * 0.55) / cols) * 100)),
      y: Math.min(92, Math.max(8, ((row + 0.5 + (rng() - 0.5) * 0.55) / rows) * 100)),
      // Small on purpose — big enough to feel organic, not big enough to
      // blur the huge/normal/tiny signal players actually rely on.
      wobble: 0.96 + rng() * 0.08,
    };
  });

  return {
    family: plan.family,
    kind: plan.kind,
    answer,
    items,
    duration: plan.duration,
    cols,
    parts: buildParts(meta),
  };
}

function generateRounds(rng: Rng, total: number): CountRound[] {
  return Array.from({ length: total }, (_, i) => generateRound(rng, i));
}

type Phase = "intro" | "scan" | "gap" | "result";

interface Gap {
  ok: boolean;
  msg: string;
}

export function CountGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("daily");
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [gap, setGap] = useState<Gap | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [streak, setStreak] = useState(0);
  const [survived, setSurvived] = useState(false);
  // Render-facing copies: the same data also lives in refs for game logic.
  const [rounds, setRounds] = useState<CountRound[]>([]);
  const [summary, setSummary] = useState<{
    score: number;
    emojis: string[];
    time: number;
  }>({ score: 0, emojis: [], time: 0 });

  // Game logic runs off refs so timer callbacks never read stale data.
  const roundsRef = useRef<CountRound[]>([]);
  const roundRef = useRef(0);
  const livesRef = useRef(LIVES);
  const resultsRef = useRef<boolean[]>([]);
  const elapsedRef = useRef(0);
  const modeRef = useRef<Mode>("daily");
  const totalRef = useRef(ROUNDS);
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
    const time = elapsedRef.current;
    const emojis = resultsRef.current.map((r) => (r ? "✅" : "❌"));
    // Time still breaks ties internally, but the shown score stays clean.
    const display =
      modeRef.current === "daily" ? `${score}/${ROUNDS}` : `${score} answered`;
    const isBest = submitBest("count", modeRef.current, {
      score,
      tiebreak: time,
      display,
    });
    if (modeRef.current === "daily") {
      setDailyResult("count", dailyNumber(), {
        display,
        emojis: emojis.join(""),
      });
      setStreak(bumpStreak());
    }
    setSummary({ score, emojis, time });
    setNewBest(isBest);
    setSurvived(didSurvive);
    setPhaseSafe("result");
    if (didSurvive) sfx.fanfare();
    else sfx.gameOver();
  }

  function endRound(correct: boolean, msg: string) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    // Count time = round budget minus what was left on the clock.
    const budget = roundsRef.current[roundRef.current].duration;
    elapsedRef.current += Math.max(0, budget - timer.remaining());
    timer.stop();
    resultsRef.current.push(correct);
    if (!correct && !UNLIMITED_LIVES) livesRef.current -= 1;
    setLives(livesRef.current);
    setGap({ ok: correct, msg });
    setPhaseSafe("gap");
    if (correct) sfx.success();
    else sfx.error();

    // A miss lingers: the non-matches fade and the ones you had to count are
    // left standing, so give real time to see what the answer was — plus half a
    // second per item beyond six, since a big count takes longer to recount.
    const answer = roundsRef.current[roundRef.current].answer;
    const missLinger = 2600 + Math.max(0, answer - 6) * 500;

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
      correct ? 700 : missLinger
    );
  }

  function beginRound() {
    const r = roundsRef.current[roundRef.current];
    sfx.reveal();
    setPhaseSafe("scan");
    timer.start(r.duration, () =>
      endRound(false, `TIME'S UP — IT WAS ${r.answer}`)
    );
  }

  function handleDigit(d: number) {
    if (lockedRef.current || phaseRef.current !== "scan") return;
    const r = roundsRef.current[roundRef.current];
    sfx.tap();
    if (d === r.answer) {
      endRound(true, "NICE ✓");
    } else {
      endRound(false, `IT WAS ${r.answer}`);
    }
  }

  function startRun(m: Mode) {
    totalRef.current = m === "daily" ? ROUNDS : SURVIVAL_CAP;
    const generated = generateRounds(rngFor("count", m), totalRef.current);
    roundsRef.current = generated;
    setRounds(generated);
    resultsRef.current = [];
    livesRef.current = LIVES;
    roundRef.current = 0;
    elapsedRef.current = 0;
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

  // Desktop: number keys answer directly. Handlers only touch refs, so
  // binding once is safe — the first render's closure never goes stale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!/^[0-9]$/.test(e.key)) return;
      handleDigit(Number(e.key));
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
        game="count"
        title="HEADCOUNT"
        tagline="Count the chaos. Answer in one tap."
        howTo={[
          "A mob of numbers and shapes appears — count only what the question asks for, then tap the keypad.",
          "6 and 9 wear a bar on the bottom, so a spinning one still reads right. Read very carefully.",
        ]}
        controlsHint="Tap the keypad · number keys on desktop"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        game="count"
        gameName="Headcount"
        path="/count"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={
          mode === "daily" ? `${summary.score}/${ROUNDS}` : `${summary.score} answered`
        }
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("count", mode)?.display ?? null}
        streak={streak}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const r = rounds[round];
  // Only spell the bar out on the rounds where mistaking a 6 for a 9 would
  // actually cost you the answer.
  const barHint = r?.parts.some((p) => p.chip && BARRED_DIGITS.has(p.text))
    ? " · the bar marks the bottom"
    : "";

  // On a miss, fade out everything that didn't need counting so the items that
  // did are laid bare — the player sees exactly what they were meant to tally.
  const revealing = phase === "gap" && gap !== null && !gap.ok;

  return (
    <div className="flex flex-1 flex-col gap-2 py-2 sm:gap-3 sm:py-4">
      <GameTitle game="count" title="HEADCOUNT" />

      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          QUESTION {round + 1}
          {mode === "daily" ? `/${ROUNDS}` : ""}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "scan" ? timer.progress : 1} />

      {/* The question */}
      <div className="text-center">
        <p className="font-display text-lg leading-snug">
          {r?.parts.map((part, i) => (
            <span
              key={i}
              style={{ color: part.color }}
              className={
                part.chip
                  ? // Fog, deliberately: no game piece is ever fog-colored, so
                    // the chip can't imply "count only this color".
                    "mx-1.5 inline-flex h-8 min-w-8 items-center justify-center rounded-lg border-2 border-fog bg-panel px-1.5 align-middle text-fog"
                  : part.emph
                    ? "underline decoration-fog decoration-2 underline-offset-4"
                    : undefined
              }
            >
              {/* The target digit wears the same bar the field does, so 6 and
                  9 read the same way in the question and in the mob. */}
              {part.chip && BARRED_DIGITS.has(part.text) ? (
                <span className="digit-bar">{part.text}</span>
              ) : (
                part.text
              )}
            </span>
          ))}
        </p>
        {r?.kind === "spin" && (
          <p className="text-xs text-fog">(spinning = the tilted ones)</p>
        )}
        {r?.kind === "glyph" && (
          <p className="text-xs text-fog">
            (any color · any size{barHint})
          </p>
        )}
        {r?.kind === "hugeGlyph" && (
          <p className="text-xs text-fog">(any color{barHint})</p>
        )}
      </div>

      {/* The mob */}
      <div
        className="relative mx-auto max-h-[42dvh] w-full max-w-md overflow-hidden rounded-2xl border-2 border-line bg-panel shadow-chunk sm:max-h-none"
        style={{ aspectRatio: "4 / 3", containerType: "inline-size" }}
      >
        {r?.items.map((item, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute select-none font-display leading-none transition-[opacity,transform] duration-500"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: `translate(-50%, -50%) scale(${
                item.wobble * (revealing && item.match ? 1.2 : 1)
              })`,
              fontSize: `${(
                Math.min(66 / r.cols, 11) * SIZE_SCALE[item.size]
              ).toFixed(2)}cqw`,
              color: COLORS[item.colorIdx].css,
              opacity: revealing && !item.match ? 0 : 1,
              zIndex: revealing && item.match ? 10 : SIZE_Z[item.size],
            }}
          >
            <span
              className={`inline-block ${
                item.spin ? "animate-count-spin" : ""
              } ${BARRED_DIGITS.has(item.glyph) ? "digit-bar" : ""}`}
            >
              {item.glyph}
            </span>
          </span>
        ))}
      </div>

      {/* Keypad — or, between rounds, the verdict takes its place (the mob above
          stays clear so the revealed items read cleanly). */}
      {phase === "gap" && gap ? (
        <div className="mx-auto flex min-h-[6.5rem] w-full max-w-md items-center justify-center">
          <p
            className={`animate-pop rounded-xl border-2 px-6 py-3 text-center font-display text-2xl ${
              gap.ok
                ? "border-mint bg-panel2 text-mint"
                : "border-coral bg-panel2 text-coral"
            }`}
          >
            {gap.msg}
          </p>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
            <button
              key={d}
              type="button"
              disabled={phase !== "scan"}
              onPointerDown={() => handleDigit(d)}
              className="h-12 rounded-lg border-2 border-line bg-panel2 font-display text-xl text-paper shadow-chunk-sm transition-transform active:translate-y-0.5 active:shadow-none disabled:opacity-40"
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
