import type { Metadata } from "next";
import { WidgetEmbed } from "@/components/WidgetEmbed";
import { CookieBanner } from "@/components/CookieBanner";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-accent",
  display: "swap",
});

// SEO note: `description` is the Google SERP snippet, so it is kept under ~155
// characters (Google truncates beyond that) and leads with the searchable terms
// a protocol team actually types. The OG/Twitter description is the link-share
// card, so it is written to sell the click rather than to rank. Both name the
// three concrete capabilities, because "AI support" alone reads as a chatbot,
// which is the thing this product beats.
export const metadata: Metadata = {
  title: "TxID: The Support & Operations Layer for On-Chain Finance",
  description:
    "TxID is the AI support agent for DeFi protocols: it reads live chain state, diagnoses failed transactions, and keeps a reportable record behind every answer.",
  keywords: [
    "DeFi support",
    "AI support agent",
    "on-chain support",
    "failed transaction diagnosis",
    "smart contract support",
    "crypto customer support",
    "Aptos support",
    "EVM support",
  ],
  metadataBase: new URL("https://txid.support"),
  // NO canonical here: this layout wraps every page, and a canonical set in the
  // root would point /security, /pricing and the rest all at "/". Each page
  // declares its own (the homepage already sets canonical "/").
  openGraph: {
    title: "TxID: The Support & Operations Layer for On-Chain Finance",
    description:
      "Give every user of your protocol an expert on hand. TxID reads live chain state, diagnoses failed transactions, and keeps a reportable record behind every answer.",
    type: "website",
    url: "https://txid.support",
    siteName: "TxID",
  },
  // Card type only, deliberately no title/description: a twitter.title set here
  // is inherited by EVERY page, so a blog post shared to X showed the generic
  // homepage card instead of its own. With these absent, scrapers fall back to
  // each page's og:title/og:description, which are page-specific wherever a
  // page overrides openGraph (blog, docs, chains, home).
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body className="font-sans antialiased">
        {children}
        <WidgetEmbed />
        <CookieBanner />
      </body>
    </html>
  );
}
