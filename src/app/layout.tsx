import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { TopHeader } from "@/components/TopHeader";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE_NAME = "Kalshi Election Tracker";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Track live Kalshi election markets with implied odds, momentum shifts, and volume leaders.",
  keywords: ["kalshi", "election markets", "prediction markets", "odds tracker"],
  openGraph: {
    title: SITE_NAME,
    description: "Live election market tracker — implied odds, momentum shifts & volume leaders from Kalshi.",
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "Live election market tracker — implied odds, momentum shifts & volume leaders from Kalshi.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/favicon.svg" as="image" type="image/svg+xml" />
      </head>
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
        <TopHeader />
        {children}

        {/* Footer */}
        <footer style={{
          borderTop: "1px solid var(--line-200)",
          padding: "1.5rem clamp(1rem, 3vw, 2.5rem)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.78rem",
          color: "var(--ink-500)",
          fontFamily: "var(--font-display), sans-serif",
        }}>
          <span>© {new Date().getFullYear()} Kalshi Election Tracker</span>
          <nav style={{ display: "flex", gap: "1.2rem" }}>
            <a href="/about" style={{ color: "var(--ink-600)", textDecoration: "none" }}>About</a>
            <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-600)", textDecoration: "none" }}>Data Source</a>
            <a href="https://github.com/a12321xyz/KalshiElectionTracker" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-600)", textDecoration: "none" }}>GitHub</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
