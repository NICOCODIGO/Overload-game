"use client";

import { useSyncExternalStore } from "react";
import type { GameId } from "./daily";

/**
 * Tiny i18n engine: a typed dictionary per language, current choice in
 * localStorage, and a pub/sub so every component switches at once.
 * To add a language: add its code to LANGS and a dictionary below — done.
 */

export type Lang = "en" | "es";

export const LANGS: Lang[] = ["en", "es"];

interface Dict {
  tagline: string;
  footerNote: string;
  daily: string;
  doneBadge: string;
  noBestYet: string;
  practice: string;
  practiceSub: string;
  doneToday: string;
  playAgainQ: string;
  dailyBest: string;
  practiceBest: string;
  streak: (n: number) => string;
  streakAlive: (n: number) => string;
  runComplete: string;
  gameOver: string;
  newBest: string;
  best: string;
  share: string;
  copied: string;
  playAgain: string;
  backToArcade: string;
  changeLang: string;
  mute: string;
  unmute: string;
  hooks: Record<GameId, string>;
}

const EN: Dict = {
  tagline: "Nine ways to fry your brain. New daily challenges at midnight UTC.",
  footerNote:
    "Personal bests and streaks live in your browser. No accounts, no tracking — just stress.",
  daily: "DAILY",
  doneBadge: "✓ DAILY",
  noBestYet: "no best yet — play!",
  practice: "PRACTICE",
  practiceSub: "random seed, no streak",
  doneToday: "done today:",
  playAgainQ: "play again?",
  dailyBest: "Daily best:",
  practiceBest: "Practice best:",
  streak: (n) => `${n}-day streak`,
  streakAlive: (n) => `${n}-day streak — keep it alive`,
  runComplete: "RUN COMPLETE",
  gameOver: "GAME OVER",
  newBest: "★ NEW PERSONAL BEST ★",
  best: "Best:",
  share: "SHARE RESULT",
  copied: "COPIED!",
  playAgain: "PLAY AGAIN",
  backToArcade: "← BACK TO ARCADE",
  changeLang: "Change language",
  mute: "Mute sounds",
  unmute: "Unmute sounds",
  hooks: {
    simon: "Only obey when Simon says. The buttons will lie to you.",
    sequence: "Intercept the code. Re-key it before the channel closes.",
    typing: "Type it exactly. The clock has no mercy.",
    clock: "Quick — what time is it? The hands won't wait.",
    anomaly: "One of them doesn't belong. Find it before the feed cuts.",
    count: "Count the chaos — but only the ones we ask for.",
    pattern: "2, 4, 8, 16… the pattern knows what comes next. Do you?",
    illusion: "Your eyes are lying. Answer anyway.",
    blink: "The scene flickers. One thing changed. Find it.",
  },
};

const ES: Dict = {
  tagline:
    "Nueve formas de freírte el cerebro. Retos diarios nuevos a medianoche UTC.",
  footerNote:
    "Tus récords y rachas viven en tu navegador. Sin cuentas, sin rastreo — solo estrés.",
  daily: "DIARIO",
  doneBadge: "✓ DIARIO",
  noBestYet: "sin récord aún — ¡juega!",
  practice: "PRÁCTICA",
  practiceSub: "semilla aleatoria, sin racha",
  doneToday: "hecho hoy:",
  playAgainQ: "¿repetir?",
  dailyBest: "Mejor diario:",
  practiceBest: "Mejor práctica:",
  streak: (n) => `racha de ${n} días`,
  streakAlive: (n) => `racha de ${n} días — no la pierdas`,
  runComplete: "RONDA COMPLETA",
  gameOver: "FIN DEL JUEGO",
  newBest: "★ NUEVO RÉCORD ★",
  best: "Récord:",
  share: "COMPARTIR RESULTADO",
  copied: "¡COPIADO!",
  playAgain: "JUGAR OTRA VEZ",
  backToArcade: "← VOLVER AL ARCADE",
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
    illusion: "Tus ojos te mienten. Responde igual.",
    blink: "La escena parpadea. Algo cambió. Encuéntralo.",
  },
};

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

/** Current dictionary — `const t = useT()` then `t.playAgain` etc. */
export function useT(): Dict {
  return DICTS[useLang()];
}
