"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { removeContract, updateContractDetails } from "@/lib/actions/contracts"
import type { WatchedContract } from "@/lib/types/config"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import { Trash2, ExternalLink, Pencil, Check, X } from "lucide-react"
import { ErrorGlossaryManager } from "./ErrorGlossaryManager"
import { AbiManager } from "./AbiManager"

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
  showGlossary?: boolean
}

export function ContractList({ projectId, contracts, showGlossary }: ContractListProps) {
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")

  function startEdit(contract: WatchedContract) {
    setEditingId(contract.id)
    setEditName(contract.name)
    setEditDesc(contract.description)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(contractId: string) {
    if (!editName.trim() || !editDesc.trim()) {
      toast.error("Name and description are required")
      return
    }
    startTransition(async () => {
      try {
        await updateContractDetails(projectId, contractId, { name: editName, description: editDesc })
        setEditingId(null)
        toast.success("Contract updated")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update contract")
      }
    })
  }

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
          <div key={contract.id} className="rounded-lg border border-border px-4 py-3">
            <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {editingId === contract.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Contract name"
                      className="h-8 text-sm"
                      maxLength={80}
                    />
                    <Badge variant="secondary" className="text-xs shrink-0">{chainName(contract.chain)}</Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">{contract.address}</p>
                  <Input
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder="What this contract is / when to query it"
                    className="h-8 text-xs"
                    maxLength={500}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{contract.name}</p>
                    <Badge variant="secondary" className="text-xs">{chainName(contract.chain)}</Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">{contract.address}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{contract.description}</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {editingId === contract.id ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => saveEdit(contract.id)} disabled={isPending} className="text-emerald-600 hover:text-emerald-600">
                    <Check className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isPending}>
                    <X className="size-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(contract)} disabled={isPending} title="Edit name & description">
                    <Pencil className="size-3.5" />
                  </Button>
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
                </>
              )}
            </div>
            </div>
            {showGlossary && (
              <>
                <AbiManager projectId={projectId} contract={contract} />
                <ErrorGlossaryManager projectId={projectId} contract={contract} />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
