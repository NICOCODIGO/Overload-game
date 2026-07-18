import type { Metadata } from "next";
import { ArcadeGrid } from "@/components/ArcadeGrid";

export const metadata: Metadata = {
  title: "Overload — the brain arcade",
  description:
    "Five fast, stressful mini-games. One daily challenge each. Reflexes, focus, patience — how much can your brain take?",
  openGraph: {
    title: "Overload — the brain arcade",
    description:
      "Five fast, stressful mini-games. New daily challenges for everyone, every day.",
    url: "/",
  },
};

export default function Home() {
  return <ArcadeGrid />;
}
