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
    "One support and operations layer for DeFi protocols, issuers and tokenisation platforms, and institutions. The same investigation engine, adapted for the teams responsible for on-chain users, assets, and operations.",
  alternates: { canonical: "/solutions" },
};

function RecordVisual() {
  return (
    <div className="max-w-md mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[#10101d]">
        <Archive className="w-3.5 h-3.5 text-accent" />
        <p className="text-xs font-semibold text-white">The Case Record</p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {[
          ["#4822", "Liquidation dispute", "Escalated", "text-amber-400"],
          ["#4821", "Failed swap · Slippage", "Resolved", "text-emerald-400"],
          ["#4820", "Wrong network · Bridge", "Resolved", "text-emerald-400"],
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
          Searchable · Exportable · Traceable to evidence
        </p>
      </div>
    </div>
  );
}

// One page rather than three thin ones: the same skeleton per audience, so the
// set reads as one platform seen through three buyers' eyes.
interface Pain {
  title: string;
  paras: string[];
  bullets?: string[];
  tail?: string;
}

interface Audience {
  id: string;
  icon: React.ElementType;
  badge: string;
  headline: React.ReactNode;
  subParas: string[];
  pains: Pain[];
  delivers: string[];
  // The record card carries its own header and footer, so it takes neither.
  visualLabel?: string;
  visual: React.ReactNode;
  visualCaption?: string[];
  cta?: { label: string; href: string };
}

const AUDIENCES: Audience[] = [
  {
    id: "protocols",
    icon: Blocks,
    badge: "Protocols",
    headline: (
      <>
        Give users answers that{" "}
        <span className="text-accent">normally require an engineer</span>
      </>
    ),
    subParas: [
      "Failed swaps, stuck transactions, wrong networks, and contract errors create support questions that only someone who understands the chain can resolve.",
      "TxID brings that expertise directly into your product and community, 24/7.",
    ],
    pains: [
      {
        title: "Support shouldn't depend on the person who understands the chain",
        paras: [
          "Most users cannot read transactions. Most support teams cannot either.",
          "The same issues repeat across Discord, Telegram, and tickets until an engineer investigates manually.",
        ],
      },
      {
        title: "Every answer becomes an investigation",
        paras: [
          "TxID checks the transaction, reads contract state, verifies balances and approvals, and explains what happened.",
          "The expertise that previously lived with a handful of engineers becomes available instantly.",
        ],
      },
    ],
    delivers: [
      "Failed transactions diagnosed in seconds",
      "Answers grounded in your documentation, contracts, and error mappings",
      "Escalations delivered with investigation context already attached",
      "Support data transformed into product insights",
      "Multi-chain support, including Move-native Aptos",
    ],
    visualLabel: "Embedded experience",
    visual: <WidgetMockup className="relative" />,
    visualCaption: ["Your brand.", "Your documentation.", "Live blockchain intelligence."],
  },
  {
    id: "issuers",
    icon: Landmark,
    badge: "Issuers & tokenisation platforms",
    headline: (
      <>
        When assets move on-chain, <span className="text-accent">questions follow</span>
      </>
    ),
    subParas: [
      "Stablecoins, tokenised assets, and digital financial products create new client support responsibilities.",
      "Your users may not understand the blockchain, but their questions still need accurate answers.",
    ],
    pains: [
      {
        title: "Traditional support cannot see the full picture",
        paras: ["“Where is my money?” might mean:"],
        bullets: [
          "A pending settlement",
          "A delayed transaction",
          "A wallet change",
          "A contract state issue",
        ],
        tail: "The answer exists on-chain, but traditional support tools cannot access it.",
      },
      {
        title: "Every client increases operational complexity",
        paras: [
          "Each platform, tenant, or asset introduces new users, new workflows, and new support requirements.",
          "TxID provides a scalable support layer without adding more manual investigation.",
        ],
      },
    ],
    delivers: [
      "White-label support embedded into your product",
      "Answers based on live blockchain data and verified sources",
      "Clear explanations for settlement, transfers, and asset activity",
      "Complete case records for operations and review",
      "Support across EVM and Move-native environments",
    ],
    visualLabel: "Example investigation",
    visual: (
      <InvestigationMockup
        steps={[
          { label: "Transaction identified" },
          { label: "Error decoded" },
          { label: "Wallet impact checked" },
        ]}
        verdict={
          <span className="space-y-1.5 block">
            <span className="block">
              <span className="text-white font-medium">Finding:</span> the swap failed because
              the price moved beyond the user&apos;s slippage tolerance.
            </span>
            <span className="block">
              <span className="text-white font-medium">Resolution:</span> retry with slippage
              increased to 0.5%.
            </span>
          </span>
        }
        showLifecycleTail={false}
      />
    ),
    visualCaption: ["Evidence-backed answer delivered ✓"],
  },
  {
    id: "institutions",
    icon: Building2,
    badge: "Institutions",
    headline: (
      <>
        Answer clients correctly. <span className="text-accent">Defend every answer.</span>
      </>
    ),
    subParas: [
      "When clients hold assets on-chain, operations teams become responsible for explaining what happened.",
      "Those answers need to be accurate, verifiable, and reviewable.",
    ],
    pains: [
      {
        title: "Client questions require blockchain expertise",
        paras: [
          "Settlement status. Asset movements. Failed transactions.",
          "The answer exists on-chain, but most client service tooling cannot access it.",
        ],
      },
      {
        title: "Expertise becomes a bottleneck",
        paras: [
          "The few people who understand blockchain activity become responsible for every investigation.",
          "That does not scale across clients, markets, or time zones.",
        ],
      },
      {
        title: "Every answer needs evidence",
        paras: [
          "What was the client told?",
          "What data supported it?",
          "Could the decision be reviewed later?",
        ],
        tail: "TxID creates the record automatically.",
      },
    ],
    delivers: [
      "Every response backed by live blockchain data",
      "Evidence attached to every case",
      "Contract verification and sanctions checks where required",
      "Escalations delivered into existing workflows",
      "Read-only by design: no custody, no keys, no financial advice",
    ],
    visual: <RecordVisual />,
    cta: { label: "See the case record", href: "/record" },
  },
];

export default function SolutionsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28">
        {/* Hero */}
        <section className="pb-16">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-3">Solutions</p>
              <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                One layer, three teams.
              </h1>
              <p className="text-lg text-muted leading-relaxed mb-10">
                The same investigation engine, adapted for the teams responsible for on-chain
                users, assets, and operations.
              </p>
              <div className="flex flex-wrap gap-2.5 justify-center">
                {AUDIENCES.map((a) => (
                  <a
                    key={a.id}
                    href={`#${a.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-muted hover:border-accent/50 hover:text-white transition-colors"
                  >
                    <a.icon className="w-4 h-4 text-accent" />
                    {a.badge}
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
            className="scroll-mt-24 py-24 border-t border-[var(--border)]"
          >
            <div className="max-w-6xl mx-auto px-6">
              <FadeIn>
                <div className="max-w-3xl mb-14">
                  <p className="font-mono text-sm text-accent mb-3">
                    {String(ai + 1).padStart(2, "0")} · {a.badge}
                  </p>
                  <h2 className="font-display text-4xl font-bold text-white leading-[1.15] tracking-tight mb-4">
                    {a.headline}
                  </h2>
                  <div className="space-y-3">
                    {a.subParas.map((p) => (
                      <p key={p} className="text-muted leading-relaxed">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              </FadeIn>

              {/* Two or three pains depending on the audience, so the row always
                  fills rather than leaving an orphan card. */}
              <div
                className={`grid gap-5 mb-16 ${
                  a.pains.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
                }`}
              >
                {a.pains.map((p, i) => (
                  <FadeIn key={p.title} delay={i * 0.08}>
                    <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-7">
                      <h3 className="font-display font-semibold text-white mb-3">{p.title}</h3>
                      <div className="space-y-2.5">
                        {p.paras.map((t) => (
                          <p key={t} className="text-sm text-muted leading-relaxed">
                            {t}
                          </p>
                        ))}
                      </div>
                      {p.bullets && (
                        <ul className="mt-3 space-y-1.5">
                          {p.bullets.map((b) => (
                            <li
                              key={b}
                              className="flex items-start gap-2.5 text-sm text-muted"
                            >
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-accent shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {p.tail && (
                        <p className="mt-3 text-sm text-muted leading-relaxed">{p.tail}</p>
                      )}
                    </div>
                  </FadeIn>
                ))}
              </div>

              <div
                className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
                  ai % 2 === 1 ? "lg:[direction:rtl]" : ""
                }`}
              >
                <FadeIn className="lg:[direction:ltr]">
                  <p className="font-mono text-xs uppercase tracking-widest text-muted/60 mb-5">
                    What the layer delivers
                  </p>
                  <ul className="space-y-4">
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
                <FadeIn delay={0.1} className="lg:[direction:ltr] flex flex-col items-center">
                  {a.visualLabel && (
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted/60 mb-4 text-center">
                      {a.visualLabel}
                    </p>
                  )}
                  {a.visual}
                  {a.visualCaption && (
                    <div className="mt-5 text-center space-y-0.5">
                      {a.visualCaption.map((c) => (
                        <p key={c} className="text-xs text-muted/60">
                          {c}
                        </p>
                      ))}
                    </div>
                  )}
                </FadeIn>
              </div>
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className="py-24 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                One layer. Every team.
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
