import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { WidgetMockup } from "@/components/sections/WidgetMockup";
import { InvestigationMockup } from "@/components/sections/InvestigationMockup";
import { FlowRail } from "@/components/sections/FlowRail";
import { ArrowRight, CheckCircle2, Hash, Archive } from "lucide-react";

export const metadata: Metadata = {
  title: "How It Works: From Question to Compliance Record | TxID Support",
  description:
    "Follow one support case end to end: a user asks in your product, TxID investigates live on-chain, the user gets unblocked, your team receives the case, and compliance keeps the record.",
  alternates: { canonical: "/how-it-works" },
};

function Stage({
  n,
  who,
  title,
  copy,
  children,
  flip,
}: {
  n: string;
  who: string;
  title: string;
  copy: string;
  children: React.ReactNode;
  flip?: boolean;
}) {
  return (
    // Uniform stage height; the rail (FlowRail) signals progression, so no
    // dividers. Content sits right of the rail.
    <section className="relative py-10 lg:py-0 lg:min-h-[560px] lg:flex lg:items-center">
      <div className="w-full max-w-6xl mx-auto pl-14 pr-6 lg:px-6">
        <div className={`grid lg:grid-cols-2 gap-10 items-center ${flip ? "lg:[direction:rtl]" : ""}`}>
          <FadeIn className="lg:[direction:ltr]">
            <p className="font-mono text-sm text-accent mb-2">
              {n} · {who}
            </p>
            <h2 className="font-display text-3xl font-bold text-white mb-4">{title}</h2>
            <p className="text-muted leading-relaxed max-w-lg">{copy}</p>
          </FadeIn>
          <FadeIn delay={0.1} className="lg:[direction:ltr]">
            {children}
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28">
        {/* Intro */}
        <section className="pb-10">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-3">How it works</p>
              <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                One case, end to end.
              </h1>
              <p className="text-lg text-muted leading-relaxed">
                Follow a single support question through the whole company: from the user who asks it
                to the compliance team that keeps the record.
              </p>
            </FadeIn>
          </div>
        </section>

        <FlowRail>
        {/* 1 - the user asks (the widget animation lives here now) */}
        <Stage
          n="01"
          who="Your user"
          title="Support, right where they're stuck"
          copy="A user hits a failed transaction and asks right on your site, or in your Telegram group. They connect their wallet and TxID already sees what happened. There is no ticket form, and no waiting for another timezone to wake up."
        >
          <WidgetMockup className="relative" />
        </Stage>

        {/* 2 - the investigation */}
        <Stage
          n="02"
          who="TxID"
          title="A live on-chain investigation"
          copy="The engine treats the question as an engineering problem. It fetches the transaction, replays it against chain state, and decodes the failure using your contracts and error maps. Verified fact is kept distinct from interpretation, always."
          flip
        >
          <InvestigationMockup />
        </Stage>

        {/* 3 - the resolution */}
        <Stage
          n="03"
          who="Your user"
          title="Unblocked in seconds"
          copy="Most questions end here. The user gets the answer and the exact fix, in your brand and their language, and the repeat questions never reach your team."
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[#0d0d18] px-4 py-3.5">
              <p className="text-sm text-[#c8c8d8] leading-relaxed">
                Your swap reverted because the price moved past your 0.3% slippage tolerance.
                No funds left your wallet, you only paid $1.18 in gas.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">Fix: set slippage to 0.5% and retry. It will go through.</p>
            </div>
          </div>
        </Stage>

        {/* 4 - the escalation */}
        <Stage
          n="04"
          who="Your team"
          title="Escalation with the investigation attached"
          copy="When a human is genuinely needed, the case lands where your team already works, whether that is Slack, Discord, Linear, GitHub or Jira, with the full investigation attached. Nobody starts from zero."
          flip
        >
          <div className="max-w-md mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[#10101d]">
              <Hash className="w-3.5 h-3.5 text-accent" />
              <p className="text-xs font-semibold text-white">#support-escalations</p>
            </div>
            <div className="p-4 space-y-2.5">
              <p className="text-xs text-[#c8c8d8]">
                <span className="font-semibold text-white">TxID</span> · Case #4822 needs a human
              </p>
              <div className="rounded-lg border border-[var(--border)] bg-[#12121f] px-3 py-2.5 space-y-1.5">
                <p className="text-[11px] text-muted">
                  <span className="text-[#c8c8d8] font-medium">Summary:</span> user&apos;s withdrawal is stuck behind a
                  timelock that ends in 41 hours; they believe funds are lost.
                </p>
                <p className="text-[11px] text-muted">
                  <span className="text-[#c8c8d8] font-medium">Checked:</span> lock state, unlock timestamp, wallet
                  balance, no failed transactions.
                </p>
                <p className="text-[11px] text-muted">
                  <span className="text-[#c8c8d8] font-medium">Remaining:</span> user requests manual early release -
                  policy decision.
                </p>
              </div>
              <p className="text-[10px] font-mono text-muted/60">Full case attached · 12 chain reads · 41s investigation</p>
            </div>
          </div>
        </Stage>

        {/* 5 - the record */}
        <Stage
          n="05"
          who="Compliance & product"
          title="A record you can stand behind"
          copy="Every investigation is stored and searchable. Support learns what users struggle with. Product sees what keeps breaking. And when compliance needs to show exactly what a client was told, it is all there."
        >
          <div className="max-w-md mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[#10101d]">
              <Archive className="w-3.5 h-3.5 text-accent" />
              <p className="text-xs font-semibold text-white">Case record</p>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {[
                ["#4822", "Stuck withdrawal · timelock", "Escalated", "text-amber-400"],
                ["#4821", "Failed swap · slippage", "Resolved", "text-emerald-400"],
                ["#4820", "Wrong network · bridge", "Resolved", "text-emerald-400"],
                ["#4819", "Approval question", "Resolved", "text-emerald-400"],
              ].map(([id, label, status, color]) => (
                <div key={id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[10px] font-mono text-muted/60">{id}</span>
                  <span className="text-xs text-[#c8c8d8] flex-1 truncate">{label}</span>
                  <span className={`text-[10px] font-mono ${color}`}>{status}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[#10101d]">
              <p className="text-[10px] font-mono text-muted/60">
                Searchable · exportable · every answer traceable to its evidence
              </p>
            </div>
          </div>
        </Stage>
        </FlowRail>

        {/* CTA */}
        <section className="py-16 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">See it on a real protocol</h2>
              <p className="text-muted mb-8">
                Try the live demo on a protocol you already use, or talk to us about your own.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button href="/check" variant="primary" size="lg">
                  Try it live
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="mailto:team@txid.support?subject=TxID early access" variant="outline" size="lg">
                  Request access
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
