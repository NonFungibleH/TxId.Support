import type { Metadata } from "next";
import { SolutionLayout } from "@/components/solutions/SolutionLayout";
import { WidgetMockup } from "@/components/sections/WidgetMockup";

export const metadata: Metadata = {
  title: "For Protocols: Support That Reads Your Chain | TxID Support",
  description:
    "DeFi and trading protocols: give every user an expert answer backed by a live on-chain investigation, in your product and your Telegram, with escalations your engineers don't dread.",
  alternates: { canonical: "/solutions/protocols" },
};

export default function ProtocolsSolutionPage() {
  return (
    <SolutionLayout
      s={{
        badge: "Protocols",
        headline: (
          <>
            Your users&apos; questions,
            <br />
            <span className="text-accent">answered like an engineer would.</span>
          </>
        ),
        sub: "Failed swaps, stuck orders, wrong networks: every on-chain product generates questions only someone who can read the chain can answer. TxID answers them in your product and your community, around the clock.",
        pains: [
          {
            title: "Questions overspill to specialists",
            detail:
              "Most users and most support staff can't read a transaction. The same issues repeat across Discord, Telegram and tickets until an engineer steps in.",
          },
          {
            title: "Every answer is an investigation",
            detail:
              "Knowing where to look, reading the transaction, checking balances and approvals, sometimes tracing across other protocols. That expertise doesn't scale.",
          },
          {
            title: "Users give up before you reply",
            detail:
              "By the time a human answers a 2am question, the user has already abandoned the transaction, or the protocol.",
          },
        ],
        delivers: [
          "A user with a failed swap at 2am has the diagnosis and the fix thirty seconds later",
          "Answers grounded in your docs, your contracts, and your own error maps",
          "Escalations land in Slack or your tracker with the work already done, so engineers stop re-checking what was already checked",
          "Support history becomes a record of what users actually struggle with",
          "Live on 9 chains, including Move-native Aptos, and it understands subaccounts and delegated session keys",
        ],
        visual: <WidgetMockup className="relative" />,
        visualCaption: "The embedded surface: your brand, your docs, live chain reads",
      }}
    />
  );
}
