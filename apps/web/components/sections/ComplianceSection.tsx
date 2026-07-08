import { ShieldCheck, ScanSearch, FileCheck2, ScrollText, Ban, BookLock } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const ITEMS = [
  {
    icon: ScanSearch,
    title: "OFAC sanctions screening",
    description:
      "Any address, screened in real time against the on-chain Chainalysis sanctions oracle. Users get a clear warning before they interact with a flagged counterparty.",
  },
  {
    icon: FileCheck2,
    title: "Audits, cited with sources",
    description:
      "List your audits in the dashboard and the assistant cites them by auditor, with a link to the report, whenever users ask if the protocol is safe.",
  },
  {
    icon: ShieldCheck,
    title: "Contract verification",
    description:
      "Confirms users are interacting with your real, source-verified contracts, including proxy transparency and upgrade history.",
  },
  {
    icon: ScrollText,
    title: "Audit-logged support",
    description:
      "Every conversation is stored with a full record of what was asked and answered: a reviewable support trail for your team.",
  },
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
];

export function ComplianceSection() {
  return (
    <section id="compliance" className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">{`Compliance`}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Built for protocols that take trust seriously
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Support that holds up to scrutiny: screened, verified, logged, and
              never in custody of anything.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ITEMS.map((item, i) => (
            <FadeIn key={item.title} delay={(i % 3) * 0.06}>
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-accent)] transition-colors group h-full">
                <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <item.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                </div>
                <h3 className="font-display font-semibold text-white text-sm mb-1.5">
                  {item.title}
                </h3>
                <p className="text-xs text-muted leading-relaxed">{item.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
