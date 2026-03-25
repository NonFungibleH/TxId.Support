"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { removeContract } from "@/lib/actions/contracts"
import type { WatchedContract } from "@/lib/types/config"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import { Trash2, ExternalLink } from "lucide-react"

function chainName(id: string) {
  return SUPPORTED_CHAINS.find(c => c.id === id)?.name ?? id
}

function explorerUrl(contract: WatchedContract) {
  const chain = SUPPORTED_CHAINS.find(c => c.id === contract.chain)
  if (!chain) return null
  return `https://${chain.explorer}/address/${contract.address}`
}

interface ContractListProps {
  projectId: string
  contracts: WatchedContract[]
}

export function ContractList({ projectId, contracts }: ContractListProps) {
  const [isPending, startTransition] = useTransition()

  function remove(contractId: string) {
    startTransition(async () => {
      try {
        await removeContract(projectId, contractId)
        toast.success("Contract removed")
      } catch {
        toast.error("Failed to remove contract")
      }
    })
  }

  if (contracts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No contracts added yet. Add one below.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {contracts.map(contract => {
        const url = explorerUrl(contract)
        return (
          <div key={contract.id} className="flex items-start justify-between rounded-lg border border-border px-4 py-3 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm">{contract.name}</p>
                <Badge variant="secondary" className="text-xs">{chainName(contract.chain)}</Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground truncate">{contract.address}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{contract.description}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {url && (
                <Button
                  variant="ghost"
                  size="sm"
                  render={<a href={url} target="_blank" rel="noopener noreferrer" />}
                >
                  <ExternalLink className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(contract.id)}
                disabled={isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
