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

/**
 * Thrown when an ARCHIVAL node looked and the account is genuinely not on
 * chain. A finding, not a failure, and deliberately a different class from
 * NearLookupUnavailableError so a caller cannot conflate the two.
 *
 * On NEAR an account must be created before it can hold anything, so "no such
 * account" and "an account holding nothing" are different situations with
 * different fixes, and the user needs to be told which one they are in.
 */
export class NearAccountNotFoundError extends Error {
  readonly accountId: string
  constructor(accountId: string) {
    super(`there is no NEAR account called ${accountId}`)
    this.name = "NearAccountNotFoundError"
    this.accountId = accountId
  }
}
