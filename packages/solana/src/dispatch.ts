import {
  getSolanaRecentTransactions as heliusRecent,
  getSolanaTransactionBySignature as heliusBySignature,
  getSolanaWalletBalance as heliusBalance,
} from "./helius"
import {
  getSolanaRecentTransactionsRpc,
  getSolanaTransactionBySignatureRpc,
  getSolanaWalletBalanceRpc,
} from "./rpc"
import type { SolanaBalance, SolanaTransaction } from "./types"

/**
 * Which Solana read path to use, decided in ONE place.
 *
 * Solana was the last paused chain and it was paused on a missing
 * `HELIUS_API_KEY`, not on anything technical. The keyless JSON-RPC path in
 * `rpc.ts` answers every read the product actually makes, so the absence of a
 * key now costs a `description` and a `type` rather than the whole chain.
 *
 * Helius stays PREFERRED where the key exists: its enriched output is better
 * for the successful transactions a user is browsing, and it is one call per
 * page rather than one per transaction against a rate-limited public node.
 *
 * The dispatch is deliberately not a fall-through on error. A Helius failure
 * is an outage, and an outage must surface as `unavailable` rather than be
 * quietly re-served from a different source with different fields: two answers
 * to the same question that differ in shape is how a caller starts treating a
 * missing `description` as a fact about the transaction.
 */
export function heliusConfigured(): boolean {
  return Boolean(process.env.HELIUS_API_KEY)
}

export function getSolanaWalletBalance(address: string): Promise<SolanaBalance> {
  return heliusConfigured() ? heliusBalance(address) : getSolanaWalletBalanceRpc(address)
}

export function getSolanaRecentTransactions(
  address: string,
  programAddress?: string,
  limit = 10,
): Promise<SolanaTransaction[]> {
  return heliusConfigured()
    ? heliusRecent(address, programAddress, limit)
    : getSolanaRecentTransactionsRpc(address, programAddress, limit)
}

export function getSolanaTransactionBySignature(signature: string): Promise<SolanaTransaction | null> {
  return heliusConfigured()
    ? heliusBySignature(signature)
    : getSolanaTransactionBySignatureRpc(signature)
}
