import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ScanSearch, Archive, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { TrustMockup } from "@/components/sections/TrustMockup";

export const metadata: Metadata = {
  title: "Trust | TxID",
  description:
    "Read-only by design, verifiable on request, recorded by default. How TxID keeps on-chain support safe for protocols, platforms, and institutions.",
  alternates: { canonical: "/security" },
};

// Three quiet pillars instead of six defensive cards. The page states the
// posture; the product proves it.
const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Read-only by design",
    points: [
      "No custody, no keys, no signing: nothing can move funds",
      "Reads the same public data any block explorer can",
      "Nothing to integrate: no contract permissions, nothing deployed",
    ],
  },
  {
    icon: ScanSearch,
    title: "Verifiable on request",
    points: [
      "Every claim backed by a live chain read, with its source",
      "OFAC sanctions screening via the on-chain Chainalysis oracle",
      "Contract verification and your audits, cited when users ask",
    ],
  },
  {
    icon: Archive,
    title: "Recorded by default",
    points: [
      "Every conversation stored with the investigation behind it",
      "Reviewable by your team; deletable on request",
      "Conversation data retained for 12 months",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-20">
        {/* Hero */}
        <section className="pb-14">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <FadeIn>
                <p className="font-mono text-sm text-accent mb-3">Trust</p>
                <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                  Read-only. Verifiable.
                  <br />
                  <span className="text-accent">Recorded.</span>
                </h1>
                <p className="text-lg text-muted leading-relaxed">
                  TxID can&apos;t touch funds, proves its answers on request, and keeps a record
                  of everything it says.
                </p>
              </FadeIn>
              <FadeIn delay={0.1}>
                <TrustMockup />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-4">
              {PILLARS.map((p, i) => (
                <FadeIn key={p.title} delay={i * 0.08}>
                  <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-7">
                    <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                      <p.icon className="w-5 h-5 text-accent" />
                    </div>
                    <h2 className="font-display text-lg font-bold text-white mb-4">{p.title}</h2>
                    <ul className="space-y-2.5">
                      {p.points.map((pt) => (
                        <li key={pt} className="text-sm text-muted leading-relaxed">
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* The fine print, briefly */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6">
            <FadeIn>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 space-y-4">
                <div>
                  <h2 className="font-display font-semibold text-white mb-1.5">What we store</h2>
                  <p className="text-sm text-muted leading-relaxed">
                    Conversations, the wallet addresses inside them, your project configuration, and
                    usage counts. No private keys, seed phrases, or signing permission, ever: there is
                    no path for the assistant to request any of them.
                  </p>
                </div>
                <div>
                  <h2 className="font-display font-semibold text-white mb-1.5">Actions, if you enable them</h2>
                  <p className="text-sm text-muted leading-relaxed">
                    Off by default. When a protocol opts in, the assistant prepares transactions that
                    users review and sign in their own wallet: explicit requests only, exact-amount
                    approvals, OFAC-screened, geo-restricted, and no fee taken. Everyone else stays
                    fully read-only.
                  </p>
                </div>
                <div>
                  <h2 className="font-display font-semibold text-white mb-1.5">What&apos;s next</h2>
                  <p className="text-sm text-muted leading-relaxed">
                    SOC 2 and data-retention controls are on the funded roadmap. We say plainly what
                    exists and what&apos;s coming, here and on{" "}
                    <Link href="/record" className="text-accent hover:underline">the Case Record</Link>.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* CTA */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-2xl font-bold text-white mb-3">
                Send this page to your reviewer
              </h2>
              <p className="text-muted max-w-lg mx-auto mb-6">
                For a data processing agreement or anything not covered here, we&apos;re one email away.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button href="mailto:team@txid.support?subject=Security review" variant="primary" size="lg">
                  Talk to us
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/check" variant="outline" size="lg">
                  Try it live
                </Button>
              </div>
              <p className="text-xs text-muted/60 mt-5">
                See also our{" "}
                <Link href="/privacy" className="text-muted hover:text-white underline underline-offset-2">privacy policy</Link>{" "}
                and{" "}
                <Link href="/terms" className="text-muted hover:text-white underline underline-offset-2">terms</Link>.
              </p>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
