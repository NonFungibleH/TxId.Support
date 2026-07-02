import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { ContractList } from "@/components/settings/ContractList"
import { AddContractDialog } from "@/components/settings/AddContractDialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_CHAIN_LIMITS, SUPPORTED_CHAINS } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

function chainName(id: string) {
  return SUPPORTED_CHAINS.find(c => c.id === id)?.name ?? id
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
          Add any contract addresses the AI should be able to look up — smart contracts, your token contract, treasury wallets, vesting contracts, and more. The AI uses the name and description to decide when to query each one.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Watched contracts</CardTitle>
            <CardDescription>
              {contracts.length}/20 contracts.
              {activeChains.length > 0 && (
                <span className={atChainLimit ? " text-amber-500" : ""}>
                  {" "}{activeChains.map(chainName).join(", ")}
                  {chainLimit !== -1 && ` (${activeChains.length}/${chainLimit} chain${chainLimit === 1 ? "" : "s"})`}.
                </span>
              )}
            </CardDescription>
          </div>
          <AddContractDialog
            projectId={typedProject.id}
            activeChains={activeChains}
            chainLimit={chainLimit}
          />
        </CardHeader>
        <CardContent>
          <ContractList projectId={typedProject.id} contracts={contracts} showGlossary />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <p className="text-sm font-medium">Error glossary</p>
            <p className="text-sm text-muted-foreground">
              When a user&apos;s transaction fails, the AI decodes the revert reason automatically. Add error
              explanations to each contract so the AI uses your exact wording, not a generic guess.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>The error name (e.g. <code className="font-mono text-xs">SlippageTooHigh</code>) is matched against the decoded revert</li>
              <li>Your explanation replaces any AI-generated guess</li>
              <li>Works for Solidity custom errors, standard revert strings, and panic codes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
