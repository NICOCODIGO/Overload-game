import type { UiIcon } from "@/components/PixelIcon";

/**
 * Every outbound link the site owns, in one place. Fill in an href and the
 * button appears; leave it "" and it stays hidden — so half-finished profiles
 * never ship as dead buttons.
 */
export const SOCIALS: { label: string; href: string; icon: UiIcon }[] = [
  { label: "GitHub", href: "https://github.com/NICOCODIGO", icon: "github" },
  { label: "Instagram", href: "", icon: "instagram" },
  { label: "X", href: "", icon: "xsocial" },
  { label: "YouTube", href: "", icon: "youtube" },
  { label: "Website", href: "", icon: "globe" },
];
