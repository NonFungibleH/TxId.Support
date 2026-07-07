import { CHAIN_CONFIGS } from "./types"
import type { PendingDiagnosis } from "./types"

/** Minimal JSON-RPC call against a chain's public RPC. Returns result or null. */
async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: unknown }
    return json.result ?? null
  } catch {
    return null
  }
}

type RpcTx = {
  blockNumber: string | null
  from: string
  nonce: string
  gasPrice?: string
  maxFeePerGas?: string
}

function toBig(hex: string | null | undefined): bigint {
  if (!hex) return 0n
  try {
    return BigInt(hex)
  } catch {
    return 0n
  }
}

function gwei(wei: bigint): string {
  return (Number(wei) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 })
}

/** The fee cap the sender is willing to pay: maxFeePerGas (EIP-1559) or gasPrice (legacy). */
function effectiveFee(tx: RpcTx): bigint {
  return toBig(tx.maxFeePerGas) || toBig(tx.gasPrice)
}

/**
 * Diagnose a hash that Moralis could not return as a mined transaction.
 * Uses raw JSON-RPC against the chain's public RPC (no API key, no Moralis cost)
 * to tell pending / stuck-nonce / underpriced / dropped / no-gas apart.
 * Returns null if the chain is unknown or the tx turns out to be mined after all.
 */
export async function diagnosePendingTx(
  hash: string,
  chainId: string,
  walletAddress?: string,
): Promise<PendingDiagnosis | null> {
  const cfg = CHAIN_CONFIGS[chainId]
  if (!cfg?.rpcUrl) return null
  const rpc = cfg.rpcUrl
  const symbol = cfg.nativeCurrency

  const tx = (await rpcCall(rpc, "eth_getTransactionByHash", [hash])) as RpcTx | null

  // ── Transaction is in the mempool but not yet mined ──────────────────────
  if (tx && tx.blockNumber == null) {
    const from = tx.from
    const txNonce = Number(toBig(tx.nonce))

    const [latestNonceRaw, gasPriceRaw, blockRaw] = (await Promise.all([
      rpcCall(rpc, "eth_getTransactionCount", [from, "latest"]),
      rpcCall(rpc, "eth_gasPrice", []),
      rpcCall(rpc, "eth_getBlockByNumber", ["latest", false]),
    ])) as [string | null, string | null, { baseFeePerGas?: string } | null]

    const latestNonce = latestNonceRaw ? Number(toBig(latestNonceRaw)) : txNonce

    // Stuck nonce: an earlier tx must confirm before this one can.
    if (txNonce > latestNonce) {
      const gap = txNonce - latestNonce
      return {
        cause: "pending_stuck_nonce",
        reason: `An earlier pending transaction (nonce ${latestNonce}) is blocking this one (nonce ${txNonce}). Nonces must confirm in order, so nothing after the stuck transaction can go through.`,
        detail: `${gap} earlier transaction${gap === 1 ? "" : "s"} ahead in the queue`,
      }
    }

    // Underpriced: the sender's fee cap is below what the network needs right now.
    const txFee = effectiveFee(tx)
    const baseFee = toBig(blockRaw?.baseFeePerGas)
    const networkGasPrice = toBig(gasPriceRaw)
    if (txFee > 0n && baseFee > 0n && txFee < baseFee) {
      return {
        cause: "pending_underpriced",
        reason: `The transaction's max fee is below the current network base fee, so validators won't include it until fees drop or it is resubmitted with a higher fee.`,
        detail: `max fee ${gwei(txFee)} gwei vs base fee ${gwei(baseFee)} gwei`,
      }
    }
    if (txFee > 0n && networkGasPrice > 0n && txFee < networkGasPrice) {
      return {
        cause: "pending_underpriced",
        reason: `The gas price is below the current going rate, so the transaction is waiting in the mempool.`,
        detail: `${gwei(txFee)} gwei vs current ${gwei(networkGasPrice)} gwei`,
      }
    }

    return {
      cause: "pending_congestion",
      reason: `The transaction is in the mempool and simply hasn't been mined yet, usually due to temporary network congestion or a very recent submission.`,
    }
  }

  // The node returned a mined tx — let the normal path handle it.
  if (tx && tx.blockNumber != null) return null

  // ── The node doesn't know this hash: dropped / replaced / never broadcast ─
  if (walletAddress) {
    const balanceRaw = (await rpcCall(rpc, "eth_getBalance", [walletAddress, "latest"])) as string | null
    if (balanceRaw != null && toBig(balanceRaw) === 0n) {
      return {
        cause: "insufficient_gas_balance",
        reason: `The connected wallet holds 0 ${symbol}, so it cannot pay gas for any transaction on this network. Add some ${symbol} and try again.`,
      }
    }
  }

  return {
    cause: "dropped",
    reason: `This transaction hash isn't known to the network. It was most likely dropped from the mempool (often because the gas was too low), replaced by another transaction using the same nonce, or never successfully broadcast.`,
  }
}
