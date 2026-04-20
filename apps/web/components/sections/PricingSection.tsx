import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { APP_URL } from "@/lib/config";
import { clsx } from "clsx";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: null,
    badge: null,
    description: "Everything you need to go live",
    cta: "Start Free Trial",
    ctaHref: `${APP_URL}/sign-up`,
    highlight: false,
    features: [
      { label: "50 conversations / month", soon: false },
      { label: "Wallet detection", soon: false },
      { label: "Transaction diagnostics", soon: false },
      { label: "Docs Q&A (RAG)", soon: false },
      { label: "Multi-chain support", soon: false },
      { label: "Script tag embed", soon: false },
      { label: "Analytics dashboard", soon: false },
      { label: "TxID Support branding", soon: false },
    ],
  },
  {
    name: "Pro",
    price: "$99",
    period: "/mo",
    badge: "Most Popular",
    description: "For live protocols with real users",
    cta: "Start Free Trial",
    ctaHref: `${APP_URL}/sign-up?plan=pro`,
    highlight: true,
    features: [
      { label: "5,000 conversations / month", soon: false },
      { label: "Remove TxID branding", soon: false },
      { label: "Custom branding (colours, font, logo)", soon: false },
      { label: "Priority support", soon: false },
      { label: "5 team seats", soon: false },
      { label: "React npm package", soon: true },
      { label: "CSV export", soon: true },
      { label: "SSO / SAML", soon: true },
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: null,
    badge: null,
    description: "For high-volume protocols",
    cta: "Contact Sales",
    ctaHref: "mailto:hello@txid.support?subject=Enterprise enquiry",
    highlight: false,
    features: [
      { label: "Unlimited conversations", soon: false },
      { label: "Custom chains", soon: false },
      { label: "SLA guarantee", soon: false },
      { label: "Dedicated support", soon: false },
      { label: "Unlimited team seats", soon: false },
      { label: "Custom integrations", soon: false },
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

        <div className="grid md:grid-cols-3 gap-5">
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
                    <span className={clsx(
                      "text-white text-xs font-semibold px-3 py-1 rounded-full",
                      plan.badge === "Coming soon" ? "bg-[#3f3f46]" : "bg-accent"
                    )}>
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
                    <li key={f.label} className="flex items-start gap-2 text-sm text-muted">
                      {f.soon ? (
                        <Clock className="w-4 h-4 text-muted/50 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      )}
                      <span className={f.soon ? "text-muted/50" : undefined}>
                        {f.label}
                        {f.soon && <span className="ml-1 text-[10px] font-mono text-muted/40">soon</span>}
                      </span>
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
