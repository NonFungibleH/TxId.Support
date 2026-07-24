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

export interface AptosModuleAbi {
  address: string
  moduleName: string
  functions: AptosModuleFunction[]
}
