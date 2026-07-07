import { CHAIN_CONFIGS } from "./types"
import { functionSelector } from "./keccak"

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: string }
    return json.result ?? null
  } catch {
    return null
  }
}

type AbiFn = {
  type: string
  name?: string
  inputs?: unknown[]
  outputs?: Array<{ type: string }>
  stateMutability?: string
  constant?: boolean
}

export interface ContractStateValue {
  function: string
  type: string
  value: string
}

/** Names of no-argument view getters available on a contract (for suggesting the right one). */
export function viewGetterNames(abiJson: string | undefined): string[] {
  if (!abiJson) return []
  try {
    const abi = JSON.parse(abiJson) as AbiFn[]
    return abi
      .filter(
        f =>
          f.type === "function" &&
          !!f.name &&
          (f.inputs?.length ?? 0) === 0 &&
          (f.outputs?.length ?? 0) > 0 &&
          (f.stateMutability === "view" || f.stateMutability === "pure" || f.constant === true),
      )
      .map(f => f.name!)
  } catch {
    return []
  }
}

/**
 * Read the current value of a no-argument view function (a getter) on a contract
 * via eth_call against the chain's public RPC. Decodes simple return types
 * (uint/int, bool, address, string). Returns null if the function isn't a
 * readable no-arg getter or the call fails — never throws.
 */
export async function getContractState(
  contractAddress: string,
  chainId: string,
  functionName: string,
  abiJson: string | undefined,
): Promise<ContractStateValue | null> {
  try {
    if (!abiJson) return null
    const abi = JSON.parse(abiJson) as AbiFn[]
    const fn = abi.find(
      f =>
        f.type === "function" &&
        f.name?.toLowerCase() === functionName.toLowerCase() &&
        (f.inputs?.length ?? 0) === 0 &&
        (f.outputs?.length ?? 0) > 0 &&
        (f.stateMutability === "view" || f.stateMutability === "pure" || f.constant === true),
    )
    if (!fn?.name || !fn.outputs?.length) return null
    const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
    if (!rpcUrl) return null

    const raw = await ethCall(rpcUrl, contractAddress, functionSelector(`${fn.name}()`))
    if (!raw || raw === "0x") return null
    const hex = raw.replace(/^0x/, "")
    const outType = fn.outputs[0]!.type

    let value: string
    if (outType.startsWith("uint") || outType.startsWith("int")) {
      value = BigInt("0x" + (hex.slice(0, 64) || "0")).toString()
    } else if (outType === "bool") {
      value = BigInt("0x" + (hex.slice(0, 64) || "0")) !== 0n ? "true" : "false"
    } else if (outType === "address") {
      value = "0x" + hex.slice(24, 64)
    } else if (outType === "string") {
      const len = Number(BigInt("0x" + (hex.slice(64, 128) || "0")))
      value = Buffer.from(hex.slice(128, 128 + len * 2), "hex").toString("utf-8")
    } else {
      value = "0x" + hex.slice(0, 64)
    }
    return { function: fn.name, type: outType, value }
  } catch {
    return null
  }
}
