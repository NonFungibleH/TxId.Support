import { Code2, Settings, Rocket } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const STEPS = [
  {
    icon: Code2,
    number: "01",
    title: "Embed",
    description:
      "Add one script tag to your site. Works with React, Next.js, or plain HTML. Takes under a minute.",
    iconBg: "bg-accent-muted",
    iconColor: "text-accent",
  },
  {
    icon: Settings,
    number: "02",
    title: "Configure",
    description:
      "Set your brand colours, paste your logo URL, and add your docs link. Preview updates in real time before you go live.",
    iconBg: "bg-[rgba(245,158,11,0.12)]",
    iconColor: "text-[var(--yellow)]",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Go Live",
    description:
      "Your users get instant AI support — wallet detection, transaction diagnosis, docs Q&A — all in your brand.",
    iconBg: "bg-[rgba(34,197,94,0.12)]",
    iconColor: "text-[var(--green)]",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">{`// How it works`}</p>
            <h2 className="font-display text-4xl font-bold text-white">
              Live in three steps
            </h2>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.1}>
              <div className="relative bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-accent)] transition-colors group">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step.iconBg}`}>
                    <step.icon className={`w-5 h-5 ${step.iconColor}`} />
                  </div>
                  <span aria-hidden="true" className="font-mono text-3xl font-bold text-white/5 group-hover:text-white/10 transition-colors select-none">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {step.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
