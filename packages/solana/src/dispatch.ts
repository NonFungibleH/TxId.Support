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

/**
 * THE TWO PATHS DID NOT ENFORCE THE SAME RULE, and the better-resourced
 * deployment got the weaker answer.
 *
 * `rpc.ts` refuses to report an empty history until a node that keeps the
 * ledger agrees it is empty, because a pruning node answers 200 with `[]` for
 * history it does not hold. The enriched Helius endpoint has no equivalent
 * check anywhere: whatever array comes back is mapped and returned. So setting
 * a key swapped a guarded path for an unguarded one, silently, and the wallet
 * it misinforms is the one that came back after a month to ask where the money
 * went.
 *
 * An empty list is therefore CHECKED rather than trusted, and the check runs
 * only for that answer, because it is the only answer that cannot be told
 * apart from a failure to produce one.
 *
 * This is not the fall-through on error rejected above, and that rejection
 * stands. An outage re-served from another source with different fields
 * teaches a caller to read a missing `description` as a fact about the
 * transaction. An empty list is a different thing: a positive claim about the
 * wallet, made without the evidence to support it.
 */
export async function getSolanaRecentTransactions(
  address: string,
  programAddress?: string,
  limit = 10,
): Promise<SolanaTransaction[]> {
  if (!heliusConfigured()) return getSolanaRecentTransactionsRpc(address, programAddress, limit)

  const enriched = await heliusRecent(address, programAddress, limit)
  if (enriched.length > 0) return enriched

  // The RPC path answers all three ways correctly on its own: it returns the
  // transactions if an archival node has them, `[]` if an archival node agrees
  // there are none, and throws if nothing can settle it. Deferring to it is
  // deferring to the guard, rather than reimplementing it here.
  return getSolanaRecentTransactionsRpc(address, programAddress, limit)
}

export function getSolanaTransactionBySignature(signature: string): Promise<SolanaTransaction | null> {
  return heliusConfigured()
    ? heliusBySignature(signature)
    : getSolanaTransactionBySignatureRpc(signature)
}
