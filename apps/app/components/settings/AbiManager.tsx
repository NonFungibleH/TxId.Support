"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, AlertTriangle, RefreshCw, Trash2, Upload } from "lucide-react"
import { refreshContractAbi, saveContractAbi, clearContractAbi } from "@/lib/actions/contracts"
import type { WatchedContract } from "@/lib/types/config"

interface Props {
  projectId: string
  contract: WatchedContract
}

export function AbiManager({ projectId, contract }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showPaste, setShowPaste] = useState(false)
  const [abiText, setAbiText] = useState("")

  const isSolana = contract.chain === "solana"
  const label = isSolana ? "IDL" : "ABI"
  const hasAbi = !!contract.abi
  const source = contract.abiSource

  function handleRefresh() {
    startTransition(async () => {
      try {
        const result = await refreshContractAbi(projectId, contract.id)
        if (result.found) {
          toast.success(`${label} fetched from ${isSolana ? "Anchor registry" : "block explorer"}`)
        } else {
          toast.error(`Program not found in registry. Paste the ${label} manually.`)
          setShowPaste(true)
        }
      } catch {
        toast.error(`Failed to check ${isSolana ? "Anchor registry" : "block explorer"}`)
      }
    })
  }

  function handleSave() {
    if (!abiText.trim()) return
    startTransition(async () => {
      try {
        await saveContractAbi(projectId, contract.id, abiText.trim())
        toast.success(`${label} saved`)
        setShowPaste(false)
        setAbiText("")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to save ${label}`)
      }
    })
  }

  function handleClear() {
    startTransition(async () => {
      try {
        await clearContractAbi(projectId, contract.id)
        toast.success(`${label} removed`)
      } catch {
        toast.error(`Failed to remove ${label}`)
      }
    })
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label} (for transaction diagnostics)</p>

      {hasAbi ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-500">
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>
              {source === "explorer"
                ? (isSolana ? "Fetched from Anchor registry" : "Verified on block explorer")
                : `${label} uploaded manually`}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 text-muted-foreground"
              onClick={handleRefresh}
              disabled={isPending}
            >
              <RefreshCw className="size-3" />
              Re-check
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive hover:text-destructive"
              onClick={handleClear}
              disabled={isPending}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400 leading-relaxed">
              {isSolana
                ? `No IDL found. Custom program errors won't be decoded. Check the Anchor registry, or paste your IDL JSON below.`
                : `No ABI found. Custom error names won't be decoded — the AI will see raw hex instead of the error name. Either verify this contract on the block explorer, or paste the ABI below.`}
            </p>
          </div>

          {showPaste ? (
            <div className="space-y-2">
              <Textarea
                placeholder={isSolana
                  ? "Paste your Anchor IDL JSON here"
                  : 'Paste your ABI JSON array here, e.g. [{"type":"error","name":"SlippageTooHigh",...}]'}
                value={abiText}
                onChange={(e) => setAbiText(e.target.value)}
                className="text-xs font-mono min-h-[100px] resize-y"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleSave}
                  disabled={isPending || !abiText.trim()}
                >
                  <Upload className="size-3" />
                  Save {label}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setShowPaste(false); setAbiText("") }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleRefresh}
                disabled={isPending}
              >
                <RefreshCw className="size-3" />
                {isSolana ? "Check Anchor registry" : "Check block explorer"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setShowPaste(true)}
              >
                <Upload className="size-3" />
                Paste {label}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
