"use client";

import { useT } from "@/lib/i18n";

export function Lives({ lives, max = 3 }: { lives: number; max?: number }) {
  const t = useT();
  return (
    <div
      className="flex gap-1.5 text-2xl"
      aria-label={t.a11y.lives(lives, max)}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={i < lives ? "text-coral" : "text-line opacity-50"}
        >
          {i < lives ? "♥" : "♡"}
        </span>
      ))}
    </div>
  );
}
