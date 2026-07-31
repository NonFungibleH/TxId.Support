import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Company | TxID Support",
  description:
    "TxID is building the support and operations layer for on-chain finance: an investigation behind every answer, and a record behind every case. Built by the former Product Lead of Team Finance.",
  alternates: { canonical: "/company" },
};

const BELIEFS = [
  {
    title: "Answers about value must be correct",
    detail:
      "A wrong answer about someone's assets is worse than no answer. That's why every claim is backed by a live on-chain read, and why verified fact is always kept distinct from interpretation.",
  },
  {
    title: "Support is an investigation, not a script",
    detail:
      "The right answer to \"why did my transaction fail?\" lives on-chain. Reading it properly, the way a protocol engineer would, is the product.",
  },
  {
    title: "The record matters as much as the answer",
    detail:
      "As institutions bring real value on-chain, what was said to a client, and on what basis, becomes infrastructure. We build for the team that has to stand behind it.",
  },
];

export default function CompanyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-20">
        {/* Mission */}
        <section className="pb-14">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-3">Company</p>
              <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                Building the layer that
                <br />
                <span className="text-accent">explains on-chain finance.</span>
              </h1>
              <p className="text-lg text-muted leading-relaxed">
                Every blockchain transaction tells you what happened. TxID explains why, guides the
                fix, and keeps the record. We&apos;re building that as infrastructure: for protocols
                today, and for the institutions bringing real value on-chain next.
              </p>
            </FadeIn>
          </div>
        </section>

        {/* Beliefs */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-4">
              {BELIEFS.map((b, i) => (
                <FadeIn key={b.title} delay={i * 0.08}>
                  <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
                    <h2 className="font-display font-semibold text-white mb-2">{b.title}</h2>
                    <p className="text-sm text-muted leading-relaxed">{b.detail}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6">
            <FadeIn>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <p className="font-mono text-sm text-accent mb-3">Who&apos;s behind it</p>
                <p className="text-[15px] text-[#c8c8d8] leading-relaxed">
                  TxID is built by <span className="text-white font-semibold">Howard Pearce</span>,
                  previously Product Lead at Team Finance, the token management platform integrated
                  across 20+ blockchains that supported 40,000 projects in their launches, and
                  hands-on with a wide range of early-stage teams through the TrustSwap incubator.
                  Development runs Move-native on Aptos and across the major EVM networks.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Contact */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">Talk to the team</h2>
              <p className="text-muted mb-8">
                Working on a protocol, a platform, or an ecosystem where this should exist?
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button href="mailto:team@txid.support" variant="primary" size="lg">
                  team@txid.support
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/check" variant="outline" size="lg">
                  Try the product
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
