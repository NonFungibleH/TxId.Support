import { CHAIN_CONFIGS } from "./types"
import { functionSelector } from "./keccak"
import { encodeStaticArg, isStaticType } from "./abi"
import { getTokenPrice } from "./token"

// ── Wallet-executed actions ("Actions" feature) ─────────────────────────────
// Builders for unsigned transactions the USER signs in their own wallet.
// TxID never sends transactions, never holds keys, never charges a fee.
// Swaps route through the KyberSwap Aggregator public API; contract actions
// encode calldata from the protocol's stored ABI. Every builder is policy-
// checked by the caller (apps/app) — nothing here grants permission.

export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

// Curated per-chain routable majors. Addresses are canonical deployments;
// verified during pilot QA before GA (see design doc, Manual QA script).
export const MAJOR_TOKENS: Record<string, Record<string, string>> = {
  "0x1": {
    ETH: NATIVE_TOKEN,
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  "0x2105": {
    ETH: NATIVE_TOKEN,
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  "0x38": {
    BNB: NATIVE_TOKEN,
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  },
  "0x89": {
    POL: NATIVE_TOKEN,
    WPOL: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  "0xa4b1": {
    ETH: NATIVE_TOKEN,
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  "0xa": {
    ETH: NATIVE_TOKEN,
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },
  "0xa86a": {
    AVAX: NATIVE_TOKEN,
    WAVAX: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  },
}

const KYBER_CHAIN: Record<string, string> = {
  "0x1": "ethereum",
  "0x2105": "base",
  "0x38": "bsc",
  "0x89": "polygon",
  "0xa4b1": "arbitrum",
  "0xa": "optimism",
  "0xa86a": "avalanche",
}

interface RpcResponse { result?: string; error?: { message?: string } }

async function rpc(rpcUrl: string, method: string, params: unknown[]): Promise<RpcResponse | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return (await res.json()) as RpcResponse
  } catch {
    return null
  }
}

/** Decimal string ("10", "0.5") → raw base units. Throws on malformed input. */
export function toRawAmount(amount: string, decimals: number): bigint {
  const trimmed = amount.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid amount: ${amount}`)
  const [whole, frac = ""] = trimmed.split(".")
  if (frac.length > decimals) throw new Error(`Too many decimal places for this token (max ${decimals})`)
  return BigInt(whole + frac.padEnd(decimals, "0"))
}

export function fromRawAmount(raw: string | bigint, decimals: number): string {
  const s = BigInt(raw).toString().padStart(decimals + 1, "0")
  const whole = s.slice(0, s.length - decimals)
  const frac = s.slice(s.length - decimals).replace(/0+$/, "")
  return frac ? `${whole}.${frac.slice(0, 6)}` : whole
}

export async function getTokenDecimals(token: string, chainId: string): Promise<number | null> {
  if (token.toLowerCase() === NATIVE_TOKEN.toLowerCase()) return 18
  const config = CHAIN_CONFIGS[chainId]
  if (!config?.rpcUrl) return null
  const res = await rpc(config.rpcUrl, "eth_call", [{ to: token, data: functionSelector("decimals()") }, "latest"])
  if (!res?.result || res.result === "0x") return null
  try { return Number(BigInt(res.result)) } catch { return null }
}

export async function getAllowance(token: string, owner: string, spender: string, chainId: string): Promise<bigint | null> {
  const config = CHAIN_CONFIGS[chainId]
  if (!config?.rpcUrl) return null
  const data = functionSelector("allowance(address,address)") + encodeStaticArg("address", owner) + encodeStaticArg("address", spender)
  const res = await rpc(config.rpcUrl, "eth_call", [{ to: token, data }, "latest"])
  if (!res?.result || res.result === "0x") return null
  try { return BigInt(res.result) } catch { return null }
}

/** Exact-amount approve calldata — never infinite. */
export function buildApproveTx(token: string, spender: string, amountRaw: bigint): { to: string; data: string; value: string } {
  const data = functionSelector("approve(address,uint256)") + encodeStaticArg("address", spender) + encodeStaticArg("uint256", amountRaw.toString())
  return { to: token, data, value: "0x0" }
}

export interface PreflightResult {
  wouldFail: boolean
  revertReason?: string
  gas?: string
}

/** eth_estimateGas from the user's address, value-aware. */
export async function preflightTx(
  chainId: string,
  from: string,
  to: string,
  data: string,
  value?: string,
): Promise<PreflightResult | null> {
  const config = CHAIN_CONFIGS[chainId]
  if (!config?.rpcUrl) return null
  const tx: Record<string, string> = { from, to, data }
  if (value && value !== "0x0" && value !== "0") tx.value = value
  const est = await rpc(config.rpcUrl, "eth_estimateGas", [tx])
  if (!est) return null
  if (est.error) return { wouldFail: true, revertReason: est.error.message ?? "execution reverted" }
  if (!est.result) return null
  return { wouldFail: false, gas: est.result }
}

// ── KyberSwap Aggregator adapter ────────────────────────────────────────────

const KYBER_BASE = "https://aggregator-api.kyberswap.com"
const KYBER_CLIENT_ID = "txid-support"

export interface SwapQuote {
  routeSummary: unknown
  routerAddress: string
  amountIn: string
  amountOut: string
  amountInUsd: number | null
  amountOutUsd: number | null
}

export async function kyberQuote(
  chainId: string,
  tokenIn: string,
  tokenOut: string,
  amountInRaw: string,
): Promise<SwapQuote | { error: string }> {
  const chain = KYBER_CHAIN[chainId]
  if (!chain) return { error: "Swaps are not supported on this chain." }
  try {
    const url = `${KYBER_BASE}/${chain}/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountInRaw}`
    const res = await fetch(url, { headers: { "x-client-id": KYBER_CLIENT_ID }, signal: AbortSignal.timeout(15000) })
    const body = (await res.json()) as {
      code?: number
      message?: string
      data?: { routeSummary?: { amountIn: string; amountOut: string; amountInUsd?: string; amountOutUsd?: string }; routerAddress?: string }
    }
    const rs = body.data?.routeSummary
    if (!res.ok || body.code !== 0 || !rs || !body.data?.routerAddress) {
      return { error: body.message ?? "No route found for this pair right now." }
    }
    return {
      routeSummary: rs,
      routerAddress: body.data.routerAddress,
      amountIn: rs.amountIn,
      amountOut: rs.amountOut,
      amountInUsd: rs.amountInUsd ? Number(rs.amountInUsd) : null,
      amountOutUsd: rs.amountOutUsd ? Number(rs.amountOutUsd) : null,
    }
  } catch {
    return { error: "The swap route service is unreachable right now." }
  }
}

export interface BuiltSwap {
  to: string
  data: string
  value: string
  gas: string | null
  amountOut: string
  minAmountOut: string
}

export async function kyberBuild(
  chainId: string,
  routeSummary: unknown,
  sender: string,
  slippageBps = 100,
): Promise<BuiltSwap | { error: string }> {
  const chain = KYBER_CHAIN[chainId]
  if (!chain) return { error: "Swaps are not supported on this chain." }
  try {
    const res = await fetch(`${KYBER_BASE}/${chain}/api/v1/route/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-client-id": KYBER_CLIENT_ID },
      body: JSON.stringify({
        routeSummary,
        sender,
        recipient: sender,
        slippageTolerance: slippageBps,
        source: KYBER_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(15000),
    })
    const body = (await res.json()) as {
      code?: number
      message?: string
      data?: { data?: string; routerAddress?: string; amountOut?: string; gas?: string; transactionValue?: string }
    }
    const d = body.data
    if (!res.ok || body.code !== 0 || !d?.data || !d.routerAddress) {
      return { error: body.message ?? "Could not build the swap transaction." }
    }
    const amountOut = d.amountOut ?? "0"
    const minOut = (BigInt(amountOut) * BigInt(10000 - slippageBps)) / 10000n
    return {
      to: d.routerAddress,
      data: d.data,
      value: d.transactionValue ?? "0x0",
      gas: d.gas ?? null,
      amountOut,
      minAmountOut: minOut.toString(),
    }
  } catch {
    return { error: "The swap build service is unreachable right now." }
  }
}

/** USD value of a token amount, for the swap cap. Fail-closed: null = unknown. */
export async function usdValueOf(
  quoteUsd: number | null,
  token: string,
  chainId: string,
  amountHuman: string,
): Promise<number | null> {
  if (quoteUsd !== null && quoteUsd > 0) return quoteUsd
  if (token.toLowerCase() === NATIVE_TOKEN.toLowerCase()) return null
  const price = await getTokenPrice(token, chainId)
  if (!price?.priceUsd) return null
  return Number(amountHuman) * Number(price.priceUsd)
}

// ── Contract-action calldata (mirrors estimateAction's encoding rules) ──────

export interface EncodedAction {
  to: string
  data: string
  fnName: string
}

export function encodeContractAction(
  contractAddress: string,
  functionName: string,
  args: string[],
  abiJson: string,
): EncodedAction | { error: string } {
  type AbiIO = { type: string; name?: string }
  type AbiFn = { type: string; name?: string; inputs?: AbiIO[]; stateMutability?: string; constant?: boolean }
  let abi: AbiFn[]
  try { abi = JSON.parse(abiJson) as AbiFn[] } catch { return { error: "This contract's ABI is not available." } }
  const fn = abi.find(
    f =>
      f.type === "function" &&
      f.name?.toLowerCase() === functionName.toLowerCase() &&
      (f.inputs?.length ?? 0) === args.length &&
      f.stateMutability !== "view" &&
      f.stateMutability !== "pure" &&
      f.stateMutability !== "payable" &&
      f.constant !== true,
  )
  if (!fn?.name) return { error: `No matching non-payable write function "${functionName}" with ${args.length} argument(s).` }
  const inputs = fn.inputs ?? []
  if (inputs.some(i => !isStaticType(i.type))) return { error: "This function has argument types that are not supported yet." }
  try {
    const selector = functionSelector(`${fn.name}(${inputs.map(i => i.type).join(",")})`)
    const data = selector + inputs.map((inp, i) => encodeStaticArg(inp.type, args[i] ?? "0")).join("")
    return { to: contractAddress, data, fnName: fn.name }
  } catch {
    return { error: "Could not encode the transaction arguments." }
  }
}
