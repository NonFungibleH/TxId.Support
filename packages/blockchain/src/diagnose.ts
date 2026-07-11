import { CHAIN_CONFIGS } from "./types"
import { getTransactionByHash } from "./wallet"
import { enrichTransaction } from "./enrich"
import { diagnosePendingTx } from "./pending"
import type { DecodedRevert } from "./types"

// Every EVM chain we support, tried in parallel when the caller doesn't name one.
const DEFAULT_CHAINS = ["0x1", "0x2105", "0x38", "0x89", "0xa4b1", "0xa", "0xa86a"]

export interface TxDiagnosis {
  /** Overall outcome. */
  status: "success" | "failed" | "pending" | "not_found"
  /** Human name of the chain the tx was found on (null if not found). */
  chain: string | null
  chainId: string | null
  /** Machine-readable cause, e.g. custom_error, out_of_gas, pending_underpriced. */
  cause: string | null
  /** The specific error name / revert string when one is available. */
  error: string | null
  /** Plain-English explanation of what happened. */
  explanation: string
  /** The recommended next step (null when there's nothing to fix). */
  fix: string | null
  tokenTransfers: Array<{ token: string; symbol?: string; from: string; to: string; value: string; kind: string }>
  gas: { verdict: string | null; effectiveGwei?: string }
  /** Decoded function name that was called, when known. */
  method: string | null
}

function chainName(id: string): string {
  return CHAIN_CONFIGS[id]?.name ?? id
}

/** Fix text for a mined failure, inferring intent from the custom-error name. */
function fixForRevert(rev: DecodedRevert | undefined): string | null {
  if (!rev) return "Reverted by the contract. Review the action's requirements and retry."
  switch (rev.cause) {
    case "out_of_gas":
      return "Raise the gas limit in your wallet and resubmit."
    case "panic":
      return "This is a contract-level arithmetic/logic error (panic). Report it to the protocol team."
    case "custom_error": {
      const n = (rev.errorName ?? "").toLowerCase()
      if (/slippage|priceimpact|minamount|minout|insufficientoutput/.test(n)) return "Increase your slippage tolerance and retry."
      if (/allowance|approv|notapproved/.test(n)) return "Approve the token for this contract first, then retry."
      if (/deadline|expired/.test(n)) return "The transaction took too long — resubmit it."
      if (/insufficient|balance/.test(n)) return "You don't have enough of a required token/asset — top up and retry."
      if (/paused|notactive|halted/.test(n)) return "The contract is temporarily paused — try again later."
      return `The contract rejected the call (${rev.errorName ?? "custom error"}). Check this action's requirements and retry.`
    }
    case "revert_reason":
      return "Resolve the condition in the revert reason above, then retry."
    default:
      return "Reverted by the contract. Review the action's requirements and retry."
  }
}

function fixForPending(cause: string): string {
  switch (cause) {
    case "pending_stuck_nonce":
      return "Speed up or cancel the earlier pending transaction (same nonce, higher fee) so this one can proceed."
    case "pending_underpriced":
      return "Resubmit with a higher max fee, or use your wallet's 'speed up'."
    case "pending_congestion":
      return "Wait for the network to clear, or speed it up with a higher fee."
    case "insufficient_gas_balance":
      return "Add the network's native token to cover gas, then retry."
    default:
      return "Resubmit the transaction with a higher fee if it's urgent."
  }
}

/**
 * Headless transaction diagnosis — the same engine the support bot uses,
 * returned as a structured object rather than prose. Resolves the chain
 * automatically (or uses `chainOverride`), classifies success / failure /
 * pending / not-found, decodes the revert reason, and attaches token transfers
 * and a gas verdict.
 */
export async function diagnoseTransaction(hash: string, chainOverride?: string): Promise<TxDiagnosis> {
  const candidates = chainOverride && CHAIN_CONFIGS[chainOverride] ? [chainOverride] : DEFAULT_CHAINS

  // Find the chain the tx is mined on (highest-priority hit).
  const results = await Promise.all(
    candidates.map(async (id) => ({ id, tx: await getTransactionByHash(hash, id).catch(() => null) })),
  )
  const hit = results.find((r) => r.tx)
  if (hit?.tx) {
    const tx = hit.tx
    const enrichment = await enrichTransaction(hash, hit.id, []).catch(() => null)
    const rev = tx.decodedRevert
    const failed = tx.status === "failed"
    return {
      status: tx.status,
      chain: chainName(hit.id),
      chainId: hit.id,
      cause: failed ? rev?.cause ?? "unknown_revert" : "success",
      error: rev?.errorName ?? (rev?.cause === "revert_reason" ? rev.reason : null) ?? null,
      explanation: failed
        ? rev?.reason ?? "The transaction reverted."
        : "The transaction executed successfully.",
      fix: failed ? fixForRevert(rev) : null,
      tokenTransfers: (enrichment?.tokenTransfers ?? []).map((t) => ({
        token: t.token,
        ...(t.symbol ? { symbol: t.symbol } : {}),
        from: t.from,
        to: t.to,
        value: t.valueFormatted ?? t.value,
        kind: t.kind,
      })),
      gas: {
        verdict: enrichment?.gas?.verdict ?? null,
        ...(enrichment?.gas?.effectiveGwei ? { effectiveGwei: enrichment.gas.effectiveGwei } : {}),
      },
      method: tx.method ?? enrichment?.method ?? null,
    }
  }

  // Not mined — diagnose pending / dropped on every candidate, preferring the
  // chain where the tx is actually visible.
  const pending = await Promise.all(
    candidates.map(async (id) => ({ id, diag: await diagnosePendingTx(hash, id).catch(() => null) })),
  )
  const best = pending.find((p) => p.diag && p.diag.cause !== "dropped") ?? pending.find((p) => p.diag)
  if (best?.diag) {
    const d = best.diag
    const isPending = d.cause.startsWith("pending_")
    return {
      status: isPending ? "pending" : "not_found",
      chain: chainName(best.id),
      chainId: best.id,
      cause: d.cause,
      error: null,
      explanation: d.reason,
      fix: fixForPending(d.cause),
      tokenTransfers: [],
      gas: { verdict: null },
      method: null,
    }
  }

  return {
    status: "not_found",
    chain: null,
    chainId: null,
    cause: null,
    error: null,
    explanation: `This transaction was not found on any supported chain (${candidates.map(chainName).join(", ")}). The hash may be mistyped, never broadcast, or on an unsupported chain.`,
    fix: "Double-check the full hash was copied correctly; if it was genuinely submitted, resubmit it.",
    tokenTransfers: [],
    gas: { verdict: null },
    method: null,
  }
}
