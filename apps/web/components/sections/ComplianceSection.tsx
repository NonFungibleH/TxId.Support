import { ShieldCheck, ScanSearch, FileCheck2, ScrollText, Ban, BookLock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/ui/FadeIn";

const GROUPS = [
  {
    label: "Safe by design",
    blurb:
      "Structural guarantees. Nothing to configure, and nothing that can go wrong.",
    items: [
      {
        icon: Ban,
        title: "No custody, no advice",
        description:
          "The assistant never touches funds, never asks for keys, and never tells users what to buy. Read-only by design.",
      },
      {
        icon: BookLock,
        title: "Grounded, bounded answers",
        description:
          "Scoped to your protocol and your documentation. It reads real chain state instead of guessing, and declines what it cannot verify.",
      },
      {
        icon: ScrollText,
        title: "Audit-logged support",
        description:
          "Every conversation is stored with a full record of what was asked and answered: a reviewable support trail for your team.",
      },
    ],
  },
  {
    label: "Ask and verify",
    blurb:
      "Users never have to take the bot's word for it. They can ask it to prove things, live on-chain, with the source cited.",
    items: [
      {
        icon: ScanSearch,
        title: "OFAC sanctions screening, on demand",
        description:
          "Ask whether an address or counterparty is flagged and the assistant screens it live against the on-chain Chainalysis sanctions oracle (OFAC SDN list), then cites the source.",
      },
      {
        icon: ShieldCheck,
        title: "Contract verification, on request",
        description:
          "Ask “is this the real contract?” and it confirms source-verified status from the block explorer, including proxy transparency and upgrade history.",
      },
      {
        icon: FileCheck2,
        title: "Audits, cited with sources",
        description:
          "List your audits in the dashboard and the assistant cites them by auditor, with a link to the report, whenever users ask if the protocol is safe.",
      },
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
              Add an AI to your protocol without adding risk
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Read-only by design, and able to prove what it tells your users:
              screened, verified, logged, and never in custody of anything.
            </p>
          </div>
        </FadeIn>

        <div className="space-y-10">
          {GROUPS.map((grp) => (
            <div key={grp.label}>
              <FadeIn>
                <div className="mb-4">
                  <h3 className="font-display text-lg font-semibold text-white">{grp.label}</h3>
                  <p className="text-sm text-muted mt-1 max-w-2xl">{grp.blurb}</p>
                </div>
              </FadeIn>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grp.items.map((item, i) => (
                  <FadeIn key={item.title} delay={(i % 3) * 0.06}>
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-accent)] transition-colors group h-full">
                      <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                        <item.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                      </div>
                      <h4 className="font-display font-semibold text-white text-sm mb-1.5">
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted leading-relaxed">{item.description}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
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
