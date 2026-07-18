import type { Metadata } from "next";
import { AnomalyGame } from "./AnomalyGame";

export const metadata: Metadata = {
  title: "Anomaly",
  description:
    "Anomaly detection under pressure: one thing in the crowd doesn't belong. Scan the sector and tap it before the feed cuts out.",
  openGraph: {
    title: "Anomaly — Overload",
    description:
      "One of them doesn't belong. 12 sectors a day, and the twins get closer every round.",
    url: "/anomaly",
  },
};

export default function AnomalyPage() {
  return <AnomalyGame />;
}
