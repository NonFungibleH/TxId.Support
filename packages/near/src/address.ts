/**
 * NEAR account ids, which are unlike every other chain we read.
 *
 * They are HUMAN-READABLE NAMES, not hex: `alice.near`, `v2.ref-finance.near`,
 * `i6849797610.tg`. That is a routing gift. Aptos and Sui addresses are the
 * same shape as each other, and a Stellar transaction hash is an EVM hash
 * without its 0x, so both needed the request to name the chain. A NEAR account
 * id cannot be confused with any of them.
 *
 * The one collision is the implicit-account form: 64 lowercase hex characters
 * with NO 0x prefix, which is a NEAR public key rendered as an account. That is
 * the same shape as a Stellar transaction hash, so shape alone still cannot
 * decide, and `isNearAccount` is never the only thing consulted.
 *
 * Rules from NEAR's own specification: 2 to 64 characters, lowercase letters,
 * digits and the separators `-`, `_`, `.`; each dot-separated part must begin
 * and end alphanumerically.
 */
const ACCOUNT_RE = /^(?=.{2,64}$)[a-z0-9]+(?:[-_][a-z0-9]+)*(?:\.[a-z0-9]+(?:[-_][a-z0-9]+)*)*$/
const IMPLICIT_RE = /^[0-9a-f]{64}$/

export function isNearAccount(value: string): boolean {
  const v = value.trim()
  if (IMPLICIT_RE.test(v)) return true
  return ACCOUNT_RE.test(v)
}

/**
 * An identifier that is structurally a valid NEAR account name but is almost
 * certainly another chain's address pasted into the wrong box.
 *
 * `0x` followed by 40 hex characters passes NEAR's own rules: lowercase letters
 * and digits are exactly what an account name may contain. So `isNearAccount`
 * says yes, correctly, and a user who pastes their MetaMask address into a NEAR
 * project would be told "there is no NEAR account called 0x1234…" after a round
 * trip, when the useful answer is "that is an Ethereum address".
 *
 * Kept SEPARATE from validity on purpose. `isNearAccount` answers what NEAR's
 * specification allows and must not be bent; this answers what the user
 * probably did, which is a different question and a worse thing to hard-code
 * into a validator.
 */
export function looksLikeForeignAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim())
}

/** True for the 64-hex implicit form, which shares a shape with a Stellar hash. */
export function isImplicitNearAccount(value: string): boolean {
  return IMPLICIT_RE.test(value.trim())
}

/**
 * A NEAR transaction hash is base58, NOT hex, which is the one identifier here
 * that is genuinely distinctive. Length is 43 to 44 characters in practice.
 */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,50}$/
export function isNearTxHash(value: string): boolean {
  const v = value.trim()
  // Reject anything that is entirely hex of hash length: that is another
  // chain's identifier wearing a base58-compatible alphabet.
  if (/^[0-9a-fA-F]{64}$/.test(v)) return false
  return BASE58.test(v)
}
