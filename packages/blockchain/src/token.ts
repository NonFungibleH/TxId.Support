import { CHAIN_CONFIGS } from "./types"
import { functionSelector } from "./keccak"
import { encodeStaticArg } from "./abi"

// ERC-20 is a standard interface, so we can read any token by address without
// its ABI. All reads are eth_call against the chain's public RPC (no key).

const UINT_MAX_HALF = 1n << 255n // treat allowances above this as "unlimited"

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

function decodeUint(raw: string | null): bigint | null {
  if (!raw || raw === "0x") return null
  try { return BigInt(raw) } catch { return null }
}

function decodeString(raw: string | null): string | undefined {
  if (!raw || raw.length <= 2) return undefined
  const hex = raw.replace(/^0x/, "")
  try {
    // dynamic string: [offset][len][data]
    const len = Number(BigInt("0x" + hex.slice(64, 128)))
    if (len > 0 && len < 256) {
      const s = Buffer.from(hex.slice(128, 128 + len * 2), "hex").toString("utf-8").replace(/\0/g, "").trim()
      if (s) return s
    }
  } catch { /* fall through to bytes32 */ }
  const s = Buffer.from(hex, "hex").toString("utf-8").replace(/\0/g, "").trim()
  return s || undefined
}

function formatUnits(raw: bigint, decimals?: number): string | undefined {
  if (decimals === undefined) return undefined
  try {
    const base = 10n ** BigInt(decimals)
    const whole = raw / base
    const frac = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 6)
    const wholeStr = whole.toLocaleString("en-US")
    return frac ? `${wholeStr}.${frac}` : wholeStr
  } catch {
    return undefined
  }
}

export interface TokenInfo {
  address: string
  name?: string
  symbol?: string
  decimals?: number
  totalSupply?: string
  totalSupplyFormatted?: string
}

/** name / symbol / decimals / totalSupply for any ERC-20 token. */
export async function getTokenInfo(token: string, chainId: string): Promise<TokenInfo | null> {
  const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
  if (!rpcUrl) return null
  const [nameRaw, symRaw, decRaw, supRaw] = await Promise.all([
    ethCall(rpcUrl, token, functionSelector("name()")),
    ethCall(rpcUrl, token, functionSelector("symbol()")),
    ethCall(rpcUrl, token, functionSelector("decimals()")),
    ethCall(rpcUrl, token, functionSelector("totalSupply()")),
  ])
  const dec = decodeUint(decRaw)
  const decimals = dec !== null ? Number(dec) : undefined
  const supply = decodeUint(supRaw)
  const info: TokenInfo = { address: token }
  const name = decodeString(nameRaw)
  const symbol = decodeString(symRaw)
  if (name) info.name = name
  if (symbol) info.symbol = symbol
  if (decimals !== undefined) info.decimals = decimals
  if (supply !== null) {
    info.totalSupply = supply.toString()
    const fmt = formatUnits(supply, decimals)
    if (fmt) info.totalSupplyFormatted = fmt
  }
  return name || symbol || supply !== null ? info : null
}

export interface TokenAllowance {
  token: string
  owner: string
  spender: string
  allowance: string
  allowanceFormatted?: string
  isUnlimited: boolean
  approvalNeeded: boolean
}

/** ERC-20 allowance(owner, spender) — "does owner need to approve spender?". */
export async function getTokenAllowance(
  token: string,
  owner: string,
  spender: string,
  chainId: string,
): Promise<TokenAllowance | null> {
  const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
  if (!rpcUrl) return null
  const data =
    functionSelector("allowance(address,address)") +
    encodeStaticArg("address", owner) +
    encodeStaticArg("address", spender)
  const [allowRaw, decRaw] = await Promise.all([
    ethCall(rpcUrl, token, data),
    ethCall(rpcUrl, token, functionSelector("decimals()")),
  ])
  const allowance = decodeUint(allowRaw)
  if (allowance === null) return null
  const dec = decodeUint(decRaw)
  const decimals = dec !== null ? Number(dec) : undefined
  const result: TokenAllowance = {
    token,
    owner,
    spender,
    allowance: allowance.toString(),
    isUnlimited: allowance >= UINT_MAX_HALF,
    approvalNeeded: allowance === 0n,
  }
  const fmt = formatUnits(allowance, decimals)
  if (fmt) result.allowanceFormatted = fmt
  return result
}

export interface TokenPrice {
  priceUsd?: string
  symbol?: string
  dex?: string
  chain?: string
  liquidityUsd?: number
  pairUrl?: string
}

// Our chain IDs → DexScreener chain names, so we don't pick a same-address
// impostor token on a different chain (e.g. a PulseChain fork of USDC).
const DEXSCREENER_CHAIN: Record<string, string> = {
  "0x1": "ethereum", "0x2105": "base", "0x38": "bsc", "0x89": "polygon",
  "0xa4b1": "arbitrum", "0xa": "optimism", "0xa86a": "avalanche",
}

/**
 * Token USD price via DexScreener (free, no key). Filters to the given chain
 * (when known) so a same-address token on another chain can't win on liquidity,
 * then picks the deepest-liquidity pair.
 */
export async function getTokenPrice(token: string, chainId?: string): Promise<TokenPrice | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      pairs?: Array<{
        priceUsd?: string
        dexId?: string
        chainId?: string
        url?: string
        liquidity?: { usd?: number }
        baseToken?: { symbol?: string }
      }>
    }
    let pairs = (data.pairs ?? []).filter(p => p.priceUsd)
    const wantChain = chainId ? DEXSCREENER_CHAIN[chainId] : undefined
    if (wantChain) {
      const onChain = pairs.filter(p => p.chainId === wantChain)
      if (onChain.length) pairs = onChain
    }
    if (!pairs.length) return null
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    const top = pairs[0]!
    const out: TokenPrice = {}
    if (top.priceUsd) out.priceUsd = top.priceUsd
    if (top.baseToken?.symbol) out.symbol = top.baseToken.symbol
    if (top.dexId) out.dex = top.dexId
    if (top.chainId) out.chain = top.chainId
    if (top.liquidity?.usd !== undefined) out.liquidityUsd = top.liquidity.usd
    if (top.url) out.pairUrl = top.url
    return out
  } catch {
    return null
  }
}

// A chain's native gas token → its wrapped ERC-20 (which DexScreener prices)
// and the native symbol to report. Lets us answer "what's the price of AVAX/
// ETH/BNB" — the native token has no ERC-20 address of its own.
const NATIVE_WRAPPED: Record<string, { symbol: string; wrapped: string }> = {
  "0x1":    { symbol: "ETH",   wrapped: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
  "0x2105": { symbol: "ETH",   wrapped: "0x4200000000000000000000000000000000000006" },
  "0xa":    { symbol: "ETH",   wrapped: "0x4200000000000000000000000000000000000006" },
  "0xa4b1": { symbol: "ETH",   wrapped: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
  "0x38":   { symbol: "BNB",   wrapped: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" },
  "0x89":   { symbol: "POL",   wrapped: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" },
  "0xa86a": { symbol: "AVAX",  wrapped: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7" },
}

/**
 * USD price of a chain's NATIVE gas token (AVAX, ETH, BNB, POL…), via its
 * wrapped ERC-20 on DexScreener. Returns null for unknown chains.
 */
export async function getNativeTokenPrice(chainId: string): Promise<TokenPrice | null> {
  const native = NATIVE_WRAPPED[chainId]
  if (!native) return null
  const price = await getTokenPrice(native.wrapped, chainId)
  if (!price) return null
  return { ...price, symbol: native.symbol }
}
