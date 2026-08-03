import Link from "next/link";
import { Search, MessageCircle, Archive, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

// The layer's spine: three pillars, deep, instead of twelve features wide.
// The full capabilities grid lives at /capabilities.
const PILLARS = [
  {
    icon: Search,
    name: "Investigate",
    line: "It reads the chain before it answers",
    detail:
      "TxID pulls the transaction, replays it, and decodes the failure using your contracts and error maps. If it can't verify something, it says so instead of guessing.",
    href: "/how-it-works",
    linkLabel: "See the flow",
  },
  {
    icon: MessageCircle,
    name: "Resolve",
    line: "Answers where your users already are",
    detail:
      "In your product, in your Telegram groups, or through the API. Most questions get resolved in seconds. The rest go to your team with the work already done.",
    href: "/api",
    linkLabel: "The three surfaces",
  },
  {
    icon: Archive,
    name: "Record",
    line: "It keeps the case file",
    detail:
      "Every question is filed with its evidence and its outcome, automatically. Support learns from it, product prioritizes with it, and compliance can point to it.",
    href: "/record",
    linkLabel: "The Case Record",
  },
];

export function Pillars() {
  return (
    <section className="py-16 border-t border-[var(--border)]" id="features">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="font-mono text-sm text-accent mb-3">The layer</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Investigate. Resolve. Record.
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Everything TxID does comes down to these three.
            </p>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-4">
          {PILLARS.map((p, i) => (
            <FadeIn key={p.name} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-7 hover:border-accent/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-accent-muted flex items-center justify-center mb-5">
                  <p.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display text-2xl font-bold text-white mb-1">{p.name}</h3>
                <p className="text-sm text-accent mb-3">{p.line}</p>
                <p className="text-sm text-muted leading-relaxed flex-1">{p.detail}</p>
                <Link
                  href={p.href}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  {p.linkLabel}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.2}>
          <p className="text-center mt-8 text-sm text-muted">
            Want the full list?{" "}
            <Link href="/features" className="text-accent hover:underline">
              See all features →
            </Link>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
