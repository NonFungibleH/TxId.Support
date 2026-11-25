import type { Metadata } from "next"

// /check/arc is a client component, so its metadata lives in this route layout.
export const metadata: Metadata = {
  title: "Try TxID on Arc: Live Transaction Diagnosis | TxID",
  description:
    "Watch TxID read Arc live: why a transaction failed, what a wallet has sent, and whether it has the USDC Arc charges for fees. Free, no sign-up.",
  alternates: { canonical: "/check/arc" },
  // Private for now: shared by direct link with Circle and Arc teams, never
  // indexed or linked from the site until we decide to launch it publicly.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Try TxID on Arc | TxID",
    description: "Live Arc transaction diagnosis, with USDC fees explained in dollars.",
    url: "https://txid.support/check/arc",
    type: "website",
  },
}

export default function ArcCheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
