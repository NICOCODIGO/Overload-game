import type { Metadata } from "next";
import { PatternGame } from "./PatternGame";

export const metadata: Metadata = {
  title: "Next!",
  description:
    "2, 4, 8, 16… what comes next? Number runs, letter ladders, spinning arrows, and interleaved sequences — crack the rule before the clock does.",
  openGraph: {
    title: "Next! — Overload",
    description:
      "The pattern knows what comes next. Do you? 14 sequences a day, and the rules get sneakier.",
    url: "/pattern",
  },
};

export default function PatternPage() {
  return <PatternGame />;
}
