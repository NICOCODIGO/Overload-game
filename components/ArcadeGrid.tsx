"use client";

import { GAMES, GAME_ORDER } from "@/lib/games";
import { GameCard } from "./GameCard";
import { SiteFooter } from "./SiteFooter";
import { useT } from "@/lib/i18n";

export function ArcadeGrid() {
  const t = useT();

  return (
    // Content flows from the top; the footer is pushed to the bottom with
    // mt-auto. On short viewports the page just scrolls — nothing centers
    // into dead space or clips.
    <div className="animate-rise flex flex-1 flex-col gap-8 py-10">
      <div className="text-center">
        <h1 className="title-glitch relative inline-block font-display text-5xl leading-tight text-lemon drop-shadow-[4px_4px_0_var(--color-coral)] sm:text-6xl">
          {/* Ghost copies that jab out in accent colors during the glitch. */}
          <span aria-hidden className="glitch-ghost glitch-a">
            OVERLOAD
          </span>
          <span aria-hidden className="glitch-ghost glitch-b">
            OVERLOAD
          </span>
          OVER
          <span className="text-coral drop-shadow-[4px_4px_0_var(--color-lemon)]">
            LOAD
          </span>
        </h1>
        <p className="mt-3 font-pixel text-xl text-fog">{t.tagline}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {GAME_ORDER.map((game) => (
          <GameCard
            key={game}
            game={game}
            href={GAMES[game].path}
            title={GAMES[game].title}
            accent={GAMES[game].accent}
            hook={t.hooks[game]}
          />
        ))}
      </div>

      <SiteFooter />
    </div>
  );
}
