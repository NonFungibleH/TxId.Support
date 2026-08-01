import Link from "next/link";
import { Search, MessageCircle, Archive, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

// The layer's spine: three pillars, deep, instead of twelve features wide.
// The full capabilities grid lives at /capabilities.
const PILLARS = [
  {
    icon: Search,
    name: "Investigate",
    line: "Every question worked like a protocol engineer would",
    detail:
      "Live chain reads, transactions replayed, errors decoded against your contracts and error maps. Every claim has a source, and verified fact is kept distinct from interpretation.",
    href: "/how-it-works",
    linkLabel: "See the flow",
  },
  {
    icon: MessageCircle,
    name: "Resolve",
    line: "Plain-English answers where your users already are",
    detail:
      "Embedded in your product, inside your Telegram groups, or through the API. Most questions end resolved in seconds; the rest reach your team with the investigation attached.",
    href: "/api",
    linkLabel: "The three surfaces",
  },
  {
    icon: Archive,
    name: "Record",
    line: "A defensible case file behind every answer",
    detail:
      "The question, the evidence, the reasoning, and the resolution, filed automatically. Support learns, product prioritises, and compliance can stand behind what was said.",
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
            <Link href="/capabilities" className="text-accent hover:underline">
              Every capability, in one place →
            </Link>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
