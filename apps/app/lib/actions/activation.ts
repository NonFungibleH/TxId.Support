"use server"

import { requireCapability } from "@/lib/roles-server"
import { revalidatePath } from "next/cache"
import { CHAIN_CONFIGS, canonicalChainId, getTokenInfo, sanitizeChainText } from "@txid/blockchain"
import { getProject, updateConfig } from "@/lib/actions/project"
import type { ActivationConfig, ActivationMode, ActivationSpend, ProjectConfig } from "@/lib/types/config"
import { ACTIVATION_HOLDOUT_MAX } from "@/lib/types/config"

/**
 * Save the readiness check settings.
 *
 * TOKEN SYMBOLS ARE READ ON CHAIN HERE, ONCE, and a token that cannot be read
 * is refused rather than saved as "Unknown". Every checklist this project
 * shows will name the token, and "Get Unknown on Avalanche" is worse than no
 * checklist at all.
 */

export interface ActivationInput {
  mode: ActivationMode
  action: string
  contractId: string | null
  spendsKind: ActivationSpend["kind"]
  tokens: string[]
  guideUrl: string
  holdoutPct: number
}

export type SaveResult = { ok: true } | { ok: false; error: string }

const MODES: ActivationMode[] = ["off", "prompt", "open_once"]

export async function saveActivation(input: ActivationInput): Promise<SaveResult> {
  await requireCapability("settings")
  const { project } = await getProject()
  if (!project) return { ok: false, error: "No project found." }
  const typed = project as unknown as { id: string; config: ProjectConfig }
  const config = typed.config

  if (!MODES.includes(input.mode)) return { ok: false, error: "Choose how the check is offered." }

  const action = input.action.trim().toLowerCase()
  if (!/^[a-z][a-z ]{1,23}$/.test(action)) {
    return { ok: false, error: "Name the first action in a word or two, as your users would say it: deposit, swap, lock, stake." }
  }

  const contract = input.contractId ? (config.watchedContracts ?? []).find(c => c.id === input.contractId) : null
  if (input.contractId && !contract) return { ok: false, error: "That contract is no longer in your watched contracts." }
  const chainId = contract ? canonicalChainId(String(contract.chain)) : null
  if (contract && (!chainId || !CHAIN_CONFIGS[chainId])) {
    return { ok: false, error: "The readiness check covers EVM chains for now. Choose a contract on an EVM chain." }
  }

  let spends: ActivationSpend
  if (input.spendsKind === "native") spends = { kind: "native" }
  else if (input.spendsKind === "any") spends = { kind: "any" }
  else {
    if (!chainId) return { ok: false, error: "Choose the contract first, so the tokens can be read on its chain." }
    const addresses = Array.from(new Set(input.tokens.map(t => t.trim()).filter(Boolean)))
    if (addresses.length === 0) return { ok: false, error: "Add at least one token the first action uses." }
    if (addresses.length > 3) return { ok: false, error: "Up to three tokens." }
    const bad = addresses.find(a => !/^0x[0-9a-fA-F]{40}$/.test(a))
    if (bad) return { ok: false, error: `${bad} is not a token address.` }
    const tokens: { address: string; symbol: string }[] = []
    for (const address of addresses) {
      const info = await getTokenInfo(address, chainId).catch(() => null)
      const symbol = info?.symbol ? sanitizeChainText(info.symbol).slice(0, 16) : ""
      if (!symbol) {
        return {
          ok: false,
          error: `Couldn't read the token at ${address} on ${CHAIN_CONFIGS[chainId]!.name}. Check it is the token's address on that chain, then save again.`,
        }
      }
      tokens.push({ address, symbol })
    }
    spends = { kind: "tokens", tokens }
  }

  let guideUrl: string | undefined
  if (input.guideUrl.trim()) {
    try {
      const u = new URL(input.guideUrl.trim())
      if (u.protocol !== "https:") throw new Error()
      guideUrl = u.toString()
    } catch {
      return { ok: false, error: "The guide link must be a full https:// address." }
    }
  }

  const holdoutPct = Math.max(0, Math.min(ACTIVATION_HOLDOUT_MAX, Math.round(Number(input.holdoutPct) || 0)))

  const prev = config.activation
  const next: ActivationConfig = {
    mode: input.mode,
    action,
    spends,
    holdoutPct,
    ...(contract ? { contractId: contract.id } : {}),
    ...(guideUrl ? { guideUrl } : {}),
    ...(input.mode !== "off" ? { enabledAt: prev?.enabledAt ?? new Date().toISOString() } : prev?.enabledAt ? { enabledAt: prev.enabledAt } : {}),
  }

  await updateConfig(typed.id, { activation: next })
  revalidatePath("/dashboard/activation")
  return { ok: true }
}
