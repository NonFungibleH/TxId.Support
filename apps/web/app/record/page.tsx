import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { InvestigationMockup } from "@/components/sections/InvestigationMockup";
import { ArrowRight, Scale, Wrench, Headset, FileDown } from "lucide-react";

export const metadata: Metadata = {
  title: "The Case Record: A Defensible Trail for Every Answer | TxID Support",
  description:
    "Every TxID answer is an investigation, and every investigation is filed: the question, the on-chain evidence, the reasoning, and the resolution. A record support, product, and compliance can stand behind.",
  alternates: { canonical: "/record" },
};

const CASE_FIELDS = [
  { field: "The question", detail: "What the user asked, in their words, wherever they asked it." },
  { field: "The evidence", detail: "Every on-chain read the investigation made, with its source." },
  { field: "The reasoning", detail: "How the engine got from evidence to answer. Facts and interpretation are never blurred." },
  { field: "The resolution", detail: "What the user was told, and how the case ended." },
];

const CONSUMERS = [
  {
    icon: Headset,
    who: "Support",
    what: "Stops re-reading transcripts. Every case arrives summarized and categorized, so the team can see what users actually struggle with.",
  },
  {
    icon: Wrench,
    who: "Product & engineering",
    what: "Learns which failures repeat and which flows confuse people. It is a prioritization signal straight from production.",
  },
  {
    icon: Scale,
    who: "Compliance & operations",
    what: "Can show exactly what a client was told and the on-chain evidence it rested on. No reconstruction, no guesswork.",
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
                  <span className="text-accent">on the record.</span>
                </h1>
                <p className="text-lg text-muted leading-relaxed mb-4">
                  Support tools log chat transcripts. TxID files the whole investigation, from the
                  user&apos;s question to the on-chain evidence behind the answer. One case, kept
                  properly, that your whole company can rely on.
                </p>
                <p className="font-mono text-xs text-muted/70 mb-8">
                  The chat is how cases get created. The record is what you keep.
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
                <InvestigationMockup />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* What a case contains */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-10">
                <h2 className="font-display text-3xl font-bold text-white mb-3">What a case contains</h2>
                <p className="text-muted max-w-xl mx-auto">Four parts, captured automatically on every interaction.</p>
              </div>
            </FadeIn>
            <div className="grid md:grid-cols-4 gap-4">
              {CASE_FIELDS.map((f, i) => (
                <FadeIn key={f.field} delay={i * 0.06}>
                  <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                    <p className="font-mono text-[11px] text-accent mb-2 uppercase tracking-widest">Part {i + 1}</p>
                    <h3 className="font-display font-semibold text-white mb-2">{f.field}</h3>
                    <p className="text-sm text-muted leading-relaxed">{f.detail}</p>
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
                <h2 className="font-display text-3xl font-bold text-white mb-3">One record, three teams</h2>
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
                    <p className="text-sm text-muted leading-relaxed">{c.what}</p>
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
                <div className="flex items-center gap-3 mb-4">
                  <FileDown className="w-5 h-5 text-accent" />
                  <h2 className="font-display text-xl font-bold text-white">Built to be relied on</h2>
                </div>
                <ul className="space-y-3 text-sm text-muted leading-relaxed">
                  <li>
                    <span className="text-[#c8c8d8] font-medium">Today:</span> every conversation stored with its
                    investigation, summarized and categorized automatically, reviewable by your team in the dashboard.
                  </li>
                  <li>
                    <span className="text-[#c8c8d8] font-medium">Read-only by design:</span> TxID holds no keys, moves no
                    funds, and gives no financial advice. Cases contain public on-chain data and the conversation itself.
                  </li>
                  <li>
                    <span className="text-[#c8c8d8] font-medium">On the roadmap:</span> full-text case search, exports,
                    data-retention controls, and SOC 2: the operational-intelligence layer we&apos;re building next.
                    We tell you what exists and what&apos;s coming, plainly.
                  </li>
                </ul>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                The support tool is the front end.
                <br />
                The record is the product.
              </h2>
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                <Button href="mailto:team@txid.support?subject=TxID Case Record" variant="primary" size="lg">
                  Email the team
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/solutions/institutions" variant="outline" size="lg">
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
