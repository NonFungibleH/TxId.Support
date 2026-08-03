import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

// Three audiences, each a full-width card: positioning on the left, what they
// actually get on the right. Full-width rather than a 3-up grid because the
// lists run to seven items and a third-width column can't carry that.
const SEGMENTS = [
  {
    badge: "DeFi protocols",
    heading: "Turn failed transactions into solved problems",
    subheading: "When users get stuck, TxID understands why.",
    description:
      "TxID analyses wallet activity, reads the transaction state, and explains exactly what happened, with the steps needed to resolve the issue.",
    lists: [
      {
        label: "Your users get:",
        items: [
          "Failed transactions explained with the correct fix",
          "Wallet-specific guidance based on real activity",
          "Answers grounded in your protocol documentation",
          "Seamless escalation when human support is required",
        ],
      },
      {
        label: "Your team gets:",
        items: [
          "Fewer repetitive support tickets",
          "Complete transaction context when escalation happens",
          "A searchable record of every interaction",
        ],
      },
    ],
    href: "/solutions/protocols",
    linkLabel: "For protocols",
    accent: "text-accent",
    dot: "bg-accent",
    hover: "hover:border-accent/50",
  },
  {
    badge: "Token issuers & digital asset platforms",
    heading: "Help holders understand their assets",
    subheading:
      "As assets move on-chain, users need reliable answers about ownership, transfers, participation, and ecosystem activity.",
    description:
      "TxID provides accurate, always-current support across your digital asset lifecycle.",
    lists: [
      {
        label: "Handles:",
        items: [
          "Token information, supply, and distribution",
          "Vesting schedules and unlock events",
          "Staking and reward mechanisms",
          "Trading venues and ecosystem resources",
          "Documentation and community resources",
        ],
      },
    ],
    href: "/solutions/issuers",
    linkLabel: "For issuers",
    accent: "text-[var(--yellow)]",
    dot: "bg-[var(--yellow)]",
    hover: "hover:border-[var(--yellow)]/50",
  },
  {
    badge: "Institutions, issuers & tokenisation platforms",
    heading: "Give clients answers they can verify and defend",
    subheading: "When financial assets move on-chain, every explanation matters.",
    description:
      "TxID combines live blockchain analysis with a complete audit trail, helping institutions answer client questions with confidence and meet operational and compliance requirements.",
    lists: [
      {
        label: "Every interaction includes:",
        items: [
          "Live on-chain evidence behind each response",
          "Clear separation between verified facts and interpretation",
          "Searchable case records for support, product, and compliance",
          "Escalation into existing workflows with full context attached",
        ],
      },
    ],
    href: "/solutions/institutions",
    linkLabel: "For institutions",
    accent: "text-accent",
    dot: "bg-accent",
    hover: "hover:border-accent/50",
  },
];

export function ForWho() {
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="font-mono text-sm text-accent mb-3">{"Who it's for"}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Built for organisations moving value on-chain
            </h2>
            <p className="text-muted max-w-2xl mx-auto">
              From leading DeFi protocols to financial institutions issuing digital assets.
              One intelligent support layer for every on-chain interaction.
            </p>
          </div>
        </FadeIn>

        <div className="space-y-6">
          {SEGMENTS.map((seg, i) => (
            <FadeIn key={seg.badge} delay={i * 0.08}>
              <div
                className={`relative rounded-2xl border p-8 bg-[var(--bg-surface)] border-[var(--border)] transition-colors ${seg.hover}`}
              >
                <div className="grid md:grid-cols-[1.15fr_1fr] gap-8 lg:gap-12">
                  <div>
                    <span
                      className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest mb-5 ${seg.accent}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${seg.dot}`} />
                      {seg.badge}
                    </span>
                    <h3 className="font-display text-2xl font-bold text-white mb-2">{seg.heading}</h3>
                    <p className={`text-sm mb-4 ${seg.accent}`}>{seg.subheading}</p>
                    <p className="text-sm text-muted leading-relaxed">{seg.description}</p>
                    <Link
                      href={seg.href}
                      className={`group mt-6 inline-flex items-center gap-1.5 text-sm font-medium ${seg.accent} hover:underline`}
                    >
                      {seg.linkLabel}
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>

                  <div className="space-y-5">
                    {seg.lists.map(list => (
                      <div key={list.label}>
                        <p className="text-xs font-semibold text-white mb-2.5">{list.label}</p>
                        <ul className="space-y-2.5">
                          {list.items.map(item => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
                              <Check className={`w-4 h-4 shrink-0 mt-0.5 ${seg.accent}`} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
