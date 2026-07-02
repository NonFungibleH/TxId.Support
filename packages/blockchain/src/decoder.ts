import { CHAIN_CONFIGS } from "./types"
import type { DecodedRevert } from "./types"

const ERROR_SELECTOR = "08c379a0" // Error(string)
const PANIC_SELECTOR = "4e487b71" // Panic(uint256)

const PANIC_MESSAGES: Record<number, string> = {
  0x01: "An assertion check failed inside the contract",
  0x11: "An arithmetic overflow or underflow occurred",
  0x12: "A division by zero was attempted",
  0x21: "An invalid enum value was used",
  0x22: "Incorrectly encoded storage byte array",
  0x31: "An array .pop() was called on an empty array",
  0x32: "An array index was out of bounds",
  0x41: "The contract ran out of memory",
  0x51: "A zero-initialized function pointer was called",
}

const EXPLORER_APIS: Record<string, { url: string; keyEnv: string }> = {
  "0x1":      { url: "https://api.etherscan.io/api",            keyEnv: "ETHERSCAN_API_KEY" },
  "0x2105":   { url: "https://api.basescan.org/api",            keyEnv: "BASESCAN_API_KEY"  },
  "0x38":     { url: "https://api.bscscan.com/api",             keyEnv: "BSCSCAN_API_KEY"   },
  "0x89":     { url: "https://api.polygonscan.com/api",         keyEnv: "ETHERSCAN_API_KEY" },
  "0xa4b1":   { url: "https://api.arbiscan.io/api",             keyEnv: "ETHERSCAN_API_KEY" },
  "0xa":      { url: "https://api-optimistic.etherscan.io/api", keyEnv: "ETHERSCAN_API_KEY" },
  "0xaa36a7": { url: "https://api-sepolia.etherscan.io/api",    keyEnv: "ETHERSCAN_API_KEY" },
}

/**
 * Replay a transaction via eth_call at the block it was mined.
 * The revert reason shows up in the error.data field of the JSON-RPC response.
 */
async function fetchRevertHex(
  from: string,
  to: string,
  value: string,
  input: string,
  blockNumber: string,
  rpcUrl: string,
): Promise<string | null> {
  try {
    const blockHex = "0x" + parseInt(blockNumber, 10).toString(16)
    const valueHex = "0x" + BigInt(value || "0").toString(16)
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ from, to, value: valueHex, data: input || "0x" }, blockHex],
        id: 1,
      }),
      signal: AbortSignal.timeout(6000),
    })
    const json = (await res.json()) as {
      error?: { data?: string; message?: string }
    }
    return json.error?.data ?? null
  } catch {
    return null
  }
}

/** Look up a 4-byte error selector on 4byte.directory. */
async function lookup4Byte(selector: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`,
      { signal: AbortSignal.timeout(3000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { results?: Array<{ text_signature: string }> }
    return data.results?.[0]?.text_signature ?? null
  } catch {
    return null
  }
}

type AbiErrorEntry = { name: string; inputs: Array<{ name: string; type: string }> }
type RawAbiEntry = { type: string; name?: string; inputs?: Array<{ name: string; type: string }> }

function parseAbiErrors(abiJson: string): AbiErrorEntry[] {
  try {
    const abi = JSON.parse(abiJson) as RawAbiEntry[]
    return abi
      .filter((e) => e.type === "error" && e.name)
      .map((e) => ({ name: e.name!, inputs: e.inputs ?? [] }))
  } catch {
    return []
  }
}

/**
 * Fetch the full ABI JSON string for a contract from its block explorer.
 * Returns null if the contract is unverified or the API key is missing.
 */
export async function fetchAbiFromExplorer(address: string, chainId: string): Promise<string | null> {
  const explorerCfg = EXPLORER_APIS[chainId]
  if (!explorerCfg) return null
  // API key is optional — Etherscan-compatible APIs work without one (rate-limited to 5 req/s)
  const apiKey = process.env[explorerCfg.keyEnv] ?? ""
  try {
    const url = `${explorerCfg.url}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const data = (await res.json()) as { status: string; result: string }
    if (data.status !== "1") return null
    // Validate it's parseable JSON
    JSON.parse(data.result)
    return data.result
  } catch {
    return null
  }
}

/** Fetch error entries from a block explorer's ABI endpoint. */
async function fetchContractErrors(address: string, chainId: string): Promise<AbiErrorEntry[]> {
  const abiJson = await fetchAbiFromExplorer(address, chainId)
  return abiJson ? parseAbiErrors(abiJson) : []
}

/** Decode ABI-encoded Error(string) — strips 4-byte selector, reads string value. */
function decodeErrorString(revertHex: string): string | null {
  try {
    const data = revertHex.replace(/^0x/, "").slice(8)
    if (data.length < 128) return null
    const byteLen = parseInt(data.slice(64, 128), 16)
    if (byteLen === 0) return ""
    if (byteLen > 4096) return null
    const strHex = data.slice(128, 128 + byteLen * 2)
    return Buffer.from(strHex, "hex").toString("utf-8")
  } catch {
    return null
  }
}

/** Decode ABI-encoded Panic(uint256) — strips 4-byte selector, reads panic code. */
function decodePanicCode(revertHex: string): number | null {
  try {
    const data = revertHex.replace(/^0x/, "").slice(8)
    if (data.length < 64) return null
    return parseInt(data.slice(0, 64), 16)
  } catch {
    return null
  }
}

/**
 * Decode why a failed transaction reverted.
 * Replays the call via eth_call to get the revert data, then decodes it.
 * Falls back through: Error(string) → Panic → 4byte.directory → block explorer ABI → unknown.
 */
export async function decodeTxRevert(params: {
  from: string
  to: string | null
  value: string
  input: string
  blockNumber: string
  gasUsed: string
  gasLimit: string
  chainId: string
  /** Pre-loaded ABI JSON string — skips block explorer fetch if provided */
  preloadedAbi?: string
}): Promise<DecodedRevert> {
  const { from, to, value, input, blockNumber, gasUsed, gasLimit, chainId, preloadedAbi } = params
  const chain = CHAIN_CONFIGS[chainId]

  const gasUsedN = parseInt(gasUsed, 10) || 0
  const gasLimitN = parseInt(gasLimit, 10) || 0
  const percentUsed = gasLimitN > 0 ? Math.round((gasUsedN / gasLimitN) * 100) : 0
  const gasInfo = { used: gasUsedN, limit: gasLimitN, percentUsed }

  // Out-of-gas: gasUsed ≥ 99% of gasLimit
  if (percentUsed >= 99) {
    return {
      cause: "out_of_gas",
      reason: `Out of gas: ${gasUsedN.toLocaleString()} of ${gasLimitN.toLocaleString()} units consumed (${percentUsed}%). Increase the gas limit in your wallet before retrying.`,
      gasInfo,
    }
  }

  // No target contract or no RPC configured
  if (!to || !chain?.rpcUrl) {
    return { cause: "unknown_revert", reason: "Reverted by the smart contract.", gasInfo }
  }

  // Replay via eth_call to get the encoded revert reason
  const revertHex = await fetchRevertHex(from, to, value, input, blockNumber, chain.rpcUrl)

  if (!revertHex || revertHex === "0x" || revertHex.length < 10) {
    return { cause: "unknown_revert", reason: "The smart contract reverted but did not return a specific error message.", gasInfo }
  }

  const raw = revertHex.replace(/^0x/, "")
  const selector = raw.slice(0, 8).toLowerCase()

  // Standard revert string: Error(string)
  if (selector === ERROR_SELECTOR) {
    const message = decodeErrorString(revertHex)
    if (message !== null) {
      return { cause: "revert_reason", reason: message || "Reverted without a reason string.", rawHex: revertHex, gasInfo }
    }
  }

  // Solidity panic
  if (selector === PANIC_SELECTOR) {
    const code = decodePanicCode(revertHex)
    if (code !== null) {
      const reason = PANIC_MESSAGES[code] ?? `Unknown panic code 0x${code.toString(16)}`
      return { cause: "panic", reason, errorSignature: "Panic(uint256)", rawHex: revertHex, gasInfo }
    }
  }

  // Custom error — use preloaded ABI first, otherwise fetch in parallel with 4byte
  const preloadedErrors = preloadedAbi ? parseAbiErrors(preloadedAbi) : null
  const [sig4byte, explorerErrors] = await Promise.all([
    lookup4Byte(selector),
    preloadedErrors !== null ? Promise.resolve(preloadedErrors) : fetchContractErrors(to, chainId),
  ])

  // Match by name from ABI (if we got the ABI and the 4byte sig)
  const errorName = sig4byte?.split("(")[0]
  const abiMatch = errorName
    ? explorerErrors.find((e) => e.name === errorName)
    : undefined

  if (sig4byte) {
    const fullSig = abiMatch
      ? `${abiMatch.name}(${abiMatch.inputs.map((i) => i.type).join(",")})`
      : sig4byte
    const resolvedName = abiMatch?.name ?? errorName
    return {
      cause: "custom_error",
      reason: fullSig,
      ...(resolvedName ? { errorName: resolvedName } : {}),
      errorSignature: fullSig,
      rawHex: revertHex,
      gasInfo,
    }
  }

  // Completely unknown
  return {
    cause: "unknown_revert",
    reason: "The contract reverted with an unrecognized error.",
    rawHex: revertHex,
    gasInfo,
  }
}
