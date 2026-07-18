import type { Metadata } from "next";
import { BlinkGame } from "./BlinkGame";

export const metadata: Metadata = {
  title: "Blink",
  description:
    "Change blindness under pressure: the scene flashes, blinks, and flashes again — one thing changed. Tap it before the clock runs out.",
  openGraph: {
    title: "Blink — Overload",
    description:
      "The scene flickers. One thing changed. Find it. 10 scenes a day, and the changes get sneakier.",
    url: "/blink",
  },
};

export default function BlinkPage() {
  return <BlinkGame />;
}
