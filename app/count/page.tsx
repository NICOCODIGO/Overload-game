import type { Metadata } from "next";
import { CountGame } from "./CountGame";

export const metadata: Metadata = {
  title: "Headcount",
  description:
    "A mob of numbers and shapes floods the screen — count only what the question asks for. Colors, sizes, spinners, and cruel combos. One tap to answer.",
  openGraph: {
    title: "Headcount — Overload",
    description:
      "Count the chaos — but only the ones we ask for. 12 questions a day, and the mob keeps growing.",
    url: "/count",
  },
};

export default function CountPage() {
  return <CountGame />;
}
