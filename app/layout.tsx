import type { Metadata, Viewport } from "next";
import { Bungee, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const bungee = Bungee({
  variable: "--font-bungee",
  weight: "400",
  subsets: ["latin"],
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://overload-arcade.example.com"
  ),
  title: {
    default: "Overload — the brain arcade",
    template: "%s — Overload",
  },
  description:
    "Fast, stressful mini-games that test your reflexes, focus, and patience. New daily challenges for everyone, every day.",
  openGraph: {
    siteName: "Overload",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#140f2d",
  width: "device-width",
  initialScale: 1,
  // Games are tap-heavy; pinch zoom off avoids accidental zooming mid-round.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bungee.variable} ${grotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-4 pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
