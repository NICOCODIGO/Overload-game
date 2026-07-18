"use client";

import { GameCard } from "./GameCard";
import { getStreak } from "@/lib/storage";
import { useClientValue } from "@/lib/hooks";

export function ArcadeGrid() {
  const streak = useClientValue(getStreak, 0);

  return (
    <div className="animate-rise flex flex-1 flex-col justify-center gap-8 py-10">
      <div className="text-center">
        <h1 className="font-display text-5xl leading-tight text-lemon drop-shadow-[4px_4px_0_var(--color-coral)] sm:text-6xl">
          OVER
          <span className="text-coral drop-shadow-[4px_4px_0_var(--color-lemon)]">
            LOAD
          </span>
        </h1>
        <p className="mt-3 text-fog">
          Nine ways to fry your brain. New daily challenges at midnight UTC.
        </p>
        {streak > 0 && (
          <p className="mt-1 font-display text-sm text-coral">
            🔥 {streak}-day streak — keep it alive
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <GameCard
          game="simon"
          href="/simon"
          icon="🫵"
          title="SIMON SAYS"
          hook="Only obey when Simon says. The buttons will lie to you."
          accent="text-coral"
        />
        <GameCard
          game="sequence"
          href="/sequence"
          icon="📡"
          title="SIGNAL RUSH"
          hook="Intercept the code. Re-key it before the channel closes."
          accent="text-mint"
        />
        <GameCard
          game="typing"
          href="/typing"
          icon="⌨️"
          title="PANIC TYPE"
          hook="Type it exactly. The clock has no mercy."
          accent="text-sky"
        />
        <GameCard
          game="clock"
          href="/clock"
          icon="🕐"
          title="OVERCLOCKED"
          hook="Quick — what time is it? The hands won't wait."
          accent="text-lemon"
        />
        <GameCard
          game="anomaly"
          href="/anomaly"
          icon="🔎"
          title="ANOMALY"
          hook="One of them doesn't belong. Find it before the feed cuts."
          accent="text-coral"
        />
        <GameCard
          game="count"
          href="/count"
          icon="🔢"
          title="HEADCOUNT"
          hook="Count the chaos — but only the ones we ask for."
          accent="text-mint"
        />
        <GameCard
          game="pattern"
          href="/pattern"
          icon="🧩"
          title="NEXT!"
          hook="2, 4, 8, 16… the pattern knows what comes next. Do you?"
          accent="text-sky"
        />
        <GameCard
          game="illusion"
          href="/illusion"
          icon="👁️"
          title="DOUBLE TAKE"
          hook="Your eyes are lying. Answer anyway."
          accent="text-lemon"
        />
        <GameCard
          game="blink"
          href="/blink"
          icon="👀"
          title="BLINK"
          hook="The scene flickers. One thing changed. Find it."
          accent="text-coral"
        />
      </div>

      <p className="text-center text-xs text-fog">
        Personal bests and streaks live in your browser. No accounts, no
        tracking — just stress.
      </p>
    </div>
  );
}
