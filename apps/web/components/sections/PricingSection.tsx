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
    description: "For token communities and early-stage protocols",
    cta: "Get started free",
    ctaHref: `${APP_URL}/sign-up`,
    highlight: false,
    features: [
      { label: "200 conversations / month", soon: false },
      { label: "Wallet detection", soon: false },
      { label: "Transaction diagnostics", soon: false },
      { label: "Knowledge base Q&A", soon: false },
      { label: "1 chain", soon: false },
      { label: "Script tag embed", soon: false },
      { label: "Analytics dashboard", soon: false },
    ],
  },
  {
    name: "Pro",
    price: "$699",
    period: "/mo",
    badge: "Most Popular",
    description: "For protocols with active on-chain users",
    cta: "Try Pro free",
    ctaHref: `${APP_URL}/sign-up?plan=pro`,
    highlight: true,
    features: [
      { label: "5,000 conversations / month", soon: false },
      { label: "Remove TxID branding", soon: false },
      { label: "Custom branding (colours, font, logo)", soon: false },
      { label: "Up to 3 chains", soon: false },
      { label: "Custom agent name + avatar", soon: false },
      { label: "Token price + chart", soon: false },
      { label: "Escalation webhooks", soon: false },
      { label: "Priority support", soon: false },
      { label: "CSV export", soon: false },
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
    <section className={clsx("py-16", compact && "pb-0")}>
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
                  "rounded-2xl border p-6 flex flex-col h-full transition-colors",
                  plan.highlight
                    ? "bg-accent-muted border-accent shadow-lg shadow-accent/10"
                    : "bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--border-accent)]"
                )}
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display font-semibold text-white">
                      {plan.name}
                    </h3>
                    {plan.badge && (
                      <span className={clsx(
                        "text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0",
                        plan.badge === "Coming soon" ? "bg-[#3f3f46]" : "bg-accent"
                      )}>
                        {plan.badge}
                      </span>
                    )}
                  </div>
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
                        <Check className="w-4 h-4 text-[var(--green)] flex-shrink-0 mt-0.5" />
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

        {compact && (
          <FadeIn delay={0.25}>
            <p className="text-center text-sm text-muted mt-8">
              Need to compare plans?{" "}
              <a href="/pricing" className="text-accent hover:underline underline-offset-2">
                See the full feature breakdown →
              </a>
            </p>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
