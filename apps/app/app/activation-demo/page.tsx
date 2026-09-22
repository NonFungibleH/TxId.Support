import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { buildChecklist, type ChecklistInput } from "@/lib/activation/readiness"
import type { ReadinessResponse } from "@/app/widget/useActivation"
import { ActivationDemoGrid } from "./ActivationDemoGrid"

export const metadata: Metadata = { title: "Activation demo | TxID", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/**
 * Fixtures-only review of the readiness check, for a branch preview.
 *
 * EVERY CHECKLIST HERE IS BUILT BY THE REAL BUILDER from fixture wallet
 * facts, so the words on this page are exactly the words a user would read.
 * Only the chain reads are replaced. 404s in production, like /console-demo.
 */

const ok = <T,>(value: T) => ({ kind: "ok" as const, value })

const AVAX = { id: "0xa86a", name: "Avalanche", nativeSymbol: "AVAX", evm: true }
const BASE = { id: "0x2105", name: "Base", nativeSymbol: "ETH", evm: true }
const PROJECT = "Lumen Finance"

function state(input: Omit<ChecklistInput, "projectName">, extra: Partial<ReadinessResponse> = {}): ReadinessResponse {
  return {
    arm: "shown",
    state: "new",
    action: input.action,
    checklist: buildChecklist({ projectName: PROJECT, ...input }),
    guideUrl: "https://example.com/getting-started",
    ...extra,
  }
}

export default function ActivationDemoPage() {
  if (process.env.VERCEL_ENV === "production") notFound()

  const scenarios: { title: string; note: string; readiness: ReadinessResponse }[] = [
    {
      title: "New wallet, wrong network, token elsewhere",
      note: "A lending deposit in USDC. Wallet on Ethereum, USDC sitting on Arbitrum.",
      readiness: state({
        action: "deposit",
        spends: { kind: "tokens", tokens: [{ address: "0x0", symbol: "USDC" }] },
        actionChain: AVAX,
        facts: {
          walletChain: { id: "0x1", name: "Ethereum" },
          gas: ok({ hasAny: true, coversOneTx: true }),
          asset: ok({ held: [], wanted: ["USDC"], elsewhere: [{ symbol: "USDC", chainName: "Arbitrum" }] }),
          approvals: null,
          failure: null,
        },
      }),
    },
    {
      title: "Ready, with the approve step flagged",
      note: "Holds USDC on the right chain; no allowance yet, so the wallet will ask first.",
      readiness: state({
        action: "deposit",
        spends: { kind: "tokens", tokens: [{ address: "0x0", symbol: "USDC" }] },
        actionChain: AVAX,
        facts: {
          walletChain: { id: "0xa86a", name: "Avalanche" },
          gas: ok({ hasAny: true, coversOneTx: true }),
          asset: ok({ held: ["USDC"], wanted: ["USDC"], elsewhere: [] }),
          approvals: ok([{ symbol: "USDC", approved: false }]),
          failure: null,
        },
      }),
    },
    {
      title: "First attempt failed",
      note: "A swap that ran out of gas four minutes ago. The failure goes to the top.",
      readiness: state({
        action: "swap",
        spends: { kind: "any" },
        actionChain: BASE,
        facts: {
          walletChain: { id: "0x2105", name: "Base" },
          gas: ok({ hasAny: true, coversOneTx: true }),
          asset: null,
          approvals: null,
          failure: {
            source: "history",
            when: "4 minutes ago",
            reason: "It ran out of gas. The gas limit set for it was too low for what it needed to do, which is a wallet setting, not your balance.",
          },
        },
      }),
    },
    {
      title: "A read did not come back",
      note: "Staking the native coin. The balance lookup failed, so it says so rather than calling the wallet empty.",
      readiness: state({
        action: "stake",
        spends: { kind: "native" },
        actionChain: AVAX,
        facts: {
          walletChain: { id: "0xa86a", name: "Avalanche" },
          gas: { kind: "unavailable" },
          asset: null,
          approvals: null,
          failure: null,
        },
      }),
    },
    {
      title: "No gas on the chain",
      note: "Staking the native coin with none in the wallet.",
      readiness: state({
        action: "stake",
        spends: { kind: "native" },
        actionChain: AVAX,
        facts: {
          walletChain: { id: "0xa86a", name: "Avalanche" },
          gas: ok({ hasAny: false, coversOneTx: false }),
          asset: null,
          approvals: null,
          failure: null,
        },
      }),
    },
    {
      title: "First action went through",
      note: "What the panel shows once the first success is seen on chain.",
      readiness: { arm: "shown", state: "activated", action: "deposit" },
    },
  ]

  return <ActivationDemoGrid projectName={PROJECT} scenarios={scenarios} />
}
