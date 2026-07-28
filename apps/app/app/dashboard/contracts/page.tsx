import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { ContractList } from "@/components/settings/ContractList"
import { AddContractDialog } from "@/components/settings/AddContractDialog"
import { AuditsManager } from "@/components/settings/AuditsManager"
import { TokenForm } from "@/components/settings/TokenForm"
import { CollapsibleCard } from "@/components/settings/CollapsibleCard"
import { Card, CardContent } from "@/components/ui/card"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_CHAIN_LIMITS, SUPPORTED_CHAINS } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

function chainName(id: string) {
  return SUPPORTED_CHAINS.find(c => c.id === id)?.name ?? id
}

function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

export default async function ContractsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig
  const contracts = config.watchedContracts ?? []
  const plan = (config.plan ?? "free") as Plan

  // Derive active chains from contracts + token (chains are not manually configured)
  const activeChains = [...new Set([
    ...contracts.map(c => c.chain as string),
    ...(config.token?.chain ? [config.token.chain as string] : []),
  ])]

  const chainLimitRaw = PLAN_CHAIN_LIMITS[plan]
  const chainLimit = chainLimitRaw === Infinity ? -1 : chainLimitRaw
  const atChainLimit = chainLimit !== -1 && activeChains.length >= chainLimit

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Smart Contracts</h1>
        <p className="text-muted-foreground mt-1">
          Your protocol&apos;s own token has its own section below. Add any other contract addresses the AI should be able to look up: treasury wallets, vesting, staking, and more. The AI uses the name and description to decide when to query each one.
        </p>
      </div>

      <CollapsibleCard
        title="Token contract"
        description="Your protocol's own token. Powers live price, the buy link, and token questions in the widget. Kept separate from the watched contracts below."
        summary={
          config.token?.address
            ? <>Set: <span className="font-mono">{shortAddr(config.token.address)}</span>{config.token.chain ? ` · ${chainName(config.token.chain)}` : ""}</>
            : "Not configured yet (optional)."
        }
        defaultOpen={false}
      >
        <TokenForm projectId={typedProject.id} initial={config.token} />
      </CollapsibleCard>

      <CollapsibleCard
        title="Watched contracts"
        description={
          <>
            {contracts.length}/20 contracts.
            {activeChains.length > 0 && (
              <span className={atChainLimit ? " text-amber-500" : ""}>
                {" "}{activeChains.map(chainName).join(", ")}
                {chainLimit !== -1 && ` (${activeChains.length}/${chainLimit} chain${chainLimit === 1 ? "" : "s"})`}.
              </span>
            )}
          </>
        }
        action={
          <AddContractDialog
            projectId={typedProject.id}
            activeChains={activeChains}
            chainLimit={chainLimit}
          />
        }
        defaultOpen
      >
        <ContractList projectId={typedProject.id} contracts={contracts} showGlossary />
      </CollapsibleCard>

      <Card>
        <CardContent>
          <AuditsManager projectId={typedProject.id} audits={config.audits ?? []} />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm font-medium">Error glossary</p>
            <p className="text-sm text-muted-foreground">
              When a user&apos;s transaction fails, the AI decodes the failure reason automatically. Add error
              explanations per contract so the AI uses your exact wording, not a generic guess. Set these up on each
              contract in the Watched contracts section above.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Matched by error name, e.g. <code className="font-mono text-xs">SlippageTooHigh</code> on EVM chains, or a Move abort like <code className="font-mono text-xs">EINVALID_TP_SL_ORDER_ID</code> on Aptos</li>
              <li>Your explanation replaces any AI-generated guess</li>
              <li>Works across chains: Solidity custom errors, revert strings and panic codes, and Aptos Move abort codes</li>
              <li>Known protocols such as Decibel are already covered automatically, no setup needed</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
