import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter_Tight } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { LayoutChrome } from "@/components/shared/layout-chrome";

// Inter Tight — bold, slightly geometric, with optically rounded corners.
const display = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://opencast.cc";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "OPENCAST — verifiable prediction markets",
  description:
    "World Cup prediction markets that settle trustlessly against verifiable TxLINE proofs. On Solana.",
  icons: {
    // Brand favicon — a single lime dot, matching the OPENCAST wordmark
    // accent in the header.
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "OPENCAST — type a question, get a live market",
    description:
      "Predict the 2026 World Cup. Trustless settlement via TxLINE proofs, on Solana.",
    url: SITE_URL,
    siteName: "OpenCast",
    images: [{ url: "/landing/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OPENCAST — type a question, get a live market",
    description:
      "Predict the 2026 World Cup. Trustless settlement via TxLINE proofs, on Solana.",
    images: ["/landing/og.png"],
  },
  other: {
    // OpenCast ships a single, hand-tuned light theme. This tells Dark Reader
    // (and similar auto-dark extensions) to leave the page alone instead of
    // inverting the cream/lime palette into an unreadable grey wash.
    "darkreader-lock": "",
    "color-scheme": "light",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <LayoutChrome>{children}</LayoutChrome>
        </Providers>
      </body>
    </html>
  );
}
