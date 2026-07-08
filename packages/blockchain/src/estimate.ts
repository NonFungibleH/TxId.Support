import { CHAIN_CONFIGS } from "./types"
import { functionSelector } from "./keccak"
import { encodeStaticArg, isStaticType } from "./abi"

type AbiIO = { type: string; name?: string }
type AbiFn = {
  type: string
  name?: string
  inputs?: AbiIO[]
  stateMutability?: string
  constant?: boolean
}

interface RpcError {
  code?: number
  message?: string
  data?: unknown
}

async function rpc(rpcUrl: string, method: string, params: unknown[]): Promise<{ result?: string; error?: RpcError } | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return (await res.json()) as { result?: string; error?: RpcError }
  } catch {
    return null
  }
}

export interface ActionEstimate {
  function: string
  from: string
  contract: string
  /** false = the node accepted the call; true = it would revert right now. */
  wouldFail: boolean
  revertReason?: string
  gasUnits?: string
  gasPriceGwei?: string
  estimatedCostNative?: string
  nativeCurrency?: string
}

/**
 * Pre-flight a WRITE action without sending it: eth_estimateGas from the user's
 * wallet with the exact calldata. Two outcomes, both useful:
 *  - success → the action would currently succeed + what it will cost in gas
 *  - revert  → the action would FAIL right now, with the node's revert message
 * Static argument types only (same constraint as getContractData).
 * Returns null on infrastructure failure — never throws.
 */
export async function estimateAction(
  contractAddress: string,
  chainId: string,
  functionName: string,
  args: string[],
  from: string,
  abiJson: string | undefined,
): Promise<ActionEstimate | null> {
  try {
    if (!abiJson) return null
    const abi = JSON.parse(abiJson) as AbiFn[]
    const fn = abi.find(
      f =>
        f.type === "function" &&
        f.name?.toLowerCase() === functionName.toLowerCase() &&
        (f.inputs?.length ?? 0) === args.length &&
        f.stateMutability !== "view" &&
        f.stateMutability !== "pure" &&
        f.constant !== true,
    )
    if (!fn?.name) return null
    const inputs = fn.inputs ?? []
    if (inputs.some(i => !isStaticType(i.type))) return null
    const config = CHAIN_CONFIGS[chainId]
    if (!config?.rpcUrl) return null

    const selector = functionSelector(`${fn.name}(${inputs.map(i => i.type).join(",")})`)
    const data = selector + inputs.map((inp, i) => encodeStaticArg(inp.type, args[i] ?? "0")).join("")

    const est = await rpc(config.rpcUrl, "eth_estimateGas", [{ from, to: contractAddress, data }])
    if (!est) return null

    const base: ActionEstimate = {
      function: fn.name,
      from,
      contract: contractAddress,
      wouldFail: false,
    }

    if (est.error) {
      // The node simulated the call and it reverted — that IS the diagnosis.
      const msg = est.error.message ?? "execution reverted"
      return { ...base, wouldFail: true, revertReason: msg }
    }
    if (!est.result) return null

    const gasUnits = BigInt(est.result)
    const priceRes = await rpc(config.rpcUrl, "eth_gasPrice", [])
    const gasPrice = priceRes?.result ? BigInt(priceRes.result) : null

    return {
      ...base,
      gasUnits: gasUnits.toString(),
      ...(gasPrice
        ? {
            gasPriceGwei: (Number(gasPrice) / 1e9).toFixed(2),
            estimatedCostNative: (Number(gasUnits * gasPrice) / 1e18).toFixed(6),
            nativeCurrency: config.nativeCurrency,
          }
        : {}),
    }
  } catch {
    return null
  }
}
