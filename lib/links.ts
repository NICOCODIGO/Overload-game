import type { UiIcon } from "@/components/PixelIcon";

/**
 * Every outbound link the site owns, in one place. Fill in an href and the
 * button appears; leave it "" and it stays hidden — so half-finished profiles
 * never ship as dead buttons.
 */
export const SOCIALS: { label: string; href: string; icon: UiIcon }[] = [
  { label: "GitHub", href: "https://github.com/NICOCODIGO/Overload-game", icon: "github" },
  { label: "Instagram", href: "", icon: "instagram" },
  { label: "X", href: "", icon: "xsocial" },
  { label: "YouTube", href: "", icon: "youtube" },
  { label: "Website", href: "", icon: "globe" },
];

/** The repo link is presented inside the info panel, so the footer's icon row
    leaves it out rather than showing the same destination twice. */
export const REPO_LABEL = "GitHub";

/**
 * Feedback form — paste the share link of a Google Form (or Tally, Formspree,
 * anything that gives you a URL) and the SEND FEEDBACK button appears inside
 * the info panel. Left empty, that whole section stays hidden rather than
 * shipping a button that goes nowhere.
 *
 * The site is a static export with no backend of its own, so a hosted form is
 * how a player's message reaches you at all.
 *
 * Use the form's "Send → link" URL, not the edit URL: an edit URL lets anyone
 * who clicks it rewrite your questions.
 */
export const FEEDBACK_URL = "";
