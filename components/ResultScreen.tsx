"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { GameId, Mode } from "@/lib/daily";
import { GAMES } from "@/lib/games";
import { buildShareText, copyToClipboard } from "@/lib/share";
import { getDailyResult } from "@/lib/storage";
import { useT } from "@/lib/i18n";
import { useClientValue, useLiveBackdrop } from "@/lib/hooks";
import { PixelIcon, type UiIcon } from "./PixelIcon";
import { GameTitle } from "./GameTitle";
import { Confetti } from "./Confetti";

/** Only the clipboard share text uses emoji — it's plain text pasted into
    chats. On screen everything renders as pixel sprites. */
const SHARE_EMOJI: Record<GameId, string> = {
  simon: "🫵",
  sequence: "⚡",
  typing: "🎯",
  clock: "🕐",
  anomaly: "🔎",
  count: "🔢",
  pattern: "🧩",
  scramble: "🔤",
  blink: "👀",
};

interface ResultScreenProps {
  game: GameId;
  mode: Mode;
  dailyNum: number; // ignored in survival mode
  /** Headline score, already in the player's language. */
  scoreLine: string;
  /** Personal best for this mode, same formatting as scoreLine. */
  bestDisplay: string | null;
  /** One ✅/❌ per round, in order. */
  emojis: string[];
  /** True if the run ended by finishing, false if lives ran out. */
  survived: boolean;
  newBest: boolean;
  streak: number;
  onPlayAgain: () => void;
}

/** Shared post-game screen: emoji strip, score, share-to-clipboard, replay. */
export function ResultScreen(props: ResultScreenProps) {
  const t = useT();
  useLiveBackdrop(); // round's over — let the grid move again
  const meta = GAMES[props.game];
  const [copied, setCopied] = useState(false);
  const bestBadgeRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  // Survival runs can be 100+ rounds — far too many sprites to render or to
  // paste into a chat. Show only the tail (where the run got hard and ended)
  // and prefix a "…" marker so it reads as a clipped strip.
  const MAX_STRIP = 40;
  const clipped = props.emojis.length > MAX_STRIP;
  const shown = clipped ? props.emojis.slice(-MAX_STRIP) : props.emojis;

  const share = async () => {
    const shareEmojis = clipped
      ? "…" + props.emojis.slice(-30).join("")
      : props.emojis.join("");
    const ok = await copyToClipboard(
      buildShareText({
        gameName: meta.name,
        dailyNum: props.mode === "daily" ? props.dailyNum : null,
        scoreLine: `${props.scoreLine} ${SHARE_EMOJI[props.game]}`,
        emojis: shareEmojis,
        path: meta.path,
      })
    );
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1800);
  };

  // Wrap the strip every 10 for readability; share text stays one line.
  // On screen the ✅/❌ render as pixel sprites; the clipboard keeps emoji.
  const rows: string[][] = [];
  for (let i = 0; i < shown.length; i += 10) {
    rows.push(shown.slice(i, i + 10));
  }

  // Same stat tiles as the intro screen — best for this mode, plus streak.
  const isDaily = props.mode === "daily";

  // The daily's record is written before this screen mounts, so `attempts`
  // already counts the run being shown: 1 means it was nailed first go.
  const daily = useClientValue(
    () => (isDaily ? getDailyResult(props.game, props.dailyNum) : null),
    null
  );
  // Same definition the menu card uses for its PERFECT badge: not one ❌.
  const flawless =
    props.survived &&
    props.emojis.length > 0 &&
    !props.emojis.includes("❌");
  // Deliberately reads `attempts === 1` rather than defaulting a missing count
  // to 1: before the client read lands `daily` is null, and treating that as a
  // first try would flash confetti on mount and then yank it away.
  const perfectFirstTry = isDaily && flawless && daily?.attempts === 1;
  // A clean first run can never be a `newBest` — there's no previous score to
  // beat — so without this the best possible result gets the quietest screen.
  const celebrate = props.newBest || perfectFirstTry;
  const stats: { icon: UiIcon; value: string; label: string; color: string }[] =
    [
      ...(props.bestDisplay
        ? [
            {
              icon: (isDaily ? "trophy" : "target") as UiIcon,
              value: props.bestDisplay,
              label: isDaily ? t.statDaily : t.statSurvival,
              color: isDaily ? "text-lemon" : "text-mint",
            },
          ]
        : []),
      ...(isDaily && props.streak > 0
        ? [
            {
              icon: "flame" as UiIcon,
              value: t.streakDays(props.streak),
              label: t.statStreak,
              color: "text-coral",
            },
          ]
        : []),
    ];

  return (
    <div className="animate-rise flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center sm:gap-6 sm:py-10">
      {/* Bursts from the NEW BEST badge when there is one; a perfect run has
          no badge, so it launches from the score instead. */}
      {celebrate && (
        <Confetti originRef={props.newBest ? bestBadgeRef : scoreRef} />
      )}
      <GameTitle game={props.game} />

      <h2
        className={`animate-pop font-display text-4xl leading-[0.95] sm:text-6xl ${
          props.survived ? "text-mint" : "text-coral"
        } drop-shadow-[3px_3px_0_rgb(0_0_0/0.55)] sm:drop-shadow-[5px_5px_0_rgb(0_0_0/0.55)]`}
      >
        {props.survived ? t.runComplete : t.gameOver}
      </h2>

      {props.newBest && (
        <div
          ref={bestBadgeRef}
          className="animate-pop -rotate-2 rounded-lg border-2 border-black/40 bg-lemon px-4 py-1.5 font-display text-sm text-ink shadow-chunk-sm"
        >
          {t.newBest}
        </div>
      )}

      {/* One results card: score, run strip, stats */}
      <div className="w-full max-w-sm space-y-2.5 rounded-2xl border-2 border-line bg-panel px-6 py-4 shadow-chunk sm:space-y-3 sm:py-5">
        <div ref={scoreRef} className="font-display text-3xl text-lemon sm:text-4xl">
          {props.scoreLine}
        </div>
        <div>
          {clipped && (
            <div className="pb-0.5 text-xs text-fog">
              {t.lastShown(MAX_STRIP)}
            </div>
          )}
          {rows.map((row, i) => (
            <div key={i} className="flex justify-center gap-0.5 py-0.5">
              {row.map((e, j) => (
                <PixelIcon
                  key={j}
                  name={e === "✅" ? "check" : "x"}
                  size={18}
                />
              ))}
            </div>
          ))}
        </div>
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
          onClick={share}
          className="rounded-xl border-2 border-black/40 bg-mint px-6 py-3 font-display text-ink shadow-chunk transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:py-4"
        >
          {copied ? t.copied : t.share}
        </button>
        <button
          type="button"
          onClick={props.onPlayAgain}
          className="rounded-xl border-2 border-line bg-panel px-6 py-2.5 font-display text-paper shadow-chunk-sm transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:py-3"
        >
          {t.playAgain}
        </button>
        <Link
          href="/"
          className="flex items-center justify-center rounded-xl border-2 border-line bg-panel/60 px-6 py-2.5 font-display text-sm text-fog shadow-chunk-sm transition-transform hover:-translate-y-0.5 hover:text-paper active:translate-y-1 active:shadow-none"
        >
          {t.backToArcade}
        </Link>
      </div>
    </div>
  );
}
