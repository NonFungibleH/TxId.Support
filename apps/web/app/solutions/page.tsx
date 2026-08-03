import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { WidgetMockup } from "@/components/sections/WidgetMockup";
import { InvestigationMockup } from "@/components/sections/InvestigationMockup";
import { ArrowRight, Check, Archive, Blocks, Landmark, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Solutions | TxID",
  description:
    "One support and operations layer for DeFi protocols, issuers and tokenisation platforms, and institutions. The same investigation engine, seen through each team's eyes.",
  alternates: { canonical: "/solutions" },
};

function RecordVisual() {
  return (
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
  );
}

// One page rather than three thin ones: the same skeleton per audience, so the
// set reads as one platform seen through three buyers' eyes.
interface Audience {
  id: string;
  icon: React.ElementType;
  badge: string;
  nav: string;
  headline: React.ReactNode;
  sub: string;
  pains: { title: string; detail: string }[];
  delivers: string[];
  visual: React.ReactNode;
  visualCaption: string;
  cta?: { label: string; href: string };
}

const AUDIENCES: Audience[] = [
  {
    id: "protocols",
    icon: Blocks,
    badge: "Protocols",
    nav: "Protocols",
    headline: (
      <>
        Your users&apos; questions,{" "}
        <span className="text-accent">answered like an engineer would.</span>
      </>
    ),
    sub: "Failed swaps, stuck orders, wrong networks: every on-chain product generates questions only someone who can read the chain can answer. TxID answers them in your product and your community, around the clock.",
    pains: [
      {
        title: "Questions overspill to specialists",
        detail:
          "Most users and most support staff can't read a transaction. The same issues repeat across Discord, Telegram and tickets until an engineer steps in.",
      },
      {
        title: "Every answer is an investigation",
        detail:
          "Knowing where to look, reading the transaction, checking balances and approvals, sometimes tracing across other protocols. That expertise doesn't scale.",
      },
      {
        title: "Users give up before you reply",
        detail:
          "By the time a human answers a 2am question, the user has already abandoned the transaction, or the protocol.",
      },
    ],
    delivers: [
      "A user with a failed swap at 2am has the diagnosis and the fix thirty seconds later",
      "Answers grounded in your docs, your contracts, and your own error maps",
      "Escalations land in Slack or your tracker with the work already done, so engineers stop re-checking what was already checked",
      "Support history becomes a record of what users actually struggle with",
      "Live on 9 chains, including Move-native Aptos, and it understands subaccounts and delegated session keys",
    ],
    visual: <WidgetMockup className="relative" />,
    visualCaption: "The embedded surface: your brand, your docs, live chain reads",
  },
  {
    id: "issuers",
    icon: Landmark,
    badge: "Issuers & tokenisation platforms",
    nav: "Issuers",
    headline: (
      <>
        Assets on-chain means <span className="text-accent">questions on-chain.</span>
      </>
    ),
    sub: "Stablecoin issuers, tokenisation platforms, neobanks and wallet providers inherit client-facing support obligations the moment value moves on-chain. Your clients' users have no chain knowledge at all, and their questions still have to be answered correctly.",
    pains: [
      {
        title: "Mainstream users, on-chain problems",
        detail:
          "\"Where is my money?\" now has an on-chain answer: a pending settlement, a sponsored transaction, an address that rotated. Your support stack can't see any of it.",
      },
      {
        title: "Every tenant multiplies the load",
        detail:
          "Each client you onboard brings their own users, their own assets, and their own stream of questions your team is expected to field.",
      },
      {
        title: "Wrong answers are expensive",
        detail:
          "A client-facing answer about on-chain assets has to be correct, and it has to be defensible after the fact. Guesswork is a liability.",
      },
    ],
    delivers: [
      "White-label support inside your product, or one deployment per tenant",
      "When a client asks where their money is, the answer comes from the chain, with the source",
      "Fluent in what confuses mainstream users most: settlement timing, sponsored gas, changed addresses",
      "Every case filed, so operations can show what was said and why it was right",
      "Runs on 9 chains today, including Aptos, where tokenised assets are heading",
    ],
    visual: <InvestigationMockup />,
    visualCaption: "Every answer is an investigation with evidence, not a guess",
  },
  {
    id: "institutions",
    icon: Building2,
    badge: "Institutions",
    nav: "Institutions",
    headline: (
      <>
        Answer clients correctly, <span className="text-accent">and defensibly.</span>
      </>
    ),
    sub: "When an institution's clients hold on-chain assets, operations and compliance teams must answer questions about them without in-house chain expertise, and stand behind every answer afterwards.",
    pains: [
      {
        title: "Client questions, chain answers",
        detail:
          "Settlement status, asset movements, failed transactions: the correct answer lives on-chain, where your client-service tooling can't reach.",
      },
      {
        title: "Expertise doesn't scale",
        detail:
          "The few people who can read a chain become the bottleneck for every client query, at any hour, in any market condition.",
      },
      {
        title: "Answers must be evidenced",
        detail:
          "What was the client told, on what basis, and was it correct? Without a record, every answer is an unmanaged risk.",
      },
    ],
    delivers: [
      "Every claim comes from a live chain read, with the source cited",
      "Each case is filed with its evidence and resolution, ready for review",
      "OFAC sanctions screening and contract verification on request, against the on-chain oracle",
      "Escalations reach your existing tools with the work already done",
      "Read-only. No custody, no keys, no advice.",
    ],
    visual: <RecordVisual />,
    visualCaption: "The record: what compliance actually buys",
    cta: { label: "See the case record", href: "/record" },
  },
];

export default function SolutionsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28">
        {/* Hero */}
        <section className="pb-12">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-3">Solutions</p>
              <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                One layer, three teams.
              </h1>
              <p className="text-lg text-muted leading-relaxed mb-8">
                The same investigation engine, seen through the eyes of the team that relies
                on it.
              </p>
              <div className="flex flex-wrap gap-2.5 justify-center">
                {AUDIENCES.map((a) => (
                  <a
                    key={a.id}
                    href={`#${a.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-muted hover:border-accent/50 hover:text-white transition-colors"
                  >
                    <a.icon className="w-4 h-4 text-accent" />
                    {a.nav}
                  </a>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {AUDIENCES.map((a, ai) => (
          <section
            key={a.id}
            id={a.id}
            className="scroll-mt-24 py-14 border-t border-[var(--border)]"
          >
            <div className="max-w-6xl mx-auto px-6">
              <FadeIn>
                <div className="max-w-3xl mb-10">
                  <p className="font-mono text-sm text-accent mb-3">
                    {String(ai + 1).padStart(2, "0")} · {a.badge}
                  </p>
                  <h2 className="font-display text-4xl font-bold text-white leading-[1.15] tracking-tight mb-4">
                    {a.headline}
                  </h2>
                  <p className="text-muted leading-relaxed">{a.sub}</p>
                </div>
              </FadeIn>

              <div className="grid md:grid-cols-3 gap-4 mb-12">
                {a.pains.map((p, i) => (
                  <FadeIn key={p.title} delay={i * 0.08}>
                    <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
                      <h3 className="font-display font-semibold text-white mb-2">{p.title}</h3>
                      <p className="text-sm text-muted leading-relaxed">{p.detail}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <FadeIn>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted/60 mb-4">
                    What the layer delivers
                  </p>
                  <ul className="space-y-3">
                    {a.delivers.map((d) => (
                      <li key={d} className="flex items-start gap-3 text-sm text-muted">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                  {a.cta && (
                    <Button href={a.cta.href} variant="outline" className="mt-7">
                      {a.cta.label}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </FadeIn>
                <FadeIn delay={0.1}>
                  {a.visual}
                  <p className="text-center text-xs text-muted/60 mt-4">{a.visualCaption}</p>
                </FadeIn>
              </div>
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className="py-16 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                One layer, whichever team you sit on
              </h2>
              <p className="text-muted mb-8">
                See how TxID works with your protocol, or request early access.
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
