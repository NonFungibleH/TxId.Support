import type { Metadata } from "next"

// /check is a client component, so its metadata lives in this route layout.
export const metadata: Metadata = {
  title: "Why Did My Transaction Fail? Free Transaction Checker | TxID Support",
  description:
    "Paste a transaction hash to find out why it failed — out of gas, reverted, or a custom contract error — explained in plain English. Free, no wallet connection needed.",
  alternates: { canonical: "/check" },
  openGraph: {
    title: "Free Transaction Checker | TxID Support",
    description: "Find out why a transaction failed, explained in plain English.",
    url: "https://txid.support/check",
    type: "website",
  },
}

export default function CheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
