import { viewFunctionResult } from "./fullnode"
import { normalizeAptosAddress } from "./address"

/**
 * Aptos confidential assets, as far as they can honestly be read.
 *
 * WHY THIS EXISTS. `0x1::confidential_asset` is live on mainnet and Petra
 * offers it to every user as "Confidential APT". When someone enables it, their
 * APT moves out of the visible fungible-asset store into a confidential one
 * whose amounts are Twisted ElGamal ciphertexts. Our balance read queries the
 * Indexer's `current_fungible_asset_balances`, so the confidential portion is
 * simply ABSENT from it.
 *
 * That is this codebase's recurring bug in a new costume: a HIDDEN balance
 * rendered as an ABSENT one. A user who moves some APT into cAPT gets told a
 * smaller number; one who moves all of it gets told their wallet is empty. On a
 * support surface, "your balance is zero" is the answer people act on.
 *
 * WHAT WE CANNOT READ, AND MUST NOT PRETEND TO. The amounts. They are encrypted
 * to the holder's key by design, and no view returns a plaintext figure. Do not
 * add one; do not estimate one. `get_total_confidential_supply` is chain-wide
 * and says nothing about any individual.
 *
 * WHAT WE CAN READ, WITH NO KEY AT ALL. Whether a store exists, whether the
 * balance is normalized, whether incoming transfers are paused, and how many
 * transfers have arrived since the last rollover. Those four answer the support
 * questions confidential assets actually generate, and none of them requires
 * decrypting anything:
 *
 *   - "My balance shows less than I have."      → a store exists, amount encrypted
 *   - "Someone sent me cAPT and nothing moved." → pending, needs a rollover
 *   - "My confidential transfer keeps failing." → not normalized
 *   - "Nobody can send me cAPT."                → incoming transfers paused
 *
 * NULL IS OUR FAILURE. `hasStore: false` is a real finding; `null` means we
 * could not ask, and the caller must say so rather than implying the user has
 * no confidential balance.
 */

/** The APT fungible-asset metadata object. cAPT is confidential APT. */
export const APT_FA_METADATA = "0xa"

export interface ConfidentialState {
  /** A confidential store exists for this asset. The AMOUNT is unreadable. */
  hasStore: boolean
  /**
   * Confidential transfers received since the last rollover. Above zero means
   * value is sitting in the PENDING balance and will not appear in the
   * available balance until the holder rolls it over. Null when unread.
   */
  transfersPending: number | null
  /** False means transfers will fail until the holder normalizes. Null when unread. */
  normalized: boolean | null
  /** True means nobody can send this holder confidential transfers. Null when unread. */
  incomingPaused: boolean | null
}

const asBool = (d: unknown[]): boolean | null => (typeof d[0] === "boolean" ? d[0] : null)
const asNum = (d: unknown[]): number | null => {
  const v = d[0]
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Read what is knowable about a wallet's confidential balance for one asset.
 *
 * Returns null ONLY when the presence check itself could not be answered. An
 * `aborted` view is the chain saying the resource does not exist, which is a
 * real answer of "no store", not a failure.
 */
export async function getConfidentialState(
  address: string,
  metadata: string = APT_FA_METADATA,
): Promise<ConfidentialState | null> {
  const owner = normalizeAptosAddress(address)
  const fn = (name: string) => `0x1::confidential_asset::${name}`

  const presence = await viewFunctionResult(fn("has_confidential_store"), [], [owner, metadata])
  if (!presence.ok) {
    // The VM rejecting the call means the store resource is not there. Being
    // unable to reach the node means we know nothing, and saying "no
    // confidential balance" then would be the exact bug this file exists for.
    if (presence.kind === "aborted") {
      return { hasStore: false, transfersPending: null, normalized: null, incomingPaused: null }
    }
    return null
  }

  const hasStore = asBool(presence.data) === true
  if (!hasStore) {
    return { hasStore: false, transfersPending: null, normalized: null, incomingPaused: null }
  }

  // Operational detail, only worth asking for once a store exists. Each is
  // independently allowed to fail: a rate-limited flag must not discard the
  // presence finding, which is the part that stops us saying "empty".
  const [pending, normalized, paused] = await Promise.all([
    viewFunctionResult(fn("get_num_transfers_received"), [], [owner, metadata]),
    viewFunctionResult(fn("is_normalized"), [], [owner, metadata]),
    viewFunctionResult(fn("incoming_transfers_paused"), [], [owner, metadata]),
  ])

  return {
    hasStore: true,
    transfersPending: pending.ok ? asNum(pending.data) : null,
    normalized: normalized.ok ? asBool(normalized.data) : null,
    incomingPaused: paused.ok ? asBool(paused.data) : null,
  }
}

/**
 * The model-facing note for a confidential state. Written here rather than in
 * the prompt so that the wording travels with the facts, and so it cannot drift
 * into implying we know an amount.
 */
export function confidentialNote(state: ConfidentialState | null): string | null {
  if (state === null) {
    return "Could not check whether this wallet holds a confidential (cAPT) balance: the lookup failed. Do NOT say they have none, and do not present the visible balance as their whole holding."
  }
  if (!state.hasStore) return null

  const parts = [
    "This wallet HOLDS A CONFIDENTIAL BALANCE (cAPT) in addition to the visible balances above.",
    "The amount is encrypted on chain and only the holder can decrypt it, so you do NOT know it and must not guess or imply a figure.",
    "Say plainly that the visible balance is not their whole holding, and that the confidential part is private by design and visible only in their own wallet.",
  ]
  if (state.transfersPending !== null && state.transfersPending > 0) {
    parts.push(
      `${state.transfersPending} confidential transfer${state.transfersPending === 1 ? "" : "s"} have arrived since their last rollover. Incoming confidential transfers sit in a PENDING balance and do not appear in the available balance until the holder rolls them over in their wallet. If they are asking why a transfer they received has not shown up, this is why.`,
    )
  }
  if (state.normalized === false) {
    parts.push(
      "Their confidential balance is NOT normalized. Confidential transfers and withdrawals will keep failing until they normalize it in their wallet. If they are asking why a confidential transfer failed, lead with this.",
    )
  }
  if (state.incomingPaused === true) {
    parts.push(
      "They have PAUSED incoming confidential transfers, so nobody can send them cAPT until they unpause it. If someone reports being unable to send them cAPT, this is the reason.",
    )
  }
  return parts.join(" ")
}
