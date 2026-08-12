"use client";

import Link from "next/link";
import { getStreak } from "@/lib/storage";
import { useClientValue } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { PixelIcon } from "./PixelIcon";

/**
 * Slim full-width status bar: logo hard left (and the way home), streak +
 * sound hard right. Game switching lives on the arcade floor.
 */
export function Header() {
  const t = useT();
  const streak = useClientValue(getStreak, 0);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-ink/90 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-4 px-5 py-2.5 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="font-display text-xl tracking-wide text-lemon drop-shadow-[2px_2px_0_var(--color-coral)] sm:text-2xl"
        >
          OVERLOAD
        </Link>

        <div className="flex items-center gap-3">
          {streak > 0 && (
            <span
              className="group relative flex h-11 cursor-default items-center gap-1.5 font-display text-sm text-coral"
              aria-label={`${t.streak(streak)} — ${t.streakHint}`}
            >
              <PixelIcon name="flame" size={20} className="flame-flicker" />
              {streak}
              {/* Hover tooltip: right-aligned so it never runs off the edge. */}
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-max max-w-[220px] rounded-lg border-2 border-line bg-panel px-3 py-2 text-left font-sans text-xs font-normal normal-case text-paper opacity-0 shadow-chunk-sm transition-opacity duration-150 group-hover:opacity-100"
              >
                <span className="font-display text-coral">
                  {t.streak(streak)}
                </span>
                <span className="mt-0.5 block text-fog">{t.streakHint}</span>
              </span>
            </span>
          )}

        </div>
      </div>
    </header>
  );
}
