import type { Metadata } from "next"

// /check/aptos is a client component, so its metadata lives in this route layout.
export const metadata: Metadata = {
  title: "Try TxID on Aptos: Live Move Transaction Diagnosis | TxID",
  description:
    "Connect your Aptos wallet and watch TxID diagnose your real Move transactions live: abort codes decoded into plain English, balances and history read from Aptos-native infrastructure. Free, no sign-up.",
  alternates: { canonical: "/check/aptos" },
  // Private for now: shared by direct link with the Aptos ecosystem, never
  // indexed or linked from the site until we decide to launch it publicly.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Try TxID on Aptos | TxID",
    description: "Live Move transaction diagnosis: abort codes decoded into plain English.",
    url: "https://txid.support/check/aptos",
    type: "website",
  },
}

export default function AptosCheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
