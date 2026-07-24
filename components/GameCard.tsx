"use client";

import Link from "next/link";
import type { GameId } from "@/lib/daily";
import { PixelIcon } from "./PixelIcon";
import { dailyNumber } from "@/lib/daily";
import { getDailyResult } from "@/lib/storage";
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
  // Today's daily result (not the all-time best — that lives on the game's own
  // screen). A flawless run has no ❌ in its strip, i.e. no hearts lost.
  const today = useClientValue(
    () => getDailyResult(props.game, dailyNumber()),
    null
  );
  const perfect = today ? !today.emojis.includes("❌") : false;

  return (
    <Link
      href={props.href}
      className="group relative flex flex-col items-center gap-2 rounded-2xl border-2 border-line bg-panel p-5 text-center shadow-chunk transition-transform hover:-translate-y-1 hover:border-lemon active:translate-y-0.5 active:shadow-none"
    >
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
      {today ? (
        <span
          className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-1.5 ${
            perfect ? "bg-lemon/15" : "bg-mint/15"
          }`}
        >
          <PixelIcon name={perfect ? "trophy" : "check"} size={18} />
          <span
            className={`font-display text-sm ${
              perfect ? "text-lemon" : "text-mint"
            }`}
          >
            {perfect ? t.perfect : t.doneLabel} {today.display}
          </span>
        </span>
      ) : (
        <span className="mt-1 font-pixel text-base text-fog/70">
          {t.playToday}
        </span>
      )}
    </Link>
  );
}
