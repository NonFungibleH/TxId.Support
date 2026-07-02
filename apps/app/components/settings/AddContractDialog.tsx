"use client"

import { useState, useTransition } from "react"
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
import { addContract } from "@/lib/actions/contracts"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import { Plus, AlertTriangle } from "lucide-react"
import Link from "next/link"

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

  const isNewChain = !activeChains.includes(chain)
  const atChainLimit = chainLimit !== -1 && isNewChain && activeChains.length >= chainLimit

  function reset() {
    setName(""); setAddress(""); setChain("0x1"); setDescription("")
  }

  function submit() {
    startTransition(async () => {
      try {
        await addContract(projectId, { name, address, chain, description })
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
                {SUPPORTED_CHAINS.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <p className="text-xs text-muted-foreground">The AI reads this to understand what the contract tracks and when to call it.</p>
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
