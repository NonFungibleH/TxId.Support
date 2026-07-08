import { CHAIN_CONFIGS } from "./types"

// GoPlus Security token_security API — free, keyless. Chain path segment is the
// DECIMAL chain id.
const GOPLUS_CHAINS: Record<string, string> = {
  "0x1": "1",
  "0x38": "56",
  "0x89": "137",
  "0xa": "10",
  "0xa4b1": "42161",
  "0x2105": "8453",
  "0xe708": "59144",
}

export interface TokenSafety {
  token: string
  chain: string
  /** Human-readable red flags, empty when nothing concerning was found. */
  flags: string[]
  isHoneypot: boolean | null
  buyTaxPercent: number | null
  sellTaxPercent: number | null
  isMintable: boolean | null
  isOpenSource: boolean | null
  hasBlacklist: boolean | null
  transfersPausable: boolean | null
  ownerCanChangeBalance: boolean | null
  canTakeBackOwnership: boolean | null
  holderCount: number | null
  source: string
}

type GoPlusToken = Record<string, string | undefined>

function bool(v: string | undefined): boolean | null {
  if (v === "1") return true
  if (v === "0") return false
  return null
}

function taxPercent(v: string | undefined): number | null {
  if (v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 10000) / 100 : null
}

/**
 * Screen a token contract for scam/honeypot characteristics via the GoPlus
 * Security API (free, keyless): honeypot, buy/sell tax, mintability,
 * blacklists, pausable transfers, balance manipulation, unverified source.
 * Returns null when the chain is unsupported or the API fails — never throws.
 */
export async function getTokenSafety(token: string, chainId: string): Promise<TokenSafety | null> {
  try {
    const dec = GOPLUS_CHAINS[chainId.toLowerCase()]
    if (!dec) return null
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${dec}?contract_addresses=${token}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return null
    const json = (await res.json()) as { result?: Record<string, GoPlusToken> }
    const data = json.result?.[token.toLowerCase()]
    if (!data) return null

    const isHoneypot = bool(data.is_honeypot)
    const buyTaxPercent = taxPercent(data.buy_tax)
    const sellTaxPercent = taxPercent(data.sell_tax)
    const isMintable = bool(data.is_mintable)
    const isOpenSource = bool(data.is_open_source)
    const hasBlacklist = bool(data.is_blacklisted)
    const transfersPausable = bool(data.transfer_pausable)
    const ownerCanChangeBalance = bool(data.owner_change_balance)
    const canTakeBackOwnership = bool(data.can_take_back_ownership)

    const flags: string[] = []
    if (isHoneypot) flags.push("HONEYPOT: the token cannot be sold")
    if (sellTaxPercent !== null && sellTaxPercent >= 10) flags.push(`High sell tax: ${sellTaxPercent}%`)
    if (buyTaxPercent !== null && buyTaxPercent >= 10) flags.push(`High buy tax: ${buyTaxPercent}%`)
    if (ownerCanChangeBalance) flags.push("Owner can modify holder balances")
    if (isMintable) flags.push("Owner can mint new supply")
    if (canTakeBackOwnership) flags.push("Renounced ownership can be reclaimed")
    if (transfersPausable) flags.push("Transfers can be paused by the owner")
    if (hasBlacklist) flags.push("Has a blacklist function")
    if (isOpenSource === false) flags.push("Source code is not verified")

    return {
      token,
      chain: CHAIN_CONFIGS[chainId]?.name ?? chainId,
      flags,
      isHoneypot,
      buyTaxPercent,
      sellTaxPercent,
      isMintable,
      isOpenSource,
      hasBlacklist,
      transfersPausable,
      ownerCanChangeBalance,
      canTakeBackOwnership,
      holderCount: data.holder_count ? Number(data.holder_count) : null,
      source: "GoPlus Security API",
    }
  } catch {
    return null
  }
}
