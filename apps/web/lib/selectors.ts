// Custom-error selector reference, driving /selector/[hex], the AI answer feed
// and the sitemap. When a modern contract reverts with a custom error, block
// explorers that lack the ABI show only the 4-byte selector (for example
// 0x118cdaa7), and people paste that hex straight into a search engine.
//
// PROVENANCE: every selector below was computed as the first 4 bytes of
// keccak256 of the signature, using a method verified against the two
// universally documented selectors, Error(string) = 0x08c379a0 and
// Panic(uint256) = 0x4e487b71. Do not add a selector without computing it:
// a wrong mapping here is worse than no page.
//
// A 4-byte selector identifies a SIGNATURE. Distinct signatures can in rare
// cases share a selector, so pages state the mapping as "this selector matches
// X", which is exact, rather than claiming no other signature exists.

export interface ErrorSelector {
  /** Lowercase 0x-prefixed 4-byte selector. Doubles as the URL segment. */
  selector: string
  /** The full error signature the selector was computed from. */
  signature: string
  /** The error name alone, for headings. */
  name: string
  /** Where this error is defined, so the reader knows what they hit. */
  source: string
  meaning: string
  fix: string
}

export const SELECTORS: ErrorSelector[] = [
  // ── Solidity built-ins ────────────────────────────────────────────────────
  {
    selector: "0x08c379a0",
    signature: "Error(string)",
    name: "Error",
    source: "Solidity built-in",
    meaning:
      "The standard revert-with-message wrapper. Every require(condition, \"message\") failure is encoded this way, with the human-readable reason packed after the selector.",
    fix: "Decode the string that follows the selector: it is the actual reason. A transaction decoder does this automatically from the hash.",
  },
  {
    selector: "0x4e487b71",
    signature: "Panic(uint256)",
    name: "Panic",
    source: "Solidity built-in",
    meaning:
      "The compiler's automatic safety check wrapper. The number that follows says which check fired: 0x11 arithmetic overflow, 0x12 division by zero, 0x32 array out of bounds, 0x01 failed assertion, among others.",
    fix: "Read the panic code after the selector and look it up in our error reference. A panic generally signals contract state the developers did not expect.",
  },

  // ── OpenZeppelin 5.x ──────────────────────────────────────────────────────
  {
    selector: "0x118cdaa7",
    signature: "OwnableUnauthorizedAccount(address)",
    name: "OwnableUnauthorizedAccount",
    source: "OpenZeppelin 5",
    meaning:
      "The calling address is not the contract's owner, and the function is owner-only. The address that made the forbidden call is included in the error data.",
    fix: "Use the dapp's normal interface rather than calling admin functions directly. If you administer the contract, sign from the owner address.",
  },
  {
    selector: "0x1e4fbdf7",
    signature: "OwnableInvalidOwner(address)",
    name: "OwnableInvalidOwner",
    source: "OpenZeppelin 5",
    meaning: "An ownership transfer was attempted to an invalid owner, most commonly the zero address.",
    fix: "If transferring ownership, double-check the new owner address. Regular users should not encounter this.",
  },
  {
    selector: "0xe450d38c",
    signature: "ERC20InsufficientBalance(address,uint256,uint256)",
    name: "ERC20InsufficientBalance",
    source: "OpenZeppelin 5",
    meaning:
      "The token transfer needs more tokens than the sender holds. The error data carries the sender, their balance, and the amount that was needed, so the shortfall is explicit.",
    fix: "Check the token balance against the amount, remembering decimals. If a contract triggered it mid-route, rebuild the transaction with a fresh quote.",
  },
  {
    selector: "0xfb8f41b2",
    signature: "ERC20InsufficientAllowance(address,uint256,uint256)",
    name: "ERC20InsufficientAllowance",
    source: "OpenZeppelin 5",
    meaning:
      "The spender contract is not approved to move this much of the token. The error data carries the spender, its current allowance, and the amount it needed.",
    fix: "Approve the token for the spender, for at least the amount in the transaction, then retry. The most common cause of a first swap or stake failing.",
  },
  {
    selector: "0x96c6fd1e",
    signature: "ERC20InvalidSender(address)",
    name: "ERC20InvalidSender",
    source: "OpenZeppelin 5",
    meaning: "The token transfer names an invalid sender, typically the zero address, which the standard forbids.",
    fix: "Almost always a contract-side bug in whatever built the transaction. Report it to the dapp.",
  },
  {
    selector: "0xec442f05",
    signature: "ERC20InvalidReceiver(address)",
    name: "ERC20InvalidReceiver",
    source: "OpenZeppelin 5",
    meaning: "The token transfer names an invalid receiver, typically the zero address. Sending tokens to the zero address burns them, so the standard blocks it unless done through an explicit burn.",
    fix: "Check the recipient address in the transaction. If a dapp filled it in, report the bug to the dapp.",
  },
  {
    selector: "0x94280d62",
    signature: "ERC20InvalidSpender(address)",
    name: "ERC20InvalidSpender",
    source: "OpenZeppelin 5",
    meaning: "An approval names an invalid spender, typically the zero address.",
    fix: "Rebuild the approval from the dapp. If it recurs, the dapp is producing a bad spender address.",
  },
  {
    selector: "0x7e273289",
    signature: "ERC721NonexistentToken(uint256)",
    name: "ERC721NonexistentToken",
    source: "OpenZeppelin 5",
    meaning: "The NFT token ID in the transaction does not exist: never minted, or burned. The ID is in the error data.",
    fix: "Verify the token ID. A marketplace listing for a burned NFT fails exactly here.",
  },
  {
    selector: "0x177e802f",
    signature: "ERC721InsufficientApproval(address,uint256)",
    name: "ERC721InsufficientApproval",
    source: "OpenZeppelin 5",
    meaning: "The operator is not approved to move this NFT: no per-token approval and no approval-for-all from the owner.",
    fix: "Approve the marketplace or contract for the NFT (or collection) first, then retry the transfer or sale.",
  },
  {
    selector: "0xe2517d3f",
    signature: "AccessControlUnauthorizedAccount(address,bytes32)",
    name: "AccessControlUnauthorizedAccount",
    source: "OpenZeppelin 5",
    meaning: "The calling address lacks the role the function requires. The account and the missing role's identifier are in the error data.",
    fix: "Use the dapp's normal user flows. Role-gated functions are for protocol operators, and this error is that gate working.",
  },
  {
    selector: "0xd93c0665",
    signature: "EnforcedPause()",
    name: "EnforcedPause",
    source: "OpenZeppelin 5",
    meaning: "The contract is paused and this function refuses to run while it is. The modern form of \"Pausable: paused\".",
    fix: "Wait for the protocol to unpause and watch their official channels. Nothing about your wallet is wrong, and nothing moved.",
  },
  {
    selector: "0x8dfc202b",
    signature: "ExpectedPause()",
    name: "ExpectedPause",
    source: "OpenZeppelin 5",
    meaning: "The opposite gate: a function that may only run WHILE paused was called with the contract unpaused. An operator-side error.",
    fix: "Nothing for a regular user to do. If you operate the contract, pause it first.",
  },
  {
    selector: "0x3ee5aeb5",
    signature: "ReentrancyGuardReentrantCall()",
    name: "ReentrancyGuardReentrantCall",
    source: "OpenZeppelin 5",
    meaning: "The contract blocked a re-entrant call, the modern form of \"ReentrancyGuard: reentrant call\". It protects against a class of exploit.",
    fix: "Retry the action on its own rather than batched. If it persists, the interaction between contracts is the issue: report to the protocol.",
  },
  {
    selector: "0xcd786059",
    signature: "AddressInsufficientBalance(address)",
    name: "AddressInsufficientBalance",
    source: "OpenZeppelin 5",
    meaning: "A contract tried to send more native coin (ETH and so on) than it holds. This is the CONTRACT's balance, not yours.",
    fix: "Usually a protocol-side state problem, for example a vault that cannot cover a withdrawal right now. Check the protocol's status before retrying.",
  },
  {
    selector: "0x1425ea42",
    signature: "FailedInnerCall()",
    name: "FailedInnerCall",
    source: "OpenZeppelin 5",
    meaning: "A low-level call the contract made to another contract failed without a reason. The real failure happened one layer deeper.",
    fix: "A transaction decoder that traces internal calls can find the inner failure. From the outside, check the obvious causes first: approvals, balances, paused contracts.",
  },
  {
    selector: "0x5274afe7",
    signature: "SafeERC20FailedOperation(address)",
    name: "SafeERC20FailedOperation",
    source: "OpenZeppelin 5",
    meaning: "A token call made through the SafeERC20 wrapper failed: the token at the address in the error data refused or misbehaved. Common with non-standard, restricted, or fake tokens.",
    fix: "Verify the token address is the genuine token, then check approval and balance. Lookalike scam tokens fail exactly here.",
  },
  {
    selector: "0xf645eedf",
    signature: "ECDSAInvalidSignature()",
    name: "ECDSAInvalidSignature",
    source: "OpenZeppelin 5",
    meaning: "A signature the contract tried to verify is malformed. Common with signed orders, permits, and meta-transactions that were built incorrectly or corrupted in transit.",
    fix: "Re-sign the message or order from the dapp rather than reusing a stored signature. If it persists, the dapp is building the signature payload wrongly.",
  },
  {
    selector: "0xf92ee8a9",
    signature: "InvalidInitialization()",
    name: "InvalidInitialization",
    source: "OpenZeppelin 5",
    meaning: "An upgradeable contract's initializer was called when it must not be, for example a second time. A deployment or upgrade-time error, not a user one.",
    fix: "Nothing user-side. If you are deploying, review the initializer flow.",
  },

  // ── Uniswap Permit2 ───────────────────────────────────────────────────────
  {
    selector: "0xd81b2f2e",
    signature: "AllowanceExpired(uint256)",
    name: "AllowanceExpired",
    source: "Uniswap Permit2",
    meaning:
      "Permit2 approvals carry an expiry, and this one has passed. The trade tried to spend tokens under a permission that is no longer valid. The expiry timestamp is in the error data.",
    fix: "Re-approve the token in the dapp (a fresh Permit2 signature or approval) and retry the trade.",
  },
  {
    selector: "0xf96fb071",
    signature: "InsufficientAllowance(uint256)",
    name: "InsufficientAllowance",
    source: "Uniswap Permit2",
    meaning: "The Permit2 allowance for this token is smaller than the amount the trade needs.",
    fix: "Approve the token again for at least the trade amount, then retry.",
  },
  {
    selector: "0xcd21db4f",
    signature: "SignatureExpired(uint256)",
    name: "SignatureExpired",
    source: "Uniswap Permit2",
    meaning: "The signed permit had a deadline and the transaction missed it, usually because it sat unmined too long.",
    fix: "Rebuild and re-sign the trade with a fresh quote so the new deadline is in the future, and use a market-rate fee so it mines in time.",
  },
  {
    selector: "0x815e1d64",
    signature: "InvalidSigner()",
    name: "InvalidSigner",
    source: "Uniswap Permit2",
    meaning: "The recovered signer of a permit does not match the expected owner: the signature is from the wrong account or malformed.",
    fix: "Make sure you sign with the same wallet address that holds the tokens, then rebuild the trade.",
  },

  // ── Uniswap Universal Router ──────────────────────────────────────────────
  {
    selector: "0x849eaf98",
    signature: "V2TooLittleReceived()",
    name: "V2TooLittleReceived",
    source: "Uniswap Universal Router",
    meaning: "Slippage protection on a V2-style pool: the swap would have delivered less than your minimum, so it refused to fill.",
    fix: "Retry with a fresh quote, slightly higher slippage tolerance, or a calmer market. The protection saved you from a worse price.",
  },
  {
    selector: "0x8ab0bc16",
    signature: "V2TooMuchRequested()",
    name: "V2TooMuchRequested",
    source: "Uniswap Universal Router",
    meaning: "The inverse slippage guard: filling the requested output would have taken more input tokens than your maximum.",
    fix: "Rebuild with a fresh quote. If it recurs, the pool is thin for this size: trade smaller or use an aggregator.",
  },
  {
    selector: "0x39d35496",
    signature: "V3TooLittleReceived()",
    name: "V3TooLittleReceived",
    source: "Uniswap Universal Router",
    meaning: "Slippage protection on a V3 pool: the output fell below your minimum between quoting and mining.",
    fix: "Fresh quote, slightly higher tolerance, or a calmer moment. For volatile pairs, smaller clips fill more reliably.",
  },
  {
    selector: "0x739dbe52",
    signature: "V3TooMuchRequested()",
    name: "V3TooMuchRequested",
    source: "Uniswap Universal Router",
    meaning: "The V3 inverse guard: the requested output would have cost more input than you allowed.",
    fix: "Rebuild the trade with a fresh quote, or reduce the size.",
  },
  {
    selector: "0x6a12f104",
    signature: "InsufficientETH()",
    name: "InsufficientETH",
    source: "Uniswap Universal Router",
    meaning: "The router needed more native ETH than the transaction supplied, common when a route wraps ETH mid-path and the value attached does not cover it.",
    fix: "Rebuild from the dapp with a fresh quote rather than editing the transaction value by hand.",
  },
  {
    selector: "0x675cae38",
    signature: "InsufficientToken()",
    name: "InsufficientToken",
    source: "Uniswap Universal Router",
    meaning: "The router ended a step with fewer tokens than the next step needed, typically a fee-on-transfer token shrinking mid-route.",
    fix: "Use the fee-on-transfer supporting route if the dapp offers one, or trade the token on a venue built for its transfer fee.",
  },
  {
    selector: "0x5bf6f916",
    signature: "TransactionDeadlinePassed()",
    name: "TransactionDeadlinePassed",
    source: "Uniswap Universal Router",
    meaning: "The trade's deadline passed before it was mined, usually because the fee was too low for current congestion.",
    fix: "Retry with a fresh quote and a market-rate fee. The deadline exists to stop stale-price fills, so this revert protected you.",
  },
  {
    selector: "0x1231ae40",
    signature: "ETHNotAccepted()",
    name: "ETHNotAccepted",
    source: "Uniswap Universal Router",
    meaning: "Native ETH was sent to the router in a context where it does not accept it.",
    fix: "Rebuild the transaction from the dapp. If you crafted it manually, do not attach value for token-to-token routes.",
  },
  {
    selector: "0xd76a1e9e",
    signature: "InvalidCommandType(uint256)",
    name: "InvalidCommandType",
    source: "Uniswap Universal Router",
    meaning: "The router received a command byte it does not recognise, which means the calldata was malformed, almost always a buggy or incompatible integration.",
    fix: "Use the official interface for the trade. If a third-party dapp produced this, report it there.",
  },

  // ── Uniswap V3 core ───────────────────────────────────────────────────────
  {
    selector: "0x2bc80f3a",
    signature: "T()",
    name: "T",
    source: "Uniswap V3 core",
    meaning: "A deliberately tiny error name from V3's gas-golfed core, thrown for a timestamp-related check in observations. Reaching it as an end user is rare.",
    fix: "Retry from the dapp with a fresh quote. Persistent failures here are for the integrating dapp to debug.",
  },
  {
    selector: "0xa1bf7886",
    signature: "LOK()",
    name: "LOK",
    source: "Uniswap V3 core",
    meaning: "The pool's reentrancy lock: the pool was entered again before the first operation finished. V3's compact equivalent of a reentrant-call revert.",
    fix: "Retry the trade on its own. If a complex route keeps hitting it, simplify the route or trade directly on the pool's own interface.",
  },

  // ── Common DeFi conventions ───────────────────────────────────────────────
  {
    selector: "0x3f4ab80e",
    signature: "TRANSFER_FAILED()",
    name: "TRANSFER_FAILED",
    source: "Common DeFi convention",
    meaning: "A custom-error form of the classic transfer failure: a token the contract tried to move refused the transfer.",
    fix: "Check the token for restrictions, fees on transfer, or a paused state, and verify approvals and balances.",
  },
  {
    selector: "0x82b42900",
    signature: "Unauthorized()",
    name: "Unauthorized",
    source: "Common DeFi convention",
    meaning: "A generic permission gate: the calling address is not allowed to do this. The custom-error cousin of owner and role checks.",
    fix: "Use the dapp's intended flow for the action. If you should have permission, confirm you are signing from the right address.",
  },
  {
    selector: "0xf4d678b8",
    signature: "InsufficientBalance()",
    name: "InsufficientBalance",
    source: "Common DeFi convention",
    meaning: "A compact custom error for not enough balance, thrown by many modern contracts in place of the older string message.",
    fix: "Check the relevant balance, token or native, against the amount, remembering gas needs the native coin on top.",
  },
  {
    selector: "0x2c5211c6",
    signature: "InvalidAmount()",
    name: "InvalidAmount",
    source: "Common DeFi convention",
    meaning: "The amount failed a contract rule: zero where nonzero is required, below a minimum, above a maximum, or wrong granularity.",
    fix: "Check the dapp for minimum and maximum limits on the action, and retry inside them.",
  },
  {
    selector: "0x70f65caa",
    signature: "DeadlinePassed()",
    name: "DeadlinePassed",
    source: "Common DeFi convention",
    meaning: "A generic deadline guard: the transaction mined after the time limit it carried.",
    fix: "Rebuild with a fresh quote and a fee that mines promptly.",
  },
  {
    selector: "0xd92e233d",
    signature: "ZeroAddress()",
    name: "ZeroAddress",
    source: "Common DeFi convention",
    meaning: "An address parameter was the zero address where a real one is required. Usually a dapp bug or an unfilled form field making it into the transaction.",
    fix: "Check any address field you filled in, and otherwise report to the dapp.",
  },
  {
    selector: "0x1f2a2005",
    signature: "ZeroAmount()",
    name: "ZeroAmount",
    source: "Common DeFi convention",
    meaning: "An amount of zero reached a function that requires a nonzero amount, often a stale interface sending an empty value.",
    fix: "Refresh the dapp, enter the amount again, and retry.",
  },
  {
    selector: "0x850c6f76",
    signature: "SlippageTooHigh()",
    name: "SlippageTooHigh",
    source: "Common DeFi convention",
    meaning: "The price moved beyond the tolerance the transaction allowed, so the contract refused to fill at the worse rate.",
    fix: "Retry with a fresh quote, a slightly wider tolerance, or a calmer market.",
  },
  {
    selector: "0xbb55fd27",
    signature: "InsufficientLiquidity()",
    name: "InsufficientLiquidity",
    source: "Common DeFi convention",
    meaning: "The pool or market cannot cover the requested size: not enough liquidity to fill the trade, mint, or withdrawal.",
    fix: "Trade a smaller size or route through deeper liquidity, for example via an aggregator.",
  },
]

export function getSelector(hex: string): ErrorSelector | undefined {
  const needle = hex.toLowerCase()
  return SELECTORS.find((s) => s.selector === needle)
}

export function selectorsBySource(): { source: string; entries: ErrorSelector[] }[] {
  const order: string[] = []
  const map = new Map<string, ErrorSelector[]>()
  for (const s of SELECTORS) {
    if (!map.has(s.source)) {
      map.set(s.source, [])
      order.push(s.source)
    }
    map.get(s.source)!.push(s)
  }
  return order.map((source) => ({ source, entries: map.get(source)! }))
}
