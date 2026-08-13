import type { Metadata } from "next";
import { PatternGame } from "./PatternGame";

export const metadata: Metadata = {
  title: "Next!",
  description:
    "2, 4, 8, 16… what comes next? Number runs, letter ladders, spinning arrows, and interleaved sequences — crack the rule before the clock does.",
  openGraph: {
    // Repeated per page because Next merges metadata shallowly — a page
    // openGraph object replaces the root layout's rather than extending it,
    // so without these two the built pages ship no og:site_name or og:type.
    siteName: "Overload",
    type: "website",
    title: "Next! — Overload",
    description:
      "The pattern knows what comes next. Do you? 14 sequences a day, and the rules get sneakier.",
    url: "/pattern",
  },
};

export default function PatternPage() {
  return <PatternGame />;
}
