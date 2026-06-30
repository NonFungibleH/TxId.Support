import { Code2, Settings, Rocket } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const STEPS = [
  {
    icon: Code2,
    number: "01",
    title: "Embed",
    description:
      "Add one script tag to your site. Works with React, Next.js, or plain HTML. Takes under a minute.",
  },
  {
    icon: Settings,
    number: "02",
    title: "Configure",
    description:
      "Set your brand colours, paste your logo URL, and add your docs link. Preview updates in real time before you go live.",
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
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">{`// How it works`}</p>
            <h2 className="font-display text-4xl font-bold text-white">
              Live in three steps
            </h2>
          </div>
        </FadeIn>

        <div className="relative grid md:grid-cols-3 gap-10 md:gap-6">
          {/* Connector line between steps on desktop */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-5 left-[calc(100%/6)] right-[calc(100%/6)] h-px bg-gradient-to-r from-accent/40 via-accent/20 to-accent/40"
          />

          {STEPS.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.12}>
              <div className="flex flex-col items-center text-center">
                {/* Numbered icon circle */}
                <div className="relative z-10 w-11 h-11 rounded-full bg-accent-muted border border-accent/30 flex items-center justify-center mb-5">
                  <step.icon className="w-5 h-5 text-accent" />
                </div>

                <p className="font-mono text-[10px] text-accent/50 tracking-widest mb-2">
                  {step.number}
                </p>
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
