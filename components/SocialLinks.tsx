"use client";

import { PixelIcon, type UiIcon } from "./PixelIcon";

/**
 * Social links preset — fill in an href and the button appears; leave it
 * empty ("") and it stays hidden. Add more rows freely; any UiIcon works
 * (draw new ones in PixelIcon.tsx).
 */
const SOCIALS: { label: string; href: string; icon: UiIcon }[] = [
  { label: "GitHub", href: "https://github.com/NICOCODIGO", icon: "github" },
  { label: "Instagram", href: "", icon: "instagram" },
  { label: "X", href: "", icon: "xsocial" },
  { label: "YouTube", href: "", icon: "youtube" },
  { label: "Website", href: "", icon: "globe" },
];

export function SocialLinks() {
  const links = SOCIALS.filter((s) => s.href);
  if (links.length === 0) return null;

  return (
    <div className="flex justify-center gap-3">
      {links.map((s) => (
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
    </div>
  );
}
