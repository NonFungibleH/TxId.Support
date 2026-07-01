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
        <h1 className="text-2xl font-bold">Add Contract Addresses</h1>
        <p className="text-muted-foreground mt-1">
          Add any contract addresses the AI should be able to look up — smart contracts, your token contract, treasury wallets, vesting contracts, and more. The AI uses the name and description to decide when to query each one.
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
              <li>A user asks about their token lock status</li>
              <li>The AI matches the question to your contract using its name and description</li>
              <li>The AI calls the contract on-chain with the user&apos;s wallet address</li>
              <li>The result is returned to the user in plain English</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
