import React from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingSection } from "@/components/sections/PricingSection";
import { ClosingCTA } from "@/components/sections/ClosingCTA";
import { FadeIn } from "@/components/ui/FadeIn";
import { Check, Minus } from "lucide-react";
// APP_URL is consumed by PricingSection — imported there directly

export const metadata: Metadata = {
  title: "Pricing | TxID Support",
  description: "Start free. Upgrade when your protocol is ready.",
  alternates: { canonical: "/pricing" },
};

const COMPARISON = [
  {
    category: "Support",
    rows: [
      { feature: "Conversations / month", starter: "200", pro: "5,000", enterprise: "Unlimited" },
      { feature: "Wallet detection", starter: true, pro: true, enterprise: true },
      { feature: "Transaction diagnostics", starter: true, pro: true, enterprise: true },
      { feature: "Revert reason explainer", starter: true, pro: true, enterprise: true },
      { feature: "Knowledge base Q&A", starter: true, pro: true, enterprise: true },
    ],
  },
  {
    category: "Branding",
    rows: [
      { feature: "TxID Support branding", starter: true, pro: false, enterprise: false },
      { feature: "Custom colours + font", starter: false, pro: true, enterprise: true },
      { feature: "Custom logo", starter: false, pro: true, enterprise: true },
      { feature: "Custom agent name + avatar", starter: false, pro: true, enterprise: true },
      { feature: "Token price + chart", starter: false, pro: true, enterprise: true },
    ],
  },
  {
    category: "Integration",
    rows: [
      { feature: "Script tag embed", starter: true, pro: true, enterprise: true },
      { feature: "Inline iframe embed", starter: true, pro: true, enterprise: true },
      { feature: "Chains supported", starter: "1", pro: "Up to 3", enterprise: "Unlimited" },
      { feature: "Custom chains", starter: false, pro: false, enterprise: true },
    ],
  },
  {
    category: "Notifications",
    rows: [
      { feature: "Analytics dashboard", starter: true, pro: true, enterprise: true },
      { feature: "Escalation webhooks", starter: false, pro: true, enterprise: true },
      { feature: "CSV export", starter: false, pro: true, enterprise: true },
    ],
  },
  {
    category: "SupportTier",
    rows: [
      { feature: "Community support", starter: true, pro: true, enterprise: true },
      { feature: "Priority support", starter: false, pro: true, enterprise: true },
      { feature: "Dedicated support", starter: false, pro: false, enterprise: true },
      { feature: "SLA guarantee", starter: false, pro: false, enterprise: true },
    ],
  },
];

const FAQ = [
  {
    q: "What does the free trial include?",
    a: "The Free plan lets you evaluate the product with no credit card: you get 150 conversations/month, the full feature set (wallet detection, transaction diagnostics, knowledge base Q&A, token widget), and a full analytics dashboard. It is enough to test on your own site and validate it with real users before you move to a paid plan.",
  },
  {
    q: "What counts as a conversation?",
    a: "A conversation starts when a user opens the agent and sends their first message. It ends after 30 minutes of inactivity. Multiple messages in the same session count as one conversation.",
  },
  {
    q: "How does the Pro plan work?",
    a: "The Custom plan is for protocols running the agent in production: once you are past the free 150-conversation trial and have real users relying on it. It unlocks higher volume, multiple chains, escalation webhooks, integrations, and priority support. Contact us for a demo and pricing, no long-term contract, cancel anytime.",
  },
  {
    q: "What chains are supported?",
    a: "Ethereum, Sepolia (testnet), Base, BNB Chain, Polygon, Arbitrum, and Optimism are supported. Starter plans include 1 chain, Pro includes up to 3, and Enterprise unlocks all chains plus custom ones.",
  },
  {
    q: "How does the docs Q&A work?",
    a: "You paste your docs URL in the dashboard. The system crawls and indexes it automatically using RAG (retrieval-augmented generation). The AI answers questions grounded in your documentation, not hallucinated.",
  },
  {
    q: "Can I use my own branding?",
    a: "Yes. Set your colours, font, and logo URL in the dashboard. The free tier includes a small 'Powered by TxID Support' footer note. Removing that is a Pro plan feature.",
  },
];

// Temporarily hidden pre-launch: the detailed feature comparison and the
// price-quoting FAQ imply committed tiers/prices we haven't finalised. The
// data + markup are preserved below — flip this to `true` to restore them
// (and re-check the $ figures in the FAQ before doing so).
const SHOW_DETAILED_PRICING = false;

type CellValue = boolean | string;

function Cell({ value }: { value: CellValue }) {
  if (value === true) return <Check className="w-4 h-4 text-accent mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-muted mx-auto" />;
  return <span className="text-sm text-white">{value}</span>;
}

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
}

export default function PricingPage() {
  return (
    <>
      {SHOW_DETAILED_PRICING && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
        />
      )}
      <Navbar />
      <main className="pt-24">
        <div className="max-w-6xl mx-auto px-6 text-center pt-10 pb-0">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">{"Pricing"}</p>
            <h1 className="font-display text-5xl font-bold text-white mb-4">
              Start free. Scale when ready.
            </h1>
            <p className="text-lg text-muted max-w-xl mx-auto">
              No credit card required. The free tier is genuinely useful,
              not a 7-day trial.
            </p>
          </FadeIn>
        </div>

        <PricingSection />

        {SHOW_DETAILED_PRICING && (
        <>
        <div className="max-w-5xl mx-auto px-6 py-24">
          <FadeIn>
            <h2 className="font-display text-2xl font-bold text-white text-center mb-12">
              Full feature comparison
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 pr-4 text-sm font-medium text-muted w-1/2">Feature</th>
                    {["Starter", "Pro", "Enterprise"].map((plan) => (
                      <th key={plan} className="text-center py-3 px-4 text-sm font-display font-semibold text-white">
                        {plan}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((group) => (
                    <React.Fragment key={group.category}>
                      <tr className="border-t border-[var(--border)]">
                        <td colSpan={4} className="py-3 pr-4">
                          <span className="font-mono text-xs text-accent uppercase tracking-wider">
                            {group.category}
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr
                          key={row.feature}
                          className="border-b border-[var(--border)] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pr-4 text-sm text-muted">{row.feature}</td>
                          <td className="py-3 px-4 text-center"><Cell value={row.starter} /></td>
                          <td className="py-3 px-4 text-center"><Cell value={row.pro} /></td>
                          <td className="py-3 px-4 text-center"><Cell value={row.enterprise} /></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>

        <div className="max-w-3xl mx-auto px-6 pb-24">
          <FadeIn>
            <h2 className="font-display text-2xl font-bold text-white text-center mb-10">
              Frequently asked questions
            </h2>
          </FadeIn>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <FadeIn key={item.q} delay={i * 0.05}>
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
                  <p className="font-display font-semibold text-white mb-2 text-sm">
                    {item.q}
                  </p>
                  <p className="text-sm text-muted leading-relaxed">{item.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
        </>
        )}

        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
