import { CHAIN_CONFIGS } from "./types"

/**
 * Thrown by a transaction lookup when NOBODY could be asked, as opposed to
 * every source answering "no such transaction".
 *
 * The RPC fallback in wallet.ts used to return null for a network failure, so
 * an indexer outage plus an RPC outage read as "the chain has never seen this
 * hash". Callers that fan out across chains catch this and report the chain
 * as unreachable rather than as checked; the API resolves it to lookup_failed
 * rather than to not found.
 *
 * Lives here rather than in wallet.ts because blockscout-wallet.ts must throw
 * it too, and wallet.ts imports blockscout-wallet.ts.
 */
export class LookupUnavailableError extends Error {
  constructor(public readonly chainId: string) {
    super(`Could not reach ${CHAIN_CONFIGS[chainId]?.name ?? chainId} to look up the transaction`)
    this.name = "LookupUnavailableError"
  }
}
