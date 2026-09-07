/**
 * Thrown when a Solana read did not COMPLETE, as distinct from completing and
 * finding nothing.
 *
 * This exists because the two were the same value. `getSolanaTransactionBySignature`
 * returned `null` for a Helius 500, a 429, a timeout AND for a signature that
 * genuinely is not on chain, so an outage reached the user as "that
 * transaction does not exist". That is the exact shape of #68 on the EVM side,
 * where an indexer outage told someone their transaction never happened, and
 * it is the most frightening thing this product can say to a person looking for
 * their money.
 *
 * The EVM path signals this with LookupUnavailableError in @txid/blockchain.
 * Solana gets its own rather than taking a dependency on that whole package for
 * one class; the handling in packages/ai is identical.
 */
export class SolanaLookupUnavailableError extends Error {
  constructor(reason: string) {
    super(`Solana lookup unavailable: ${reason}`)
    this.name = "SolanaLookupUnavailableError"
  }
}
