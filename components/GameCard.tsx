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

/* Whole-sprite hover motion. Games whose sprites animate their inner PARTS
   (waves, keys, hands, glint, hops — via PixelIcon `parts`) need none. */
const HOVER_ANIM: Partial<Record<GameId, string>> = {
  simon: "sprite-hover-wag", // finger wags "no no"
  pattern: "sprite-hover-wiggle",
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
        animated
      />
      <span className={`font-display text-xl ${props.accent}`}>
        {props.title}
      </span>
      <span className="font-pixel text-lg leading-tight text-fog">
        {props.hook}
      </span>
      {best ? (
        <span className="mt-1 flex items-center gap-2 rounded-lg bg-panel2 px-3 py-1.5">
          <PixelIcon name="trophy" size={18} />
          <span className="font-display text-sm text-lemon">
            {best.display}
          </span>
        </span>
      ) : (
        <span className="mt-1 font-pixel text-base text-fog/70">
          {t.noBestYet}
        </span>
      )}
    </Link>
  );
}
