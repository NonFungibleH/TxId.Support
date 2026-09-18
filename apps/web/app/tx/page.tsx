import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { TxChecker } from "./TxChecker";

export const metadata: Metadata = {
  title: "Transaction Checker: Why Did It Fail? | TxID",
  description:
    "Paste a transaction hash and get a plain-English answer: what happened, why, and a message you can send the customer. Free, no account. Ethereum, Base, Arbitrum and more.",
  keywords: [
    "transaction checker",
    "why did my transaction fail",
    "failed transaction",
    "transaction status",
    "check transaction hash",
    "stuck transaction",
  ],
  alternates: { canonical: "/tx" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Transaction Checker: Why Did It Fail? | TxID",
    description:
      "Paste a hash, get the plain-English answer and a message you can send the customer. Free, no account.",
    type: "website",
    url: "https://txid.support/tx",
    siteName: "TxID",
  },
};

/**
 * PULLED 2026-09-18. The checker behind this page reads EVM chains only, so a
 * hash from Aptos (identical in format) or any other supported chain came back
 * as "dropped on Ethereum" with advice to resubmit at a higher fee: a claim
 * about the user's transaction built from not having looked, and advice that
 * could make someone send a successful transaction twice. It stays down until
 * it reads every chain the site lists and never advises resubmitting on a
 * hash it could not find. The component is kept so restoring it is one line.
 */
const CHECKER_LIVE = false

export default function TxPage() {
  if (!CHECKER_LIVE) notFound()
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-24">
        <section className="px-6">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-3">Free tool</p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-[1.1] tracking-tight mb-4">
                Why did this
                <br />
                <span className="text-accent">transaction fail?</span>
              </h1>
              <p className="text-lg text-muted leading-relaxed max-w-xl mx-auto">
                Paste a hash. Get what happened, why, and a sentence you can send the customer.
                No block explorer, no jargon, no account.
              </p>
            </FadeIn>
          </div>
          <FadeIn delay={0.1}>
            <TxChecker />
          </FadeIn>
        </section>

        {/* Quiet reassurance strip — reinforces the read-only posture without a
            heavy section, since a first-time user is pasting a hash into a tool
            they've never seen. */}
        <section className="px-6 mt-16">
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            {[
              { h: "Read-only", p: "It reads public chain data. It never asks for a wallet signature or a key." },
              { h: "Plain English", p: "The decoded reason, translated, plus the next step, not a raw trace." },
              { h: "Send-ready", p: "A message written for a customer, ready to paste into the ticket." },
            ].map((c) => (
              <div key={c.h} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <p className="text-sm font-semibold text-white mb-1">{c.h}</p>
                <p className="text-xs text-muted leading-relaxed">{c.p}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
