import {
  ShieldCheck, ScanSearch, FileCheck2, ScrollText, Ban, BookLock, Eye, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { FadeIn } from "@/components/ui/FadeIn";

// One flat set of seven. The old two-group split used "Safe by design" as a
// group label; it now reads better as a card in its own right.
const ITEMS = [
  {
    icon: Ban,
    title: "Safe by design",
    tagline: "Built with clear boundaries",
    paras: [
      "TxID cannot move funds, access private keys, or take actions on behalf of users.",
      "No custody. No transactions. No financial advice.",
    ],
  },
  {
    icon: BookLock,
    title: "Grounded, verified answers",
    tagline: "No guessing. No hallucinations.",
    paras: [
      "TxID combines your documentation with live on-chain data to understand what happened.",
      "If something cannot be verified, it says so.",
    ],
  },
  {
    icon: ScrollText,
    title: "Complete audit trail",
    tagline: "Every interaction becomes a case record",
    paras: [
      "Every conversation is logged with the question, evidence, response, and outcome.",
      "Support teams can review cases. Product teams can identify trends. Compliance teams have a searchable record.",
    ],
  },
  {
    icon: Eye,
    title: "Verify everything",
    tagline: "Let users validate the answer themselves",
    paras: [
      "TxID can provide supporting evidence behind its responses, including live blockchain data and referenced sources.",
    ],
  },
  {
    icon: ScanSearch,
    title: "Compliance checks",
    tagline: "Screen addresses when needed",
    paras: [
      "On supported EVM networks, TxID can check whether addresses are flagged against sanctions data sources and provide the relevant reference.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Contract verification",
    tagline: "Confirm users are interacting with the right contracts",
    paras: [
      "TxID can verify source-verified contracts, proxy configurations, and upgrade history through blockchain explorers.",
      "On Aptos, it reads published modules and available on-chain metadata.",
    ],
  },
  {
    icon: FileCheck2,
    title: "Audit transparency",
    tagline: "Make security information accessible",
    paras: [
      "Add your protocol audits to TxID and let users retrieve auditor information and supporting reports when they ask about security.",
    ],
  },
];

export function ComplianceSection() {
  return (
    <section id="compliance" className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="font-mono text-sm text-accent mb-3">{`Trust & compliance`}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Add intelligent support without adding risk
            </h2>
            <p className="text-muted max-w-2xl mx-auto">
              TxID is designed to operate safely alongside your protocol.
              Read-only by design, grounded in verified data, and fully auditable.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* A 7th card orphans hard-left on the last row of a 3-up grid; centre it. */}
          {ITEMS.map((item, i) => (
            <FadeIn
              key={item.title}
              delay={(i % 3) * 0.06}
              className={clsx(i === ITEMS.length - 1 && ITEMS.length % 3 === 1 && "lg:col-start-2")}
            >
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-accent)] transition-colors group h-full">
                <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <item.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                </div>
                <h3 className="font-display font-semibold text-white text-sm mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-accent mb-2">{item.tagline}</p>
                <div className="space-y-2">
                  {item.paras.map(p => (
                    <p key={p} className="text-xs text-muted leading-relaxed">{p}</p>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <div className="text-center mt-10">
            <Link
              href="/security"
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:gap-2.5 transition-all"
            >
              Read the full security &amp; trust overview
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
