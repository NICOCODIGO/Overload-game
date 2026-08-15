import { PixelIcon } from "./PixelIcon";

/**
 * The flame and its day count.
 *
 * Shared between the header, where it's live, and the info panel, where it's
 * shown as an example — the whole point of putting it in the panel is that a
 * player recognises the thing in the corner on sight, so the two can't be
 * allowed to drift apart.
 */
export function StreakBadge({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1.5 font-display text-sm text-coral">
      <PixelIcon name="flame" size={20} className="flame-flicker" />
      {count}
    </span>
  );
}
