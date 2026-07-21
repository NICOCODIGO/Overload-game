import type { GameId } from "@/lib/daily";
import { PixelIcon } from "./PixelIcon";

/**
 * Game identity block. Full: the intro-screen lockup (big sprite over big
 * title) — used mid-game. Compact: a subdued little badge for screens where
 * something else (like GAME OVER) deserves the spotlight.
 */
export function GameTitle({
  game,
  title,
  compact = false,
}: {
  game: GameId;
  title: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2">
        <PixelIcon name={game} size={22} />
        <span className="font-display text-sm tracking-widest text-fog">
          {title}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center text-center">
      <PixelIcon name={game} size={56} className="mx-auto" />
      <span className="mt-2 font-display text-4xl text-lemon drop-shadow-[3px_3px_0_var(--color-coral)]">
        {title}
      </span>
    </div>
  );
}
