import { Code2, Settings, Rocket } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const STEPS = [
  {
    icon: Code2,
    number: "01",
    title: "Embed",
    description:
      "Add one script tag to your site. Works with React, Next.js, or plain HTML. Takes under a minute.",
    code: `<script src="https://txid.support/widget.js"\n  data-key="YOUR_KEY"></script>`,
  },
  {
    icon: Settings,
    number: "02",
    title: "Configure",
    description:
      "Set your brand colours, upload your logo, paste your docs URL. Live preview updates in real time.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Go Live",
    description:
      "Your users get instant AI support — wallet detection, transaction diagnosis, docs Q&A — all in your brand.",
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
                  <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-accent" />
                  </div>
                  <span className="font-mono text-3xl font-bold text-white/5 group-hover:text-white/10 transition-colors select-none">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {step.description}
                </p>
                {step.code && (
                  <pre className="mt-4 bg-[var(--bg-elevated)] rounded-lg px-3 py-2 text-xs font-mono text-accent/80 overflow-x-auto border border-[var(--border)]">
                    {step.code}
                  </pre>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
