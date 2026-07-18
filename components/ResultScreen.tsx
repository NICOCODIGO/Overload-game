"use client";

import Link from "next/link";
import { useState } from "react";
import type { Mode } from "@/lib/daily";
import { buildShareText, copyToClipboard } from "@/lib/share";

interface ResultScreenProps {
  gameName: string;
  path: string; // route for the share link, e.g. "/sequence"
  mode: Mode;
  dailyNum: number; // ignored in practice mode
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
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const ok = await copyToClipboard(
      buildShareText({
        gameName: props.gameName,
        dailyNum: props.mode === "daily" ? props.dailyNum : null,
        scoreLine: props.scoreLine,
        emojis: props.emojis.join(""),
        path: props.path,
      })
    );
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1800);
  };

  // Wrap the strip every 10 for readability; share text stays one line.
  const rows: string[] = [];
  for (let i = 0; i < props.emojis.length; i += 10) {
    rows.push(props.emojis.slice(i, i + 10).join(""));
  }

  return (
    <div className="animate-rise flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <h2
        className={`font-display text-3xl ${
          props.survived
            ? "text-mint drop-shadow-[3px_3px_0_rgb(0_0_0/0.5)]"
            : "text-coral drop-shadow-[3px_3px_0_rgb(0_0_0/0.5)]"
        }`}
      >
        {props.survived ? "RUN COMPLETE" : "GAME OVER"}
      </h2>

      <div className="font-display text-2xl text-lemon">{props.scoreLine}</div>

      {props.newBest && (
        <div className="animate-pop rounded-full border-2 border-lemon bg-panel px-4 py-1 font-display text-xs text-lemon">
          ★ NEW PERSONAL BEST ★
        </div>
      )}

      <div className="rounded-xl border-2 border-line bg-panel px-4 py-3 shadow-chunk">
        {rows.map((row, i) => (
          <div key={i} className="text-lg leading-6 tracking-wider">
            {row}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-fog">
        {props.extraStats?.map((s) => (
          <span key={s.label}>
            {s.label}: <span className="text-paper">{s.value}</span>
          </span>
        ))}
        {props.bestDisplay && <span>🏆 Best: {props.bestDisplay}</span>}
        {props.mode === "daily" && props.streak > 0 && (
          <span>🔥 {props.streak}-day streak</span>
        )}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={share}
          className="rounded-xl border-2 border-black/40 bg-mint px-6 py-4 font-display text-ink shadow-chunk transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {copied ? "COPIED! 📋" : "SHARE RESULT"}
        </button>
        <button
          type="button"
          onClick={props.onPlayAgain}
          className="rounded-xl border-2 border-line bg-panel px-6 py-3 font-display text-paper shadow-chunk-sm transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          PLAY AGAIN
        </button>
        <Link
          href="/"
          className="py-1 font-display text-xs text-fog hover:text-paper"
        >
          ← BACK TO ARCADE
        </Link>
      </div>
    </div>
  );
}
