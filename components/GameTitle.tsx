import type { GameId } from "@/lib/daily";
import { GAMES } from "@/lib/games";
import { PixelIcon } from "./PixelIcon";

/**
 * Game identity block. Full: the intro-screen lockup (big sprite over big
 * title) — used mid-game. Compact: a subdued little badge for screens where
 * something else (like GAME OVER) deserves the spotlight.
 */
export function GameTitle({
  game,
  compact = false,
}: {
  game: GameId;
  compact?: boolean;
}) {
  const title = GAMES[game].title;
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
    // Icon and title on a single row so the header stays short; both scale up
    // at sm+ (desktop).
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      <PixelIcon
        name={game}
        size={56}
        className="h-8 w-8 shrink-0 sm:h-11 sm:w-11"
      />
      <span className="font-display text-2xl text-lemon drop-shadow-[2px_2px_0_var(--color-coral)] sm:text-4xl sm:drop-shadow-[3px_3px_0_var(--color-coral)]">
        {title}
      </span>
    </div>
  );
}
