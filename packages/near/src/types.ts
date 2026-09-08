import type { DecodedNearError } from "./errors"

export interface NearBalance {
  /** Formatted NEAR, e.g. "134.323557". */
  near: string
  /** Raw yoctoNEAR. NEAR has 24 decimals, so this never survives a JS number. */
  yocto: string
  /**
   * What can actually be sent, after the storage the account is staking for.
   * NULL MEANS NOT COMPUTED, never zero, and never "all of it".
   */
  spendableNear: string | null
  /** Yocto locked against this account's own state, or null if not computed. */
  storageStakedYocto: string | null
  storageBytes: number | null
  tokens: NearTokenBalance[]
  /**
   * True when the fungible-token list could not be read. The list is then EMPTY
   * BECAUSE WE DID NOT LOOK, which is not the same as holding no tokens.
   */
  tokensUnavailable: boolean
}

export interface NearTokenBalance {
  /** The FT contract's account id, e.g. "usdt.tether-token.near". */
  contractId: string
  /** Raw integer string. Decimals live on the FT contract and are NOT assumed here. */
  amountRaw: string
}

export interface NearTransaction {
  hash: string
  signerId: string
  receiverId: string
  status: "success" | "failed"
  blockHeight: number | null
  timestamp: string | null
  /** Computed here so the model never subtracts two clocks. Null = not readable. */
  age: string | null
  /** Gas burnt across every receipt, in raw gas units. */
  gasBurnt: string | null
  /** Yocto actually spent on this transaction, across every receipt. */
  tokensBurntYocto: string | null
  /** The methods called, in order, as the transaction declared them. */
  methods: string[]
  /** The chain's own failure object, verbatim, for the record. */
  rawFailure: string | null
  decodedError?: DecodedNearError
}
