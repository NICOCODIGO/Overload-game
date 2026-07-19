"use client";

import type { GameId, Mode } from "@/lib/daily";
import { dailyNumber } from "@/lib/daily";
import { getBest, getDailyResult, getStreak } from "@/lib/storage";
import { useClientValue } from "@/lib/hooks";
import { unlockAudio } from "@/lib/audio";
import { useT } from "@/lib/i18n";
import { PixelIcon } from "./PixelIcon";

interface IntroScreenProps {
  game: GameId;
  title: string;
  tagline: string;
  /** Exactly two short lines — no walls of text. */
  howTo: [string, string];
  controlsHint?: string;
  onStart: (mode: Mode) => void;
}

/**
 * Shared pre-game screen: title, 2-line how-to, Daily + Practice buttons,
 * personal bests, and today's result if the daily was already played.
 */
export function IntroScreen(props: IntroScreenProps) {
  const t = useT();
  const num = useClientValue(dailyNumber, 0);
  const todayResult = useClientValue(
    () => getDailyResult(props.game, dailyNumber()),
    null
  );
  const bestDaily = useClientValue(() => getBest(props.game, "daily"), null);
  const bestPractice = useClientValue(
    () => getBest(props.game, "practice"),
    null
  );
  const streak = useClientValue(getStreak, 0);

  const start = (mode: Mode) => {
    unlockAudio(); // user gesture — safe moment to create the AudioContext
    props.onStart(mode);
  };

  return (
    <div className="animate-rise flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <div>
        <PixelIcon name={props.game} size={56} className="mx-auto" />
        <h1 className="mt-2 font-display text-4xl text-lemon drop-shadow-[3px_3px_0_var(--color-coral)]">
          {props.title}
        </h1>
        <p className="mt-2 text-fog">{props.tagline}</p>
      </div>

      <div className="w-full max-w-sm space-y-4 rounded-xl border-2 border-line bg-panel p-5 text-left shadow-chunk">
        {props.howTo.map((line, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-mint/40 bg-panel2 font-display text-sm text-mint">
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed">{line}</p>
          </div>
        ))}
        {props.controlsHint && (
          <p className="border-t-2 border-line pt-3 text-center text-xs text-fog">
            {props.controlsHint}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={() => start("daily")}
          className="rounded-xl border-2 border-black/40 bg-lemon px-6 py-4 font-display text-lg text-ink shadow-chunk transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {t.daily} #{num || "…"}
          {todayResult && (
            <span className="block text-xs font-sans font-normal">
              {t.doneToday} {todayResult.display} — {t.playAgainQ}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => start("practice")}
          className="rounded-xl border-2 border-line bg-panel px-6 py-3 font-display text-paper shadow-chunk-sm transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {t.practice}
          <span className="block text-xs font-sans font-normal text-fog">
            {t.practiceSub}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-fog">
        {bestDaily && (
          <span className="flex items-center gap-1.5">
            <PixelIcon name="trophy" size={14} />
            {t.dailyBest} {bestDaily.display}
          </span>
        )}
        {bestPractice && (
          <span className="flex items-center gap-1.5">
            <PixelIcon name="target" size={14} />
            {t.practiceBest} {bestPractice.display}
          </span>
        )}
        {streak > 0 && (
          <span className="flex items-center gap-1.5">
            <PixelIcon name="flame" size={14} />
            {t.streak(streak)}
          </span>
        )}
      </div>
    </div>
  );
}
