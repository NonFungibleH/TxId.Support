// The error reference: one entry per transaction error message, driving the
// programmatic pages at /errors/[slug], the AI answer feed at /llms-errors.txt,
// and the sitemap. Adding an error here is all it takes to publish its page.
//
// Rules that keep these pages worth ranking:
// - `message` is the EXACT string a wallet or explorer shows, because that is
//   what people paste into a search engine. `aka` carries variant phrasings.
// - `meaning` and `fix` must each say something specific. An entry we cannot
//   explain properly does not ship: thin pages hurt every other page here.
// - No em dashes in any user-facing string (site-wide rule).

export type ErrorCategory = "gas" | "nonce" | "revert" | "panic" | "wallet"

export const ERROR_CATEGORIES: Record<ErrorCategory, { label: string; blurb: string }> = {
  gas: {
    label: "Gas and fees",
    blurb: "The transaction never really ran, or ran out of the computation you authorised.",
  },
  nonce: {
    label: "Mempool and nonce",
    blurb: "The network would not accept or include the transaction, usually an ordering or pricing problem.",
  },
  revert: {
    label: "Contract reverts",
    blurb: "The transaction ran and the smart contract rejected it, with a reason.",
  },
  panic: {
    label: "Solidity panics",
    blurb: "Automatic safety checks the compiler inserts. A panic means the contract reached a state it did not expect.",
  },
  wallet: {
    label: "Wallet and RPC errors",
    blurb: "Warnings and failures from the wallet or the node, often before anything is signed.",
  },
}

export interface TxError {
  slug: string
  /** The exact string shown to the user. Doubles as the page H1 and title. */
  message: string
  /** Variant phrasings of the same error, shown on the page and in schema. */
  aka?: string[]
  category: ErrorCategory
  /** What happened, in plain English. Two to four sentences. */
  meaning: string
  /** What to actually do. Specific, not "contact support". */
  fix: string
}

export const TX_ERRORS: TxError[] = [
  // ── Gas and fees ──────────────────────────────────────────────────────────
  {
    slug: "intrinsic-gas-too-low",
    message: "intrinsic gas too low",
    category: "gas",
    meaning:
      "The gas limit set on the transaction is below the minimum the network requires just to accept it, before any contract logic runs. Every transaction has a base cost (21,000 gas for a simple transfer, more when data is attached), and this limit did not cover it.",
    fix: "Raise the gas limit and resubmit. Wallets estimate the limit automatically, so this error almost always means a manual gas limit was set too low. Clear the custom value and let the wallet estimate.",
  },
  {
    slug: "out-of-gas",
    message: "out of gas",
    category: "gas",
    meaning:
      "The transaction ran, consumed its entire gas limit partway through execution, and reverted. This is about the gas limit you authorised, not your coin balance: you can hold plenty of ETH and still run out of gas. You pay for the computation used up to the point it stopped.",
    fix: "Raise the gas limit in your wallet's advanced settings and resubmit. Do not raise the gas price: it does not help here. If the estimate keeps coming out low, the contract call may be more complex than the wallet expects.",
  },
  {
    slug: "gas-required-exceeds-allowance",
    message: "gas required exceeds allowance",
    aka: ["always failing transaction", "gas uint64 overflow"],
    category: "gas",
    meaning:
      "The node's own estimate of the gas needed came out higher than the cap you allowed, and in most cases that is because the transaction would revert if it actually ran. The estimate blows up because the simulated execution fails.",
    fix: "Do not just raise the gas limit to force it through: a transaction that would revert still reverts, and you pay for it. Find the underlying revert first, commonly a missing token approval, wrong network, or insufficient balance.",
  },
  {
    slug: "insufficient-funds-for-gas",
    message: "insufficient funds for gas * price + value",
    aka: ["insufficient funds for intrinsic transaction cost"],
    category: "gas",
    meaning:
      "The wallet does not hold enough of the chain's native coin (ETH, BNB, POL, and so on) to cover the amount being sent plus the maximum possible gas fee. The check uses the maximum fee, not the likely fee, so it can trigger even when the eventual fee would have been affordable.",
    fix: "Top up the native coin, send a smaller amount, or lower the max fee. Remember that token transfers also need the native coin for gas: holding USDC alone is not enough to move USDC.",
  },
  {
    slug: "max-fee-per-gas-less-than-block-base-fee",
    message: "max fee per gas less than block base fee",
    category: "gas",
    meaning:
      "The maximum fee you offered per unit of gas is below the network's current base fee, so no block can include the transaction. Base fee moves with congestion, and a fee that was fine an hour ago can be under the floor now.",
    fix: "Increase the max fee and resubmit, or wait for congestion to fall. Most wallets refresh the suggested fee when you retry, so re-opening the transaction and accepting the new estimate is usually enough.",
  },
  {
    slug: "transaction-underpriced",
    message: "transaction underpriced",
    category: "gas",
    meaning:
      "The gas price on the transaction is below what the node's mempool will currently accept, so it refused to queue it at all. This is the node protecting itself from transactions that would sit forever.",
    fix: "Increase the gas price (or max fee) and resubmit. If your wallet keeps producing the same low price, refresh its fee estimate or switch the fee setting from low to market.",
  },
  {
    slug: "max-priority-fee-higher-than-max-fee",
    message: "max priority fee per gas higher than max fee per gas",
    category: "gas",
    meaning:
      "The transaction's tip (priority fee) is set higher than its overall fee ceiling (max fee), which is contradictory: the tip is paid out of the ceiling. This comes from manually editing one field without the other.",
    fix: "Set the max fee to at least the base fee plus your priority fee, or clear both custom values and let the wallet fill them in.",
  },
  {
    slug: "exceeds-block-gas-limit",
    message: "exceeds block gas limit",
    category: "gas",
    meaning:
      "The gas limit on the transaction is larger than the maximum a whole block can hold, so no block could ever include it. This is almost always a manually entered limit with too many zeros.",
    fix: "Lower the gas limit to something sane, or clear the custom value and let the wallet estimate. If a dapp suggested the huge limit, treat that as a bug in the dapp.",
  },

  // ── Mempool and nonce ─────────────────────────────────────────────────────
  {
    slug: "nonce-too-low",
    message: "nonce too low",
    category: "nonce",
    meaning:
      "The transaction's nonce (its sequence number) has already been used: either an earlier transaction with that nonce was mined, or one is already pending. Very often the action you are retrying actually went through the first time.",
    fix: "Check the address on a block explorer first: the original transaction may have succeeded. If you set the nonce manually, stop, and let the wallet choose it. If the wallet itself is stuck on an old nonce, resetting its activity data (MetaMask: Settings, Advanced, Clear activity tab data) resyncs it.",
  },
  {
    slug: "nonce-too-high",
    message: "nonce too high",
    category: "nonce",
    meaning:
      "There is a gap in the sequence: an earlier transaction from this address has not been mined yet, so this one cannot be processed. Transactions from one address must confirm in nonce order.",
    fix: "Deal with the earlier pending transaction first: speed it up or cancel it from the wallet's activity list. Once it resolves, the later transaction can confirm. Avoid setting nonces manually.",
  },
  {
    slug: "already-known",
    message: "already known",
    aka: ["known transaction"],
    category: "nonce",
    meaning:
      "The exact same signed transaction is already sitting in the node's mempool. Nothing failed: the node is telling you it has seen this one before, usually because a wallet or dapp resubmitted it.",
    fix: "Wait for the pending transaction to mine rather than resubmitting. If it is stuck because the fee is too low, use the wallet's speed-up option, which replaces it properly instead of duplicating it.",
  },
  {
    slug: "replacement-transaction-underpriced",
    message: "replacement transaction underpriced",
    category: "nonce",
    meaning:
      "You tried to replace a pending transaction (a speed-up or a cancel reuses its nonce), but the replacement's fee is not enough of an increase. Nodes require roughly a 10% bump or more before they will swap one pending transaction for another.",
    fix: "Raise the fee on the replacement by at least 10% over the original, or simply use the wallet's built-in speed-up or cancel button, which prices the replacement correctly.",
  },
  {
    slug: "transaction-dropped",
    message: "transaction dropped and replaced",
    aka: ["transaction dropped"],
    category: "nonce",
    meaning:
      "The network discarded the transaction, usually because another transaction with the same nonce confirmed first (a speed-up, a cancel, or simply a competing transaction), or because it sat unmined so long the mempool evicted it. A dropped transaction costs nothing: it never executed.",
    fix: "Check the address history on an explorer to see what confirmed in its place. If the action you wanted never happened, submit it again with a market-rate fee.",
  },

  // ── Contract reverts ──────────────────────────────────────────────────────
  {
    slug: "execution-reverted",
    message: "execution reverted",
    aka: [
      "warning! error encountered during contract execution [execution reverted]",
      "transaction has been reverted by the EVM",
    ],
    category: "revert",
    meaning:
      "The transaction ran and the smart contract rejected it: a require() condition failed, an assertion tripped, or the contract explicitly reverted. Every state change was rolled back as if it never happened, but the gas used up to that point is spent. On its own this message does not say WHY, the specific reason is in the revert data.",
    fix: "Decode the actual reason: replaying the transaction reveals the revert string, custom error, or panic code behind the generic message. Paste the transaction hash into a decoder (our checker at /tx does this) rather than guessing. The most common underlying causes are a missing token approval, slippage, and a deadline that passed.",
  },
  {
    slug: "erc20-transfer-amount-exceeds-balance",
    message: "ERC20: transfer amount exceeds balance",
    category: "revert",
    meaning:
      "The transaction tried to move more of a token than the sending address holds. This also appears when a contract tries to move tokens on your behalf and the balance changed since you signed, or when token decimals made the amount larger than intended.",
    fix: "Check the token balance and the exact amount, paying attention to decimals. If a swap or a bridge triggered it, the route may be trying to pull a stale amount: rebuild the transaction with a fresh quote.",
  },
  {
    slug: "erc20-transfer-amount-exceeds-allowance",
    message: "ERC20: transfer amount exceeds allowance",
    category: "revert",
    meaning:
      "A contract (a router, a staking contract, a bridge) tried to pull your tokens, but you have not approved it to move that much. Token transfers by third parties require an explicit approval first, and the approval is per token, per spender.",
    fix: "Approve the token for the contract first, for at least the amount you are moving, then retry the action. If you previously approved a smaller amount, a new approval is needed. This is the single most common reason a first swap or stake fails.",
  },
  {
    slug: "insufficient-allowance",
    message: "insufficient allowance",
    category: "revert",
    meaning:
      "The same failure as an ERC20 allowance revert, in its shorter modern form: the contract you called is not approved to move enough of your token. Newer token contracts emit this compact message instead of the long ERC20 prefix.",
    fix: "Approve the token for the spending contract, for at least the amount in the transaction, and retry. If you use exact-amount approvals, remember each new trade needs a fresh approval.",
  },
  {
    slug: "stf",
    message: "STF",
    category: "revert",
    meaning:
      "A Uniswap V3 safe-transfer-from failure. The router tried to pull tokens from your wallet and the transfer returned false, which in practice means a missing or insufficient token approval, or a token with unusual transfer behaviour (fee-on-transfer, blocklists).",
    fix: "Approve the token for the router and retry. If the approval is in place and STF persists, the token itself may take a fee on transfer or restrict transfers, and the trade needs a route or setting that tolerates that.",
  },
  {
    slug: "transfer-from-failed",
    message: "TRANSFER_FROM_FAILED",
    category: "revert",
    meaning:
      "A low-level transferFrom call returned false instead of succeeding. Routers wrap token pulls in this check, so it fires when the approval is missing, the balance is short, or the token contract itself refused the transfer (paused, blocklisted, or non-standard).",
    fix: "Check approval first, balance second. If both are fine, inspect the token: paused or restricted tokens fail here by design, and no wallet setting fixes that.",
  },
  {
    slug: "transfer-failed",
    message: "TRANSFER_FAILED",
    category: "revert",
    meaning:
      "A token transfer OUT of the contract failed: the pool or vault tried to send you tokens and the token contract refused. Common with tokens that have transfer restrictions, fees on transfer, or paused states.",
    fix: "If this is a swap, try a smaller amount or a route that supports fee-on-transfer tokens. If it is a withdrawal, check whether the token or the protocol is paused before assuming your funds are affected: a revert means nothing moved.",
  },
  {
    slug: "insufficient-output-amount",
    message: "INSUFFICIENT_OUTPUT_AMOUNT",
    aka: ["Too little received", "UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT"],
    category: "revert",
    meaning:
      "Slippage protection fired. Between signing the swap and it being mined, the price moved, and the trade would have delivered less than the minimum you agreed to receive. The contract refused to fill at the worse price, which is the protection working, not a malfunction.",
    fix: "Retry with a slightly higher slippage tolerance, or when the market is calmer. For volatile or low-liquidity tokens, split the trade into smaller amounts. Raising slippage very high is not free: it widens what a sandwich bot can take from the trade.",
  },
  {
    slug: "insufficient-input-amount",
    message: "INSUFFICIENT_INPUT_AMOUNT",
    category: "revert",
    meaning:
      "The swap reached the pool with a zero or too-small input amount. Usually a dapp bug or a stale quote rather than something you set: the route was built for an amount that no longer matches what the transaction carries.",
    fix: "Refresh the page, rebuild the swap with a fresh quote, and retry. If it persists on one dapp, try the same trade on another front end for the same protocol.",
  },
  {
    slug: "insufficient-liquidity",
    message: "INSUFFICIENT_LIQUIDITY",
    aka: ["UniswapV2: INSUFFICIENT_LIQUIDITY", "INSUFFICIENT_LIQUIDITY_MINTED"],
    category: "revert",
    meaning:
      "The pool does not hold enough of the tokens to fill the trade, mint the position, or cover the withdrawal at the size requested. Common on small or new pools, and on forgotten pools where liquidity has drained away.",
    fix: "Trade a smaller amount, or route through a bigger pool or an aggregator that splits across pools. If you are removing liquidity, the pool state may have changed since your quote: refresh and retry.",
  },
  {
    slug: "expired",
    message: "EXPIRED",
    aka: ["Transaction too old", "TransactionDeadlinePassed"],
    category: "revert",
    meaning:
      "The swap carried a deadline and did not get mined before it passed. Deadlines protect you from a transaction sitting in the mempool for an hour and executing at a stale price. A too-low fee is the usual reason it missed the window.",
    fix: "Retry with a fresh quote and a market-rate fee so it mines inside the deadline. If the network is congested, a longer deadline in the dapp settings also works, at the cost of more price movement risk.",
  },
  {
    slug: "uniswapv2-k",
    message: "UniswapV2: K",
    category: "revert",
    meaning:
      "The pool's invariant check failed: after the swap, the pool would hold less value than before, which the contract forbids. In practice this almost always involves a token that takes a fee on transfer or otherwise misreports amounts, breaking the pool's arithmetic.",
    fix: "Use the dapp's fee-on-transfer supporting swap function if it has one (many routers have a separate path for such tokens), or trade the token on a venue built for it. Plain V2-style swaps of fee-on-transfer tokens fail here by design.",
  },
  {
    slug: "ownable-caller-is-not-the-owner",
    message: "Ownable: caller is not the owner",
    category: "revert",
    meaning:
      "The function you called is restricted to the contract's owner, and your address is not it. Regular users hitting this are almost always on the wrong function, the wrong contract, or following instructions meant for the protocol team.",
    fix: "Use the dapp's normal interface for the action instead of calling the contract directly. If you are the owner and see this, you are signing from a different address than the one that owns the contract.",
  },
  {
    slug: "pausable-paused",
    message: "Pausable: paused",
    aka: ["EnforcedPause"],
    category: "revert",
    meaning:
      "The protocol has paused this part of the contract, usually during an incident, a migration, or maintenance. The revert is the pause doing its job: nothing about your wallet or transaction is wrong, and nothing moved.",
    fix: "Wait, and check the protocol's official announcements for why it is paused and when it will resume. Do not try workarounds a stranger suggests while a protocol is paused: that is prime scam territory.",
  },
  {
    slug: "reentrancyguard-reentrant-call",
    message: "ReentrancyGuard: reentrant call",
    category: "revert",
    meaning:
      "The contract blocked a call that re-entered it before a previous call finished, which is the classic shape of an exploit attempt, but can also fire on legitimate complex interactions between contracts.",
    fix: "As a user, retry the action on its own, not batched with other operations. If it keeps failing, the dapp's contract interaction is the problem, not your wallet: report it to the protocol.",
  },
  {
    slug: "safemath-subtraction-overflow",
    message: "SafeMath: subtraction overflow",
    category: "revert",
    meaning:
      "An older contract tried to subtract a larger number from a smaller one, which SafeMath blocks. In practice this is how pre-0.8 Solidity contracts say insufficient balance or insufficient allowance: the subtraction that failed was balance minus amount.",
    fix: "Treat it as a balance or allowance problem: check you hold enough of the token and that the contract is approved for the amount. The wording is just an older contract's way of saying the same thing.",
  },
  {
    slug: "safeerc20-low-level-call-failed",
    message: "SafeERC20: low-level call failed",
    aka: ["SafeERC20FailedOperation"],
    category: "revert",
    meaning:
      "A contract used OpenZeppelin's safe wrapper to call a token, and the token call itself failed or returned nonsense. Fires with non-standard tokens, tokens that are not actually deployed at the address used, and tokens with transfer restrictions.",
    fix: "Verify the token address is the real token (scam tokens with lookalike names fail here constantly), then check approval and balance. If the token is legitimate and restricted, the restriction is the answer.",
  },

  // ── Solidity panics ───────────────────────────────────────────────────────
  {
    slug: "panic-0x11",
    message: "panic code 0x11",
    aka: ["Panic(17)", "arithmetic underflow or overflow"],
    category: "panic",
    meaning:
      "An arithmetic operation went above the maximum or below zero for its number type. Since Solidity 0.8 this check is automatic. For a user, the practical meaning is usually an amount that does not fit: subtracting more than a balance, or a calculation the contract did not expect.",
    fix: "Check the amounts in the transaction against your actual balances and positions. If your inputs look right, the contract hit a state its developers did not anticipate, which is worth reporting to the protocol rather than retrying blindly.",
  },
  {
    slug: "panic-0x12",
    message: "panic code 0x12",
    aka: ["Panic(18)", "division or modulo by zero"],
    category: "panic",
    meaning:
      "The contract divided by zero. A user cannot normally cause this with inputs: it usually means the contract read a zero where it expected a value, an empty pool, a price feed returning zero, an uninitialised parameter.",
    fix: "Retry later, in case a price feed or pool state was momentarily empty. If it persists, this is a contract-side issue: report it to the protocol with the transaction hash.",
  },
  {
    slug: "panic-0x32",
    message: "panic code 0x32",
    aka: ["Panic(50)", "array index out of bounds"],
    category: "panic",
    meaning:
      "The contract read past the end of an array: asking for item 5 of a list with 3 entries. From a user's seat this often means referencing something that does not exist, a position, a tier, an index from a stale interface.",
    fix: "Refresh the dapp so its interface matches the contract's current state, and retry. If you entered an ID or index manually, verify it exists.",
  },
  {
    slug: "panic-0x01",
    message: "panic code 0x01",
    aka: ["Panic(1)", "assertion failed"],
    category: "panic",
    meaning:
      "An assert() check failed. Assertions guard conditions the developers believed could never be false, so a failing one signals a genuine bug or an extraordinary state, not a user mistake.",
    fix: "Do not retry repeatedly. Report the transaction hash to the protocol: an assertion failure is information their team needs.",
  },
  {
    slug: "panic-0x21",
    message: "panic code 0x21",
    aka: ["Panic(33)", "invalid enum value"],
    category: "panic",
    meaning:
      "A value was converted into an enum (a fixed list of options) that does not contain it, like passing option 7 where only options 0 to 3 exist. Usually a dapp passing a bad parameter.",
    fix: "Refresh the dapp and retry. If it persists, the front end is sending an invalid option, which is theirs to fix.",
  },
  {
    slug: "panic-0x31",
    message: "panic code 0x31",
    aka: ["Panic(49)", "pop on empty array"],
    category: "panic",
    meaning: "The contract tried to remove an item from an empty list. Like other panics, it points at contract state the developers did not expect rather than at your inputs.",
    fix: "Retry once in case of a race between two transactions. If it persists, report it to the protocol with the hash.",
  },
  {
    slug: "panic-0x41",
    message: "panic code 0x41",
    aka: ["Panic(65)", "memory allocation error"],
    category: "panic",
    meaning: "The contract tried to allocate too much memory or build an oversized array, typically triggered by a parameter that is far larger than intended.",
    fix: "Check any amount or count fields for extra digits, and rebuild the transaction from the dapp rather than editing raw values.",
  },
  {
    slug: "panic-0x51",
    message: "panic code 0x51",
    aka: ["Panic(81)", "uninitialized function pointer"],
    category: "panic",
    meaning: "The contract called an internal function variable that was never set. This is purely a contract bug: no user input causes it.",
    fix: "Report the transaction hash to the protocol. There is no user-side fix.",
  },

  // ── Wallet and RPC ────────────────────────────────────────────────────────
  {
    slug: "cannot-estimate-gas",
    message: "cannot estimate gas; transaction may fail or may require manual gas limit",
    aka: ["we were not able to estimate gas", "gas estimation failed"],
    category: "wallet",
    meaning:
      "Before asking you to sign, the wallet simulated the transaction against current chain state, and the simulation reverted, so no gas estimate exists. This is a preview of a failure, shown before you pay for it.",
    fix: "Treat it as a stop sign, not an obstacle. Do not set a manual gas limit to force it through: the transaction will very likely revert on-chain and cost real gas. Find the underlying revert first, most often a missing approval, wrong network, or insufficient balance.",
  },
  {
    slug: "transaction-likely-to-fail",
    message: "this transaction is likely to fail",
    aka: ["transaction will likely fail", "this transaction is expected to fail"],
    category: "wallet",
    meaning:
      "The same pre-signing simulation, in friendlier words: the wallet ran the transaction and it did not succeed. The failure it saw is real, based on the chain as it is right now.",
    fix: "Fix the cause upstream before signing: check the network, the token approval, the balance, and whether the dapp's quote is stale. Signing anyway pays gas for a predicted failure.",
  },
  {
    slug: "user-rejected-the-request",
    message: "user rejected the request",
    aka: ["MetaMask Tx Signature: User denied transaction signature", "user rejected transaction"],
    category: "wallet",
    meaning:
      "The wallet reported back to the dapp that the signing prompt was declined. If you pressed reject, that is the whole story. If you never saw a prompt, the popup was blocked, opened behind the window, or timed out.",
    fix: "Retry the action and look for the wallet popup, including behind the browser window and in the extension icon. On mobile, switch to the wallet app to find the pending request. Nothing was signed and nothing was spent.",
  },
  {
    slug: "internal-json-rpc-error",
    message: "internal JSON-RPC error",
    category: "wallet",
    meaning:
      "A catch-all from the wallet's connection to the network node: the node returned an error the wallet could not translate. Sometimes it wraps a real revert, sometimes the node itself is unhealthy or rate limiting.",
    fix: "Expand the error details if the wallet shows them: a real reason is often nested inside. Otherwise retry in a minute, switch the wallet's RPC endpoint for that network, or try another network connection.",
  },
  {
    slug: "header-not-found",
    message: "header not found",
    category: "wallet",
    meaning:
      "The RPC node was asked about a block it does not have yet, a sign the node is lagging behind the chain or load-balancing between out-of-sync servers. Your transaction and wallet are fine.",
    fix: "Retry after a few seconds. If it recurs, switch the network's RPC endpoint in the wallet settings to a healthier provider.",
  },
]

export function getError(slug: string): TxError | undefined {
  return TX_ERRORS.find((e) => e.slug === slug)
}

export function errorsByCategory(): { key: ErrorCategory; label: string; blurb: string; errors: TxError[] }[] {
  return (Object.keys(ERROR_CATEGORIES) as ErrorCategory[]).map((key) => ({
    key,
    ...ERROR_CATEGORIES[key],
    errors: TX_ERRORS.filter((e) => e.category === key),
  }))
}
