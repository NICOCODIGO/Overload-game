import type { UiIcon } from "@/components/PixelIcon";

/**
 * Every outbound link the site owns, in one place. Fill in an href and the
 * button appears; leave it "" and it stays hidden — so half-finished profiles
 * never ship as dead buttons.
 */
export const SOCIALS: { label: string; href: string; icon: UiIcon }[] = [
  { label: "GitHub", href: "", icon: "github" },
  { label: "Instagram", href: "", icon: "instagram" },
  { label: "X", href: "", icon: "xsocial" },
  { label: "YouTube", href: "", icon: "youtube" },
  { label: "Website", href: "", icon: "globe" },
];

/**
 * Feedback form — paste a Google Form (or Tally/Typeform) share link here and
 * the SEND FEEDBACK button appears in the footer. Left empty, the footer just
 * shows the social buttons.
 *
 * Use the form's "Send → link" URL, not the edit URL: an edit URL lets anyone
 * who clicks it rewrite your questions.
 */
export const FEEDBACK_URL = "";
