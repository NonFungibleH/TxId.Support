"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { updateConfig } from "@/lib/actions/project"
import type { ActionsConfig, ActionsFunctionRule } from "@/lib/types/config"
import { ACTIONS_MAX_SWAP_USD_DEFAULT, ACTIONS_MAX_SWAP_USD_CEILING } from "@/lib/types/config"
import { writeFunctionsOf } from "@/lib/action-functions"
import { AlertTriangle, ShieldCheck } from "lucide-react"

interface ContractLite { id: string; name: string; chain: string; abi: string | null }

const EMPTY: ActionsConfig = { enabled: false, allowedFunctions: {}, maxSwapUsd: ACTIONS_MAX_SWAP_USD_DEFAULT }

export function ActionsForm({
  projectId,
  initial,
  contracts,
  eligible,
}: {
  projectId: string
  initial: ActionsConfig | null
  contracts: ContractLite[]
  eligible: boolean
}) {
  const [config, setConfig] = useState<ActionsConfig>(initial ?? EMPTY)
  const [pending, startTransition] = useTransition()

  const fnsByContract = useMemo(
    () => Object.fromEntries(contracts.map(c => [c.id, writeFunctionsOf(c.abi)])),
    [contracts],
  )

  const save = (next: ActionsConfig) => {
    setConfig(next)
    startTransition(async () => {
      try {
        await updateConfig(projectId, { actions: next })
        toast.success("Actions settings saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  const toggleFn = (contractId: string, fn: string, enabled: boolean) => {
    const rules = config.allowedFunctions[contractId] ?? []
    const next = enabled ? [...rules, { fn }] : rules.filter(r => r.fn !== fn)
    save({ ...config, allowedFunctions: { ...config.allowedFunctions, [contractId]: next } })
  }

  const setApproval = (contractId: string, fn: string, approval: ActionsFunctionRule["approval"]) => {
    const rules = (config.allowedFunctions[contractId] ?? []).map(r =>
      r.fn === fn ? { fn, ...(approval ? { approval } : {}) } : r,
    )
    save({ ...config, allowedFunctions: { ...config.allowedFunctions, [contractId]: rules } })
  }

  if (!eligible) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="font-semibold">Actions is available on paid plans.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Upgrade to let your users execute swaps, staking, claims and more straight from the support chat — every transaction signed in their own wallet.
        </p>
        <a href="/dashboard/upgrade" className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          View plans
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Master toggle + disclosure */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Enable Actions</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              When on, the assistant can prepare transactions for your users to review and sign in their own wallet.
            </p>
          </div>
          <Switch
            checked={config.enabled}
            disabled={pending}
            onCheckedChange={(v) => save({ ...config, enabled: v, ...(v && !config.enabledAt ? { enabledAt: new Date().toISOString() } : {}) })}
          />
        </div>
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="flex items-start gap-1.5"><ShieldCheck className="size-3.5 shrink-0 mt-0.5" />
            How it works: the assistant only carries out what a user explicitly asks for — it never recommends trades. Users review and sign every transaction in their own wallet; approvals are exact-amount only; wallets are screened against the OFAC sanctions list and the feature is geo-restricted in sanctioned regions. Users see a one-time acknowledgement before their first action.
          </p>
          <p>By enabling Actions you accept responsibility for the functions you allow below on your own contracts.</p>
        </div>
      </div>

      {config.enabled && (
        <>
          {/* Swap cap */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="font-semibold">Swaps</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Users can swap between your token and majors (native, wrapped, USDC, USDT, DAI) via the KyberSwap aggregator. Set the per-swap USD limit; 0 disables swaps entirely.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Max per swap: $</span>
              <Input
                type="number"
                min={0}
                max={ACTIONS_MAX_SWAP_USD_CEILING}
                value={config.maxSwapUsd}
                disabled={pending}
                onChange={(e) => setConfig({ ...config, maxSwapUsd: Math.max(0, Math.min(ACTIONS_MAX_SWAP_USD_CEILING, Number(e.target.value) || 0)) })}
                onBlur={() => save(config)}
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">(max ${ACTIONS_MAX_SWAP_USD_CEILING.toLocaleString()})</span>
            </div>
          </div>

          {/* Per-contract function allowlist */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="font-semibold">Contract functions</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enable the write functions users may execute (lock, stake, claim…). Functions are off by default. If a function pulls tokens from the user (like a lock or stake), set which token it pulls and which argument is the amount, so the assistant can handle the approval step.
            </p>
            {contracts.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Add a smart contract with an ABI first, under Smart Contracts.</p>
            )}
            <div className="mt-3 space-y-4">
              {contracts.map((c) => {
                const fns = fnsByContract[c.id] ?? []
                const rules = config.allowedFunctions[c.id] ?? []
                if (fns.length === 0) {
                  return (
                    <div key={c.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">No eligible write functions (needs an ABI; only simple-argument, non-payable functions are supported).</p>
                    </div>
                  )
                }
                return (
                  <div key={c.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium mb-2">{c.name}</p>
                    <div className="space-y-2">
                      {fns.map((fn) => {
                        const rule = rules.find(r => r.fn === fn.name)
                        return (
                          <div key={fn.name} className="flex flex-wrap items-center gap-2 text-sm">
                            <Switch
                              checked={!!rule}
                              disabled={pending}
                              onCheckedChange={(v) => toggleFn(c.id, fn.name, v)}
                            />
                            <code className="text-xs">{fn.name}({fn.inputs.join(", ")})</code>
                            {fn.adminish && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-500">
                                <AlertTriangle className="size-3" /> looks administrative — enable with care
                              </span>
                            )}
                            {rule && fn.inputs.length > 0 && (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                · pulls token
                                <Input
                                  placeholder="0x… (blank = none)"
                                  defaultValue={rule.approval?.token ?? ""}
                                  disabled={pending}
                                  onBlur={(e) => {
                                    const token = e.target.value.trim()
                                    if (!token) { setApproval(c.id, fn.name, undefined); return }
                                    if (!/^0x[0-9a-fA-F]{40}$/.test(token)) { toast.error("Enter a valid token address"); return }
                                    setApproval(c.id, fn.name, { token, amountArg: rule.approval?.amountArg ?? 0 })
                                  }}
                                  className="h-7 w-44 text-xs"
                                />
                                amount arg #
                                <Input
                                  type="number"
                                  min={0}
                                  max={fn.inputs.length - 1}
                                  defaultValue={rule.approval?.amountArg ?? 0}
                                  disabled={pending || !rule.approval}
                                  onBlur={(e) => {
                                    if (!rule.approval) return
                                    const idx = Math.max(0, Math.min(fn.inputs.length - 1, Number(e.target.value) || 0))
                                    setApproval(c.id, fn.name, { token: rule.approval.token, amountArg: idx })
                                  }}
                                  className="h-7 w-14 text-xs"
                                />
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
