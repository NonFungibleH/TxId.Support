import type { Metadata } from "next"
import { JsonLd } from "@/components/JsonLd"
import { transactionGlossarySchema } from "@/lib/seo"

// /check is a client component, so its metadata lives in this route layout.
export const metadata: Metadata = {
  title: "Why Did My Transaction Fail? Free Transaction Checker | TxID",
  description:
    "Pick a protocol, connect your wallet, and find out why a transaction failed: out of gas, reverted, or a custom contract error, explained in plain English. Free.",
  alternates: { canonical: "/check" },
  openGraph: {
    title: "Free Transaction Checker | TxID",
    description: "Find out why a transaction failed, explained in plain English.",
    url: "https://txid.support/check",
    type: "website",
  },
}

export default function CheckLayout({ children }: { children: React.ReactNode }) {
  // The glossary schema is rendered here (a server component) so it lands in
  // the server HTML, where answer-engine crawlers - which often don't run JS -
  // can read it.
  return (
    <>
      <JsonLd data={transactionGlossarySchema} />
      {children}
    </>
  )
}
