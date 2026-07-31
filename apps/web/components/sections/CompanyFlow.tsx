import { MessageCircle, Search, CheckCircle2, Users, Archive, ArrowRight } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/ui/FadeIn";

// The whole company's view of one investigation, in one strip: how the same
// case serves the user, the support team, and compliance. The full animated
// journey lives at /how-it-works.
const STAGES = [
  {
    icon: MessageCircle,
    who: "Your user",
    title: "Asks anywhere",
    detail: "In the widget on your site, or your Telegram group. Pastes a hash or connects a wallet.",
  },
  {
    icon: Search,
    who: "TxID",
    title: "Investigates live",
    detail: "Reads the chain, decodes the error against your contracts, verifies what actually happened.",
  },
  {
    icon: CheckCircle2,
    who: "Your user",
    title: "Gets unblocked",
    detail: "A plain-English answer with the fix. Most questions end here, resolved in seconds.",
  },
  {
    icon: Users,
    who: "Your team",
    title: "Sees only what matters",
    detail: "Unresolved cases reach Slack or your tracker with the completed investigation attached.",
  },
  {
    icon: Archive,
    who: "Compliance & product",
    title: "Keep the record",
    detail: "Every case stored and searchable: what was asked, checked, answered, and resolved.",
  },
];

export function CompanyFlow() {
  return (
    <section className="py-16 border-t border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="font-mono text-sm text-accent mb-3">The flow</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              One investigation, used by the whole company
            </h2>
            <p className="text-muted max-w-2xl mx-auto">
              From the user&apos;s question to the compliance record, every step comes from the same case.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-5 gap-3">
          {STAGES.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.08}>
              <div className="relative h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 hover:border-accent/40 transition-colors">
                <span className="absolute -top-2.5 left-5 rounded-full bg-[#0b0c14] border border-[var(--border)] px-2 py-0.5 text-[10px] font-mono text-muted/70">
                  {s.who}
                </span>
                <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3 mt-1">
                  <s.icon className="w-4.5 h-4.5 text-accent" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{s.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{s.detail}</p>
                {i < STAGES.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-2.5 w-4 h-4 text-muted/40 z-10" />
                )}
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.3}>
          <div className="text-center mt-8">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              See the full journey, stage by stage
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
