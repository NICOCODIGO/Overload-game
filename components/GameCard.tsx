"use client";

import Link from "next/link";
import type { GameId } from "@/lib/daily";
import { dailyNumber } from "@/lib/daily";
import { getBest, getDailyResult } from "@/lib/storage";
import { useClientValue } from "@/lib/hooks";

interface GameCardProps {
  game: GameId;
  href: string;
  icon: string;
  title: string;
  hook: string;
  /** Tailwind text color class for the title accent. */
  accent: string;
}

export function GameCard(props: GameCardProps) {
  const best = useClientValue(() => getBest(props.game, "daily"), null);
  const doneToday = useClientValue(
    () => getDailyResult(props.game, dailyNumber()) !== null,
    false
  );
  const num = useClientValue(dailyNumber, 0);

  return (
    <Link
      href={props.href}
      className="group relative flex flex-col gap-2 rounded-2xl border-2 border-line bg-panel p-5 shadow-chunk transition-transform hover:-translate-y-1 hover:border-lemon active:translate-y-0.5 active:shadow-none"
    >
      <span className="absolute right-3 top-3 rounded-full bg-panel2 px-2 py-0.5 font-display text-[10px] text-lemon">
        {doneToday ? "✓ DAILY" : `DAILY #${num || "…"}`}
      </span>
      <span className="text-4xl" aria-hidden>
        {props.icon}
      </span>
      <span className={`font-display text-xl ${props.accent}`}>
        {props.title}
      </span>
      <span className="text-sm text-fog">{props.hook}</span>
      <span className="mt-1 text-xs text-fog">
        {best ? `🏆 ${best.display}` : "no best yet — play!"}
      </span>
    </Link>
  );
}
