import { CHAIN_CONFIGS } from "./types"
import { sanitizeChainText } from "./text"
import type { DecodedRevert } from "./types"
import { explorerQuery } from "./blockscout"

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

/**
 * Replay a transaction via eth_call at the block it was mined.
 * The revert reason shows up in the error.data field of the JSON-RPC response.
 */
/**
 * The replay either RAN or it did not, and the two must never be confused.
 *
 * A node that refuses the call (no archive state, rate limit, auth required,
 * timeout) returns an error with a message and NO data, which is byte for byte
 * what a genuine reason-less revert looks like here. Collapsing them made the
 * decoder report "the contract reverted but did not return an error message",
 * i.e. a claim about the CONTRACT, when the truth was that we never got to
 * look. That produced a fluent, confident and wrong diagnosis on a transaction
 * whose reason was in fact readable.
 */
type RevertProbe =
  /** The node replayed the call. `reverted: false` means it SUCCEEDED, which for
   *  a transaction that failed on-chain is a finding of its own (see below). */
  | { ran: true; reverted: boolean; hex: string | null }
  | { ran: false; note: string }

/** Node messages that mean "I cannot serve this", not "the call reverted". */
const CANNOT_SERVE =
  /missing trie node|archive|not available|unauthorized|personal token|api key|rate ?limit|too many requests|exceed|unsupported|method not found|header not found|state.*unavailable/i

async function fetchRevertHex(
  from: string,
  to: string,
  value: string,
  input: string,
  blockNumber: string,
  rpcUrl: string,
): Promise<RevertProbe> {
  try {
    // Replay against the state at the START of the transaction's block, which is
    // the end of the previous one. eth_call at block N runs against the state
    // AFTER every transaction in N, including the ones that came after ours.
    const blockHex = "0x" + Math.max(0, parseInt(blockNumber, 10) - 1).toString(16)
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
    if (!res.ok) return { ran: false, note: `RPC returned HTTP ${res.status}` }
    const json = (await res.json()) as {
      result?: unknown
      error?: { data?: string; message?: string }
    }
    if (json.error?.data) return { ran: true, reverted: true, hex: json.error.data }
    const message = json.error?.message ?? ""
    if (message && CANNOT_SERVE.test(message)) return { ran: false, note: message.slice(0, 160) }
    // These two used to be one case, and they are opposite facts. An error with
    // no data is a contract that reverted silently. A clean RESULT is a call
    // that succeeded on replay, for a transaction that failed on-chain: the
    // failure depended on state that changed within its block. On an exchange
    // that is the commonest failure there is, and it was being reported as
    // "the contract gave no reason" followed by a guess.
    if (json.error) return { ran: true, reverted: true, hex: null }
    return { ran: true, reverted: false, hex: null }
  } catch (e) {
    return { ran: false, note: e instanceof Error ? e.message.slice(0, 160) : "replay failed" }
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
    const sig = data.results?.[0]?.text_signature
    // 4byte is a public, writable registry. Anyone can register any text.
    return sig ? sanitizeChainText(sig, 120) : null
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
 * Tries Etherscan V2, then Blockscout (free) — so Base/Optimism/Polygon/Arbitrum
 * ABIs auto-fetch too. Returns null if the contract is unverified or unreachable.
 */
export async function fetchAbiFromExplorer(address: string, chainId: string): Promise<string | null> {
  try {
    const r = await explorerQuery(chainId, { module: "contract", action: "getabi", address })
    if (!r || r.status !== "1" || typeof r.result !== "string") return null
    JSON.parse(r.result) // validate it's parseable JSON
    return r.result
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
  const probe = await fetchRevertHex(from, to, value, input, blockNumber, chain.rpcUrl)

  if (!probe.ran) {
    return {
      cause: "unknown_revert",
      replayUnavailable: true,
      reason:
        "The revert reason could not be READ: this node could not replay the transaction at its block, so the contract's own error was never retrieved. This is a limit of our lookup, NOT a statement that the contract failed silently.",
      gasInfo,
    }
  }

  if (!probe.reverted) {
    return {
      cause: "state_dependent",
      reason:
        "The transaction failed on-chain, but replaying it against the state just before its block succeeds. The failure depended on something that changed in the same block: most often another trade moving the price past the slippage limit, or a competing transaction taking the liquidity or position first.",
      gasInfo,
    }
  }

  const revertHex = probe.hex
  if (!revertHex || revertHex === "0x" || revertHex.length < 10) {
    return { cause: "unknown_revert", reason: "The smart contract reverted but did not return a specific error message.", gasInfo }
  }

  const raw = revertHex.replace(/^0x/, "")
  const selector = raw.slice(0, 8).toLowerCase()

  // Standard revert string: Error(string)
  if (selector === ERROR_SELECTOR) {
    const message = decodeErrorString(revertHex)
    if (message !== null) {
      return { cause: "revert_reason", reason: sanitizeChainText(message, 200) || "Reverted without a reason string.", rawHex: revertHex, gasInfo }
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
