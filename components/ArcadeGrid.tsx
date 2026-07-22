"use client";

import type { GameId } from "@/lib/daily";
import { GameCard } from "./GameCard";
import { SocialLinks } from "./SocialLinks";
import { useT } from "@/lib/i18n";

const GAMES: { game: GameId; href: string; title: string; accent: string }[] = [
  { game: "simon", href: "/simon", title: "SIMON SAYS", accent: "text-coral" },
  { game: "sequence", href: "/sequence", title: "SIGNAL RUSH", accent: "text-mint" },
  { game: "typing", href: "/typing", title: "PANIC TYPE", accent: "text-sky" },
  { game: "clock", href: "/clock", title: "OVERCLOCKED", accent: "text-lemon" },
  { game: "anomaly", href: "/anomaly", title: "ANOMALY", accent: "text-coral" },
  { game: "count", href: "/count", title: "HEADCOUNT", accent: "text-mint" },
  { game: "pattern", href: "/pattern", title: "NEXT!", accent: "text-sky" },
  { game: "illusion", href: "/illusion", title: "DOUBLE TAKE", accent: "text-lemon" },
  { game: "blink", href: "/blink", title: "BLINK", accent: "text-coral" },
];

export function ArcadeGrid() {
  const t = useT();

  return (
    // Content flows from the top; the footer is pushed to the bottom with
    // mt-auto. On short viewports the page just scrolls — nothing centers
    // into dead space or clips.
    <div className="animate-rise flex flex-1 flex-col gap-8 py-10">
      <div className="text-center">
        <h1 className="font-display text-5xl leading-tight text-lemon drop-shadow-[4px_4px_0_var(--color-coral)] sm:text-6xl">
          OVER
          <span className="text-coral drop-shadow-[4px_4px_0_var(--color-lemon)]">
            LOAD
          </span>
        </h1>
        <p className="mt-3 font-pixel text-xl text-fog">{t.tagline}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {GAMES.map((g) => (
          <GameCard key={g.game} {...g} hook={t.hooks[g.game]} />
        ))}
      </div>

      <footer className="mt-auto flex flex-col items-center gap-4 border-t-2 border-line pt-8">
        <p className="text-center font-pixel text-base text-fog">
          {t.footerNote}
        </p>
        <SocialLinks />
      </footer>
    </div>
  );
}
