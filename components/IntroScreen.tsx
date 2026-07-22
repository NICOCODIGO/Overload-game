"use client";

import Link from "next/link";
import type { GameId, Mode } from "@/lib/daily";
import { dailyNumber } from "@/lib/daily";
import { getBest, getDailyResult, getStreak } from "@/lib/storage";
import { useClientValue } from "@/lib/hooks";
import { unlockAudio } from "@/lib/audio";
import { useT } from "@/lib/i18n";
import { PixelIcon, type UiIcon } from "./PixelIcon";

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
  const bestSurvival = useClientValue(
    () => getBest(props.game, "survival"),
    null
  );
  const streak = useClientValue(getStreak, 0);

  const start = (mode: Mode) => {
    unlockAudio(); // user gesture — safe moment to create the AudioContext
    props.onStart(mode);
  };

  // Only the stats that exist get a tile, so the row stays balanced.
  const stats: {
    icon: UiIcon;
    value: string;
    label: string;
    color: string;
  }[] = [
    ...(bestDaily
      ? [
          {
            icon: "trophy" as UiIcon,
            value: bestDaily.display,
            label: t.statDaily,
            color: "text-lemon",
          },
        ]
      : []),
    ...(bestSurvival
      ? [
          {
            icon: "target" as UiIcon,
            value: bestSurvival.display,
            label: t.statSurvival,
            color: "text-mint",
          },
        ]
      : []),
    ...(streak > 0
      ? [
          {
            icon: "flame" as UiIcon,
            value: t.streakDays(streak),
            label: t.statStreak,
            color: "text-coral",
          },
        ]
      : []),
  ];

  return (
    <div className="animate-rise flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center sm:gap-6 sm:py-10">
      <div>
        <PixelIcon
          name={props.game}
          size={56}
          className="mx-auto h-11 w-11 sm:h-14 sm:w-14"
        />
        <h1 className="mt-1 font-display text-3xl text-lemon drop-shadow-[2px_2px_0_var(--color-coral)] sm:mt-2 sm:text-4xl sm:drop-shadow-[3px_3px_0_var(--color-coral)]">
          {props.title}
        </h1>
        <p className="mt-1 font-pixel text-lg text-fog sm:mt-2 sm:text-xl">
          {props.tagline}
        </p>
      </div>

      {/* How to play, as one short paragraph — with your record underneath,
          so the card reads as "here's the game, here's how you've done". */}
      <div className="w-full max-w-sm space-y-2.5 rounded-xl border-2 border-line bg-panel p-4 shadow-chunk sm:space-y-3 sm:p-5">
        <p className="font-pixel text-lg leading-snug sm:text-xl">
          {props.howTo.join(" ")}
        </p>
        {props.controlsHint && (
          <p className="font-pixel text-sm text-fog sm:text-base">
            {props.controlsHint}
          </p>
        )}

        {stats.length > 0 && (
          <div className="flex gap-2 border-t-2 border-line pt-2.5 sm:pt-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-panel2 px-2 py-2 sm:py-2.5"
              >
                <PixelIcon name={s.icon} size={16} />
                <span className={`font-display text-sm ${s.color}`}>
                  {s.value}
                </span>
                <span className="text-center font-display text-[9px] leading-tight tracking-wider text-fog">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => start("daily")}
          className="rounded-xl border-2 border-black/40 bg-lemon px-6 py-3 font-display text-lg text-ink shadow-chunk transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:py-4"
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
          onClick={() => start("survival")}
          className="rounded-xl border-2 border-line bg-panel px-6 py-2.5 font-display text-paper shadow-chunk-sm transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:py-3"
        >
          {t.survival}
          <span className="block text-xs font-sans font-normal text-fog">
            {t.survivalSub}
          </span>
        </button>
        <Link
          href="/"
          className="py-1 text-center font-display text-xs text-fog hover:text-paper"
        >
          {t.backToArcade}
        </Link>
      </div>
    </div>
  );
}
