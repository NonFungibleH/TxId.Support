import type { Metadata } from "next";
import { SolutionLayout } from "@/components/solutions/SolutionLayout";
import { InvestigationMockup } from "@/components/sections/InvestigationMockup";

export const metadata: Metadata = {
  title: "For Issuers & Tokenization Platforms | TxID Support",
  description:
    "Stablecoin issuers, tokenization platforms, neobanks and wallets: your clients inherit on-chain questions the moment assets move on-chain. TxID answers them correctly, and keeps the record.",
  alternates: { canonical: "/solutions/issuers" },
};

export default function IssuersSolutionPage() {
  return (
    <SolutionLayout
      s={{
        badge: "Issuers & tokenization platforms",
        headline: (
          <>
            Assets on-chain means
            <br />
            <span className="text-accent">questions on-chain.</span>
          </>
        ),
        sub: "Stablecoin issuers, tokenization platforms, neobanks and wallet providers inherit client-facing support obligations the moment value moves on-chain. Your clients' users have no chain knowledge at all, and their questions still have to be answered correctly.",
        pains: [
          {
            title: "Mainstream users, on-chain problems",
            detail:
              "\"Where is my money?\" now has an on-chain answer: a pending settlement, a sponsored transaction, an address that rotated. Your support stack can't see any of it.",
          },
          {
            title: "Every tenant multiplies the load",
            detail:
              "Each client you onboard brings their own users, their own assets, and their own stream of questions your team is expected to field.",
          },
          {
            title: "Wrong answers are expensive",
            detail:
              "A client-facing answer about on-chain assets has to be correct, and it has to be defensible after the fact. Guesswork is a liability.",
          },
        ],
        delivers: [
          "White-label support embedded in your product or your tenants' products: one deployment per client",
          "Every answer backed by a live on-chain read with its source; verified fact kept distinct from interpretation",
          "Handles what confuses mainstream users most: settlement timing, sponsored gas, address changes",
          "Every case filed as a reviewable record your operations and compliance teams can rely on",
          "Native on EVM chains and Aptos, where tokenized assets and confidential balances are heading",
        ],
        visual: <InvestigationMockup />,
        visualCaption: "Every answer is an investigation with evidence, not a guess",
      }}
    />
  );
}
