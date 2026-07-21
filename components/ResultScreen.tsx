"use client";

import Link from "next/link";
import { useState } from "react";
import type { GameId, Mode } from "@/lib/daily";
import { buildShareText, copyToClipboard } from "@/lib/share";
import { useT } from "@/lib/i18n";
import { PixelIcon } from "./PixelIcon";
import { GameTitle } from "./GameTitle";

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
  illusion: "👁️",
  blink: "👀",
};

interface ResultScreenProps {
  game: GameId;
  gameName: string;
  path: string; // route for the share link, e.g. "/sequence"
  mode: Mode;
  dailyNum: number; // ignored in survival mode
  /** Headline score, e.g. "Level 9 ⚡" or "24/30 🧠". */
  scoreLine: string;
  /** One ✅/❌ per round, in order. */
  emojis: string[];
  /** True if the run ended by finishing, false if lives ran out. */
  survived: boolean;
  newBest: boolean;
  bestDisplay: string | null;
  streak: number;
  extraStats?: { label: string; value: string }[];
  onPlayAgain: () => void;
}

/** Shared post-game screen: emoji strip, score, share-to-clipboard, replay. */
export function ResultScreen(props: ResultScreenProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);

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
        gameName: props.gameName,
        dailyNum: props.mode === "daily" ? props.dailyNum : null,
        scoreLine: `${props.scoreLine} ${SHARE_EMOJI[props.game]}`,
        emojis: shareEmojis,
        path: props.path,
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

  return (
    <div className="animate-rise flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <GameTitle game={props.game} title={props.gameName.toUpperCase()} />

      <h2
        className={`animate-pop font-display text-5xl leading-[0.95] sm:text-6xl ${
          props.survived ? "text-mint" : "text-coral"
        } drop-shadow-[5px_5px_0_rgb(0_0_0/0.55)]`}
      >
        {props.survived ? t.runComplete : t.gameOver}
      </h2>

      {props.newBest && (
        <div className="animate-pop -rotate-2 rounded-lg border-2 border-black/40 bg-lemon px-4 py-1.5 font-display text-sm text-ink shadow-chunk-sm">
          {t.newBest}
        </div>
      )}

      {/* One results card: score, run strip, stats */}
      <div className="w-full max-w-sm space-y-3 rounded-2xl border-2 border-line bg-panel px-6 py-5 shadow-chunk">
        <div className="font-display text-4xl text-lemon">
          {props.scoreLine}
        </div>
        <div>
          {clipped && (
            <div className="pb-0.5 text-xs text-fog">last {MAX_STRIP} shown</div>
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
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 border-t-2 border-line pt-3 text-sm text-fog">
          {props.extraStats?.map((s) => (
            <span key={s.label}>
              {s.label}: <span className="text-paper">{s.value}</span>
            </span>
          ))}
          {props.bestDisplay && (
            <span className="flex items-center gap-1.5">
              <PixelIcon name="trophy" size={14} />
              {t.best} {props.bestDisplay}
            </span>
          )}
          {props.mode === "daily" && props.streak > 0 && (
            <span className="flex items-center gap-1.5">
              <PixelIcon name="flame" size={14} />
              {t.streak(props.streak)}
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={share}
          className="rounded-xl border-2 border-black/40 bg-mint px-6 py-4 font-display text-ink shadow-chunk transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {copied ? t.copied : t.share}
        </button>
        <button
          type="button"
          onClick={props.onPlayAgain}
          className="rounded-xl border-2 border-line bg-panel px-6 py-3 font-display text-paper shadow-chunk-sm transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {t.playAgain}
        </button>
        <Link
          href="/"
          className="py-1 font-display text-xs text-fog hover:text-paper"
        >
          {t.backToArcade}
        </Link>
      </div>
    </div>
  );
}
