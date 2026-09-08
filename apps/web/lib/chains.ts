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
  /** "cross-chain" is not a network: LayerZero is a message layer that runs
   *  ACROSS the chains above, so it gets its own section rather than being
   *  filed under one execution model it does not belong to. */
  family: "evm" | "non-evm" | "cross-chain"
  status: "live" | "coming-soon"
  /** Hidden chains keep their page content for later but are excluded from
   *  listings, static params, and the sitemap, and their pages 404. Used to
   *  park non-Aptos non-EVM chains during the Aptos partnership push. */
  hidden?: boolean
  /** Brand accent hex, themes the whole page. */
  color: string
  /** Logo path under /public.
   *
   *  OPTIONAL, and the distinction matters. Omitted means we hold no mark for
   *  this chain yet and the monogram is deliberate. A path that is SET must
   *  resolve to a real file, because a declared-but-missing logo falls back to
   *  the same monogram silently and nobody notices which chain lost its
   *  branding. `chains.test.ts` enforces exactly that split: it will not let a
   *  set path go missing, and it will not accept a placeholder standing in for
   *  a real mark. */
  logo?: string
  /** Marks that need a white disc behind them to read on dark (matches the homepage hero treatment). */
  logoWhiteBg?: boolean
  /** One-line hero subtitle. */
  tagline: string
  /** 1 to 2 sentence intro paragraph. */
  intro: string
  /** Hand-written meta description (~155 chars, Google truncates beyond).
   *  Unset falls back to the intro + generic suffix, which runs long. */
  metaDescription?: string
  /** One benefit-led sentence on what makes TxID native to this chain. Powers
   *  the "Speaks [chain]" card. No infra/plumbing names, benefit framing. */
  builtFor?: string
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
    tagline: "Native Ethereum diagnosis with direct access to execution data, contract state, and transaction outcomes.",
    intro:
      "Give your Ethereum users an assistant that looks up their actual transaction, decodes why it failed, and tells them the fix in plain English, right inside your product.",
    builtFor:
      "TxID understands the failures Ethereum users actually hit, from custom Solidity reverts to gas-limit confusion and stuck nonces.",
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
    logoWhiteBg: true,
    explorerName: "BaseScan",
    tagline: "Built for Base transactions, understanding contract failures, fees, and common user issues.",
    intro:
      "Base users move fast and get stuck fast. TxID diagnoses the real cause of a failed Base transaction, and when someone is on the wrong network it offers a one-tap switch.",
    builtFor:
      "TxID knows the Base playbook, from wrong-network mix-ups to bridged tokens with no ETH for gas, and can switch the user to Base in one tap.",
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
    tagline: "Designed around BNB Chain behaviour, including gas conditions, token mechanics, and failed transactions.",
    intro:
      "Fee-on-transfer tokens, honeypots and slippage reverts make BNB support noisy. TxID screens the token and decodes the transaction so your team does not have to.",
    builtFor:
      "TxID is tuned for BNB Chain's noisy token landscape, screening fee-on-transfer tokens and honeypots and decoding PancakeSwap reverts.",
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
    logoWhiteBg: true,
    explorerName: "PolygonScan",
    tagline: "Understands Polygon execution, gas behaviour, and the transaction failures users encounter.",
    intro:
      "Polygon's minimum-fee floor and RPC lag trip users up constantly. TxID gives them the current safe fee and confirms whether the problem is the network or their own wallet RPC.",
    builtFor:
      "TxID knows Polygon's fee floor and RPC quirks, so users get the exact fee to set and a clear answer on whether it is the chain or their wallet.",
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
    tagline: "Tuned for Arbitrum's L2 environment, including fees, execution, and transaction behaviour.",
    intro:
      "Arbitrum's gas model and sequencer confuse users when things go wrong. TxID explains what actually happened and exactly what to do next.",
    builtFor:
      "TxID understands Arbitrum's L2 gas model and sequencer, so 'pending forever' and 'no ETH for gas' get a straight answer.",
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
    tagline: "Fluent in the OP Stack, with native understanding of Optimism transactions and execution.",
    intro:
      "From wrong-network mix-ups to a wallet with no ETH for gas, TxID gives Optimism users a straight answer instead of a support ticket.",
    builtFor:
      "TxID is fluent in the OP Stack, from wrong-network fixes to the seven-day withdrawal wait back to Ethereum, all in plain English.",
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
    tagline: "Diagnose failed C-Chain transactions without leaving your app.",
    intro:
      "TxID reads the real transaction, contract, and execution data to explain what went wrong and what the user should do next.",
    metaDescription:
      "Diagnose failed Avalanche C-Chain transactions without leaving your app. TxID reads the real transaction, contract, and execution data and gives users the fix.",
    builtFor:
      "TxID keeps Avalanche users on the C-Chain and decodes the real revert from any contract, even unverified ones.",
    failures: [
      { title: "Wrong chain or subnet", detail: "Makes sure users are on the C-Chain, not an L1 subnet, and diagnoses accordingly." },
      { title: "AVAX gas failures", detail: "Gives the right gas for a failed C-Chain transaction." },
      { title: "Reverted contract calls", detail: "Decodes the real revert reason on any Avalanche contract, even unverified ones." },
      { title: "Router and DEX events", detail: "Explains swaps routed through aggregators, where the events live on the pool, not the router." },
    ],
  },

  {
    slug: "etherlink",
    name: "Etherlink",
    ticker: "XTZ",
    family: "evm",
    status: "live",
    color: "#38FF9C",
    logo: "/chains/Etherlink.png",
    explorerName: "Etherlink Explorer",
    tagline: "Supports Etherlink, the Tezos EVM Layer 2, with native transaction diagnosis.",
    intro:
      "Give your Etherlink users instant answers: why a transfer failed, what actually happened in their transaction, and the exact next step, without leaving your app.",
    builtFor:
      "TxID is built for Etherlink, the Tezos EVM Layer 2, so users get their real history and the exact reason a transfer failed.",
    failures: [
      { title: "Failed transfers and swaps", detail: "Reads the transaction from Etherlink's node, decodes the revert, and gives the exact fix." },
      { title: "XTZ gas issues", detail: "Explains out-of-gas and underpriced transactions with the right value to set." },
      { title: "Reverted contract calls", detail: "Decodes the real revert reason on any Etherlink contract via eth_call replay, verified or not." },
      { title: "Wrong-network confusion", detail: "Confirms whether the user is on Etherlink mainnet and diagnoses accordingly." },
    ],
  },

  {
    slug: "monad",
    name: "Monad",
    ticker: "MON",
    family: "evm",
    status: "live",
    color: "#836EF9",
    logo: "/chains/Monad.png",
    explorerName: "MonadScan",
    tagline: "Diagnose failed Monad transactions without leaving your app.",
    intro:
      "Monad runs the EVM, so the failures look familiar and the confusion does not: a user staring at a transaction that did not work still has no idea why, and the reason is sitting on chain in a revert nobody has translated. TxID replays the transaction, finds the real cause, and answers in plain language inside your product.",
    metaDescription:
      "Diagnose failed Monad transactions without leaving your app. TxID replays the transaction, decodes the revert, and gives your users the actual next step.",
    builtFor:
      "TxID reads Monad directly, so a failed transaction gets a real answer rather than a status code, whether or not the user has ever opened a block explorer.",
    failures: [
      { title: "Reverted transactions", detail: "Replays the transaction and turns the contract's own revert reason into what went wrong and what to do next." },
      { title: "Custom contract errors", detail: "Decodes a bare error selector against the contract's published interface, so a hex string becomes a sentence." },
      { title: "A failure that only happened once", detail: "Spots a transaction that fails on chain but succeeds when replayed a block earlier, which means the price or the liquidity moved underneath it rather than anything being broken." },
      { title: "Out of gas", detail: "Separates a gas limit set too low from a wallet that is genuinely short of MON, which need different fixes." },
      { title: "Missing approvals", detail: "Explains when a token was never approved for the contract trying to spend it." },
    ],
  },
  {
    slug: "unichain",
    name: "Unichain",
    ticker: "ETH",
    family: "evm",
    status: "live",
    color: "#FF007A",
    explorerName: "Uniscan",
    tagline: "Swap failures on Unichain, explained where your users already are.",
    intro:
      "Unichain runs the contracts most people on it are already trading through, so when something does fail it is usually a swap that did not land: a price that moved, an approval that was never given, a router that refused. TxID reads the transaction, decodes the contract's own reason, and answers in plain English inside your product.",
    metaDescription:
      "An AI support agent for Unichain apps. TxID reads the failed transaction, decodes the revert and tells your users what to do next.",
    builtFor:
      "TxID reads Unichain directly, balances and history included, so a user asking what happened to a swap gets the actual reason rather than a hash to paste into an explorer.",
    failures: [
      { title: "Swaps that did not land", detail: "Separates a price that moved mid-transaction from a router that refused outright, which need completely different fixes." },
      { title: "Custom contract errors", detail: "Decodes a bare error selector against the contract's published interface, so a hex string becomes a sentence." },
      { title: "Out of gas", detail: "Tells the user it was the gas limit rather than their ETH balance, and what to raise it to." },
      { title: "Approvals that never landed", detail: "Checks whether the token approval actually went through before anyone blames the contract." },
    ],
  },
  {
    slug: "plasma",
    name: "Plasma",
    ticker: "XPL",
    family: "evm",
    status: "live",
    color: "#00D68F",
    explorerName: "Plasmascan",
    tagline: "Stablecoin users do not read reverts. TxID reads them instead.",
    intro:
      "Plasma exists to move stablecoins, which means the people using it are the least likely in crypto to know what a revert is. They are moving dollars. When a transfer or a swap fails, TxID replays the transaction, turns the contract's own error into plain English, and says what to do next, without sending anyone to a block explorer.",
    metaDescription:
      "An AI support agent for Plasma apps. TxID diagnoses failed XPL and stablecoin transactions and explains the fix in plain English.",
    builtFor:
      "TxID reads Plasma straight from the chain's own node, so a failed transfer gets a real answer instead of a status code, for users who never wanted to learn what one is.",
    failures: [
      { title: "Reverted transfers and swaps", detail: "Replays the transaction and turns the contract's own revert reason into what went wrong and what to do next." },
      { title: "Errors that are just a code", detail: "Decodes a bare selector or a terse string like \"AS\" against the contract's interface, so the user sees a sentence rather than a fragment." },
      { title: "Failures that only happened once", detail: "Spots a transaction that fails on chain but succeeds when replayed a block earlier, which means the price or the balance moved underneath it." },
      { title: "Out of gas", detail: "Separates a gas limit set too low from a wallet that is genuinely short of XPL, which need different fixes." },
    ],
  },
  {
    slug: "mantle",
    name: "Mantle",
    ticker: "MNT",
    family: "evm",
    status: "live",
    color: "#65B3AE",
    explorerName: "Mantlescan",
    tagline: "Failed Mantle transactions, decoded and explained in your own product.",
    intro:
      "A failed transaction on Mantle tells the user almost nothing: a status code, a hash, and a gas figure in MNT rather than the ETH they may be expecting. TxID replays it against the chain, decodes the contract's own error, and gives the answer in plain English without the user leaving your app.",
    metaDescription:
      "An AI support agent for Mantle apps. TxID replays the failed transaction, decodes the revert and explains the fix in plain English.",
    builtFor:
      "TxID reads Mantle directly and knows its gas is MNT, so nobody is told to top up a token the chain does not use.",
    failures: [
      { title: "Reverted transactions", detail: "Replays the call against the chain and decodes the contract's own revert reason, custom Solidity errors included." },
      { title: "Custom contract errors", detail: "Turns a bare error selector into the contract's own named error and what it means for the user." },
      { title: "Out of gas", detail: "Tells the user it was the gas limit rather than their MNT balance, and names MNT rather than ETH." },
      { title: "Failures that only happened once", detail: "Spots a transaction that fails on chain but succeeds when replayed a block earlier, which means the state moved underneath it." },
    ],
  },
  {
    slug: "hyperevm",
    name: "HyperEVM",
    ticker: "HYPE",
    family: "evm",
    status: "live",
    color: "#97FCE4",
    // Hyperliquid and HyperEVM share ONE brand mark, so they share one file.
    // HyperEVM is Hyperliquid's EVM layer, not a separately branded network.
    logo: "/chains/Hyperliquid.png",
    explorerName: "HyperEVM Scan",
    tagline: "The EVM chain beside the exchange, read directly over its own node.",
    intro:
      "Hyperliquid is two things, and TxID reads both: the exchange, where a rejected order leaves no transaction at all, and HyperEVM, the chain running alongside it. On HyperEVM a failed contract call gets the same treatment as anywhere else, replayed and explained in plain language, without the user leaving your product.",
    metaDescription:
      "Diagnose failed HyperEVM transactions without leaving your app. TxID replays the transaction, decodes the revert, and gives your users the actual next step.",
    builtFor:
      "TxID reads HyperEVM straight from the chain's own node, and reads the Hyperliquid exchange beside it, so a user gets an answer whichever half of Hyperliquid they were using.",
    failures: [
      { title: "Reverted transactions", detail: "Replays the transaction and turns the contract's own revert reason into what went wrong and what to do next." },
      { title: "Custom contract errors", detail: "Decodes a bare error selector against the contract's published interface, so a hex string becomes a sentence." },
      { title: "Out of gas", detail: "Separates a gas limit set too low from a wallet that is genuinely short, which need different fixes." },
      { title: "Failures that only happened once", detail: "Spots a transaction that fails on chain but succeeds when replayed a block earlier, which means the market moved underneath it." },
    ],
  },
  {
    slug: "arc",
    name: "Arc",
    ticker: "USDC",
    family: "evm",
    status: "coming-soon",
    color: "#1E4E8C",
    logo: "/chains/Arc.jpg",
    explorerName: "Arc Explorer",
    tagline: "Circle's stablecoin chain, where the gas is USDC.",
    intro:
      "Arc pays for gas in USDC rather than a volatile native token, which quietly changes what a failed transaction means: running out of gas is running out of dollars, and every explanation written for a chain with its own coin gets that wrong. TxID reads Arc's execution directly and says what actually happened. Diagnosis goes live with the network.",
    metaDescription:
      "TxID is ready for Arc, Circle's USDC-native L1. Failed transactions explained in plain language, with gas denominated in dollars rather than a volatile token.",
    failures: [
      { title: "Reverted transactions", detail: "Replays the transaction and turns the contract's own revert reason into what went wrong and what to do next." },
      { title: "Gas paid in dollars", detail: "Explains a shortfall in the terms Arc actually uses, so nobody is told to top up a token the chain does not have." },
      { title: "Custom contract errors", detail: "Decodes a bare error selector against the contract's published interface, so a hex string becomes a sentence." },
      { title: "Failures that only happened once", detail: "Spots a transaction that fails on chain but succeeds when replayed a block earlier, which means state moved underneath it." },
    ],
  },
  {
    slug: "robinhood",
    name: "Robinhood Chain",
    ticker: "ETH",
    family: "evm",
    status: "live",
    color: "#CCFF00",
    logo: "/chains/Robinhood.png",
    explorerName: "Blockscout",
    tagline: "Native diagnosis on Robinhood Chain, for users who have never opened a block explorer.",
    intro:
      "Robinhood Chain brings a lot of people on-chain for the first time. When something fails, TxID reads the actual transaction, decodes why it failed, and gives the fix in plain English, right inside your product.",
    metaDescription:
      "An AI support agent for Robinhood Chain apps. TxID reads the chain, decodes failed transactions and explains the fix in plain English.",
    builtFor:
      "TxID reads Robinhood Chain directly, so a failed transaction gets a real answer instead of a status code, whether or not the user knows what a revert is.",
    failures: [
      { title: "Reverted transactions", detail: "Replays the call against the chain and decodes the contract's own revert reason, custom Solidity errors included." },
      { title: "Out-of-gas failures", detail: "Tells the user it was the gas limit rather than their ETH balance, and what to raise it to." },
      { title: "Stuck and underpriced transactions", detail: "Spots a pending nonce jam or a max fee below the base fee, and explains how to unstick it." },
      { title: "Approvals that never landed", detail: "Checks whether the token approval actually went through before anyone blames the contract." },
    ],
  },

  // ── Non-EVM (coming soon) ──────────────────────────────────────────────────
  {
    slug: "aptos",
    name: "Aptos",
    ticker: "APT",
    family: "non-evm",
    status: "live",
    color: "#2DD8A5",
    logo: "/chains/Aptos.png",
    logoWhiteBg: true,
    explorerName: "Aptos Explorer",
    tagline: "Turn Aptos error codes into answers your users can act on.",
    intro:
      "Give your Aptos users instant answers: why a transaction failed, where their funds actually are, and the exact next step, without leaving your app. Most never see a reason at all, just a transaction that did not work, while the explanation sits on chain as a Move abort nobody has translated. TxID translates it and answers in plain language.",
    metaDescription:
      "Diagnose failed Aptos transactions without leaving your app. TxID turns Move abort codes into plain answers and shows users where their funds actually are.",
    builtFor:
      "TxID is built for Aptos rather than adapted to it, so it answers the questions only Move raises: what an abort code actually means, and why a balance looks empty when the funds are sitting in a subaccount.",
    failures: [
      { title: "Move error codes", detail: "A code like 0x10010 becomes a plain explanation of what went wrong, whether any funds moved, and what to do next." },
      { title: "Funds that look missing", detail: "On venues that hold balances in a subaccount rather than the wallet, shows the user their real position and history instead of an empty account." },
      { title: "Transactions that never landed", detail: "Explains a transaction that expired before it reached the chain, so a user staring at no record knows their funds were never sent." },
      { title: "Gas paid by someone else", detail: "Explains a sponsored transaction, so a fee the user did not pay does not read as something going wrong." },
      { title: "A wallet showing the wrong address", detail: "Spots a rotated authentication key and points the user at the address actually holding their funds." },
    ],
  },
  {
    slug: "solana",
    name: "Solana",
    ticker: "SOL",
    family: "non-evm",
    status: "live",
    color: "#9945FF",
    logo: "/chains/Solana.svg",
    explorerName: "Solscan",
    tagline: "Plain-English answers on the chain that gives users the least to go on.",
    intro:
      "A Solana failure often reaches the user as nothing but \"custom program error: 0x1771\", and the error does not even say which program produced it. TxID identifies the program that actually failed on every failure it reads, decodes the error where the program publishes one, and says plainly when the meaning is the program's to define rather than guessing at it.",
    metaDescription:
      "An AI support agent for Solana apps. TxID names the program that failed, decodes the error, and tells your users what to do next.",
    builtFor:
      "Solana errors are bare numbers with no program attached. TxID reads the transaction logs to name the program that actually failed, which is the first thing anyone needs and the thing an explorer does not tell them.",
    failures: [
      { title: "Custom program errors", detail: "Names the program that rejected the transaction, and decodes its meaning where the program publishes one. Where it does not, says so rather than inventing a reason." },
      { title: "Slippage on a swap", detail: "Recognises the aggregator error behind a failed swap and explains that the price moved, rather than leaving a hex code on screen." },
      { title: "Compute-unit limits", detail: "Separates a transaction that ran out of compute budget from one the program refused, which need different fixes." },
      { title: "Expired transactions", detail: "Explains a blockhash that aged out before the transaction landed, and that nothing was charged and nothing moved." },
    ],
  },
  {
    slug: "sui",
    name: "Sui",
    ticker: "SUI",
    family: "non-evm",
    status: "live",
    color: "#4DA2FF",
    logo: "/chains/Sui.png",
    explorerName: "SuiScan",
    tagline: "Turn a bare Sui abort code into an answer your users can act on.",
    intro:
      "Sui tells a user less than almost any chain when something goes wrong: an abort arrives as a bare number, with no name attached and nothing on chain to look it up against. TxID reads the number, the module and the function, explains what it means where the protocol has published one, and says plainly when it cannot rather than guessing.",
    metaDescription:
      "Diagnose failed Sui transactions without leaving your app. TxID decodes Move aborts, DeepBook errors and the failures that are not aborts at all.",
    builtFor:
      "TxID is built for Sui rather than adapted to it, so it handles what Sui does differently: an abort that carries no name, a package that changes address every time it upgrades, and the failures that are not aborts at all.",
    failures: [
      { title: "Move aborts", detail: "Turns a module and a bare abort code into what actually went wrong, using the protocol's own published error definitions where they exist." },
      { title: "DeepBook orders and withdrawals", detail: "Explains why a withdrawal was refused or an order rejected on Sui's central orderbook, including that funds sit in a balance manager rather than the wallet." },
      { title: "A step that ran short of a coin", detail: "Separates a wallet that was genuinely short from a route where an earlier step returned less than expected, which are different problems with different answers." },
      { title: "Gas budget too low", detail: "Separates a budget set too low from a wallet that is genuinely short of SUI." },
      { title: "Orders that are already gone", detail: "Explains an order that cannot be cancelled because it has already filled, expired or been cancelled." },
    ],
  },

  {
    slug: "hyperliquid",
    name: "Hyperliquid",
    ticker: "HYPE",
    family: "non-evm",
    status: "live",
    color: "#50D2C1",
    logo: "/chains/Hyperliquid.png",
    explorerName: "Hyperliquid",
    tagline: "Tell a trader why their order was rejected, in the exchange's own words.",
    intro:
      "A rejected order on Hyperliquid leaves no fill, no transaction and no balance change, so a trader looking for it finds nothing at all. The exchange knows exactly why it refused, and says so in a single word nobody surfaces. TxID reads that and answers in plain language, inside your product.",
    metaDescription:
      "Explain rejected Hyperliquid orders inside your app. TxID reads the exchange's own rejection reasons and turns them into answers traders can act on.",
    builtFor:
      "TxID reads HyperCore itself, not just the chain beside it, so it can answer the question a perps trader actually asks: not what happened to my transaction, but why did my order not go through.",
    failures: [
      { title: "Orders below the minimum", detail: "The commonest rejection by a wide margin. Explains that Hyperliquid's minimum is in dollars rather than in coins, so a small order in a high-priced asset falls under it even when the quantity looks fine." },
      { title: "Reduce-only with nothing to reduce", detail: "Explains an order refused, or an existing one cancelled by the exchange, because the position it was there to close is already gone." },
      { title: "Immediate-or-cancel that found nothing", detail: "Explains that the order asked to fill now or not at all, and there was nothing on the book at that price." },
      { title: "Post-only that would have crossed", detail: "Explains an add-liquidity-only order refused because the market moved and it would have taken liquidity instead of adding it." },
      { title: "Margin and spot balance confusion", detail: "Separates margin, which is what a position needs, from account balance, and explains that spot and perpetual funds are held separately." },
    ],
  },
  {
    slug: "near",
    name: "NEAR",
    ticker: "NEAR",
    family: "non-evm",
    status: "live",
    color: "#00EC97",
    explorerName: "NearBlocks",
    tagline: "NEAR contracts say why they failed. Most users still cannot read it.",
    intro:
      "A failed NEAR transaction carries the contract's own message, which is more than most chains give. The trouble is what it looks like: \"Smart contract panicked: panicked at 'E68: slippage error', ref-exchange/src/simple_pool.rs:313:9\". TxID takes the source paths out, translates the code, and tells your user the price moved and what to do about it.",
    metaDescription:
      "An AI support agent for NEAR apps. TxID turns a Rust panic into a plain-English answer your users can act on.",
    builtFor:
      "NEAR is the only chain that hands over the reason a transaction failed in words rather than a number. TxID is built to finish the job: strip the developer noise, translate the protocol's code, and say what the user should do next.",
    failures: [
      { title: "Swaps refused on slippage", detail: "Explains that the price moved between quoting the swap and it reaching the pool, rather than showing a code like E68 and a source file." },
      { title: "Contract errors in plain words", detail: "Takes the Rust panic machinery out of the contract's message so the user sees the reason and not the developer's file layout." },
      { title: "Not enough gas attached", detail: "Separates a call that ran out of gas, which should be sent again with more, from a contract that refused, which should not." },
      { title: "Balance you cannot spend", detail: "Explains that NEAR charges an account for the data it stores, so part of a balance is locked and cannot be sent without deleting state." },
      { title: "Reused or expired transactions", detail: "Says when a transaction expired safely and when one may already have gone through, so nobody sends the same thing twice." },
    ],
  },
  {
    slug: "stellar",
    name: "Stellar",
    ticker: "XLM",
    family: "non-evm",
    status: "live",
    color: "#FDDA24",
    logo: "/chains/Stellar.png",
    logoWhiteBg: true,
    explorerName: "Stellar Expert",
    tagline: "Explain a failed Stellar payment in the words your users use.",
    intro:
      "More Stellar transactions fail than on any chain we measure, and most of them fail for a reason the network states precisely and nobody translates. A payment refused on slippage, a missing trustline, a balance that is not spendable because of the reserve: all of these are exact answers sitting inside a result nobody reads. TxID reads it and answers in plain language.",
    metaDescription:
      "Diagnose failed Stellar transactions without leaving your app. TxID explains path payments, trustlines, reserves and Soroban failures in plain language.",
    builtFor:
      "TxID is built for Stellar rather than adapted to it, so it explains the three things that trip people up and that no other chain has: trustlines, reserves, and a transaction that quietly expired.",
    failures: [
      { title: "A swap refused on price", detail: "The commonest failure on Stellar by a wide margin. Explains that the path moved between the quote and the transaction, that the user's own limit refused it, and that nothing was swapped." },
      { title: "A missing trustline", detail: "Explains that the recipient has not yet trusted the asset, or that their limit would be exceeded, which is nothing to do with either side having enough money." },
      { title: "A balance that will not send", detail: "Explains the minimum reserve, which rises with every trustline, offer and signer, so a user can see a balance and be unable to spend it." },
      { title: "A transaction that expired", detail: "Explains that the time bound passed before it was included, that nothing moved, and that submitting again is safe because the expired one can never execute." },
      { title: "Soroban contract failures", detail: "Explains a contract that rejected the call, including inside a fee bump, where the useful detail is otherwise hidden in a second transaction." },
    ],
  },
  {
    slug: "ton",
    name: "TON",
    ticker: "TON",
    family: "non-evm",
    status: "coming-soon",
    hidden: true,
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
  // ── Cross-chain ───────────────────────────────────────────────────────────
  {
    slug: "layerzero",
    name: "LayerZero",
    ticker: "",
    family: "cross-chain",
    status: "live",
    color: "#E4E4E7",
    logo: "/chains/LayerZero.png",
    explorerName: "LayerZero Scan",
    tagline: "Answers the worst question in crypto: it says it worked, so where is my money?",
    intro:
      "A bridge transfer leaves one chain in a transaction the user sent, and arrives on another in a transaction they did not send and cannot see. Every tool reports the same useless fact in between, that the source transaction succeeded. TxID reads the message itself and says where the value actually is.",
    metaDescription:
      "Bridged and it has not arrived? TxID reads the LayerZero message and tells your users whether their transfer is in transit, delivered, or needs a human.",
    builtFor:
      "TxID follows the transfer across, so a user whose funds have left one chain and not reached the other is told they are in transit rather than left to guess.",
    failures: [
      { title: "Sent but not arrived", detail: "Confirms the transfer left the source chain and is still in flight, so the user knows it is in transit rather than lost." },
      { title: "Bridging twice", detail: "Never tells a user to retry while a transfer is live. The first one is still coming, and a second would go through too." },
      { title: "Which side to look at", detail: "Names the destination chain and the delivery transaction, so nobody keeps refreshing the chain the funds already left." },
      { title: "States nobody can read", detail: "When the bridge reports something we cannot interpret, it says so and hands over the message id, rather than inventing a meaning." },
    ],
  },
]

/** Chains shown publicly: listings, static params, sitemap. */
export const VISIBLE_CHAINS: ChainInfo[] = CHAINS.filter((c) => !c.hidden)

/**
 * DERIVED. "Nine chains live" and the FAQ's hand-written list were both stale
 * the hour a tenth went live, and each had to be found separately. Anything
 * stating what we support reads from here.
 */
export const LIVE_CHAINS = VISIBLE_CHAINS.filter(
  (c) => c.status === "live" && c.family !== "cross-chain",
)

export const LIVE_CHAIN_COUNT = LIVE_CHAINS.length

/** "A, B and C" */
export function listChainNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

export const LIVE_EVM_NAMES = LIVE_CHAINS.filter((c) => c.family === "evm").map((c) => c.name)
export const LIVE_NON_EVM_NAMES = LIVE_CHAINS.filter((c) => c.family === "non-evm").map((c) => c.name)


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
  etherlink: [
    { role: "ai", text: "Hi 👋 Your last Etherlink transaction failed. Want me to check why?", delay: 0 },
    { role: "user", text: "Yes, it just reverted.", delay: 2500 },
    { role: "ai", text: "Your swap reverted at the router: the price moved past your slippage while it was pending, so it was rejected. Nothing left your wallet.\n\nFix: raise slippage to 2% and retry.", delay: 5000 },
    { role: "user", text: "Did it cost me XTZ?", delay: 8500 },
    { role: "ai", text: "A small amount of XTZ for gas, yes, since it ran before reverting. Retry with more slippage and it should go through.", delay: 11000 },
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
    // Text drawn ON the accent (chat bubbles, send button). Bright accents
    // like Etherlink's green make white text unreadable, so this resolves to
    // near-black for light colours, white otherwise.
    ["--on-accent"]: readableText(color),
  }
}
