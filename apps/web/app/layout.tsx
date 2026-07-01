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

export const metadata: Metadata = {
  title: "TxID Support — AI Support Agent for Web3 Protocols",
  description:
    "White-label AI support agent for DeFi protocols. Auto-detects wallets, diagnoses transactions, answers docs questions. Embed in 30 seconds.",
  metadataBase: new URL("https://txid.support"),
  openGraph: {
    title: "TxID Support — AI Support Agent for Web3 Protocols",
    description: "White-label AI support agent for DeFi protocols. Embed in 30 seconds.",
    type: "website",
    url: "https://txid.support",
    siteName: "TxID Support",
  },
  twitter: {
    card: "summary_large_image",
    title: "TxID Support — AI Support Agent for Web3 Protocols",
    description: "White-label AI support agent for DeFi protocols. Embed in 30 seconds.",
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
