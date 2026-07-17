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
      { title: "Honeypot and unsafe-token checks", detail: "When a user asks if a token is safe, it screens the contract for honeypot patterns and unsafe tax and reports what it finds." },
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

// ── Scripted interactive demos ────────────────────────────────────────────────
// One chain-specific conversation per page, played back with reading-paced
// delays by the ChainDemo component. Each shows a real failure on that chain
// being diagnosed. No em dashes (site style rule).

export interface DemoMessage {
  role: "ai" | "user"
  text: string
  /** ms after playback start when this message appears. */
  delay: number
}

export const CHAIN_DEMOS: Record<string, DemoMessage[]> = {
  ethereum: [
    { role: "ai", text: "Hi 👋 I can see your wallet is connected. Your swap a few minutes ago reverted. Want me to explain why?", delay: 0 },
    { role: "user", text: "Yes, what happened?", delay: 2500 },
    { role: "ai", text: "Your ETH to USDC swap reverted with SlippageTooHigh. The price moved 1.8% while it was pending, but your slippage tolerance was 0.5%.\n\nFix: raise slippage to 2% and retry.", delay: 5000 },
    { role: "user", text: "Did I still pay gas?", delay: 8500 },
    { role: "ai", text: "Yes, gas is charged even on failed transactions. Retry during off-peak hours and it will cost noticeably less.", delay: 11000 },
  ],
  base: [
    { role: "ai", text: "Hi 👋 Looks like your transaction will not go through. Give me a second to check.", delay: 0 },
    { role: "user", text: "It just keeps failing.", delay: 2500 },
    { role: "ai", text: "Found it. Your wallet is connected to Ethereum, but this app is on Base. That is why nothing is sending.\n\nWant me to switch you to Base?", delay: 5000 },
    { role: "user", text: "Yes please.", delay: 8000 },
    { role: "ai", text: "Done, you are on Base now. Try your transaction again. ✅", delay: 10000 },
  ],
  bnb: [
    { role: "ai", text: "Hi 👋 Your PancakeSwap swap just reverted. Want me to take a look?", delay: 0 },
    { role: "user", text: "Yeah, it failed twice.", delay: 2500 },
    { role: "ai", text: "This token charges a 5% transfer tax, so 0.5% slippage is never enough and the swap reverts with INSUFFICIENT_OUTPUT_AMOUNT.\n\nFix: set slippage to at least 6% for this token.", delay: 5000 },
    { role: "user", text: "Is the token even safe?", delay: 8500 },
    { role: "ai", text: "I screened it: liquidity is locked and there is no honeypot pattern, but the 5% tax is real. Trade with that in mind.", delay: 11000 },
  ],
  polygon: [
    { role: "ai", text: "Hi 👋 Your transaction has been pending for a while. Let me check the network.", delay: 0 },
    { role: "user", text: "It's stuck.", delay: 2500 },
    { role: "ai", text: "Your max fee is below Polygon's current floor, so validators are skipping it. The network itself is healthy, this is a fee issue.\n\nFix: resubmit with a max fee of at least 40 gwei.", delay: 5000 },
    { role: "user", text: "How do I do that?", delay: 8500 },
    { role: "ai", text: "In your wallet, speed up the transaction or set the gas to 'fast'. It will confirm within seconds.", delay: 11000 },
  ],
  arbitrum: [
    { role: "ai", text: "Hi 👋 I see your wallet on Arbitrum but the transaction is not going through. One second.", delay: 0 },
    { role: "user", text: "I bridged USDC over.", delay: 2500 },
    { role: "ai", text: "That is the issue: you have USDC on Arbitrum but 0 ETH, and gas is paid in ETH. Nothing will send until you have a little ETH.\n\nBridge or buy about $2 of ETH on Arbitrum and retry.", delay: 5000 },
    { role: "user", text: "Ah, that makes sense.", delay: 8500 },
    { role: "ai", text: "Once the ETH lands, your transaction will go straight through. 👍", delay: 10500 },
  ],
  optimism: [
    { role: "ai", text: "Hi 👋 Your transaction keeps failing. Let me diagnose it.", delay: 0 },
    { role: "user", text: "No idea why.", delay: 2500 },
    { role: "ai", text: "Your wallet is on Ethereum mainnet, but this app runs on Optimism. That is why it will not send.\n\nWant me to switch you to Optimism?", delay: 5000 },
    { role: "user", text: "Please do.", delay: 8000 },
    { role: "ai", text: "Switched. You are on Optimism now, try again. ✅", delay: 10000 },
  ],
  avalanche: [
    { role: "ai", text: "Hi 👋 I can see a failed transaction on your wallet. Want the reason?", delay: 0 },
    { role: "user", text: "Yes.", delay: 2500 },
    { role: "ai", text: "Your swap on the C-Chain reverted with a slippage error. It routed through an aggregator, so the price moved before it filled.\n\nFix: raise slippage to 2% and retry.", delay: 5000 },
    { role: "user", text: "Was it a gas problem?", delay: 8500 },
    { role: "ai", text: "No, you had enough AVAX for gas. It was purely slippage. Retry and it should fill.", delay: 11000 },
  ],
  solana: [
    { role: "ai", text: "Hi 👋 Your Solana transaction failed. Let me read the logs.", delay: 0 },
    { role: "user", text: "It said something about compute.", delay: 2500 },
    { role: "ai", text: "Right, it exceeded the compute-unit limit. Complex swaps need more than the default budget.\n\nFix: use the app's 'priority' option, or add a ComputeBudget instruction to raise the limit.", delay: 5000 },
    { role: "user", text: "Will it cost more?", delay: 9000 },
    { role: "ai", text: "Only a tiny priority fee, fractions of a cent. Then it will confirm.", delay: 11000 },
  ],
  stellar: [
    { role: "ai", text: "Hi 👋 Your payment failed. Give me a moment to check.", delay: 0 },
    { role: "user", text: "The recipient couldn't receive it.", delay: 2500 },
    { role: "ai", text: "The operation failed with op_no_trust. The recipient has not added a trustline for this asset, so they cannot hold it yet.\n\nFix: ask them to add a trustline for the asset, then resend.", delay: 5000 },
    { role: "user", text: "How do they do that?", delay: 9000 },
    { role: "ai", text: "In most Stellar wallets: Assets, then Add asset, then paste the issuer. After that your payment will go through.", delay: 11000 },
  ],
  ton: [
    { role: "ai", text: "Hi 👋 Your TON transaction bounced. Let me read the trace.", delay: 0 },
    { role: "user", text: "What went wrong?", delay: 2500 },
    { role: "ai", text: "It hit exit code 65535: the contract had no handler for the operation you sent, so the message bounced back. Usually the wrong action or an outdated app version.", delay: 5000 },
    { role: "user", text: "So my funds are safe?", delay: 9000 },
    { role: "ai", text: "Yes, a bounced message returns your TON minus a tiny fee. Refresh the app and try the correct action.", delay: 11000 },
  ],
  aptos: [
    { role: "ai", text: "Hi 👋 Your Aptos transaction failed. Let me decode the status.", delay: 0 },
    { role: "user", text: "It just says aborted.", delay: 2500 },
    { role: "ai", text: "It hit a Move abort from the coin module: the account tried to spend more than its balance, so the function aborted.\n\nFix: lower the amount, or top up first.", delay: 5000 },
    { role: "user", text: "Was gas still charged?", delay: 9000 },
    { role: "ai", text: "A small amount, yes, since the VM ran before aborting. Adjust the amount and retry.", delay: 11000 },
  ],
}

export function getChainDemo(slug: string): DemoMessage[] | undefined {
  return CHAIN_DEMOS[slug]
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
