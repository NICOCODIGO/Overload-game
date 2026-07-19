"use client";

import Link from "next/link";
import type { GameId } from "@/lib/daily";
import { PixelIcon } from "./PixelIcon";
import { dailyNumber } from "@/lib/daily";
import { getBest, getDailyResult } from "@/lib/storage";
import { useClientValue } from "@/lib/hooks";
import { useT } from "@/lib/i18n";

interface GameCardProps {
  game: GameId;
  href: string;
  title: string;
  hook: string;
  /** Tailwind text color class for the title accent. */
  accent: string;
}

/* Per-game idle motion while the card is hovered (desktop only). */
const HOVER_ANIM: Record<GameId, string> = {
  simon: "sprite-hover-poke",
  sequence: "sprite-hover-pulse",
  typing: "sprite-hover-shake",
  clock: "sprite-hover-wiggle",
  anomaly: "sprite-hover-scan",
  count: "sprite-hover-bounce",
  pattern: "sprite-hover-wiggle",
  illusion: "sprite-hover-pulse",
  blink: "sprite-hover-blink",
};

export function GameCard(props: GameCardProps) {
  const t = useT();
  const best = useClientValue(() => getBest(props.game, "daily"), null);
  const doneToday = useClientValue(
    () => getDailyResult(props.game, dailyNumber()) !== null,
    false
  );
  const num = useClientValue(dailyNumber, 0);

  return (
    <Link
      href={props.href}
      className="group relative flex flex-col items-center gap-2 rounded-2xl border-2 border-line bg-panel p-5 text-center shadow-chunk transition-transform hover:-translate-y-1 hover:border-lemon active:translate-y-0.5 active:shadow-none"
    >
      <span className="absolute right-3 top-3 rounded-full bg-panel2 px-2 py-0.5 font-display text-[10px] text-lemon">
        {doneToday ? t.doneBadge : `${t.daily} #${num || "…"}`}
      </span>
      <PixelIcon
        name={props.game}
        size={44}
        className={HOVER_ANIM[props.game]}
      />
      <span className={`font-display text-xl ${props.accent}`}>
        {props.title}
      </span>
      <span className="text-sm text-fog">{props.hook}</span>
      <span className="mt-1 flex items-center gap-1.5 text-xs text-fog">
        {best ? (
          <>
            <PixelIcon name="trophy" size={14} />
            {best.display}
          </>
        ) : (
          t.noBestYet
        )}
      </span>
    </Link>
  );
}
