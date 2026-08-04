"use client";

import { FEEDBACK_URL, SOCIALS } from "@/lib/links";
import { useClientValue } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { PixelIcon } from "./PixelIcon";

/**
 * Two quiet tiers: the links that actually exist, then the cabinet plate
 * beneath them. The year is read on the client so a static build doesn't
 * freeze the copyright at whenever it was deployed.
 */
export function SiteFooter() {
  const t = useT();
  const year = useClientValue(() => new Date().getFullYear(), 2026);
  const socials = SOCIALS.filter((s) => s.href);

  return (
    <footer className="mt-auto flex flex-col items-center gap-3 border-t-2 border-line pt-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className="rounded-lg border-2 border-line bg-panel p-2 shadow-chunk-sm transition-transform hover:-translate-y-0.5 hover:border-lemon active:translate-y-0.5 active:shadow-none"
          >
            <PixelIcon name={s.icon} size={20} />
          </a>
        ))}

        {FEEDBACK_URL && (
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border-2 border-line bg-panel px-3 py-2 font-display text-xs text-paper shadow-chunk-sm transition-transform hover:-translate-y-0.5 hover:border-lemon active:translate-y-0.5 active:shadow-none"
          >
            <PixelIcon name="mail" size={18} />
            {t.feedback}
          </a>
        )}
      </div>

      <p className="font-display text-[10px] tracking-[0.18em] text-fog/60">
        © {year} <span className="text-lemon/80">OVERLOAD ARCADE</span>
      </p>
    </footer>
  );
}
