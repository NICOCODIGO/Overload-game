import type { Metadata } from "next";
import { ArcadeGrid } from "@/components/ArcadeGrid";

export const metadata: Metadata = {
  title: "Overload — the brain arcade",
  description:
    "Nine fast, stressful mini-games. One daily challenge each. Reflexes, focus, patience — how much can your brain take?",
  openGraph: {
    // Repeated per page because Next merges metadata shallowly — a page
    // openGraph object replaces the root layout's rather than extending it,
    // so without these two the built pages ship no og:site_name or og:type.
    siteName: "Overload",
    type: "website",
    title: "Overload — the brain arcade",
    description:
      "Nine fast, stressful mini-games. New daily challenges for everyone, every day.",
    url: "/",
  },
};

export default function Home() {
  return <ArcadeGrid />;
}
