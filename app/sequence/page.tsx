import type { Metadata } from "next";
import { SequenceGame } from "./SequenceGame";

export const metadata: Metadata = {
  title: "Signal Rush",
  description:
    "Intercept the arrow code and re-key it before the channel closes. Deep transmissions go dark — input them from memory.",
  openGraph: {
    // Repeated per page because Next merges metadata shallowly — a page
    // openGraph object replaces the root layout's rather than extending it,
    // so without these two the built pages ship no og:site_name or og:type.
    siteName: "Overload",
    type: "website",
    title: "Signal Rush — Overload",
    description:
      "Intercept the code. Re-key it before the channel closes. How deep into the transmission can you get?",
    url: "/sequence",
  },
};

export default function SequencePage() {
  return <SequenceGame />;
}
