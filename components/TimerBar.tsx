"use client";

import { useT } from "@/lib/i18n";

/**
 * Chunky countdown bar. Mint → lemon → coral as time drains.
 * Driven by `progress` (1 → 0) from useCountdown.
 */
export function TimerBar({ progress }: { progress: number }) {
  const t = useT();
  const color =
    progress > 0.5
      ? "var(--color-mint)"
      : progress > 0.25
        ? "var(--color-lemon)"
        : "var(--color-coral)";
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full border-2 border-line bg-panel"
      role="progressbar"
      aria-label={t.a11y.timeRemaining}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <div
        className="h-full origin-left rounded-full"
        style={{
          transform: `scaleX(${progress})`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
