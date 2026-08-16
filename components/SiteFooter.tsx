"use client";

import { AD_SWAP_URL, REPO_LABEL, SOCIALS } from "@/lib/links";
import { useClientValue } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { InfoPanel } from "./InfoPanel";
import { PixelIcon } from "./PixelIcon";

/**
 * Two quiet tiers: the way in to the rules and the links that actually exist,
 * then the cabinet plate beneath them. The year is read on the client so a
 * static build doesn't freeze the copyright at whenever it was deployed.
 */
export function SiteFooter() {
  const t = useT();
  const year = useClientValue(() => new Date().getFullYear(), 2026);
  const socials = SOCIALS.filter((s) => s.href && s.label !== REPO_LABEL);

  return (
    <footer className="flex flex-col items-center gap-3 border-t-2 border-line pt-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <InfoPanel />
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-line bg-panel shadow-chunk-sm transition-transform hover:-translate-y-0.5 hover:border-lemon active:translate-y-0.5 active:shadow-none"
          >
            <PixelIcon name={s.icon} size={20} />
          </a>
        ))}
      </div>

      <p className="font-display text-[10px] tracking-[0.18em] text-fog/60">
        © {year} <span className="text-lemon/80">OVERLOAD ARCADE</span>
      </p>

      {/* Last of all: someone else's site, kept below our own plate so it
          never reads as part of the arcade. */}
      {AD_SWAP_URL && (
        <iframe
          src={AD_SWAP_URL}
          title={t.adLabel}
          loading="lazy"
          /* No allow-same-origin and no allow-top-navigation: the frame may
             run its own scripts and open its link in a new tab, and nothing
             else. It can't read this page, reach our storage, or navigate the
             tab out from under someone mid-visit. */
          sandbox="allow-scripts allow-popups"
          /* Roomier than the pill itself, which sizes to the advertiser's
             name. The slack is painted the page's own ink by the frame's `bg`
             so it reads as nothing at all. */
          className="h-[44px] w-[280px] max-w-full border-0"
        />
      )}
    </footer>
  );
}
