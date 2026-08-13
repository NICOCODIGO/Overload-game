import type { Metadata } from "next";
import { SimonGame } from "./SimonGame";

export const metadata: Metadata = {
  title: "Simon Says",
  description:
    "30 commands, 3 lives, one rule: only obey when Simon says. From round 5 the buttons start lying to you.",
  openGraph: {
    // Repeated per page because Next merges metadata shallowly — a page
    // openGraph object replaces the root layout's rather than extending it,
    // so without these two the built pages ship no og:site_name or og:type.
    siteName: "Overload",
    type: "website",
    title: "Simon Says — Overload",
    description:
      "Only obey when Simon says. The buttons will lie to you. Can you survive all 30 commands?",
    url: "/simon",
  },
};

export default function SimonPage() {
  return <SimonGame />;
}
