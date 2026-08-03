import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Company | TxID",
  description:
    "Every blockchain transaction tells you what happened. TxID explains why, guides the resolution, and creates a record of what occurred. The intelligence layer for on-chain operations.",
  alternates: { canonical: "/company" },
};

const BELIEFS = [
  {
    title: "Answers about value must be correct",
    paras: [
      "A wrong answer about someone's assets is worse than no answer.",
      "That is why TxID grounds every response in live blockchain data, keeps verified facts separate from interpretation, and shows the evidence behind its conclusions.",
    ],
  },
  {
    title: "Support is an investigation, not a script",
    paras: [
      "The answer to \u201cWhy did my transaction fail?\u201d does not live in a knowledge base. It lives on-chain.",
      "Reading that data properly, the way a protocol engineer would, is the product.",
    ],
  },
  {
    title: "The record matters as much as the answer",
    paras: [
      "As more financial activity moves on-chain, organisations need more than a response.",
    ],
    listLabel: "They need to know:",
    items: [
      "What was asked",
      "What data was reviewed",
      "What was answered",
      "Why that answer was correct",
    ],
    outro:
      "TxID creates that record for the teams responsible for supporting and operating on-chain systems.",
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
              <p className="text-lg text-muted leading-relaxed mb-3">
                Every blockchain transaction tells you what happened.
              </p>
              <p className="text-lg text-muted leading-relaxed mb-3">
                TxID explains why, guides the resolution, and creates a record of what occurred.
              </p>
              <p className="text-lg text-muted leading-relaxed">
                We are building the intelligence layer for on-chain operations, helping protocols
                today and the institutions moving larger-scale financial activity on-chain
                tomorrow.
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
                  <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-7">
                    <h2 className="font-display font-semibold text-white mb-3">{b.title}</h2>
                    <div className="space-y-2.5">
                      {b.paras.map((t) => (
                        <p key={t} className="text-sm text-muted leading-relaxed">
                          {t}
                        </p>
                      ))}
                    </div>
                    {b.listLabel && (
                      <p className="text-sm text-muted leading-relaxed mt-3">{b.listLabel}</p>
                    )}
                    {b.items && (
                      <ul className="mt-3 space-y-2">
                        {b.items.map((it) => (
                          <li key={it} className="flex items-start gap-2.5 text-sm text-muted">
                            <span className="mt-[0.45rem] w-1 h-1 rounded-full bg-accent shrink-0" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {b.outro && (
                      <p className="mt-4 text-sm text-[#c8c8d8] leading-relaxed border-l-2 border-accent/50 pl-4">
                        {b.outro}
                      </p>
                    )}
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
                <div className="space-y-3 text-[15px] text-[#c8c8d8] leading-relaxed">
                  <p>
                    TxID is built by{" "}
                    <span className="text-white font-semibold">Howard Pearce</span>, previously
                    Product Lead at Team Finance, a token management platform used across 20+
                    blockchain networks and supporting 40,000+ projects.
                  </p>
                  <p>
                    He has worked hands-on with early-stage Web3 teams through the TrustSwap
                    ecosystem, building products across token launches, liquidity infrastructure,
                    and on-chain operations.
                  </p>
                  <p>
                    Today, TxID is being developed across Move-native Aptos and major EVM networks.
                  </p>
                </div>
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
