/**
 * Thrown when nobody answered, which is not the same as an answer of "no".
 *
 * The Aptos read path had the exact hole #68 and #72 closed on EVM, and it
 * survived because `aptosGet` collapses four different outcomes into `null`: a
 * clean 404, a 500, a timeout and a malformed body. `getAptosTransactionByHash`
 * then returned `null`, and three callers rendered that as an absence:
 *
 *  - the agent's fan-out listed "aptos" in `checkedChains` whether or not the
 *    fullnode had answered, so an outage reached the user as "we looked on
 *    Aptos and your transaction is not there";
 *  - the resolution API's `gather.ts` caught it into `notFound`, and not_found
 *    carries a custody claim that an integrator draws a button from;
 *  - the version short-circuit reported `status: "not_found"`, hedging only in
 *    prose while the field a caller keys on said the transaction was absent.
 *
 * It lives in its own module for the same reason `LookupUnavailableError` does
 * in packages/blockchain: so the read layer and its callers can both name it
 * without an import cycle.
 */
export class AptosLookupUnavailableError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = "AptosLookupUnavailableError"
  }
}
