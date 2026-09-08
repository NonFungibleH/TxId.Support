/**
 * Thrown when a NEAR read did not COMPLETE, as distinct from completing and
 * finding nothing.
 *
 * The EVM path signals this with LookupUnavailableError, Solana and Aptos each
 * have their own. NEAR gets one rather than taking a dependency on another
 * chain package for one class; the handling in packages/ai is identical.
 */
export class NearLookupUnavailableError extends Error {
  constructor(reason: string) {
    super(`NEAR lookup unavailable: ${reason}`)
    this.name = "NearLookupUnavailableError"
  }
}
