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
  events: { type: string; data: unknown }[]
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
