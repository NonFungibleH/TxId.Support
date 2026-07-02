# Solana Support + EVM Wallet Upgrade — Design Spec
_Date: 2026-07-02_

## Overview

Add Solana as a first-class supported chain in TxID Support, with full feature parity to EVM chains: wallet connection, balance lookup, transaction history, and failed transaction diagnostics. Simultaneously upgrade the EVM wallet connection layer from `window.ethereum` (MetaMask-only) to wagmi + WalletConnect v2 (any EVM wallet).

## Goals

- Protocol teams can select "Solana" in the chain selector alongside Ethereum, Base, BNB, etc.
- Solana users can connect Phantom, Solflare, or Backpack and get the same AI-assisted tx diagnostics as EVM users
- EVM users on Rainbow, Coinbase Wallet, Ledger, etc. can connect (not just MetaMask)
- The AI tools interface is unchanged — Claude sees the same tool names regardless of chain
- Architecture is clean for future chain additions (Sui, Aptos, etc.)

## Architecture

Four areas of change, each isolated:

```
packages/solana/       ← new package: Helius client, tx decoder, wallet tools
packages/ai/           ← executeTool routes to Solana or EVM based on chainId
apps/app/              ← chain selector + ABI→IDL relabelling
apps/app/widget/       ← dual wallet connect (wagmi/WC2 for EVM, wallet-adapter for Solana)
```

---

## 1. `packages/solana` (new package)

### Purpose
Mirrors `packages/blockchain` for Solana. All Helius API calls and tx decoding live here. Nothing Solana-specific leaks into other packages.

### RPC Provider
**Helius** — free Developer tier, enhanced transaction API returns parsed human-readable descriptions (e.g. "Swapped 100 USDC for 0.5 SOL on Jupiter") which avoids most custom decoding work. Clear paid upgrade path as usage grows.

Environment variable: `HELIUS_API_KEY`

### Exports

```ts
// Balance
getSolanaWalletBalance(address: string): Promise<SolanaBalance>
// Returns: SOL balance + array of SPL token balances (mint, symbol, amount)

// Transaction history
getSolanaRecentTransactions(
  address: string,
  programAddress?: string
): Promise<SolanaTransaction[]>
// Fetches recent txs via Helius enhanced API. If programAddress provided,
// filters to txs involving that program (equivalent of contract_address filter on EVM)

// Single transaction
getSolanaTransactionBySignature(signature: string): Promise<SolanaTransaction>
// Full detail including instruction decoding, token transfers, error info

// IDL lookup
fetchIdlFromRegistry(programAddress: string): Promise<string | null>
// Checks anchor.projectserum.com for published Anchor IDL.
// Equivalent of fetchAbiFromExplorer for Solana programs.
```

### Transaction type
`SolanaTransaction` maps to the shared `Transaction` shape used by the AI layer:

```ts
interface SolanaTransaction {
  signature: string          // base58 tx signature (equivalent of hash)
  blockTime: number          // unix timestamp
  slot: number
  status: "success" | "failed"
  fee: number                // lamports
  description: string | null // Helius human-readable description
  type: string | null        // e.g. "SWAP", "TRANSFER", "NFT_SALE"
  tokenTransfers: SolanaTokenTransfer[]
  nativeTransfers: SolanaNativeTransfer[]
  error: string | null       // error message if failed
  programIds: string[]       // programs involved
}
```

### Error decoding
Solana has no eth_call replay equivalent. Instead:
- Helius marks failed txs with an `err` field containing the transaction error
- Common errors (`InsufficientFunds`, `SlippageToleranceExceeded`, etc.) are mapped to plain-English explanations in a lookup table
- If IDL is uploaded, custom program errors are matched by error code

---

## 2. Dashboard changes (`apps/app`)

### Chain selector
Add to `SUPPORTED_CHAINS` in `lib/types/config.ts`:
```ts
{ id: "solana", name: "Solana", explorer: "solscan.io" }
```
`ChainId` type automatically includes `"solana"` via the `as const` union.

### ABI → IDL for Solana contracts
When a watched contract has `chain === "solana"`:
- `AbiManager` component relabels "ABI" → "IDL" throughout
- Auto-fetch button calls `fetchIdlFromRegistry` instead of `fetchAbiFromExplorer`
- Paste textarea accepts Anchor IDL JSON (same `abi` field, different format)
- Address placeholder shows base58 format example instead of `0x…`

No schema changes — IDL JSON stored in the existing `abi` string field.

### Contract address validation
Add a helper `isSolanaChain(chainId: string): boolean` used in UI hints and validation — Solana addresses are base58, 32–44 chars, no `0x` prefix.

---

## 3. Widget wallet layer (`apps/app/app/widget/`)

### EVM: upgrade to wagmi + WalletConnect v2
Replace direct `window.ethereum` access with **wagmi** + **@wagmi/connectors**:
- MetaMask (injected)
- WalletConnect v2 (Rainbow, Ledger, any WC-compatible wallet)
- Coinbase Wallet

Environment variable: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

### Solana: `@solana/wallet-adapter-react`
Adapters included: Phantom, Solflare, Backpack.

### Routing logic
The widget reads `config.chains` from the project config:
- If any chain is `"solana"` → render Solana wallet connect (wallet-adapter modal)
- Otherwise → render EVM wallet connect (wagmi modal)
- If both → show chain selector first, then appropriate wallet modal

`walletConfig` shape is unchanged: `{ address: string, chainId: string }`.
For Solana: `{ address: "<base58>", chainId: "solana" }`.

---

## 4. AI tools routing (`packages/ai`)

### `executeTool` routing
Single branch point in `packages/ai/src/tools.ts`:

```ts
function isSolana(chainId: string): boolean {
  return chainId === "solana"
}

// Inside executeTool:
if (isSolana(walletConfig.chainId)) {
  // call packages/solana implementations
} else {
  // call existing packages/blockchain implementations (unchanged)
}
```

Tool names visible to Claude remain identical: `get_wallet_balance`, `get_recent_transactions`, `get_transaction_by_hash`. No prompt changes required for the tool definitions.

### System prompt Solana hints
When project chain is `"solana"`, inject into the wallet section:
- "transaction signature" instead of "transaction hash"
- Solscan links instead of Etherscan
- Solana-specific error guidance (no gas limit concept; fee is fixed in lamports)
- If tx not found: suggest checking signature format (base58, not 0x-prefixed)

Implemented as a small conditional block in `buildSystemPrompt`, gated on `isSolanaChain(config.chains[0])`.

---

## 5. New environment variables

| Variable | Purpose |
|---|---|
| `HELIUS_API_KEY` | Solana RPC + enhanced tx API |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect v2 project (register free at cloud.walletconnect.com) |

---

## Implementation order

1. `packages/solana` — Helius client + all five exported functions + types
2. Dashboard chain selector + ABI/IDL relabelling
3. Widget EVM wallet upgrade (wagmi + WC2)
4. Widget Solana wallet adapter
5. AI tools routing in `executeTool`
6. System prompt Solana hints
7. `.env.example` + docs update

---

## Out of scope

- Solana program (smart contract) deployment or interaction beyond read/diagnostics
- SPL token trading UI (token mode on Solana)
- Telegram bot Solana support (follow-on, after core widget support ships)
