import type { Metadata } from "next";
import { SolutionLayout } from "@/components/solutions/SolutionLayout";
import { Archive } from "lucide-react";

export const metadata: Metadata = {
  title: "For Institutions: Defensible On-Chain Answers | TxID Support",
  description:
    "Institutional operations and compliance teams: answer clients about on-chain assets correctly and defensibly, with every case recorded as an auditable trail of evidence, reasoning, and resolution.",
  alternates: { canonical: "/solutions/institutions" },
};

function RecordVisual() {
  return (
    <div className="max-w-md mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[#10101d]">
        <Archive className="w-3.5 h-3.5 text-accent" />
        <p className="text-xs font-semibold text-white">Case record</p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {[
          ["#4822", "Stuck withdrawal · timelock", "Escalated", "text-amber-400"],
          ["#4821", "Failed swap · slippage", "Resolved", "text-emerald-400"],
          ["#4820", "Wrong network · bridge", "Resolved", "text-emerald-400"],
          ["#4819", "Approval question", "Resolved", "text-emerald-400"],
        ].map(([id, label, status, color]) => (
          <div key={id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-[10px] font-mono text-muted/60">{id}</span>
            <span className="text-xs text-[#c8c8d8] flex-1 truncate">{label}</span>
            <span className={`text-[10px] font-mono ${color}`}>{status}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[#10101d]">
        <p className="text-[10px] font-mono text-muted/60">
          Searchable · exportable · every answer traceable to its evidence
        </p>
      </div>
    </div>
  );
}

export default function InstitutionsSolutionPage() {
  return (
    <SolutionLayout
      s={{
        badge: "Institutions",
        headline: (
          <>
            Answer clients correctly,
            <br />
            <span className="text-accent">and defensibly.</span>
          </>
        ),
        sub: "When an institution's clients hold on-chain assets, operations and compliance teams must answer questions about them without in-house chain expertise, and stand behind every answer afterwards.",
        pains: [
          {
            title: "Client questions, chain answers",
            detail:
              "Settlement status, asset movements, failed transactions: the correct answer lives on-chain, where your client-service tooling can't reach.",
          },
          {
            title: "Expertise doesn't scale",
            detail:
              "The few people who can read a chain become the bottleneck for every client query, at any hour, in any market condition.",
          },
          {
            title: "Answers must be evidenced",
            detail:
              "What was the client told, on what basis, and was it correct? Without a record, every answer is an unmanaged risk.",
          },
        ],
        delivers: [
          "Every claim comes from a live chain read, with the source cited",
          "Each case is filed with its evidence and resolution, ready for review",
          "OFAC sanctions screening and contract verification on request, against the on-chain oracle",
          "Escalations reach your existing tools with the work already done",
          "Read-only. No custody, no keys, no advice.",
        ],
        visual: <RecordVisual />,
        visualCaption: "The record: what compliance actually buys",
        ctaPrimary: { label: "See the case record", href: "/record" },
      }}
    />
  );
}
