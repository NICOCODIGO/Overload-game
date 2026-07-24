import type { Metadata } from "next";
import { TypingGame } from "./TypingGame";

export const metadata: Metadata = {
  title: "Panic Type",
  description:
    "Type each prompt exactly before the clock runs out — from quick words to full punctuated phrases. Typos flash red. The clock has no mercy.",
  openGraph: {
    title: "Panic Type — Overload",
    description:
      "Type it exactly how it is written. The clock has no mercy. 20 escalating prompts a day — how's your accuracy under pressure?",
    url: "/typing",
  },
};

export default function TypingPage() {
  return <TypingGame />;
}
