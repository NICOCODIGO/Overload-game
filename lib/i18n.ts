"use client";

import type { GameId } from "./daily";

/**
 * Every string the site says, in one typed dictionary.
 *
 * This was a two-language engine — a stored choice plus a pub/sub so every
 * component switched at once. The Spanish dictionary and the switcher are
 * gone; only the dictionary itself remains.
 *
 * The one thing still outside this file is puzzle content that isn't really
 * copy: Panic Type's prompts and Scramble's word pool.
 */

/* ------------------------------------------------------------------ *
 * Shapes shared with the games
 * ------------------------------------------------------------------ */

/** One run of the Headcount question banner. Split into parts so color words
    render in their color and digit targets render as a bordered chip. */
export interface QuestionPart {
  text: string;
  /** CSS color — filled in by the game, which owns the palette. */
  color?: string;
  chip?: boolean;
  /** Underlined: marks the exact thing being counted. */
  emph?: boolean;
}

export type CountKind =
  | "color"
  | "glyph"
  | "huge"
  | "tiny"
  | "spin"
  | "hugeColor"
  | "glyphColor"
  | "hugeGlyph";

/** What a Headcount round is asking. Kept as data rather than a built string,
    so the dictionary owns how it gets worded. */
export interface CountQuery {
  kind: CountKind;
  /** Numbers family (vs. shapes). */
  numbers: boolean;
  colorIdx: number;
  /** The queried digit or shape character. */
  glyph: string;
}

/** A Next! rule, as data — the dictionary turns it into a sentence. */
export type RuleSpec =
  | { k: "shapeCycle"; period: number }
  /** Constant step, already formatted: "+3", "−7", "×2". */
  | { k: "step"; token: string }
  /** 0 = the very next letter. */
  | { k: "letterSkip"; skip: number }
  | { k: "rotation"; deg: number; clockwise: boolean }
  | { k: "secondDiff"; growth: number }
  | { k: "letterGrow" };

/** Intro-screen and in-play copy for one game. */
interface GameCopy {
  tagline: string;
  /** Exactly two short lines — no walls of text. */
  howTo: [string, string];
  controls: string;
  /** Label before the round number: "ROUND 3/30", "SECTOR 3/14". */
  counter: string;
  /** Unlimited-mode score line: "24 rounds". */
  unit: (n: number) => string;
}

interface Dict {
  tagline: string;
  feedback: string;
  daily: string;
  /** Menu-card daily status. */
  perfect: string;
  doneLabel: string;
  playToday: string;
  survival: string;
  survivalSub: string;
  streak: (n: number) => string;
  streakHint: string;
  /** Short tile labels + value for the intro-screen stat row. */
  statDaily: string;
  statSurvival: string;
  statStreak: string;
  streakDays: (n: number) => string;
  runComplete: string;
  gameOver: string;
  newBest: string;
  share: string;
  copied: string;
  playAgain: string;
  backToArcade: string;
  lastShown: (n: number) => string;
  mute: string;
  unmute: string;
  hooks: Record<GameId, string>;
  games: Record<GameId, GameCopy>;

  /** In-round verdicts: the shared four, then the per-game lines. */
  fb: {
    nice: string;
    tooSlow: string;
    timesUp: string;
    wrong: string;
    // Simon Says
    neverTap: string;
    didntSay: string;
    didntSayOk: string;
    wordNotColor: string;
    wrongButton: string;
    // Signal Rush
    channelClosed: string;
    signalSent: string;
    // Anomaly
    failed: string;
    anomalyFound: string;
    // Headcount
    itWas: (n: number) => string;
    timesUpItWas: (n: number) => string;
    // Next!
    itsRinged: string;
    // Scramble
    solved: string;
    // Blink
    gotIt: string;
    missedIt: string;
  };

  /** Labels that live on the play screens. */
  play: {
    // Simon Says
    simonSays: string;
    colors: Record<"red" | "blue" | "green" | "yellow", string>;
    tapButton: (color: string) => string;
    tapWord: (color: string) => string;
    getReady: string;
    buttonAria: (color: string, label: string) => string;
    // Signal Rush
    memorizeSignal: string;
    fromMemory: string;
    swipeOrKeys: string;
    // Panic Type
    typeHere: string;
    typeAria: string;
    // Overclocked
    matchTime: string;
    memorizeClock: string;
    /** "short & thick = HOUR · long arrow = MINUTE", in four pieces so the
        two hand names can keep their colors. */
    hands: { shortIs: string; hour: string; longIs: string; minute: string };
    // Anomaly
    find: string;
    // Scramble
    hintLabel: string;
    noHint: string;
    // Next!
    theRule: string;
  };

  /** Screen-reader-only labels. Invisible, but still the site talking. */
  a11y: {
    timeRemaining: string;
    lives: (left: number, max: number) => string;
    theAnomaly: string;
    theChange: string;
    dirs: Record<"up" | "down" | "left" | "right", string>;
    inputDir: (dir: string) => string;
    hiddenClock: string;
    analogClock: string;
    arrowAt: (deg: number) => string;
  };

  /** Headcount's question vocabulary — the banner is assembled from it. */
  count: {
    colors: string[];
    question: (q: CountQuery) => QuestionPart[];
    spinNote: string;
    anyColorAnySize: string;
    anyColor: string;
    barNote: string;
  };

  /** Next!'s rule sentences. */
  rule: (spec: RuleSpec) => string;
}

/* ------------------------------------------------------------------ *
 * English
 * ------------------------------------------------------------------ */

const EN_COUNT_COLORS = ["CORAL", "MINT", "LEMON", "SKY", "WHITE"];

const EN_SHAPES: Record<string, string> = {
  "●": "CIRCLES",
  "■": "SQUARES",
  "▲": "TRIANGLES",
  "★": "STARS",
  "◆": "DIAMONDS",
};

function enCountQuestion(q: CountQuery): QuestionPart[] {
  const color = EN_COUNT_COLORS[q.colorIdx];
  const shape = EN_SHAPES[q.glyph];
  switch (q.kind) {
    case "color":
      return [
        { text: "COUNT THE " },
        { text: color, emph: true },
        { text: q.numbers ? " NUMBERS" : " SHAPES" },
      ];
    case "glyph":
      return q.numbers
        ? [{ text: "HOW MANY" }, { text: q.glyph, chip: true }, { text: "?" }]
        : [{ text: "HOW MANY " }, { text: shape, emph: true }, { text: "?" }];
    case "huge":
      return [{ text: "COUNT THE " }, { text: "HUGE", emph: true }, { text: " ONES" }];
    case "tiny":
      return [{ text: "COUNT THE " }, { text: "TINY", emph: true }, { text: " ONES" }];
    case "spin":
      return [{ text: "COUNT THE " }, { text: "SPINNING", emph: true }, { text: " ONES" }];
    case "hugeColor":
      return [
        { text: "COUNT THE " },
        { text: "HUGE", emph: true },
        { text: " " },
        { text: color, emph: true },
        { text: " ONES" },
      ];
    case "glyphColor":
      return [
        { text: "COUNT THE " },
        { text: color, emph: true },
        { text: " " },
        { text: shape, emph: true },
      ];
    case "hugeGlyph":
      return q.numbers
        ? [
            { text: "COUNT THE " },
            { text: "HUGE", emph: true },
            { text: " " },
            { text: q.glyph, chip: true },
          ]
        : [
            { text: "COUNT THE " },
            { text: "HUGE", emph: true },
            { text: " " },
            { text: shape, emph: true },
          ];
  }
}

function enRule(spec: RuleSpec): string {
  switch (spec.k) {
    case "shapeCycle":
      return `the ${spec.period} shapes repeat in a loop`;
    case "step":
      return `${spec.token} each step`;
    case "letterSkip":
      return spec.skip === 0
        ? "the next letter each step"
        : `skip ${spec.skip} letter${spec.skip > 1 ? "s" : ""} each step`;
    case "rotation":
      return `rotates ${spec.deg}° ${
        spec.clockwise ? "clockwise" : "anticlockwise"
      } each step`;
    case "secondDiff":
      return `the step grows by ${spec.growth} every time`;
    case "letterGrow":
      return "the gap grows by one letter each step";
  }
}

const EN: Dict = {
  tagline: "Nine ways to test your brain. New challenges everyday",
  feedback: "SEND FEEDBACK",
  daily: "CHALLENGE",
  perfect: "PERFECT",
  doneLabel: "DONE",
  playToday: "Not Yet Played Today",
  survival: "UNLIMITED",
  survivalSub: "endless — how long can you last?",
  streak: (n) => `${n} day streak`,
  streakHint: "Play every day to grow your streak",
  statDaily: "TODAY'S BEST",
  statSurvival: "UNLIMITED BEST",
  statStreak: "STREAK",
  streakDays: (n) => `${n} day${n === 1 ? "" : "s"}`,
  runComplete: "RUN COMPLETE",
  gameOver: "GAME OVER",
  newBest: "★ NEW PERSONAL BEST ★",
  share: "SHARE RESULT",
  copied: "COPIED!",
  playAgain: "PLAY AGAIN",
  backToArcade: "← BACK TO ARCADE",
  lastShown: (n) => `last ${n} shown`,
  mute: "Mute sounds",
  unmute: "Unmute sounds",
  hooks: {
    simon: "Only obey when Simon says. The buttons will lie to you",
    sequence: "Intercept the code. Re-key it before the channel closes",
    typing: "Type it exactly how it is written. The clock has no mercy",
    clock: "Quick! What time is it? The hands won't wait, and neither will the clock",
    anomaly: "One of them doesn't belong. Find it before the feed cuts",
    count: "Count the chaos, but only the ones we ask for. Requires focus",
    pattern: "2, 4, 8, 16… the pattern knows what comes next. Do you?",
    scramble: "Unscramble the word — but junk letters are hidden in the pile",
    blink: "The scene flickers. One thing changed. Can you find what changed?",
  },
  games: {
    simon: {
      tagline: "Obedience training for your reflexes",
      howTo: [
        "Only obey a card stamped SIMON SAYS — otherwise freeze and let the clock run out",
        "Look very carefully, the WORDS and COLORS buttons on the card can lie to you",
      ],
      controls: "Tap the buttons",
      counter: "ROUND",
      unit: (n) => `${n} rounds`,
    },
    sequence: {
      tagline: "Calling in Hell- Wait wrong game!",
      howTo: [
        "Key in the arrow code, in order, before the channel closes",
        "Deep transmissions flash once then go dark — re-key them from memory. A wrong key resets the code",
      ],
      controls: "Arrow keys / WASD OR use the Arrow pads",
      counter: "TRANSMISSION",
      unit: (n) => `Level ${n}`,
    },
    typing: {
      tagline: "Precision typing with a gun to your deadline",
      howTo: [
        "Type each prompt exactly — capitals, punctuation, everything — before the bar empties",
        "Typos flash red and must be backspaced. Miss the clock and you lose a life",
      ],
      controls: "Just type",
      counter: "PROMPT",
      unit: (n) => `${n} prompts`,
    },
    clock: {
      tagline: "What time is it? It's OVERLOAD time!",
      howTo: [
        "Tap the time that matches the clock — some rounds flip it and you pick the face that matches the time",
        "Later faces lose their numbers — and the final clocks spin, freeze, and vanish. Answer from memory",
      ],
      controls: "Tap an answer OR use keys 1–4 on desktop",
      counter: "CLOCK",
      unit: (n) => `${n} clocks`,
    },
    anomaly: {
      tagline: "Anomaly detection under pressure. One doesn't belong",
      howTo: [
        "One thing in the crowd doesn't match — find it and tap it before the feed cuts out",
        "Wrong taps burn a second. Later sectors hide near-identical twins",
      ],
      controls: "Tap the odd one out",
      counter: "SECTOR",
      unit: (n) => `${n} found`,
    },
    count: {
      tagline: "Count the chaos. Answer in one tap",
      howTo: [
        "A mob of numbers and shapes appears — count only what the question asks for, then tap the keypad",
        "6 and 9 wear a bar on the bottom, so a spinning one still reads right. Read very carefully",
      ],
      controls: "Tap the keypad · number keys on desktop",
      counter: "QUESTION",
      unit: (n) => `${n} answered`,
    },
    pattern: {
      tagline: "Crack the rule before the clock does",
      howTo: [
        "A sequence will appear, could be numbers, letters, shapes, or spinning arrows. Work out the rule",
        "and tap what comes next. The wrong options are the mistakes you were about to make",
      ],
      controls: "Tap an answer OR use keys 1–4 on desktop",
      counter: "PATTERN",
      unit: (n) => `${n} solved`,
    },
    scramble: {
      tagline: "Unscramble the word. Ignore the junk",
      howTo: [
        "Tap the letter tiles to spell the hidden word before the clock runs out",
        "Decoys hide in the pile. When the hint's gone, one correct letter is locked in green to start you off",
      ],
      controls: "Tap the tiles or type on desktop",
      counter: "WORD",
      unit: (n) => `${n} words`,
    },
    blink: {
      tagline: "Something changed. You almost saw it",
      howTo: [
        "The scene flashes, blinks, and flashes again — one thing is different between flashes. Tap it",
        "Wrong taps burn time. Colors change loudly at first, then the changes get sneakier",
      ],
      controls: "Tap the thing that changes — on either flash",
      counter: "SCENE",
      unit: (n) => `${n} spotted`,
    },
  },
  fb: {
    nice: "NICE ✓",
    tooSlow: "TOO SLOW!",
    timesUp: "TIME'S UP!",
    wrong: "WRONG!",
    neverTap: "IT SAID GET READY — NEVER TAP!",
    didntSay: "SIMON DIDN'T SAY!",
    didntSayOk: "SIMON DIDN'T SAY ✓",
    wordNotColor: "THE WORD, NOT THE COLOR!",
    wrongButton: "WRONG BUTTON!",
    channelClosed: "CHANNEL CLOSED — RETRY",
    signalSent: "SIGNAL SENT ✓",
    failed: "FAILED ✗",
    anomalyFound: "ANOMALY CONFIRMED ✓",
    itWas: (n) => `IT WAS ${n}`,
    timesUpItWas: (n) => `TIME'S UP — IT WAS ${n}`,
    itsRinged: "NOPE — IT'S RINGED",
    solved: "SOLVED ✓",
    gotIt: "GOT IT ✓",
    missedIt: "MISSED IT — RINGED",
  },
  play: {
    simonSays: "SIMON SAYS",
    colors: { red: "RED", blue: "BLUE", green: "GREEN", yellow: "YELLOW" },
    tapButton: (color) => `TAP THE ${color} BUTTON`,
    tapWord: (color) => `TAP THE WORD ${color}`,
    getReady: "GET READY TO TAP…",
    buttonAria: (color, label) => `${color} button labeled ${label}`,
    memorizeSignal: "⚡ MEMORIZE — SIGNAL GOES DARK",
    fromMemory: "from memory — you've got this",
    swipeOrKeys: "swipe or use keys",
    typeHere: "type here…",
    typeAria: "Type the prompt here",
    matchTime: "MATCH THIS TIME",
    memorizeClock: "⚡ MEMORIZE — IT WON'T STAY",
    hands: {
      shortIs: "short & thick =",
      hour: "HOUR",
      longIs: "· long arrow =",
      minute: "MINUTE",
    },
    find: "FIND:",
    hintLabel: "hint:",
    noHint: "no hint",
    theRule: "THE RULE",
  },
  a11y: {
    timeRemaining: "Time remaining",
    lives: (left, max) => `${left} of ${max} lives remaining`,
    theAnomaly: "the anomaly",
    theChange: "the thing that changes",
    dirs: { up: "up", down: "down", left: "left", right: "right" },
    inputDir: (dir) => `input ${dir}`,
    hiddenClock: "hidden clock",
    analogClock: "analog clock",
    arrowAt: (deg) => `arrow at ${deg} degrees`,
  },
  count: {
    colors: EN_COUNT_COLORS,
    question: enCountQuestion,
    spinNote: "(spinning = the tilted ones)",
    anyColorAnySize: "(any color · any size",
    anyColor: "(any color",
    barNote: " · the bar marks the bottom",
  },
  rule: enRule,
};

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

/** The dictionary's type, for helpers that take `t` as an argument. */
export type T = Dict;

/**
 * The dictionary — `const t = useT()` then `t.playAgain` etc.
 *
 * Now a plain lookup, but kept as a hook-shaped call so every component reads
 * its copy the same way it always did. That indirection is what makes this
 * file the one place wording is edited, and what would make adding a language
 * back a change here rather than in every component.
 */
export function useT(): Dict {
  return EN;
}
