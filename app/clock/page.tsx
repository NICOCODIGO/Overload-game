import type { Metadata } from "next";
import { ClockGame } from "./ClockGame";

export const metadata: Metadata = {
  title: "Overclocked",
  description:
    "Read the analog clock before the timer melts. Numbered faces, bare faces, and timelapse rounds where the hands spin, freeze, and vanish.",
  openGraph: {
    // Repeated per page because Next merges metadata shallowly — a page
    // openGraph object replaces the root layout's rather than extending it,
    // so without these two the built pages ship no og:site_name or og:type.
    siteName: "Overload",
    type: "website",
    title: "Overclocked — Overload",
    description:
      "Quick! What time is it? 20 clocks a day, and the late ones vanish before you answer.",
    url: "/clock",
  },
};

export default function ClockPage() {
  return <ClockGame />;
}
