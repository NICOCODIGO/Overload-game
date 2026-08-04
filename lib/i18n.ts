"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { GameId } from "./daily";

/**
 * Tiny i18n engine: a typed dictionary per language, current choice in
 * localStorage, and a pub/sub so every component switches at once.
 * To add a language: add its code to LANGS and a dictionary below — done.
 *
 * Everything the site *says* belongs here, including in-game copy. The only
 * English left outside this file is puzzle content that can't be translated
 * without new content: Panic Type's prompts and Scramble's word pool.
 */

export type Lang = "en" | "es";

export const LANGS: Lang[] = ["en", "es"];

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

/** What a Headcount round is asking. The dictionary turns it into a sentence,
    because word order differs by language (English puts the adjective first,
    Spanish puts it after the noun). */
export interface CountQuery {
  kind: CountKind;
  /** Numbers family (vs. shapes). */
  numbers: boolean;
  colorIdx: number;
  /** The queried digit or shape character. */
  glyph: string;
}

/** A Next! rule, as data — the sentence is written per language. */
export type RuleSpec =
  | { k: "shapeCycle"; period: number }
  /** Constant step, already formatted: "+3", "−7", "×2". */
  | { k: "step"; token: string }
  | { k: "repeatDigits" }
  /** 0 = the very next letter. */
  | { k: "letterSkip"; skip: number }
  | { k: "rotation"; deg: number; clockwise: boolean }
  | { k: "secondDiff"; growth: number }
  | { k: "interleave"; a: number; b: number }
  | { k: "letterGrow" };

/** Intro-screen and in-play copy for one game. */
interface GameCopy {
  tagline: string;
  /** Exactly two short lines — no walls of text. */
  howTo: [string, string];
  controls: string;
  /** Label before the round number: "ROUND 3/30", "SECTOR 3/14". */
  counter: string;
  /** Unlimited-mode score line: "24 rounds", "24 palabras". */
  unit: (n: number) => string;
  /** The grey one-liner under the play area. */
  hint: string;
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
  changeLang: string;
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
    patience: string;
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

  /** Screen-reader-only labels. Invisible, but they're still the site
      talking — and a Spanish player's screen reader should speak Spanish. */
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

  /** Headcount's question vocabulary — the banner is assembled per language. */
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
    case "repeatDigits":
      return "the digit goes up by 1 — and repeats one more time each step";
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
    case "interleave":
      return `two sequences woven together: one +${spec.a}, the other +${spec.b}`;
    case "letterGrow":
      return "the gap grows by one letter each step";
  }
}

const EN: Dict = {
  tagline: "Nine ways to test your brain. New challenges everyday.",
  feedback: "SEND FEEDBACK",
  daily: "CHALLENGE",
  perfect: "PERFECT",
  doneLabel: "DONE",
  playToday: "play today's daily",
  survival: "UNLIMITED",
  survivalSub: "endless — how long can you last?",
  streak: (n) => `${n}-day streak`,
  streakHint: "Play every day to grow your streak.",
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
  changeLang: "Change language",
  mute: "Mute sounds",
  unmute: "Unmute sounds",
  hooks: {
    simon: "Only obey when Simon says. The buttons will lie to you.",
    sequence: "Intercept the code. Re-key it before the channel closes.",
    typing: "Type it exactly how it is written. The clock has no mercy.",
    clock: "Quick! What time is it? The hands won't wait, and neither will the clock.",
    anomaly: "One of them doesn't belong. Find it before the feed cuts.",
    count: "Count the chaos, but only the ones we ask for. Requires focus.",
    pattern: "2, 4, 8, 16… the pattern knows what comes next. Do you?",
    scramble: "Unscramble the word — but junk letters are hidden in the pile.",
    blink: "The scene flickers. One thing changed. Can you find what changed?",
  },
  games: {
    simon: {
      tagline: "Obedience training for your reflexes.",
      howTo: [
        "Only obey a card stamped SIMON SAYS — otherwise freeze and let the clock run out.",
        "Look very carefully, the WORDS and COLORS buttons on the card can lie to you.",
      ],
      controls: "Tap the buttons · keys 1–4 on desktop",
      counter: "ROUND",
      unit: (n) => `${n} rounds`,
      hint: "No stamp? Don't touch anything.",
    },
    sequence: {
      tagline: "Crack the intercepted code before the channel closes.",
      howTo: [
        "Key in the arrow code, in order, before the channel closes.",
        "Deep transmissions flash once then go dark — re-key them from memory. A wrong key resets the code.",
      ],
      controls: "Arrow keys / WASD · swipe or d-pad on touch",
      counter: "TRANSMISSION",
      unit: (n) => `Level ${n}`,
      hint: "",
    },
    typing: {
      tagline: "Precision typing with a gun to your deadline.",
      howTo: [
        "Type each prompt exactly — capitals, punctuation, everything — before the bar empties.",
        "Typos flash red and must be backspaced. Miss the clock and you lose a life.",
      ],
      controls: "Just type · on-screen keyboard on mobile",
      counter: "PROMPT",
      unit: (n) => `${n} prompts`,
      hint: "exact match — capitals & punctuation count",
    },
    clock: {
      tagline: "You learned this in second grade. Prove it.",
      howTo: [
        "Tap the time that matches the clock — some rounds flip it and you pick the face that matches the time.",
        "Later faces lose their numbers — and the final clocks spin, freeze, and vanish. Answer from memory.",
      ],
      controls: "Tap an answer · keys 1–4 on desktop",
      counter: "CLOCK",
      unit: (n) => `${n} clocks`,
      hint: "",
    },
    anomaly: {
      tagline: "Anomaly detection under pressure. One doesn't belong.",
      howTo: [
        "One thing in the crowd doesn't match — find it and tap it before the feed cuts out.",
        "Wrong taps burn a second. Later sectors hide near-identical twins.",
      ],
      controls: "Tap the odd one out — that's it, that's the game",
      counter: "SECTOR",
      unit: (n) => `${n} found`,
      hint: "scan in rows — your eyes cheat on diagonals",
    },
    count: {
      tagline: "Count the chaos. Answer in one tap.",
      howTo: [
        "A mob of numbers and shapes appears — count only what the question asks for, then tap the keypad.",
        "6 and 9 wear a bar on the bottom, so a spinning one still reads right. Read very carefully.",
      ],
      controls: "Tap the keypad · number keys on desktop",
      counter: "QUESTION",
      unit: (n) => `${n} answered`,
      hint: "",
    },
    pattern: {
      tagline: "Crack the rule before the clock does.",
      howTo: [
        "A sequence appears — numbers, letters, shapes, or spinning arrows. Work out the rule.",
        "Tap what comes next. The wrong options are the mistakes you were about to make.",
      ],
      controls: "Tap an answer · keys 1–4 on desktop",
      counter: "PATTERN",
      unit: (n) => `${n} solved`,
      hint: "the rule can hide in gaps, growth, or every other term",
    },
    scramble: {
      tagline: "Unscramble the word. Ignore the junk.",
      howTo: [
        "Tap the letter tiles to spell the hidden word before the clock runs out.",
        "Decoys hide in the pile. When the hint's gone, one correct letter is locked in green to start you off.",
      ],
      controls: "Tap the tiles · type on desktop · backspace to undo",
      counter: "WORD",
      unit: (n) => `${n} words`,
      hint: "tap a slot to send a letter back · some tiles are junk",
    },
    blink: {
      tagline: "Something changed. You almost saw it.",
      howTo: [
        "The scene flashes, blinks, and flashes again — one thing is different between flashes. Tap it.",
        "Wrong taps burn time. Colors change loudly at first, then the changes get sneakier.",
      ],
      controls: "Tap the thing that changes — on either flash",
      counter: "SCENE",
      unit: (n) => `${n} spotted`,
      hint: "the blink is doing this — your eyes need the cut to hide the change",
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
    patience: "PATIENCE PAYS ✓",
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
    noHint: "no hint — you're on your own",
    theRule: "THE RULE:",
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
 * Spanish
 * ------------------------------------------------------------------ */

const ES_COUNT_COLORS = ["CORAL", "MENTA", "LIMÓN", "CIELO", "BLANCO"];

/** Spanish shape names carry their gender — the question needs it to agree. */
const ES_SHAPES: Record<string, { n: string; fem: boolean }> = {
  "●": { n: "CÍRCULOS", fem: false },
  "■": { n: "CUADRADOS", fem: false },
  "▲": { n: "TRIÁNGULOS", fem: false },
  "★": { n: "ESTRELLAS", fem: true },
  "◆": { n: "ROMBOS", fem: false },
};

function esCountQuestion(q: CountQuery): QuestionPart[] {
  const color = ES_COUNT_COLORS[q.colorIdx];
  const shape = ES_SHAPES[q.glyph];
  // Shapes agree in gender; the numbers family is always masculine.
  const fem = !q.numbers && shape.fem;
  const the = fem ? "LAS" : "LOS";
  switch (q.kind) {
    case "color":
      return [
        { text: `CUENTA ${q.numbers ? "LOS NÚMEROS" : "LAS FIGURAS"} ` },
        { text: color, emph: true },
      ];
    case "glyph":
      return q.numbers
        ? [{ text: "¿CUÁNTOS" }, { text: q.glyph, chip: true }, { text: "HAY?" }]
        : [
            { text: `¿CUÁNT${fem ? "AS" : "OS"} ` },
            { text: shape.n, emph: true },
            { text: " HAY?" },
          ];
    case "huge":
      return [{ text: "CUENTA LOS " }, { text: "GRANDES", emph: true }];
    case "tiny":
      return [{ text: "CUENTA LOS " }, { text: "PEQUEÑOS", emph: true }];
    case "spin":
      return [{ text: "CUENTA LOS QUE " }, { text: "GIRAN", emph: true }];
    case "hugeColor":
      return [
        { text: "CUENTA LOS " },
        { text: "GRANDES", emph: true },
        { text: " " },
        { text: color, emph: true },
      ];
    case "glyphColor":
      return [
        { text: `CUENTA ${the} ` },
        { text: shape.n, emph: true },
        { text: " " },
        { text: color, emph: true },
      ];
    case "hugeGlyph":
      return q.numbers
        ? [
            { text: "CUENTA LOS " },
            { text: q.glyph, chip: true },
            { text: " " },
            { text: "GRANDES", emph: true },
          ]
        : [
            { text: `CUENTA ${the} ` },
            { text: shape.n, emph: true },
            { text: " " },
            { text: "GRANDES", emph: true },
          ];
  }
}

function esRule(spec: RuleSpec): string {
  switch (spec.k) {
    case "shapeCycle":
      return `las ${spec.period} figuras se repiten en bucle`;
    case "step":
      return `${spec.token} en cada paso`;
    case "repeatDigits":
      return "el dígito sube de 1 en 1 — y se repite una vez más en cada paso";
    case "letterSkip":
      return spec.skip === 0
        ? "la siguiente letra en cada paso"
        : `salta ${spec.skip} letra${spec.skip > 1 ? "s" : ""} en cada paso`;
    case "rotation":
      return `gira ${spec.deg}° en sentido ${
        spec.clockwise ? "horario" : "antihorario"
      } en cada paso`;
    case "secondDiff":
      return `el salto crece ${spec.growth} cada vez`;
    case "interleave":
      return `dos secuencias entrelazadas: una +${spec.a}, la otra +${spec.b}`;
    case "letterGrow":
      return "el hueco crece una letra en cada paso";
  }
}

const ES: Dict = {
  tagline:
    "Nueve formas de freírte el cerebro. Retos diarios nuevos a medianoche UTC.",
  feedback: "ENVIAR COMENTARIOS",
  daily: "RETO",
  perfect: "PERFECTO",
  doneLabel: "HECHO",
  playToday: "juega el reto de hoy",
  survival: "ILIMITADO",
  survivalSub: "sin fin — ¿cuánto aguantas?",
  streak: (n) => `racha de ${n} días`,
  streakHint: "Juega cada día para aumentar tu racha.",
  statDaily: "MEJOR DE HOY",
  statSurvival: "MEJOR ILIM.",
  statStreak: "RACHA",
  streakDays: (n) => `${n} día${n === 1 ? "" : "s"}`,
  runComplete: "RONDA COMPLETA",
  gameOver: "FIN DEL JUEGO",
  newBest: "★ NUEVO RÉCORD ★",
  share: "COMPARTIR RESULTADO",
  copied: "¡COPIADO!",
  playAgain: "JUGAR OTRA VEZ",
  backToArcade: "← VOLVER AL ARCADE",
  lastShown: (n) => `últimos ${n} mostrados`,
  changeLang: "Cambiar idioma",
  mute: "Silenciar sonidos",
  unmute: "Activar sonidos",
  hooks: {
    simon: "Obedece solo cuando Simón lo diga. Los botones te mentirán.",
    sequence: "Intercepta el código. Retransmítelo antes de que cierre el canal.",
    typing: "Escríbelo exacto. El reloj no tiene piedad.",
    clock: "Rápido — ¿qué hora es? Las manecillas no esperan.",
    anomaly: "Uno no encaja. Encuéntralo antes de que se corte la señal.",
    count: "Cuenta el caos — pero solo lo que te pedimos.",
    pattern: "2, 4, 8, 16… el patrón sabe qué sigue. ¿Y tú?",
    scramble: "Ordena la palabra — pero hay letras falsas en el montón.",
    blink: "La escena parpadea. Algo cambió. Encuéntralo.",
  },
  games: {
    simon: {
      tagline: "Entrenamiento de obediencia para tus reflejos.",
      howTo: [
        "Obedece solo las tarjetas con el sello SIMÓN DICE — si no, quédate quieto y deja correr el reloj.",
        "Fíjate bien: las PALABRAS y los COLORES de los botones pueden mentirte.",
      ],
      controls: "Toca los botones · teclas 1–4 en escritorio",
      counter: "RONDA",
      unit: (n) => `${n} rondas`,
      hint: "¿Sin sello? No toques nada.",
    },
    sequence: {
      tagline: "Descifra el código interceptado antes de que cierre el canal.",
      howTo: [
        "Introduce el código de flechas, en orden, antes de que cierre el canal.",
        "Las transmisiones profundas destellan una vez y se apagan — repítelas de memoria. Una tecla mal reinicia el código.",
      ],
      controls: "Flechas / WASD · desliza o usa el d-pad en táctil",
      counter: "TRANSMISIÓN",
      unit: (n) => `Nivel ${n}`,
      hint: "",
    },
    typing: {
      tagline: "Mecanografía de precisión con el reloj en la nuca.",
      howTo: [
        "Escribe cada frase exacta — mayúsculas, puntuación, todo — antes de que se vacíe la barra.",
        "Los errores destellan en rojo y hay que borrarlos. Si se acaba el tiempo, pierdes una vida.",
      ],
      controls: "Solo escribe · teclado en pantalla en móvil",
      counter: "FRASE",
      unit: (n) => `${n} frases`,
      hint: "coincidencia exacta — mayúsculas y puntuación cuentan",
    },
    clock: {
      tagline: "Lo aprendiste en primaria. Demuéstralo.",
      howTo: [
        "Toca la hora que marca el reloj — en algunas rondas se invierte y eliges la esfera que coincide con la hora.",
        "Las esferas van perdiendo los números — y los últimos relojes giran, se congelan y desaparecen. Responde de memoria.",
      ],
      controls: "Toca una respuesta · teclas 1–4 en escritorio",
      counter: "RELOJ",
      unit: (n) => `${n} relojes`,
      hint: "",
    },
    anomaly: {
      tagline: "Detección de anomalías bajo presión. Una no encaja.",
      howTo: [
        "Algo en la multitud no coincide — encuéntralo y tócalo antes de que se corte la señal.",
        "Los toques fallidos queman un segundo. Los últimos sectores esconden gemelos casi idénticos.",
      ],
      controls: "Toca el que sobra — eso es todo, ese es el juego",
      counter: "SECTOR",
      unit: (n) => `${n} encontrados`,
      hint: "escanea por filas — tus ojos hacen trampa en diagonal",
    },
    count: {
      tagline: "Cuenta el caos. Responde de un toque.",
      howTo: [
        "Aparece una multitud de números y figuras — cuenta solo lo que pide la pregunta y toca el teclado.",
        "El 6 y el 9 llevan una barra abajo, así que uno girando se sigue leyendo bien. Lee con mucho cuidado.",
      ],
      controls: "Toca el teclado · teclas numéricas en escritorio",
      counter: "PREGUNTA",
      unit: (n) => `${n} respondidas`,
      hint: "",
    },
    pattern: {
      tagline: "Descifra la regla antes que el reloj.",
      howTo: [
        "Aparece una secuencia — números, letras, figuras o flechas que giran. Deduce la regla.",
        "Toca lo que sigue. Las opciones falsas son los errores que estabas a punto de cometer.",
      ],
      controls: "Toca una respuesta · teclas 1–4 en escritorio",
      counter: "PATRÓN",
      unit: (n) => `${n} resueltos`,
      hint: "la regla puede esconderse en los saltos, el crecimiento o cada dos términos",
    },
    scramble: {
      tagline: "Ordena la palabra. Ignora la basura.",
      howTo: [
        "Toca las fichas de letras para formar la palabra oculta antes de que se acabe el tiempo.",
        "Hay señuelos en el montón. Cuando no hay pista, una letra correcta queda fijada en verde para empezar.",
      ],
      controls: "Toca las fichas · escribe en escritorio · retroceso para deshacer",
      counter: "PALABRA",
      unit: (n) => `${n} palabras`,
      hint: "toca una casilla para devolver una letra · algunas fichas son basura",
    },
    blink: {
      tagline: "Algo cambió. Casi lo viste.",
      howTo: [
        "La escena destella, parpadea y vuelve a destellar — una cosa cambia entre destellos. Tócala.",
        "Los toques fallidos queman tiempo. Al principio los colores cambian a lo bestia; luego se vuelven sutiles.",
      ],
      controls: "Toca lo que cambia — en cualquiera de los dos destellos",
      counter: "ESCENA",
      unit: (n) => `${n} detectados`,
      hint: "el parpadeo lo provoca — tus ojos necesitan el corte para ocultar el cambio",
    },
  },
  fb: {
    nice: "¡BIEN! ✓",
    tooSlow: "¡DEMASIADO LENTO!",
    timesUp: "¡SE ACABÓ EL TIEMPO!",
    wrong: "¡INCORRECTO!",
    neverTap: "DIJO PREPÁRATE — ¡NUNCA TOQUES!",
    didntSay: "¡SIMÓN NO LO DIJO!",
    didntSayOk: "SIMÓN NO LO DIJO ✓",
    patience: "LA PACIENCIA PAGA ✓",
    wordNotColor: "¡LA PALABRA, NO EL COLOR!",
    wrongButton: "¡BOTÓN EQUIVOCADO!",
    channelClosed: "CANAL CERRADO — REINTENTA",
    signalSent: "SEÑAL ENVIADA ✓",
    failed: "FALLASTE ✗",
    anomalyFound: "ANOMALÍA CONFIRMADA ✓",
    itWas: (n) => `ERAN ${n}`,
    timesUpItWas: (n) => `SE ACABÓ — ERAN ${n}`,
    itsRinged: "NO — ESTÁ MARCADA",
    solved: "¡RESUELTA! ✓",
    gotIt: "¡LA VISTE! ✓",
    missedIt: "SE TE ESCAPÓ — MARCADA",
  },
  play: {
    simonSays: "SIMÓN DICE",
    colors: { red: "ROJO", blue: "AZUL", green: "VERDE", yellow: "AMARILLO" },
    tapButton: (color) => `TOCA EL BOTÓN ${color}`,
    tapWord: (color) => `TOCA LA PALABRA ${color}`,
    getReady: "PREPÁRATE PARA TOCAR…",
    buttonAria: (color, label) => `botón ${color} con la palabra ${label}`,
    memorizeSignal: "⚡ MEMORIZA — LA SEÑAL SE APAGA",
    fromMemory: "de memoria — tú puedes",
    swipeOrKeys: "desliza o usa las teclas",
    typeHere: "escribe aquí…",
    typeAria: "Escribe la frase aquí",
    matchTime: "IGUALA ESTA HORA",
    memorizeClock: "⚡ MEMORIZA — NO SE QUEDARÁ",
    hands: {
      shortIs: "corta y gruesa =",
      hour: "HORA",
      longIs: "· flecha larga =",
      minute: "MINUTO",
    },
    find: "BUSCA:",
    hintLabel: "pista:",
    noHint: "sin pista — estás solo",
    theRule: "LA REGLA:",
  },
  a11y: {
    timeRemaining: "Tiempo restante",
    lives: (left, max) => `${left} de ${max} vidas restantes`,
    theAnomaly: "la anomalía",
    theChange: "lo que cambia",
    dirs: { up: "arriba", down: "abajo", left: "izquierda", right: "derecha" },
    inputDir: (dir) => `introducir ${dir}`,
    hiddenClock: "reloj oculto",
    analogClock: "reloj analógico",
    arrowAt: (deg) => `flecha a ${deg} grados`,
  },
  count: {
    colors: ES_COUNT_COLORS,
    question: esCountQuestion,
    spinNote: "(girando = los inclinados)",
    anyColorAnySize: "(cualquier color · cualquier tamaño",
    anyColor: "(cualquier color",
    barNote: " · la barra marca abajo",
  },
  rule: esRule,
};

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

const DICTS: Record<Lang, Dict> = { en: EN, es: ES };

function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem("overload:lang");
    return raw === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

const listeners = new Set<() => void>();

export function setLang(lang: Lang): void {
  try {
    window.localStorage.setItem("overload:lang", lang);
  } catch {
    // No storage — the choice just won't survive a reload.
  }
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function cycleLang(): void {
  const cur = readLang();
  setLang(LANGS[(LANGS.indexOf(cur) + 1) % LANGS.length]);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, readLang, () => "en" as Lang);
}

/**
 * Keep <html lang> honest. The document is prerendered as `en`, so a returning
 * Spanish player would otherwise be read out in English by a screen reader
 * until they touched the language button.
 */
export function useSyncHtmlLang(): void {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
}

/** The dictionary's type, for helpers that take `t` as an argument. */
export type T = Dict;

/** Current dictionary — `const t = useT()` then `t.playAgain` etc. */
export function useT(): Dict {
  return DICTS[useLang()];
}
