"use client";

import Link from "next/link";
import { unlockAudio, toggleMuted } from "@/lib/audio";
import { getStreak } from "@/lib/storage";
import { useClientValue, useMuted } from "@/lib/hooks";
import { cycleLang, useLang, useT } from "@/lib/i18n";
import { PixelIcon } from "./PixelIcon";

/**
 * Slim full-width status bar: logo hard left (and the way home), language +
 * streak + sound hard right. Game switching lives on the arcade floor.
 */
export function Header() {
  const muted = useMuted();
  const lang = useLang();
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
              className="flex h-11 items-center gap-1.5 font-display text-sm text-coral"
              title={t.streak(streak)}
              aria-label={t.streak(streak)}
            >
              <PixelIcon name="flame" size={20} />
              {streak}
            </span>
          )}

          <button
            type="button"
            onClick={cycleLang}
            aria-label={t.changeLang}
            className="flex h-11 items-center gap-2 rounded-lg border-2 border-line bg-panel px-3 font-display text-sm text-paper shadow-chunk-sm transition-transform hover:bg-panel2 active:translate-y-0.5 active:shadow-none"
          >
            <PixelIcon name="globe" size={18} />
            {lang.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={() => {
              unlockAudio();
              toggleMuted();
            }}
            aria-label={muted ? t.unmute : t.mute}
            className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-line bg-panel shadow-chunk-sm transition-transform hover:bg-panel2 active:translate-y-0.5 active:shadow-none"
          >
            <PixelIcon name={muted ? "muted" : "sound"} size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
