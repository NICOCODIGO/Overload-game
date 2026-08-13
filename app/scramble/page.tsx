import type { Metadata } from "next";
import { ScrambleGame } from "./ScrambleGame";

export const metadata: Metadata = {
  title: "Scramble",
  description:
    "Unscramble the word before the clock runs out — but decoy letters are mixed in, and the hint disappears when it gets hard. Filter, rearrange, solve.",
  openGraph: {
    // Repeated per page because Next merges metadata shallowly — a page
    // openGraph object replaces the root layout's rather than extending it,
    // so without these two the built pages ship no og:site_name or og:type.
    siteName: "Overload",
    type: "website",
    title: "Scramble — Overload",
    description:
      "Unscramble the word — but junk letters are hidden in the pile and the hint fades away. How many can you crack?",
    url: "/scramble",
  },
};

export default function ScramblePage() {
  return <ScrambleGame />;
}
