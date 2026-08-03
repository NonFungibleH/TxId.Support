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
    "Follow one case end to end: a user asks in your product, TxID investigates live on-chain, the user gets a clear answer, your team sees only what needs attention, and compliance keeps the record.",
  alternates: { canonical: "/how-it-works" },
};

function Stage({
  n,
  who,
  title,
  paras,
  emphasis,
  visualLabel,
  children,
  flip,
}: {
  n: string;
  who: string;
  title: string;
  paras: string[];
  emphasis?: string;
  visualLabel?: string;
  children: React.ReactNode;
  flip?: boolean;
}) {
  return (
    // Uniform stage height; the rail (FlowRail) signals progression, so no
    // dividers. Content sits right of the rail.
    <section className="relative py-10 lg:py-8 lg:min-h-[440px] lg:flex lg:items-center">
      <div className="w-full max-w-6xl mx-auto pl-14 pr-6 lg:px-6">
        <div className={`grid lg:grid-cols-2 gap-10 items-center ${flip ? "lg:[direction:rtl]" : ""}`}>
          <FadeIn className="lg:[direction:ltr]">
            <p className="font-mono text-sm text-accent mb-2">
              {n} · {who}
            </p>
            <h2 className="font-display text-3xl font-bold text-white mb-4">{title}</h2>
            <div className="space-y-3 max-w-lg">
              {paras.map((p) => (
                <p key={p} className="text-muted leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
            {emphasis && (
              <p className="mt-4 max-w-lg text-sm text-[#c8c8d8] border-l-2 border-accent/50 pl-4">
                {emphasis}
              </p>
            )}
          </FadeIn>
          <FadeIn delay={0.1} className="lg:[direction:ltr]">
            {visualLabel && (
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted/60 mb-3 lg:text-left">
                {visualLabel}
              </p>
            )}
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
                One case, end to end
              </h1>
              <p className="text-lg text-muted leading-relaxed">
                Follow a user issue from the first question to the final record.
              </p>
            </FadeIn>
          </div>
        </section>

        <FlowRail>
        {/* 1 - the user asks */}
        <Stage
          n="01"
          who="Your user"
          title="Support, exactly where they are stuck"
          paras={[
            "A user encounters an issue. They ask directly on your website or Telegram, connect their wallet, and TxID already understands the context.",
          ]}
          emphasis="No forms. No screenshots. No explaining what happened."
          visualLabel="Example"
        >
          <WidgetMockup
            className="relative"
            walletLabel="Wallet connected"
            activityLabel="Recent activity"
            activity={[
              { status: "success", label: "Supply ETH", time: "2d ago" },
              { status: "success", label: "Borrow USDC", time: "2d ago" },
              { status: "failed", label: "Liquidation event", time: "20m ago" },
            ]}
            exchanges={[
              {
                q: "Why was my position liquidated?",
                thinking: "Checking your position…",
                // No answer here on purpose: the answer is stage 03.
                a: "",
              },
            ]}
          />
        </Stage>

        {/* 2 - the investigation */}
        <Stage
          n="02"
          who="TxID"
          title="Investigates what actually happened"
          paras={[
            "Before responding, TxID analyses the transaction, reads relevant contract data, and identifies the cause.",
            "It combines live blockchain data with your protocol knowledge, documentation, and error mappings to generate a verified explanation.",
            "If something cannot be confirmed, TxID says so instead of guessing.",
          ]}
          flip
        >
          <InvestigationMockup
            caseId="#4821"
            caseSubtitle="Liquidation dispute · Base"
            question="Why was my position liquidated?"
            steps={[
              { label: "Position health checked" },
              { label: "Oracle price data reviewed" },
              { label: "Liquidation transaction confirmed" },
              { label: "Protocol rules validated" },
            ]}
            verdictLabel="Investigation result"
            verdict={
              <span className="space-y-1.5 block">
                <span className="block">
                  <span className="text-white font-medium">Finding:</span> the position fell below
                  the required collateral ratio after the oracle price update.
                </span>
                <span className="block">
                  <span className="text-white font-medium">Impact:</span> liquidation executed
                  according to protocol rules.
                </span>
              </span>
            }
            showLifecycleTail={false}
          />
        </Stage>

        {/* 3 - the resolution */}
        <Stage
          n="03"
          who="Your user"
          title="Gets a clear answer, instantly"
          paras={[
            "TxID explains what happened, why it happened, and what the user can do next.",
          ]}
          emphasis="No waiting for support. No uncertainty."
          visualLabel="Example response"
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[#0d0d18] px-4 py-3.5 space-y-2.5">
              <p className="text-sm text-[#c8c8d8] leading-relaxed">
                Your position was liquidated after your collateral ratio fell below the required
                threshold.
              </p>
              <p className="text-sm text-[#c8c8d8] leading-relaxed">
                I checked the liquidation transaction, oracle update, and position health at the
                time of execution. The liquidation was triggered according to the protocol rules.
              </p>
              <p className="text-sm text-[#c8c8d8] leading-relaxed">
                To avoid this in the future, consider maintaining a higher collateral ratio or
                adding collateral before reaching the liquidation threshold.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">Resolved</p>
            </div>
          </div>
        </Stage>

        {/* 4 - the escalation */}
        <Stage
          n="04"
          who="Your team"
          title="Only see the issues that need attention"
          paras={[
            "Some cases require human judgement.",
            "When they do, TxID escalates with the investigation already complete, so your team starts with evidence, not a blank ticket.",
          ]}
          visualLabel="Works with: Slack · Discord · Linear · GitHub · Jira"
          flip
        >
          <div className="max-w-md mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[#10101d]">
              <Hash className="w-3.5 h-3.5 text-accent" />
              <p className="text-xs font-semibold text-white">#support-escalations</p>
            </div>
            <div className="p-4 space-y-2.5">
              <p className="text-xs text-[#c8c8d8]">
                <span className="font-semibold text-white">TxID</span> · Case #4822 requires review
              </p>
              <div className="rounded-lg border border-[var(--border)] bg-[#12121f] px-3 py-2.5 space-y-2">
                <p className="text-[11px] text-muted">
                  <span className="text-[#c8c8d8] font-medium">Summary:</span> user disputes a
                  liquidation event on their position.
                </p>
                <div className="space-y-1">
                  <p className="text-[11px] text-[#c8c8d8] font-medium">Verified:</p>
                  {[
                    "Position health before liquidation",
                    "Oracle price updates",
                    "Liquidation transaction",
                    "Protocol parameters",
                  ].map((v) => (
                    <p key={v} className="flex items-center gap-1.5 text-[11px] text-muted">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      {v}
                    </p>
                  ))}
                </div>
                <p className="text-[11px] text-muted">
                  <span className="text-[#c8c8d8] font-medium">Requires review:</span> user is
                  requesting further clarification on the liquidation outcome.
                </p>
              </div>
              <p className="text-[10px] font-mono text-muted/60">Full investigation attached</p>
            </div>
          </div>
        </Stage>

        {/* 5 - the record */}
        <Stage
          n="05"
          who="Compliance & product"
          title="Every interaction becomes a trusted record"
          paras={[
            "Every investigation is stored as a searchable case record.",
            "Support understands recurring issues. Product identifies where users struggle. Compliance can verify exactly what happened and what the user was told.",
          ]}
        >
          <div className="max-w-md mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[#10101d]">
              <Archive className="w-3.5 h-3.5 text-accent" />
              <p className="text-xs font-semibold text-white">Case records</p>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {[
                ["#4822", "Liquidation dispute", "Escalated", "text-amber-400"],
                ["#4821", "Position liquidation", "Resolved", "text-emerald-400"],
                ["#4820", "Failed transaction", "Resolved", "text-emerald-400"],
                ["#4819", "Protocol question", "Resolved", "text-emerald-400"],
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
                Searchable · Exportable · Traceable to evidence
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
                Experience TxID in action, or see how it integrates with your own protocol.
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
