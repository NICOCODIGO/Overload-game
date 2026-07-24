import type { Metadata } from "next";
import { ClockGame } from "./ClockGame";

export const metadata: Metadata = {
  title: "Overclocked",
  description:
    "Read the analog clock before the timer melts. Numbered faces, bare faces, and timelapse rounds where the hands spin, freeze, and vanish.",
  openGraph: {
    title: "Overclocked — Overload",
    description:
      "Quick! What time is it? 20 clocks a day, and the late ones vanish before you answer.",
    url: "/clock",
  },
};

export default function ClockPage() {
  return <ClockGame />;
}
