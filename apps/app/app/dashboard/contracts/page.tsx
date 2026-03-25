import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { ContractList } from "@/components/settings/ContractList"
import { AddContractDialog } from "@/components/settings/AddContractDialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function ContractsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig
  const contracts = config.watchedContracts ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Smart Contracts</h1>
        <p className="text-muted-foreground mt-1">
          Add your protocol&apos;s smart contracts so the AI can look them up when users ask about lock status, vesting, staking, and more.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Watched contracts</CardTitle>
            <CardDescription>
              {contracts.length}/20 contracts added. The AI uses the contract description to know when to query it.
            </CardDescription>
          </div>
          <AddContractDialog projectId={typedProject.id} />
        </CardHeader>
        <CardContent>
          <ContractList projectId={typedProject.id} contracts={contracts} />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">How it works</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>A user asks: <em>&quot;Is my TEAM token locked?&quot;</em></li>
              <li>The AI sees your &quot;Token Lock Contract&quot; and its description</li>
              <li>The AI queries the contract on-chain with the user&apos;s wallet address</li>
              <li>The user gets a real answer in plain English</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
