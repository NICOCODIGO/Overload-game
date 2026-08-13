import type { Metadata, Viewport } from "next";
import { Bungee, Space_Grotesk, VT323 } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { GridBackdrop } from "@/components/GridBackdrop";

const bungee = Bungee({
  variable: "--font-bungee",
  weight: "400",
  subsets: ["latin"],
});

// Terminal/arcade pixel font for the small "flavour" text — taglines, hooks,
// how-to, control hints. Characterful but readable; not for long reading.
const vt323 = VT323({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Baked at build time — this is a static export, so there is no runtime to
  // fall back on the way share.ts can. The real domain is the default rather
  // than a placeholder: an unset env var used to ship og:url pointing at a
  // domain that doesn't exist.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://overloadarcade.com"
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
  // Wide banner rather than the small square card. Without this the image below
  // renders as a thumbnail — or, on X, as no card at all.
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#140f2d",
  width: "device-width",
  initialScale: 1,
  // Games are tap-heavy; pinch zoom off avoids accidental zooming mid-round.
  maximumScale: 1,
  userScalable: false,
  // The on-screen keyboard shrinks the layout instead of sliding over it, so
  // Panic Type's title and timer stay put while you type. (Chrome/Android;
  // browsers without it fall back to the measuring in useKeyboardFit.)
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bungee.variable} ${grotesk.variable} ${vt323.variable} antialiased`}
    >
      {/* min-h-screen (absolute 100vh) so the flex column always fills the
          viewport — the game screens size their panels against it.
          min-h-full depended on an html height chain that wasn't resolving. */}
      {/* dvh (not vh) so mobile browser chrome is accounted for — the games
          are meant to fit the phone screen without scrolling. */}
      <body className="min-h-dvh flex flex-col">
        <GridBackdrop />
        <Header />
        <main className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-4 pb-4 sm:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
