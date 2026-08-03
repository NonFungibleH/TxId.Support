import { Settings, Code2, Rocket, Check } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const STEPS = [
  {
    icon: Settings,
    number: "01",
    title: "Configure",
    tagline: "Make TxID your own",
    description:
      "Add your brand identity, documentation, and protocol knowledge. Preview the experience in real time before launch.",
    bullets: [
      "Custom branding and appearance",
      "Documentation and knowledge sources",
      "Protocol-specific configuration",
    ],
  },
  {
    icon: Code2,
    number: "02",
    title: "Embed",
    tagline: "Add support directly into your product",
    description:
      "Deploy TxID with a single script. Works with your existing stack, including React, Next.js, or standard HTML.",
    note: "Live in minutes. No infrastructure changes required.",
    bullets: [],
  },
  {
    icon: Rocket,
    number: "03",
    title: "Go live",
    tagline: "Your users get intelligent on-chain support",
    description:
      "TxID instantly helps users understand transactions, diagnose issues, and find answers, all within your branded experience.",
    bullets: [
      "Wallet-aware support",
      "Transaction diagnosis",
      "Documentation-based answers",
      "Seamless escalation when needed",
    ],
  },
];

export function HowItWorks() {
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">{`How it works`}</p>
            <h2 className="font-display text-4xl font-bold text-white">
              Live in three simple steps
            </h2>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.1}>
              <div className="relative flex h-full flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-accent)] transition-colors group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent-muted">
                    <step.icon className="w-5 h-5 text-accent" />
                  </div>
                  <span aria-hidden="true" className="font-mono text-3xl font-bold text-white/5 group-hover:text-white/10 transition-colors select-none">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-white mb-1">
                  {step.title}
                </h3>
                <p className="text-sm text-accent mb-3">{step.tagline}</p>
                <p className="text-sm text-muted leading-relaxed">
                  {step.description}
                </p>
                {step.note && (
                  <p className="text-sm text-muted leading-relaxed mt-3">{step.note}</p>
                )}
                {step.bullets.length > 0 && (
                  <ul className="space-y-2 mt-5">
                    {step.bullets.map(b => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-muted">
                        <Check className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
