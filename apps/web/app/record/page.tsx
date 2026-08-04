import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { InvestigationMockup } from "@/components/sections/InvestigationMockup";
import { ArrowRight, Scale, Wrench, Headset, FileDown } from "lucide-react";

export const metadata: Metadata = {
  title: "The Case Record: Every Answer Backed by Evidence | TxID",
  description:
    "Most support tools keep a chat history. TxID keeps the investigation: what was asked, what the chain showed, how the issue was resolved, and why the answer was given.",
  alternates: { canonical: "/record" },
};

const CASE_FIELDS = [
  {
    field: "The question",
    paras: ["The user's original request, wherever they asked it."],
  },
  {
    field: "The evidence",
    paras: [
      "The on-chain data used during the investigation, with the supporting sources.",
    ],
  },
  {
    field: "The reasoning",
    paras: [
      "How TxID moved from evidence to conclusion.",
      "Verified facts remain separate from interpretation.",
    ],
  },
  {
    field: "The resolution",
    paras: ["The answer provided, the action taken, and the final outcome."],
  },
];

const CONSUMERS = [
  {
    icon: Headset,
    who: "Support",
    paras: [
      "Stop rebuilding context from transcripts.",
      "Every case arrives summarised and categorised, giving teams visibility into what users struggle with.",
    ],
  },
  {
    icon: Wrench,
    who: "Product & engineering",
    paras: [
      "Understand recurring failures and friction points.",
      "Turn real user issues into a direct signal for prioritisation.",
    ],
  },
  {
    icon: Scale,
    who: "Compliance & operations",
    paras: [
      "Show exactly what a user was told and the evidence behind it.",
      "No reconstruction. No ambiguity.",
    ],
  },
];

const POSTURE = [
  {
    label: "Available today",
    paras: [
      "Every conversation is stored with its investigation, automatically summarised and categorised, and reviewable by your team.",
    ],
  },
  {
    label: "Read-only by design",
    paras: [
      "TxID holds no keys, moves no funds, and provides no financial advice.",
      "Cases contain public blockchain data and the user conversation.",
    ],
  },
  {
    label: "Coming next",
    paras: [
      "Full-text case search, exports, data retention controls, and a SOC 2 audit.",
    ],
  },
];

export default function RecordPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28">
        {/* Hero */}
        <section className="pb-14">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <FadeIn>
                <p className="font-mono text-sm text-accent mb-3">The Case Record</p>
                <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                  Every answer,
                  <br />
                  <span className="text-accent">backed by evidence.</span>
                </h1>
                <p className="text-lg text-muted leading-relaxed mb-3">
                  Most support tools keep a chat history.
                </p>
                <p className="text-lg text-muted leading-relaxed mb-4">
                  TxID keeps the investigation: what was asked, what the chain showed, how the
                  issue was resolved, and why the answer was given.
                </p>
                <p className="font-mono text-xs text-muted/70 mb-8">
                  The chat creates the case. The record is what your organisation keeps.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button href="mailto:team@txid.support?subject=TxID early access" variant="primary" size="lg">
                    Talk to us
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button href="/how-it-works" variant="outline" size="lg">
                    See the full flow
                  </Button>
                </div>
              </FadeIn>
              <FadeIn delay={0.1}>
                <InvestigationMockup
                  steps={[
                    { label: "Transaction fetched", detail: "0x8f2a…d41c" },
                    { label: "Contract state analysed", detail: "Block 21044210" },
                    { label: "Error decoded", detail: "SlippageTooHigh" },
                    { label: "Wallet impact checked", detail: "No funds moved" },
                  ]}
                  verdict={
                    <span className="space-y-1.5 block">
                      <span className="block">
                        <span className="text-white font-medium">Finding:</span> the price moved
                        beyond the user&apos;s 0.3% slippage tolerance, causing the contract to
                        reject the swap.
                      </span>
                      <span className="block">
                        <span className="text-white font-medium">Resolution:</span> retry with
                        slippage tolerance increased to 0.5%.
                      </span>
                    </span>
                  }
                />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* What a case contains */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-10">
                <h2 className="font-display text-3xl font-bold text-white mb-3">
                  What every case contains
                </h2>
                <p className="text-muted max-w-xl mx-auto">Four parts, captured automatically.</p>
              </div>
            </FadeIn>
            <div className="grid md:grid-cols-4 gap-4">
              {CASE_FIELDS.map((f, i) => (
                <FadeIn key={f.field} delay={i * 0.06}>
                  <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                    <p className="font-mono text-[11px] text-accent mb-2 uppercase tracking-widest">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className="font-display font-semibold text-white mb-2">{f.field}</h3>
                    <div className="space-y-2">
                      {f.paras.map((p) => (
                        <p key={p} className="text-sm text-muted leading-relaxed">
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Who relies on it */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-10">
                <h2 className="font-display text-3xl font-bold text-white mb-3">
                  One record. Three teams.
                </h2>
              </div>
            </FadeIn>
            <div className="grid md:grid-cols-3 gap-4">
              {CONSUMERS.map((c, i) => (
                <FadeIn key={c.who} delay={i * 0.08}>
                  <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
                    <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                      <c.icon className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-display font-semibold text-white mb-2">{c.who}</h3>
                    <div className="space-y-2">
                      {c.paras.map((p) => (
                        <p key={p} className="text-sm text-muted leading-relaxed">
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Trust posture - honest, including roadmap */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6">
            <FadeIn>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <div className="flex items-center gap-3 mb-5">
                  <FileDown className="w-5 h-5 text-accent" />
                  <h2 className="font-display text-xl font-bold text-white">Built to be relied on</h2>
                </div>
                <div className="space-y-5">
                  {POSTURE.map((p) => (
                    <div key={p.label}>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-accent mb-1.5">
                        {p.label}
                      </p>
                      <div className="space-y-1.5">
                        {p.paras.map((t) => (
                          <p key={t} className="text-sm text-muted leading-relaxed">
                            {t}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 pt-5 border-t border-[var(--border)] text-sm text-[#c8c8d8]">
                  We separate what exists today from what is being built next.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                Solve the problem. Keep the proof.
              </h2>
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                <Button href="mailto:team@txid.support?subject=TxID Case Record" variant="primary" size="lg">
                  Email the team
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/solutions#institutions" variant="outline" size="lg">
                  For institutions
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
