export interface AptosBalance {
  address: string
  aptBalance: string
  aptRaw: string
  tokens: { assetType: string; symbol: string; name: string; amount: string; decimals: number }[]
}

export interface DecodedAbort {
  cause: "move_abort" | "out_of_gas" | "execution_failure" | "unknown"
  module: string | null
  code: number | null
  category: string | null
  errorName: string | null
  reason: string
  raw: string
}

export interface AptosTransaction {
  hash: string
  version: string
  success: boolean
  vmStatus: string
  timestamp: string
  /**
   * The elapsed time since `timestamp`, computed at read time, so the model
   * never subtracts two clocks itself. Null only when the timestamp did not
   * parse. See relativeAge() for the answer that made this necessary.
   */
  age: string | null
  sender: string
  functionId: string | null
  typeArguments: string[]
  gasUsed: string
  gasUnitPrice: string
  /** Total gas paid in octas (gasUsed x gasUnitPrice). 1 APT = 1e8 octas. */
  feeOctas: string
  /** Same fee rendered in APT, so the model never does the maths itself. */
  feeApt: string
  /**
   * How the transaction was authorised. Aptos has account abstraction in the
   * base layer, so this is a real user-facing fact, not plumbing:
   * "fee_payer" means someone else (usually the dApp) paid the gas,
   * "multi_agent" means several accounts signed, "single_sender" is the
   * ordinary case. Users ask "why was I not charged gas", and the answer is
   * here rather than in their balance history.
   */
  signatureType: string | null
  /** Set when the gas was sponsored by another account. */
  feePayer: string | null
  secondarySigners: string[]
  /** From the FeeStatement event. Null when the transaction emitted none. */
  feeBreakdown: {
    executionGasUnits: string | null
    ioGasUnits: string | null
    totalChargeGasUnits: string | null
    storageFeeOctas: string | null
    /** Octas refunded for state this transaction freed. */
    storageRefundOctas: string | null
  } | null
  events: { type: string; data: unknown }[]
  /**
   * The entry function's arguments, as the node returned them. Previously
   * dropped, which is why a failed order could not be described beyond its
   * error: the market, price and size a trader was acting on all live here.
   * Left raw and untyped because the layout differs per entry function;
   * anything that reads positionally must know the signature it is reading.
   */
  functionArguments: unknown[]
  /**
   * Which accounts this transaction actually wrote, summarised. A Move abort
   * cannot commit user state, so a failed transaction writes only the gas
   * payment. Carrying the addresses makes that checkable rather than asserted:
   * if the trader's account is not in this list, nothing of theirs moved.
   */
  stateWrites: { count: number; addresses: string[] }
  /**
   * Set when a watched protocol adapter recognises an object argument as one
   * of its markets. Lets an answer say "your ETH/USD order" instead of "your
   * order". Absent when nothing resolved, never guessed.
   */
  markets?: { object: string; name: string }[]
  decodedAbort?: DecodedAbort
}

export interface AptosModuleFunction {
  name: string
  isEntry: boolean
  isView: boolean
  params: string[]
  genericTypeParams: number
}

export interface AptosWalletDiagnosis {
  exists: boolean
  sequenceNumber: string | null
  aptBalance: string | null
  recentFailureCount: number | null
}

export interface AptosModuleAbi {
  address: string
  moduleName: string
  functions: AptosModuleFunction[]
}
