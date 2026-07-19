import type { GameId } from "@/lib/daily";
import { PixelIcon } from "./PixelIcon";

/**
 * Compact in-game identity strip: the game's pixel sprite + name, shown above
 * the play area. Horizontal so it costs almost no vertical space mid-game.
 */
export function GameTitle({ game, title }: { game: GameId; title: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <PixelIcon name={game} size={26} />
      <span className="font-display text-xl tracking-wide text-lemon drop-shadow-[2px_2px_0_var(--color-coral)]">
        {title}
      </span>
    </div>
  );
}
