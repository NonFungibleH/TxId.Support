// Per-chain landing-page data. Each page blends the TxID dark system with the
// chain's own accent colour (applied by overriding the --accent CSS vars) and
// logo. Colours are brand-adjacent and easy to swap once official logos land.

export interface ChainFailure {
  title: string
  detail: string
}

export interface ChainInfo {
  slug: string
  name: string
  ticker: string
  family: "evm" | "non-evm"
  status: "live" | "coming-soon"
  /** Brand accent hex, themes the whole page. */
  color: string
  /** Logo path under /public. Missing files fall back to a monogram. */
  logo: string
  /** One-line hero subtitle. */
  tagline: string
  /** 1 to 2 sentence intro paragraph. */
  intro: string
  /** The chain-specific things the bot diagnoses, the SEO and sales meat. */
  failures: ChainFailure[]
  explorerName?: string
}

export const CHAINS: ChainInfo[] = [
  // ── EVM (live) ────────────────────────────────────────────────────────────
  {
    slug: "ethereum",
    name: "Ethereum",
    ticker: "ETH",
    family: "evm",
    status: "live",
    color: "#627EEA",
    logo: "/chains/Ethereum.png",
    explorerName: "Etherscan",
    tagline: "AI support that reads Ethereum, not just your docs.",
    intro:
      "Give your Ethereum users an assistant that looks up their actual transaction, decodes why it failed, and tells them the fix in plain English, right inside your product.",
    failures: [
      { title: "Reverted swaps and custom errors", detail: "Decodes SlippageTooHigh, Expired and any custom Solidity error into plain English, with the exact fix." },
      { title: "Out-of-gas failures", detail: "Tells the user it is the gas limit, not their ETH balance, and what to raise it to." },
      { title: "Stuck and underpriced transactions", detail: "Spots a pending nonce jam or a max fee below the base fee and explains how to unstick it." },
      { title: "Approvals and allowances", detail: "Checks whether the token approval actually went through before anyone blames the contract." },
    ],
  },
  {
    slug: "base",
    name: "Base",
    ticker: "ETH",
    family: "evm",
    status: "live",
    color: "#0052FF",
    logo: "/chains/Base.png",
    explorerName: "BaseScan",
    tagline: "AI support that speaks Base.",
    intro:
      "Base users move fast and get stuck fast. TxID diagnoses the real cause of a failed Base transaction, and when someone is on the wrong network it offers a one-tap switch.",
    failures: [
      { title: "Wrong network", detail: "Catches users still on Ethereum mainnet and offers a one-tap switch straight to Base." },
      { title: "No ETH for gas", detail: "Catches users who bridged tokens to Base but hold no ETH to cover gas, so nothing will send until they top up." },
      { title: "Failed swaps and reverts", detail: "Decodes the real revert reason from any Base contract, even unverified ones." },
      { title: "Slow bridge withdrawals", detail: "Explains the roughly seven-day withdrawal wait back to Ethereum, instead of a silent, worrying pending balance." },
    ],
  },
  {
    slug: "bnb",
    name: "BNB Chain",
    ticker: "BNB",
    family: "evm",
    status: "live",
    color: "#F0B90B",
    logo: "/chains/BNB.png",
    explorerName: "BscScan",
    tagline: "AI support built for BNB Chain's quirks.",
    intro:
      "Fee-on-transfer tokens, honeypots and slippage reverts make BNB support noisy. TxID screens the token and decodes the transaction so your team does not have to.",
    failures: [
      { title: "Token tax and fee-on-transfer", detail: "Flags fee-on-transfer tokens that quietly fail swaps at low slippage." },
      { title: "Honeypot and unsafe-token screening", detail: "Screens a token against on-chain safety signals before a user buys." },
      { title: "PancakeSwap slippage reverts", detail: "Explains INSUFFICIENT_OUTPUT_AMOUNT and the slippage fix in one message." },
      { title: "Gas price set too low", detail: "Spots a gas price under the current going rate and tells the user what to bump it to." },
    ],
  },
  {
    slug: "polygon",
    name: "Polygon",
    ticker: "POL",
    family: "evm",
    status: "live",
    color: "#8247E5",
    logo: "/chains/Polygon.png",
    explorerName: "PolygonScan",
    tagline: "AI support that knows Polygon's gas floor.",
    intro:
      "Polygon's minimum-fee floor and RPC lag trip users up constantly. TxID gives them the current safe fee and confirms whether the problem is the network or their own wallet RPC.",
    failures: [
      { title: "Underpriced transactions", detail: "Polygon's priority-fee floor trips users up. The bot gives the current safe max fee to set." },
      { title: "RPC lag and 'tx not found'", detail: "Confirms the network is healthy so users know it is their wallet RPC, not the chain." },
      { title: "POL and MATIC gas confusion", detail: "Explains the native-token gas requirement clearly after the MATIC to POL rename." },
      { title: "Reverted swaps and contract calls", detail: "Decodes the real revert reason on any Polygon contract, even unverified ones." },
    ],
  },
  {
    slug: "arbitrum",
    name: "Arbitrum",
    ticker: "ETH",
    family: "evm",
    status: "live",
    color: "#12AAFF",
    logo: "/chains/Arbitrum.png",
    explorerName: "Arbiscan",
    tagline: "AI support tuned to Arbitrum's L2 model.",
    intro:
      "Arbitrum's gas model and sequencer confuse users when things go wrong. TxID explains what actually happened and exactly what to do next.",
    failures: [
      { title: "No ETH for gas", detail: "Catches users who bridged tokens to Arbitrum but have no ETH to pay gas." },
      { title: "Sequencer and 'pending forever'", detail: "Tells users when it is the sequencer versus their own transaction." },
      { title: "Reverted trades", detail: "Decodes the real cause from any Arbitrum contract, even unverified ones." },
      { title: "Slow bridge withdrawals", detail: "Explains the roughly seven-day withdrawal wait to Ethereum, instead of leaving users guessing." },
    ],
  },
  {
    slug: "optimism",
    name: "Optimism",
    ticker: "ETH",
    family: "evm",
    status: "live",
    color: "#FF0420",
    logo: "/chains/Optimism.png",
    explorerName: "Optimistic Etherscan",
    tagline: "AI support that speaks the OP Stack.",
    intro:
      "From wrong-network mix-ups to a wallet with no ETH for gas, TxID gives Optimism users a straight answer instead of a support ticket.",
    failures: [
      { title: "Wrong network", detail: "Catches users on Ethereum mainnet and offers a one-tap switch to Optimism." },
      { title: "No ETH for gas", detail: "Catches users who bridged tokens to Optimism but hold no ETH to cover gas." },
      { title: "Failed swaps and reverts", detail: "Real revert decoding on any OP Stack contract, even unverified ones." },
      { title: "Slow bridge withdrawals", detail: "Explains the seven-day challenge period on withdrawals to Ethereum, instead of leaving users guessing." },
    ],
  },
  {
    slug: "avalanche",
    name: "Avalanche",
    ticker: "AVAX",
    family: "evm",
    status: "live",
    color: "#E84142",
    logo: "/chains/Avalanche.png",
    explorerName: "Snowtrace",
    tagline: "AI support for the Avalanche C-Chain.",
    intro:
      "TxID keeps Avalanche users on the C-Chain, gives them the right gas for a failed transaction, and decodes the real revert reason from any contract.",
    failures: [
      { title: "Wrong chain or subnet", detail: "Makes sure users are on the C-Chain, not an L1 subnet, and diagnoses accordingly." },
      { title: "AVAX gas failures", detail: "Gives the right gas for a failed C-Chain transaction." },
      { title: "Reverted contract calls", detail: "Decodes the real revert reason on any Avalanche contract, even unverified ones." },
      { title: "Router and DEX events", detail: "Explains swaps routed through aggregators, where the events live on the pool, not the router." },
    ],
  },

  // ── Non-EVM (coming soon) ──────────────────────────────────────────────────
  {
    slug: "solana",
    name: "Solana",
    ticker: "SOL",
    family: "non-evm",
    status: "coming-soon",
    color: "#9945FF",
    logo: "/chains/Solana.svg",
    explorerName: "Solscan",
    tagline: "Transaction diagnosis is coming to Solana.",
    intro:
      "Compute budgets, expired blockhashes and Anchor errors make Solana support its own language. TxID is bringing the same plain-English diagnosis to Solana. Talk to us for early access.",
    failures: [
      { title: "Compute-unit limit exceeded", detail: "Explains when a transaction ran out of compute budget and how to raise it." },
      { title: "Blockhash expired", detail: "Catches the classic 'transaction expired' and tells the user to simply retry." },
      { title: "Not enough SOL for fees or rent", detail: "Distinguishes a fee shortfall from a rent-exemption shortfall, which need different fixes." },
      { title: "Anchor program errors", detail: "Decodes custom Anchor error codes into plain English." },
    ],
  },
  {
    slug: "stellar",
    name: "Stellar",
    ticker: "XLM",
    family: "non-evm",
    status: "coming-soon",
    color: "#3E1BDB",
    logo: "/chains/Stellar.png",
    explorerName: "Stellar Expert",
    tagline: "Plain-English Stellar support is on the roadmap.",
    intro:
      "Trustlines, sequence numbers and reserves are where Stellar users get stuck. TxID is bringing Horizon-powered diagnosis to Stellar. Get in touch for early access.",
    failures: [
      { title: "Missing trustline (op_no_trust)", detail: "Explains that the account has not added a trustline for the asset, and how to add one." },
      { title: "Sequence number errors (tx_bad_seq)", detail: "Tells the user their sequence number was off and how to resubmit." },
      { title: "Fee below the network minimum", detail: "Catches tx_insufficient_fee and gives the current minimum to use." },
      { title: "Reserve and min-balance limits", detail: "Explains underfunded operations against Stellar's base-reserve requirement." },
    ],
  },
  {
    slug: "ton",
    name: "TON",
    ticker: "TON",
    family: "non-evm",
    status: "coming-soon",
    color: "#0098EA",
    logo: "/chains/TON.png",
    explorerName: "Tonviewer",
    tagline: "TON transaction diagnosis is coming.",
    intro:
      "TON's asynchronous, message-based model makes 'why did it fail' genuinely hard. TxID is bringing exit-code diagnosis to TON so your users get a real answer. Talk to us for early access.",
    failures: [
      { title: "Unknown opcode (exit 65535)", detail: "Explains that the contract had no receiver for the message, the most common TON failure." },
      { title: "Out of gas (exit 13)", detail: "Catches a compute-phase gas exhaustion and tells the user what to adjust." },
      { title: "Action-phase failures (exit 32 to 34)", detail: "Explains invalid, too many, or failed actions after a successful compute phase." },
      { title: "Bounced messages", detail: "Tells the user when their message bounced back instead of executing." },
    ],
  },
  {
    slug: "aptos",
    name: "Aptos",
    ticker: "APT",
    family: "non-evm",
    status: "coming-soon",
    color: "#2DD8A5",
    logo: "/chains/Aptos.png",
    explorerName: "Aptos Explorer",
    tagline: "Move-native support is on the roadmap.",
    intro:
      "Aptos runs on Move, with its own abort codes and gas model. TxID is bringing plain-English diagnosis to Aptos. Get in touch to shape it and get early access.",
    failures: [
      { title: "Move aborts", detail: "Decodes a Move abort, its module and reason code, into plain English with the fix." },
      { title: "Out of gas", detail: "Explains an out-of-gas failure and the max-gas and gas-price to set." },
      { title: "Sequence number errors", detail: "Catches a sequence number that is too old or too new and tells the user how to resubmit." },
      { title: "Not enough balance for fees", detail: "Distinguishes a fee shortfall from the actual transfer amount." },
    ],
  },
]

export function getChain(slug: string): ChainInfo | undefined {
  return CHAINS.find((c) => c.slug === slug)
}

/** #rrggbb to rgba(...) with the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Readable text colour (black/white) for a solid fill of the given hex. */
export function readableText(hex: string): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.6 ? "#0b0c14" : "#ffffff"
}

/** CSS-var overrides that retint the TxID system to a chain's accent. */
export function accentVars(color: string): Record<string, string> {
  return {
    ["--accent"]: color,
    ["--accent-hover"]: color,
    ["--accent-muted"]: hexToRgba(color, 0.12),
    ["--border-accent"]: hexToRgba(color, 0.3),
  }
}
