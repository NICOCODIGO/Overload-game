"use client";

import { useEffect, useRef, useState } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { TimerBar } from "@/components/TimerBar";
import { Lives } from "@/components/Lives";
import { sfx } from "@/lib/audio";
import { dailyNumber, rngFor, type Mode } from "@/lib/daily";
import { useCountdown } from "@/lib/useCountdown";
import { pick, randInt, shuffle, type Rng } from "@/lib/rng";
import {
  bumpStreak,
  getBest,
  setDailyResult,
  submitBest,
} from "@/lib/storage";

const ROUNDS = 12;
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

const SHAPE_POOL = ["●", "■", "▲", "★", "◆"] as const;
const SHAPE_NAMES: Record<string, string> = {
  "●": "CIRCLES",
  "■": "SQUARES",
  "▲": "TRIANGLES",
  "★": "STARS",
  "◆": "DIAMONDS",
};

type Size = "huge" | "normal" | "tiny";

const SIZE_SCALE: Record<Size, number> = { huge: 1.75, normal: 1.0, tiny: 0.6 };

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
  ];
  return plans[i];
}

function weightedSize(rng: Rng): Size {
  const r = rng();
  return r < 0.2 ? "huge" : r < 0.75 ? "normal" : "tiny";
}

function nonHugeSize(rng: Rng): Size {
  return rng() < 0.6 ? "normal" : "tiny";
}

function nonTinySize(rng: Rng): Size {
  return rng() < 0.75 ? "normal" : "huge";
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
): Omit<CountItem, "x" | "y" | "wobble"> {
  const { family, kind, pool, colorIdx, glyphIdx } = meta;
  const target = pool[glyphIdx];
  let item = {
    glyph: pick(rng, pool),
    colorIdx: randInt(rng, 0, COLORS.length - 1),
    size: weightedSize(rng),
    spin: family === "shapes" ? false : rng() < 0.2,
  };
  if (kind === "color") {
    item.colorIdx = match ? colorIdx : colorExcept(rng, colorIdx);
  } else if (kind === "glyph") {
    item.glyph = match ? target : glyphExcept(rng, pool, glyphIdx);
  } else if (kind === "huge") {
    item.size = match ? "huge" : nonHugeSize(rng);
  } else if (kind === "tiny") {
    item.size = match ? "tiny" : nonTinySize(rng);
  } else if (kind === "spin") {
    item.spin = match;
  } else if (kind === "hugeColor") {
    if (match) {
      item = { ...item, size: "huge", colorIdx };
    } else {
      const r = rng();
      if (r < 0.35) item = { ...item, size: nonHugeSize(rng), colorIdx };
      else if (r < 0.7)
        item = { ...item, size: "huge", colorIdx: colorExcept(rng, colorIdx) };
      else
        item = {
          ...item,
          size: nonHugeSize(rng),
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
      if (r < 0.35) item = { ...item, size: nonHugeSize(rng), glyph: target };
      else if (r < 0.7)
        item = {
          ...item,
          size: "huge",
          glyph: glyphExcept(rng, pool, glyphIdx),
        };
      else
        item = {
          ...item,
          size: nonHugeSize(rng),
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
        { text: c.name, color: c.css },
        { text: meta.family === "shapes" ? " SHAPES" : " NUMBERS" },
      ];
    case "glyph":
      return meta.family === "numbers"
        ? [{ text: `HOW MANY ${g}s?` }]
        : [{ text: `HOW MANY ${SHAPE_NAMES[g]}?` }];
    case "huge":
      return [{ text: "COUNT THE HUGE ONES" }];
    case "tiny":
      return [{ text: "COUNT THE TINY ONES" }];
    case "spin":
      return [{ text: "COUNT THE SPINNING ONES" }];
    case "hugeColor":
      return [
        { text: "COUNT THE HUGE " },
        { text: c.name, color: c.css },
        { text: " ONES" },
      ];
    case "glyphColor":
      return [
        { text: "COUNT THE " },
        { text: c.name, color: c.css },
        { text: ` ${SHAPE_NAMES[g]}` },
      ];
    case "hugeGlyph":
      return meta.family === "numbers"
        ? [{ text: `COUNT THE HUGE ${g}s` }]
        : [{ text: `COUNT THE HUGE ${SHAPE_NAMES[g]}` }];
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
    Array.from({ length: plan.count }, (_, idx) =>
      makeItem(rng, meta, idx < answer)
    )
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
      wobble: 0.9 + rng() * 0.2,
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

function generateRounds(rng: Rng): CountRound[] {
  return Array.from({ length: ROUNDS }, (_, i) => generateRound(rng, i));
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
    const display = `${score}/${ROUNDS} · ${time.toFixed(1)}s`;
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
    if (!correct) livesRef.current -= 1;
    setLives(livesRef.current);
    setGap({ ok: correct, msg });
    setPhaseSafe("gap");
    if (correct) sfx.success();
    else sfx.error();

    gapTimeoutRef.current = window.setTimeout(
      () => {
        if (livesRef.current <= 0) {
          finish(false);
        } else if (roundRef.current + 1 >= ROUNDS) {
          finish(true);
        } else {
          roundRef.current += 1;
          lockedRef.current = false;
          setRound(roundRef.current);
          setGap(null);
          beginRound();
        }
      },
      correct ? 700 : 1100
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
      endRound(true, "NICE ✅");
    } else {
      endRound(false, `IT WAS ${r.answer}`);
    }
  }

  function startRun(m: Mode) {
    const generated = generateRounds(rngFor("count", m));
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
        icon="🔢"
        tagline="Count the chaos. Answer in one tap."
        howTo={[
          "A mob of numbers and shapes appears — count only what the question asks for.",
          "Answer with one tap on the keypad. A wrong count or a slow count costs a life.",
        ]}
        controlsHint="Tap the keypad · number keys on desktop"
        onStart={startRun}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        gameName="Headcount"
        path="/count"
        mode={mode}
        dailyNum={dailyNumber()}
        scoreLine={`${summary.score}/${ROUNDS} 🔢`}
        emojis={summary.emojis}
        survived={survived}
        newBest={newBest}
        bestDisplay={getBest("count", mode)?.display ?? null}
        streak={streak}
        extraStats={[
          { label: "Count time", value: `${summary.time.toFixed(1)}s` },
        ]}
        onPlayAgain={() => startRun(mode)}
      />
    );
  }

  const r = rounds[round];

  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs text-fog">
          QUESTION {round + 1}/{ROUNDS}
        </span>
        <Lives lives={lives} />
      </div>

      <TimerBar progress={phase === "scan" ? timer.progress : 1} />

      {/* The question */}
      <div className="text-center">
        <p className="font-display text-lg leading-snug">
          {r?.parts.map((part, i) => (
            <span key={i} style={{ color: part.color }}>
              {part.text}
            </span>
          ))}
        </p>
        {r?.kind === "spin" && (
          <p className="text-xs text-fog">(spinning = the tilted ones)</p>
        )}
      </div>

      {/* The mob */}
      <div
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border-2 border-line bg-panel shadow-chunk"
        style={{ aspectRatio: "4 / 3", containerType: "inline-size" }}
      >
        {r?.items.map((item, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute select-none font-display leading-none"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: `translate(-50%, -50%) scale(${item.wobble})`,
              fontSize: `${(
                Math.min(66 / r.cols, 11) * SIZE_SCALE[item.size]
              ).toFixed(2)}cqw`,
              color: COLORS[item.colorIdx].css,
              zIndex: SIZE_Z[item.size],
            }}
          >
            <span
              className={
                item.spin ? "animate-count-spin inline-block" : "inline-block"
              }
            >
              {item.glyph}
            </span>
          </span>
        ))}

        {/* Between-round overlay */}
        {phase === "gap" && gap && (
          <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
            <p
              className={`animate-pop rounded-xl border-2 px-4 py-2 font-display text-lg backdrop-blur ${
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

      {/* Keypad */}
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
    </div>
  );
}
