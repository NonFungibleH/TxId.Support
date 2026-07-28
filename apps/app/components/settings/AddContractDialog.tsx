"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { addContract, peekContractFunctions, peekAptosModules, type AptosModulePeek } from "@/lib/actions/contracts"
import { SUPPORTED_CHAINS, SELECTABLE_CHAINS } from "@/lib/types/config"
import { Plus, AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const APTOS_ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/
// Sentinel for the module Select: empty string means "all modules" but the
// Select needs a non-empty value to render a selection.
const ALL_MODULES = "__all__"

interface AddContractDialogProps {
  projectId: string
  activeChains: string[]
  chainLimit: number  // -1 = unlimited
}

export function AddContractDialog({ projectId, activeChains, chainLimit }: AddContractDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [chain, setChain] = useState("0x1")
  const [description, setDescription] = useState("")
  const [detectedFns, setDetectedFns] = useState<string[] | null>(null)
  const [detectingFns, setDetectingFns] = useState(false)
  const [aptosModules, setAptosModules] = useState<AptosModulePeek[] | null>(null)
  const [aptosPeekError, setAptosPeekError] = useState<string | null>(null)
  const [moduleName, setModuleName] = useState("")
  const peekTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAptos = chain === "aptos"
  const addressRe = isAptos ? APTOS_ADDRESS_RE : EVM_ADDRESS_RE
  const isNewChain = !activeChains.includes(chain)
  const atChainLimit = chainLimit !== -1 && isNewChain && activeChains.length >= chainLimit

  // Fetch function names (EVM: block explorer) or the module list (Aptos:
  // fullnode) whenever address + chain look valid
  useEffect(() => {
    const aptos = chain === "aptos"
    setDetectedFns(null); setAptosModules(null); setAptosPeekError(null); setModuleName("")
    const isValidAddress = (aptos ? APTOS_ADDRESS_RE : EVM_ADDRESS_RE).test(address.trim())
    if (!isValidAddress) return

    if (peekTimeout.current) clearTimeout(peekTimeout.current)
    peekTimeout.current = setTimeout(() => {
      setDetectingFns(true)
      if (aptos) {
        peekAptosModules(address.trim())
          .then(res => {
            if ("modules" in res) setAptosModules(res.modules)
            else setAptosPeekError(res.error)
          })
          .catch(() => setAptosModules(null))
          .finally(() => setDetectingFns(false))
      } else {
        peekContractFunctions(address.trim(), chain)
          .then(fns => setDetectedFns(fns))
          .catch(() => setDetectedFns(null))
          .finally(() => setDetectingFns(false))
      }
    }, 600)

    return () => { if (peekTimeout.current) clearTimeout(peekTimeout.current) }
  }, [address, chain])

  function reset() {
    setName(""); setAddress(""); setChain("0x1"); setDescription("")
    setDetectedFns(null); setDetectingFns(false)
    setAptosModules(null); setAptosPeekError(null); setModuleName("")
  }

  function submit() {
    startTransition(async () => {
      try {
        await addContract(projectId, {
          name, address, chain, description,
          ...(isAptos && moduleName ? { moduleName } : {}),
        })
        toast.success("Contract added")
        reset()
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add contract")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm">
          <Plus className="size-4 mr-1" />
          Add contract
        </Button>
      } />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add smart contract</DialogTitle>
          <DialogDescription>
            The AI will query this contract when users ask related questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="contract-name">Name</Label>
            <Input id="contract-name" placeholder="e.g. Token Lock Contract" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contract-address">Contract address</Label>
            <Input id="contract-address" placeholder="0x..." value={address} onChange={e => setAddress(e.target.value)} className="font-mono" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contract-chain">Chain</Label>
            <Select value={chain} onValueChange={v => v && setChain(v)}>
              <SelectTrigger id="contract-chain">
                <SelectValue>
                  {SUPPORTED_CHAINS.find(c => c.id === chain)?.name ?? chain}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_CHAINS.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAptos && aptosModules && aptosModules.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="contract-module">Module (optional)</Label>
              <Select
                value={moduleName || ALL_MODULES}
                onValueChange={v => setModuleName(v === ALL_MODULES || !v ? "" : v)}
              >
                <SelectTrigger id="contract-module">
                  <SelectValue>
                    {moduleName || "All modules"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MODULES}>All modules</SelectItem>
                  {aptosModules.map(m => (
                    <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Scope the AI to one module, or leave as all modules at this address.</p>
            </div>
          )}

          {atChainLimit && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Your plan supports {chainLimit} chain{chainLimit === 1 ? "" : "s"}.{" "}
                <Link href="/dashboard/upgrade" className="underline underline-offset-2 font-medium" onClick={() => setOpen(false)}>
                  Upgrade
                </Link>{" "}
                to add contracts on multiple chains.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="contract-desc">Description</Label>
            <textarea
              id="contract-desc"
              rows={3}
              placeholder="e.g. Tracks vested TEAM tokens per wallet. Holds unlock dates and vested amounts for each holder."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none"
            />
            <p className="text-xs text-muted-foreground">The AI reads this to understand what the contract does and when to use it.</p>

            {/* ABI function / module hints */}
            {detectingFns && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {isAptos ? "Reading modules from the Aptos fullnode…" : "Reading contract from block explorer…"}
              </div>
            )}
            {detectedFns && detectedFns.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-medium text-foreground/70">{detectedFns.length} function{detectedFns.length === 1 ? "" : "s"} detected - use these to describe what the contract does:</p>
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                  {detectedFns.map(fn => (
                    <span key={fn} className="rounded bg-background border border-border px-1.5 py-0.5 text-xs font-mono text-foreground/60">{fn}</span>
                  ))}
                </div>
              </div>
            )}
            {!isAptos && detectedFns === null && !detectingFns && addressRe.test(address.trim()) && (
              <p className="text-xs text-muted-foreground/60">Contract not verified on block explorer - you&apos;ll need to describe it manually.</p>
            )}
            {isAptos && aptosModules && aptosModules.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-medium text-foreground/70">{aptosModules.length} module{aptosModules.length === 1 ? "" : "s"} found - a reference for writing the description. To narrow what the AI reads, use the Module dropdown above.</p>
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                  {aptosModules.map(m => (
                    <span key={m.name} className="rounded bg-background border border-border px-1.5 py-0.5 text-xs font-mono text-foreground/60">
                      {m.name} ({m.entryCount} entry, {m.viewCount} view)
                    </span>
                  ))}
                </div>
              </div>
            )}
            {isAptos && aptosModules && aptosModules.length === 0 && !detectingFns && (
              <p className="text-xs text-muted-foreground/60">No modules found at this address. You can still add it and describe it manually.</p>
            )}
            {isAptos && aptosPeekError && !detectingFns && (
              <p className="text-xs text-muted-foreground/60">{aptosPeekError}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isPending || !name || !address || !description || atChainLimit}>
            {isPending ? "Adding…" : "Add contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
