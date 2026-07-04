import type { Metadata } from "next"

// /demo is a client component, so its metadata lives in this route layout.
export const metadata: Metadata = {
  title: "Live Demo | TxID Support",
  description:
    "Try the TxID Support AI agent live. See how it detects wallets, diagnoses failed transactions, and answers protocol questions in real time.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Live Demo | TxID Support",
    description: "Try the TxID Support AI agent live in your browser.",
    url: "https://txid.support/demo",
    type: "website",
  },
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
