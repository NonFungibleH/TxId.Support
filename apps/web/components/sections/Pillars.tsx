import Link from "next/link";
import { Search, MessageCircle, Archive, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

// The layer's spine: three pillars, deep, instead of twelve features wide.
// The full capabilities grid lives at /capabilities.
const PILLARS = [
  {
    icon: Search,
    name: "Investigate",
    line: "Understand what happened before responding",
    paras: [
      "TxID analyses the transaction, reads relevant on-chain data, and identifies the cause of failure using your contracts, documentation, and error mappings.",
      "When something cannot be verified, TxID says so. It never invents an answer.",
    ],
    href: "/how-it-works",
    linkLabel: "See the flow",
  },
  {
    icon: MessageCircle,
    name: "Resolve",
    line: "Help users where they already are",
    paras: [
      "TxID delivers support inside your product, Telegram, or through your API. It can open the moment a user hits an error, so help arrives right when something breaks instead of waiting to be found.",
      "Most issues are resolved instantly. When human support is required, your team receives the full context instead of another unanswered ticket.",
    ],
    href: "/api",
    linkLabel: "The three surfaces",
  },
  {
    icon: Archive,
    name: "Record",
    line: "Create a complete case history automatically",
    paras: [
      "Every interaction is captured with its evidence, analysis, and outcome.",
      "Support teams understand recurring issues. Product teams identify opportunities. Compliance teams have a searchable record they can rely on.",
    ],
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
            <p className="font-mono text-sm text-accent mb-3">The intelligence layer</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Investigate. Resolve. Record.
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Everything TxID does comes down to three things.
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
                <div className="space-y-3 flex-1">
                  {p.paras.map(para => (
                    <p key={para} className="text-sm text-muted leading-relaxed">{para}</p>
                  ))}
                </div>
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
