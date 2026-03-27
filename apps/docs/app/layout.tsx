import type { Metadata } from "next"
import { Inter, Space_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: { default: "TxID Support Docs", template: "%s — TxID Support" },
  description: "Developer documentation for TxID Support — the AI-powered DeFi support widget.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
