"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toggleMuted, unlockAudio } from "@/lib/audio";
import { getStreak } from "@/lib/storage";
import { useClientValue, useMuted } from "@/lib/hooks";

const GAMES = [
  { href: "/simon", label: "SIMON" },
  { href: "/sequence", label: "SIGNAL" },
  { href: "/typing", label: "TYPE" },
  { href: "/clock", label: "CLOCK" },
  { href: "/anomaly", label: "SPOT" },
  { href: "/count", label: "COUNT" },
] as const;

export function Header() {
  const pathname = usePathname();
  const muted = useMuted();
  const streak = useClientValue(getStreak, 0);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="font-display text-lg tracking-wide text-lemon drop-shadow-[2px_2px_0_var(--color-coral)]"
        >
          OVERLOAD
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {GAMES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className={`rounded-md px-2 py-1 font-display text-[11px] tracking-wider transition-colors ${
                pathname === g.href
                  ? "bg-panel2 text-lemon"
                  : "text-fog hover:text-paper"
              }`}
            >
              {g.label}
            </Link>
          ))}
        </nav>

        {streak > 0 && (
          <span
            className="font-display text-xs text-coral"
            title={`${streak}-day streak`}
            aria-label={`${streak} day streak`}
          >
            🔥{streak}
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            unlockAudio();
            toggleMuted();
          }}
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          className="rounded-md border-2 border-line bg-panel px-2 py-1 text-sm hover:bg-panel2"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
    </header>
  );
}
