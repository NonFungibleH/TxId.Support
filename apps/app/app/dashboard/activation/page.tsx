import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { CHAIN_CONFIGS, canonicalChainId } from "@txid/blockchain"
import { ActivationForm } from "@/components/settings/ActivationForm"
import { ActivationResults } from "@/components/dashboard/ActivationResults"
import { loadCohort } from "@/lib/activation/store"
import { summarizeCohort } from "@/lib/activation/cohort"
import type { ProjectConfig } from "@/lib/types/config"
import { ACTIVATION_DEFAULT } from "@/lib/types/config"

/**
 * Activation: the readiness check for new wallets, and whether it works.
 *
 * Setup first, results second, because the results are about the setup. Off
 * by default; a project that never opens this page behaves exactly as before.
 */
export default async function ActivationPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typed = project as unknown as { id: string; config: ProjectConfig }
  const config = typed.config
  const contracts = (config.watchedContracts ?? [])
    .map(c => ({ c, chain: CHAIN_CONFIGS[canonicalChainId(String(c.chain))] }))
    .filter(x => !!x.chain)
    .map(x => ({ id: x.c.id, name: x.c.name, chainName: x.chain!.name }))

  const rows = await loadCohort(typed.id)
  const summary = rows ? summarizeCohort(rows, Date.now()) : null
  const activation = config.activation ?? null

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activation</h1>
        <p className="mt-1 text-muted-foreground">
          Help new wallets get to their first successful action. When one connects, the assistant can offer a short check of what is already in place, what to sort first, and what their wallet is about to ask them. If the first attempt fails, the reason goes to the top.
        </p>
      </div>
      <ActivationForm initial={activation} contracts={contracts} />
      <ActivationResults summary={summary} holdoutPct={activation?.holdoutPct ?? ACTIVATION_DEFAULT.holdoutPct} />
    </div>
  )
}
