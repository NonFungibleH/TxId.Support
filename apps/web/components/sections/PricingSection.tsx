import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { clsx } from "clsx";

const PLANS = [
  {
    name: "Token Starter",
    price: "Free",
    period: null,
    description: "Get your token widget live in minutes.",
    cta: "Get started free",
    ctaHref: "https://app.txid.support/sign-up?plan=token-starter",
    highlight: false,
    features: [
      "1 token",
      "1,000 widget loads/mo",
      "TxID branding",
      "Live price + chart",
      "Community links",
    ],
  },
  {
    name: "Token Pro",
    price: "$29",
    period: "/mo",
    description: "White-label token widget for serious projects.",
    cta: "Start Token Pro",
    ctaHref: "https://app.txid.support/sign-up?plan=token-pro",
    highlight: false,
    features: [
      "1 token",
      "10,000 widget loads/mo",
      "White-label (remove TxID branding)",
      "Analytics dashboard",
      "Priority support",
    ],
  },
  {
    name: "Support Starter",
    price: "$49",
    period: "/mo",
    description: "Full AI support for your protocol.",
    cta: "Start Support",
    ctaHref: "https://app.txid.support/sign-up?plan=support-starter",
    highlight: true,
    badge: "Most Popular",
    features: [
      "1 project",
      "5,000 conversations/mo",
      "AI support + tx diagnostics",
      "Docs RAG knowledge base",
      "White-label",
      "Analytics",
    ],
  },
  {
    name: "Support Growth",
    price: "$149",
    period: "/mo",
    description: "Scale across multiple projects.",
    cta: "Start Growth",
    ctaHref: "https://app.txid.support/sign-up?plan=support-growth",
    highlight: false,
    features: [
      "10 projects",
      "25,000 conversations/mo",
      "Everything in Starter",
      "Team seats",
      "Priority support",
    ],
  },
];

export function PricingSection({ compact }: { compact?: boolean }) {
  return (
    <section className={clsx("py-24", compact && "pb-0")}>
      <div className="max-w-6xl mx-auto px-6">
        {compact && (
          <FadeIn>
            <div className="text-center mb-12">
              <p className="font-mono text-sm text-accent mb-3">{"// Pricing"}</p>
              <h2 className="font-display text-4xl font-bold text-white mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-muted max-w-xl mx-auto">
                Start free. Upgrade when you&apos;re ready.
              </p>
            </div>
          </FadeIn>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.08}>
              <div
                className={clsx(
                  "relative rounded-2xl border p-6 flex flex-col h-full transition-colors",
                  plan.highlight
                    ? "bg-accent-muted border-accent shadow-lg shadow-accent/10"
                    : "bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--border-accent)]"
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display font-semibold text-white mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-muted mb-3">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-muted">{plan.period}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted">
                      <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  href={plan.ctaHref}
                  variant={plan.highlight ? "primary" : "outline"}
                  className="w-full justify-center"
                >
                  {plan.cta}
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
