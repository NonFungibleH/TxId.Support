"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, AlertTriangle, RefreshCw, Trash2, Upload, Info, Loader2 } from "lucide-react"
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
  // Tracked separately from isPending so only the button that started the
  // fetch shows a spinner. An Aptos package can take seconds to page through.
  const [checking, setChecking] = useState(false)

  const isSolana = contract.chain === "solana"
  const isAptos = contract.chain === "aptos"
  const label = isSolana ? "IDL" : isAptos ? "Move module ABI" : "ABI"
  const sourceName = isSolana ? "Anchor registry" : isAptos ? "Aptos fullnode" : "block explorer"
  const hasAbi = !!contract.abi
  const source = contract.abiSource

  function handleRefresh() {
    setChecking(true)
    startTransition(async () => {
      try {
        const result = await refreshContractAbi(projectId, contract.id)
        if (result.found) {
          toast.success(`${label} fetched from ${sourceName}`)
        } else if (isAptos) {
          // The fullnode returns the same null for not-found and network
          // failure, so stay honestly ambiguous here.
          toast.error("Could not fetch modules: the address may have no modules published, or the network request failed.")
          setShowPaste(true)
        } else {
          toast.error(`Program not found in registry. Paste the ${label} manually.`)
          setShowPaste(true)
        }
      } catch {
        toast.error(`Failed to check ${sourceName}`)
      } finally {
        setChecking(false)
      }
    })
  }

  function handleSave() {
    if (!abiText.trim()) return
    startTransition(async () => {
      try {
        const res = await saveContractAbi(projectId, contract.id, abiText.trim())
        if (!res.ok) { toast.error(res.reason); return }
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
      <p className="text-xs font-medium text-muted-foreground">
        {isAptos ? "Move module ABI (on-chain)" : `${label} (for transaction diagnostics)`}
      </p>

      {hasAbi ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-500">
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>
              {source === "explorer"
                ? (isSolana ? "Fetched from Anchor registry" : isAptos ? "Fetched from Aptos fullnode" : "Verified on block explorer")
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
              {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              {checking ? "Checking…" : "Re-check"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive hover:text-destructive"
              onClick={handleClear}
              disabled={isPending}
              aria-label={`Remove stored ${label}`}
              title={`Remove stored ${label}`}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Aptos is informational, not a warning: module ABIs are read live
              from the fullnode whether or not a copy is stored here. */}
          <div className={isAptos
            ? "flex items-start gap-2 rounded-md bg-muted/40 border border-border px-3 py-2"
            : "flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2"}
          >
            {isAptos
              ? <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
              : <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />}
            <p className={`text-xs leading-relaxed ${isAptos ? "text-muted-foreground" : "text-amber-400"}`}>
              {isSolana
                ? `No IDL found. Custom program errors won't be decoded. Check the Anchor registry, or paste your IDL JSON below.`
                : isAptos
                ? `No module ABI stored, and nothing is missing: the AI reads Move module ABIs live from the fullnode on every question. Store a copy only if you want it pinned.`
                : `No ABI found. Custom error names won't be decoded, so the AI will see raw hex instead of the error name. Either verify this contract on the block explorer, or paste the ABI below.`}
            </p>
          </div>

          {showPaste ? (
            <div className="space-y-2">
              <Textarea
                placeholder={isSolana
                  ? "Paste your Anchor IDL JSON here"
                  : isAptos
                  ? "Paste your Move module ABI JSON here"
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
                {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                {checking
                  ? "Checking…"
                  : isSolana ? "Check Anchor registry" : isAptos ? "Check Aptos fullnode" : "Check block explorer"}
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
