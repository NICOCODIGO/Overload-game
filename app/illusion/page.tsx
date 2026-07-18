import type { Metadata } from "next";
import { IllusionGame } from "./IllusionGame";

export const metadata: Metadata = {
  title: "Double Take",
  description:
    "Optical illusions with factual questions: which line is ACTUALLY longer? Sometimes your eyes are lying. Sometimes they're not. Good luck.",
  openGraph: {
    title: "Double Take — Overload",
    description:
      "Your eyes are lying. Answer anyway. 12 illusions a day, and the real differences keep shrinking.",
    url: "/illusion",
  },
};

export default function IllusionPage() {
  return <IllusionGame />;
}
