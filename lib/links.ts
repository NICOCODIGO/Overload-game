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
 * Ad swap — a spot traded with another small site trying to grow, on the
 * understanding that one of theirs carries yours. Set to "" to remove it.
 *
 * It's a third party we don't control, so it lives in the arcade footer and
 * only there. That happens to be the home page alone: the game routes never
 * mount SiteFooter, and a stranger's animated box has no business beside a
 * round that's asking the player to concentrate.
 *
 * The frame, not the <script> they also offer: a script would run in our own
 * page with the run of the DOM and localStorage — where every best and streak
 * is kept — while this can't reach past its own sandbox. `shape=pill` is the
 * small rounded form, and `bg` paints the space around it to match
 * --color-ink so the frame doesn't sit on the page as a visible patch. Retune
 * that hex if the ink ever changes.
 *
 * Worth a look now and then — it's a hobby project on Firebase's free tier,
 * and if it ever goes away this leaves an empty box behind.
 */
export const AD_SWAP_URL =
  "https://ad-swap.web.app/frame.html?site=tUt8KVbb332QXyrR4kWq&shape=pill&theme=dark&bg=140f2d";

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
export const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSedwTWasIY5wSAK4YztcxKtoP4oH1GyORa62GWM_ADORxO5-A/viewform";
