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
  title: "TxID Support: The Support & Operations Layer for On-Chain Finance",
  description:
    "An investigation behind every answer: TxID reads live chain state, diagnoses failed transactions, and keeps a reportable record of every case. EVM and Move-native Aptos.",
  metadataBase: new URL("https://txid.support"),
  openGraph: {
    title: "TxID Support: The Support & Operations Layer for On-Chain Finance",
    description: "Expert support for every user, an investigation behind every answer. EVM and Aptos.",
    type: "website",
    url: "https://txid.support",
    siteName: "TxID Support",
  },
  twitter: {
    card: "summary_large_image",
    title: "TxID Support: The Support & Operations Layer for On-Chain Finance",
    description: "Expert support for every user, an investigation behind every answer. EVM and Aptos.",
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
