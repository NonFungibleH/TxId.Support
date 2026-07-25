# Aptos Chain Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chain-wide read + diagnose Aptos support (spec: `docs/superpowers/specs/2026-07-24-aptos-integration-design.md`), demo-ready for the Aptos partnership call.

**Architecture:** New isolated `packages/aptos` (`@txid/aptos`) mirroring `packages/solana` — fullnode REST + Indexer GraphQL + Move-abort decoder. Chain id `"aptos"`. Branching only at the existing Solana dispatch sites via a shared `isNonEvmChain` pattern. Actions/execute stays EVM-only.

**Tech Stack:** TypeScript (tsconfig.base, `exactOptionalPropertyTypes: true`), plain `fetch` (no SDK dependency — matches `packages/solana`), vitest for the pure decoder/util functions, live-probe scripts for API functions (repo convention: no test infra exists in packages today; vitest is added ONLY to `packages/aptos`).

**Conventions that bind every task:** conditional spreads for optional fields (never `field: x | undefined`); no comments unless the WHY is non-obvious; typecheck gate = `pnpm --filter <pkg> exec tsc --noEmit`; commit after every task; push at phase ends.

---

## Phase 1 — `@txid/aptos` package + chain registry (week 1)

### Task 1: Package scaffold + types

**Files:**
- Create: `packages/aptos/package.json`, `packages/aptos/tsconfig.json`, `packages/aptos/src/index.ts`, `packages/aptos/src/types.ts`

- [ ] **Step 1:** Copy `packages/solana/package.json` → `packages/aptos/package.json`; change name to `@txid/aptos`; add `"vitest": "^2"` AND `"tsx": "^4"` to devDependencies (tsx is NOT available anywhere in the workspace today — the live-probe scripts need it) and a `"test": "vitest run"` script. Copy `packages/solana/tsconfig.json` verbatim (note: its `include: ["src"]` means `scripts/` is not typechecked — the probe scripts are validated by running them).
- [ ] **Step 2:** Create `src/types.ts`:

```ts
export interface AptosBalance {
  address: string
  aptBalance: string          // formatted APT (8 decimals)
  aptRaw: string              // octas
  tokens: { assetType: string; symbol: string; name: string; amount: string; decimals: number }[]
}

export interface AptosTransaction {
  hash: string
  version: string
  success: boolean
  vmStatus: string
  timestamp: string           // ISO
  sender: string
  functionId: string | null   // "0xaddr::module::function" (null for non-entry txs)
  typeArguments: string[]
  gasUsed: string
  gasUnitPrice: string
  events: { type: string; data: unknown }[]
  decodedAbort?: DecodedAbort
}

export interface DecodedAbort {
  cause: "move_abort" | "out_of_gas" | "execution_failure" | "unknown"
  module: string | null       // "0xaddr::module"
  code: number | null
  category: string | null     // "invalid argument" | ... | null when non-canonical
  errorName: string | null    // from framework table / errmap, else null
  reason: string              // plain-English, always set, honest when only module+code known
  raw: string                 // original vm_status
}

export interface AptosModuleFunction {
  name: string
  isEntry: boolean
  isView: boolean
  params: string[]
  genericTypeParams: number
}

export interface AptosModuleAbi {
  address: string
  moduleName: string
  functions: AptosModuleFunction[]
}
```

- [ ] **Step 3:** Create `src/index.ts` exporting everything plus:

```ts
export function isAptosChain(chainId: string): boolean {
  return chainId === "aptos"
}
export function isAptosAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(addr)
}
export function normalizeAptosAddress(addr: string): string {
  return "0x" + addr.slice(2).toLowerCase().padStart(64, "0")
}
```

- [ ] **Step 4:** `pnpm install` (workspace pickup), then `pnpm --filter @txid/aptos exec tsc --noEmit` → clean.
- [ ] **Step 5:** Commit `feat(aptos): scaffold @txid/aptos package (types + chain/address helpers)`.

### Task 2: Abort decoder (TDD — this is pure parsing, the one genuinely unit-testable core)

**Files:**
- Create: `packages/aptos/src/abort.ts`, `packages/aptos/src/abort.test.ts`

- [ ] **Step 1:** Write failing tests first in `abort.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { decodeAbort } from "./abort"

describe("decodeAbort", () => {
  it("parses canonical std::error abort with category", () => {
    const d = decodeAbort("Move abort in 0x1::coin: 0x10006")
    expect(d.cause).toBe("move_abort")
    expect(d.module).toBe("0x1::coin")
    expect(d.code).toBe(0x10006)
    expect(d.category).toBe("invalid argument")   // category bits of 0x10006 are 1 (extract via BigInt, not >>)
    expect(d.errorName).toBe("EINSUFFICIENT_BALANCE") // framework table hit
    expect(d.reason).toMatch(/insufficient balance/i)
  })
  it("handles raw small-constant abort honestly (no category)", () => {
    const d = decodeAbort("Move abort in 0xabc::stable_pool: 0x7")
    expect(d.category).toBeNull()
    expect(d.errorName).toBeNull()
    expect(d.reason).toMatch(/code 7/)
    expect(d.reason).not.toMatch(/guarantee|certainly/i)
  })
  it("parses named-error variant 'EINSUFFICIENT_BALANCE(0x10006)'", () => {
    const d = decodeAbort("Move abort in 0x1::coin: EINSUFFICIENT_BALANCE(0x10006)")
    expect(d.errorName).toBe("EINSUFFICIENT_BALANCE")
    expect(d.code).toBe(0x10006)
  })
  it("handles OUT_OF_GAS", () => {
    expect(decodeAbort("Out of gas").cause).toBe("out_of_gas")
  })
  it("handles EXECUTION_FAILURE and unknown strings", () => {
    expect(decodeAbort("Execution failed in 0x1::x at code offset 5").cause).toBe("execution_failure")
    expect(decodeAbort("something novel").cause).toBe("unknown")
  })
  it("errmap overrides generic reason", () => {
    const d = decodeAbort("Move abort in 0xdead::pool: 0x3", { "0xdead::pool": { 3: { name: "E_SLIPPAGE", reason: "Output below the minimum you set (slippage)." } } })
    expect(d.errorName).toBe("E_SLIPPAGE")
    expect(d.reason).toMatch(/slippage/)
  })
  it("never invents a category for large raw u64 codes", () => {
    const d = decodeAbort("Move abort in 0xabc::vault: 18446744073709551615")
    expect(d.category).toBeNull()
    expect(d.code).toBeNull() // exceeds MAX_SAFE_INTEGER — kept only in raw/reason
    expect(d.reason).toMatch(/18446744073709551615/)
  })
})
```

- [ ] **Step 2:** `pnpm --filter @txid/aptos exec vitest run` → all FAIL (module missing).
- [ ] **Step 3:** Implement `abort.ts`: `CATEGORY_NAMES` map (1 invalid argument … 0xD unavailable, per `std::error`), `FRAMEWORK_ERRORS` table (≥15 entries: `0x1::coin` 0x10006 EINSUFFICIENT_BALANCE / 0x60005 ECOIN_STORE_NOT_PUBLISHED "wallet has not registered this coin", `0x1::account` sequence/exists errors, `0x1::aptos_account`, `0x1::object`, `0x1::fungible_asset` insufficient balance/frozen, `0x1::timestamp`, `0x3::token`, `0x4::token` common codes — source each from aptos-framework `error.move` conventions and module sources), regex parse of the three vm_status shapes, category extraction via **BigInt** (never `>>`, which truncates at 32 bits and would INVENT a false category for large raw u64 constants — the exact invented-certainty the spec forbids): parse the code as BigInt; if it exceeds `Number.MAX_SAFE_INTEGER`, set `code: null`, `category: null`, and quote the raw code in `reason`; else `category = big > 0xFFFFn && (big >> 16n) <= 0xDn ? CATEGORY_NAMES[Number(big >> 16n)] ?? null : null`, optional `errmap` param `Record<string, Record<number, { name: string; reason: string }>>` taking precedence, and reason-building that is explicit-but-honest for bare codes (`"The transaction was rejected by 0xabc::stable_pool with error code 7. The module doesn't publish a description for this code; common causes for this kind of action are …"` — keep phrasing generic here; protocol-specific phrasing lives in the errmap).
- [ ] **Step 4:** `vitest run` → PASS. `tsc --noEmit` → clean.
- [ ] **Step 5:** Commit `feat(aptos): Move abort decoder (categories, framework table, errmap)`.

### Task 3: Fullnode client

**Files:**
- Create: `packages/aptos/src/fullnode.ts`
- Create: `packages/aptos/scripts/verify-live.ts` (live probe; grows across tasks)

- [ ] **Step 1:** Implement `fullnode.ts`. Base URL `https://fullnode.mainnet.aptoslabs.com/v1`; every request sends `...(process.env.APTOS_API_KEY ? { Authorization: \`Bearer ${process.env.APTOS_API_KEY}\` } : {})`; shared `aptosGet<T>(path)` with 10s AbortSignal timeout returning `T | null` on non-OK (404 → null, not throw). Functions:
  - `getLedgerInfo()` → GET `/` → `{ chainId, ledgerVersion, ledgerTimestamp }`
  - `getAccount(address)` → GET `/accounts/{addr}` → `{ sequenceNumber } | null` (null = account does not exist — meaningful signal, not an error)
  - `getAptosModuleAbi(address, moduleName?)` → GET `/accounts/{addr}/module/{name}` or `/accounts/{addr}/modules?limit=25` → map `abi.exposed_functions` to `AptosModuleFunction[]` (`is_entry`, `is_view`, `params` minus signer types, `generic_type_params.length`)
  - `getAptosTransactionByHash(hashOrVersion, errmap?)` → numeric → `/transactions/by_version/{v}` else `/transactions/by_hash/{h}`; only `type === "user_transaction"` maps; on `success === false` attach `decodedAbort: decodeAbort(vm_status, errmap)`; map payload `function`/`type_arguments`, timestamp µs → ISO
  - `viewFunction(fn, typeArgs, args)` → POST `/view` → `unknown[] | null`
  - `getAptosNetworkStatus()` → ledger info + lag check (`Date.now() - ledgerTimestamp` > 60s ⇒ degraded) → `{ up: boolean, latestVersion, secondsBehind }`
  - `diagnoseAptosWallet(address)` → `{ exists, sequenceNumber, aptBalance, recentFailureCount }` (balance via `viewFunction("0x1::coin::balance", ["0x1::aptos_coin::AptosCoin"], [addr])`; failures counted later from indexer history — accept 0 placeholder until Task 4 wires it)
- [ ] **Step 2:** Write `scripts/verify-live.ts` (run with `pnpm --filter @txid/aptos exec tsx scripts/verify-live.ts`): asserts ledger info sane; `0x1` `coin` module ABI contains a `transfer` entry fn; a known mainnet tx hash (pick one from explorer.aptoslabs.com while implementing — one SUCCESS and one FAILED with a Move abort; hardcode both with a comment of what they are) maps correctly incl. `decodedAbort` on the failed one; `getAccount` on `0x1` exists and on `0x` + 63×`f`+`e` (vanity nonexistent) returns null. Print PASS/FAIL per check, exit 1 on any FAIL.
- [ ] **Step 3:** Run it live → all PASS. `tsc --noEmit` clean.
- [ ] **Step 4:** Commit `feat(aptos): fullnode client (ledger, accounts, module ABI, tx by hash/version, view)`.

### Task 4: Indexer client (balances + history)

**Files:**
- Create: `packages/aptos/src/indexer.ts`
- Modify: `packages/aptos/src/fullnode.ts` (wire `recentFailureCount`), `packages/aptos/scripts/verify-live.ts`

- [ ] **Step 1:** Implement `indexer.ts` — `aptosGraphql<T>(query, variables)` POST to `https://api.mainnet.aptoslabs.com/v1/graphql` (same optional bearer, 10s timeout).
  - `getAptosWalletBalance(address)`:

```graphql
query Balances($owner: String!) {
  current_fungible_asset_balances(
    where: { owner_address: { _eq: $owner }, amount: { _gt: "0" } }
    order_by: { amount: desc }, limit: 30
  ) { asset_type amount metadata { name symbol decimals } }
}
```

  Map to `AptosBalance`; APT = the row whose `asset_type` is `0x1::aptos_coin::AptosCoin` (or the FA-form APT metadata symbol "APT" at `0xa`); format 8 decimals; remaining rows → `tokens`. Normalise `address` before querying (indexer stores padded form).
  - `getAptosRecentTransactions(address, moduleAddress?, limit = 10)`: `account_transactions(where: {account_address: {_eq: $addr}}, order_by: {transaction_version: desc}, limit: 25) { transaction_version }` → hydrate each via `getAptosTransactionByHash(String(transaction_version))` (numeric input routes to `/by_version` — no separate helper exists) (concurrency 5) → if `moduleAddress`, filter `functionId?.startsWith(normalizeAptosAddress(moduleAddress))` → slice(0, limit).
- [ ] **Step 2:** Wire `diagnoseAptosWallet` to count `success === false` among the last 10.
- [ ] **Step 3:** Extend verify-live.ts: pick a busy public mainnet address from the explorer (e.g. a CEX hot wallet or foundation address — verify while implementing, comment what it is); assert balance has APT + ≥1 token, history returns txs with `functionId` populated; a legacy-CoinStore-era wallet also returns APT (FA/CoinStore unification check). Run → PASS.
- [ ] **Step 4:** Commit `feat(aptos): indexer client (FA balances, account history) + wallet diagnosis`.

### Task 5: Chain registry + name/logo maps (app-wide identity)

**Files:**
- Modify: `apps/app/lib/types/config.ts:41-58` (SUPPORTED_CHAINS + **add `"aptos"` to PAUSED_CHAINS temporarily**)
- Modify: `packages/ai/src/prompt.ts` (CHAIN_NAMES), `apps/app/components/dashboard/ConversationList.tsx` (CHAIN_NAMES)
- Modify: `apps/app/app/dashboard/analytics/page.tsx:23-49` (CHAIN_NAMES + CHAIN_LOGOS: add `aptos` AND backfill the missing `solana` entries)
- Create: `apps/app/public/chains/Aptos.png` (copy from `apps/web/public/chains/Aptos.png`) + the Solana logo too — note the web repo's file is `Solana.svg`, not .png; copy with the right extension and reference it accordingly (the analytics CHAIN_LOGOS paths are root-relative and served from `apps/app/public/chains/`, which has its own partial logo set — do NOT assume they load from the web origin)
- Modify: `apps/app/package.json` + `packages/ai/package.json` (add `"@txid/aptos": "workspace:*"`)

- [ ] **Step 1:** Add `{ id: "aptos", name: "Aptos", explorer: "explorer.aptoslabs.com" }` to SUPPORTED_CHAINS **and add `"aptos"` to `PAUSED_CHAINS` (config.ts:58)**. This is deliberate sequencing safety (Solana precedent): SELECTABLE_CHAINS feeds the contract dialogs immediately, but the chat route, widget, and dashboard paths don't exist until phase 3 — an unpaused half-wired chain would let users create Aptos contracts whose tools fall through to EVM paths. Task 13 removes the pause. Then grep each CHAIN_NAMES/CHAIN_LOGOS map listed above and add entries (`/chains/Aptos.png`), copying the logo files per the Files list.
- [ ] **Step 2:** `pnpm install`; typecheck sweep: `for p in @txid/aptos @txid/ai @txid/blockchain @txid/app @txid/web; do pnpm --filter $p exec tsc --noEmit || exit 1; done` → clean.
- [ ] **Step 3:** Commit `feat(aptos): chain registry + name/logo maps (incl. solana analytics backfill)`. Push (end of phase 1).

**Phase 1 acceptance:** verify-live.ts fully green against mainnet; vitest green; typecheck sweep green.

---

## Phase 2 — AI layer: tools, hash routing, prompt (week 2)

### Task 6: Non-EVM guard sweep in tools.ts

**Files:**
- Modify: `packages/ai/src/tools.ts` (all audited sites: :196, :212, :225, :238-316, :341+ contract toolset, :535, :546, :561, :566, :573, :588, :610, :637, :646)
- Modify: `packages/aptos/src/indexer.ts` (small `getAptosAssetMetadata(assetType)` helper for the :535 branch)

Per-site dispositions (from spec §3 table / §4):

- [ ] **Step 1:** Add at top: `import { isAptosChain, ... } from "@txid/aptos"` and a local `const isNonEvm = (id: string) => isSolanaChain(id) || isAptosChain(id)`.
- [ ] **Step 2:** Wallet tools — `get_wallet_balance` (:196) and `get_recent_transactions` (:212) gain `if (isAptosChain(wallet.chainId)) return getAptosWalletBalance(...)` / `getAptosRecentTransactions(wallet.address, contractFilter, limit)` branches mirroring the Solana lines directly above them. `get_wallet_approvals` (:225): Aptos → `{ address, count: 0, approvals: [], note: "Aptos has no standing token approvals — coins can only move when the owner signs. Nothing to revoke." }`.
- [ ] **Step 3:** `diagnose_wallet` (:573) → `diagnoseAptosWallet`. `get_network_status` (:566) → `getAptosNetworkStatus`. The `switchTo` computation at :588 is INSIDE diagnose_wallet's EVM path (it decides whether to offer the one-tap network-switch button) — do NOT add a note-returning early-return; just add Aptos to its exclusion (`!isSolanaChain(target) && !isAptosChain(target)`) so an EVM-connected wallet is never offered a switch to Aptos (no EIP-3326 there). `get_token_info` (:535) → Aptos branch mirroring the Solana line: FA metadata via a small indexer query (`fungible_asset_metadata` by `asset_type` — name, symbol, decimals, supply if available), honest note on lookup failure. `get_token_allowance` (:546) → note (no allowance concept on Aptos). `check_token_safety` (:610) → note ("EVM-only safety source; on Aptos check the asset's metadata + holders on the explorer") — same honest-note pattern the Solana branch uses. `estimate_action` (:637): Aptos → note (simulation needs a connected wallet; stretch task 14). Sanctions executor (:646): if the screened/connected address is Aptos-format-only (>40 hex) or wallet chain is `"aptos"` → `{ available: false, note: "Sanctions screening uses an EVM on-chain oracle and is not available for Aptos addresses." }`. While here, glance at `get_token_price` (:551): it has NO non-EVM guard today (pre-existing gap shared with Solana) — confirm an Aptos asset id fails gracefully (DexScreener may even answer); don't restructure, just verify no crash.
- [ ] **Step 4:** `get_native_price` (:561): read `packages/blockchain/src/token.ts:215` first. Mechanics (do not look for a "pair id"): `getNativeTokenPrice` maps chainId → an entry in the `NATIVE_WRAPPED`-style map `{ symbol, wrapped-token address }` and calls `getTokenPrice` against DexScreener's *tokens* endpoint filtered by `DEXSCREENER_CHAIN[chainId]`. Add `DEXSCREENER_CHAIN["aptos"] = "aptos"` and a native entry whose token id is APT (`0x1::aptos_coin::AptosCoin`, or the FA form `0xa` — probe both against `https://api.dexscreener.com/latest/dex/tokens/{id}` live and use whichever returns pairs). If neither returns reliable pairs, fall back to CoinGecko `simple/price?ids=aptos` and note the NEW third-party dependency (free tier ~5-30 req/min) in the commit message.
- [ ] **Step 5:** Contract toolset (:341+): every builder that takes `watchedContracts` — for a contract with `chain === "aptos"`: `get_contract_functions` → `getAptosModuleAbi` (needs `moduleName` from the snapshot — see Task 10; until then use the address's full module list); `get_contract_state`/`get_contract_data` → `viewFunction` (function name must be fully qualified `addr::module::fn` — build from contract + moduleName + user-supplied fn); `get_contract_info` → module existence + fn counts (no proxy/verification concepts — say so); `get_contract_transactions` → `getAptosRecentTransactions(contract.address, contract.address, limit)`; holdings/events/deployment/upgrade-history → honest per-tool notes (events partially: recent txs' events for the module).
- [ ] **Step 6:** Typecheck `@txid/ai`. Commit `feat(ai): Aptos branches at every non-EVM dispatch site`.

### Task 7: Tx-hash routing (the format-collision fix)

**Files:**
- Modify: `packages/ai/src/tools.ts:238-316` (get_transaction_by_hash executor)

- [ ] **Step 1:** In the candidate collector: `pushEvm` must skip `"aptos"` exactly as it skips Solana (:252-253 area).
- [ ] **Step 2:** Compute `aptosInPlay = isAptosChain(wallet?.chainId ?? "") || watchedContracts.some(c => isAptosChain(c.chain))`. When true AND input matches `/^0x[0-9a-fA-F]{64}$/` or `/^\d+$/`: add `getAptosTransactionByHash(hash)` to the same `Promise.all` fan-out as the EVM candidates (the fan-out already tolerates nulls). All-numeric input short-circuits to Aptos only. NOTE: pass **no errmap in this task** — `errmapFor()` does not exist yet; Task 9 Step 4 introduces it and upgrades this call site (the framework table inside decodeAbort still applies without it).
- [ ] **Step 3:** Result selection: prefer whichever candidate found a tx (existing behaviour); if both an EVM chain and Aptos claim the hash (astronomically unlikely), prefer the connected wallet's chain and say which chain was used in the result.
- [ ] **Step 4:** Extend verify-live.ts (or a small `packages/ai` probe script) — feed the known failed Aptos hash through `executeTool("get_transaction_by_hash", ...)` with an Aptos wallet config; assert the decoded abort surfaces. Run live → PASS.
- [ ] **Step 5:** Commit `feat(ai): route EVM-format Aptos tx hashes via parallel fullnode query`.

### Task 8: Prompt guidance

**Files:**
- Modify: `packages/ai/src/prompt.ts` (wallet/tx guidance — add Aptos block alongside the Solana block; CHAIN_NAMES done in Task 5)

- [ ] **Step 1:** Read the existing Solana guidance block in `buildSystemPrompt` and add the Aptos equivalent, covering: versions vs hashes; Petra/Martian; the `decodedAbort` interpretation contract mirroring `decodedRevert` (category → confident plain-English framing; `errorName` → use it; bare module+code → honest framing with likely causes, never invented certainty; `out_of_gas` → max gas units, not APT balance; submission-level errors like SEQUENCE_NUMBER_TOO_OLD → resubmit guidance); explorer.aptoslabs.com link format; "modules, not contracts" vocabulary; no approvals concept (frame as a Move safety property); sanctions/token-safety honest-note behaviour.
- [ ] **Step 2:** Grep prompt.ts for every place the Solana block is conditionally included and mirror the condition for Aptos (`config.chains.includes("aptos")` / wallet chain).
- [ ] **Step 3:** Typecheck. Commit `feat(ai): Aptos system-prompt guidance (aborts, Petra, vocabulary)`.

### Task 9: Curated failed-tx set + errmap for demo protocols

**Files:**
- Create: `packages/aptos/src/errmap.ts` (protocol errmaps: **Decibel (top priority — demo centerpiece, user decision 2026-07-24)**, Thala, Aries, Amnis, PancakeSwap-Aptos)
- Create: `packages/aptos/scripts/tune-diagnosis.ts`

> **Decibel** — Aptos Labs' own fully on-chain perpetuals exchange, mainnet package `0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06` (orderbook at same address; modules incl. perp_engine, perp_positions, liquidation, collateral_balance_sheet, dex_accounts_entry). The Task 17 demo build features Decibel first (branding + contracts + docs crawl); curated set targets ≥5 Decibel failed txs; perp-trader vocabulary (margin, leverage, mark price, liquidation) in reasons.

- [ ] **Step 1:** From explorer.aptoslabs.com, collect ~20 REAL failed mainnet txs across the four protocols (mix: slippage aborts, insufficient balance, not-registered, expired, raw-constant aborts). Record hash + expected story in `tune-diagnosis.ts`.
- [ ] **Step 2:** For each protocol module that appears, attempt constant harvesting: fetch package source via `0x1::code::PackageRegistry` resource on the module address; where non-empty, grep `const E\w+: u64 = \d+` → seed `errmap.ts`; where empty, hand-write entries for the codes seen in the curated set (reason strings from protocol docs/source on GitHub).
- [ ] **Step 3:** Run tune-diagnosis.ts: each tx → `getAptosTransactionByHash(hash, ERRMAP)` → print `reason`. Iterate on errmap/framework table until every curated tx reads as a support agent should say it. This step is done when a non-expert reading the output would know what to do next.
- [ ] **Step 4:** Thread the errmap: `getAptosTransactionByHash` already accepts it; tools.ts passes `errmapFor(watchedContracts)` (union of static errmap entries whose module address matches a watched contract, plus the full framework table always).
- [ ] **Step 5:** vitest + live scripts green. Commit `feat(aptos): protocol errmaps + curated failed-tx diagnosis tuning`. Push (end of phase 2).

**Phase 2 acceptance:** all ~20 curated failed txs produce support-quality plain English via the real tool path; EVM + Solana tool behaviour unchanged (spot-run an EVM tx through get_transaction_by_hash).

---

## Phase 3 — Surfaces: widget, chat route, dashboard, demos, marketing (week 3)

### Task 10: Types — moduleName threading

**Files:**
- Modify: `apps/app/lib/types/config.ts` (`WatchedContract`), `packages/ai/src/types.ts` (`WatchedContractSnapshot`)
- Modify: the snapshot construction site(s) in `apps/app/app/api/chat/route.ts` (grep `watchedContracts` mapping into the snapshot) + any other Snapshot builders (grep `WatchedContractSnapshot`)

- [ ] **Step 1:** Add `moduleName?: string` to both types; thread with conditional spread `...(c.moduleName ? { moduleName: c.moduleName } : {})` at every mapping site (grep-driven; `exactOptionalPropertyTypes`).
- [ ] **Step 2:** tools.ts contract branches from Task 6 switch from "full module list" to scoped module when `moduleName` present.
- [ ] **Step 3:** Typecheck sweep. Commit `feat: optional moduleName on watched contracts (Aptos module scoping)`.

### Task 11: Chat route — wallet validation + non-EVM exclusions

**Files:**
- Modify: `apps/app/app/api/chat/route.ts:151-160` (address formats), `:459` (actionsCtx gate)

- [ ] **Step 1:** Add `const APTOS_ADDR = /^0x[0-9a-fA-F]{1,64}$/` and accept `walletAddress` matching EVM OR SOL OR (APTOS when `chainId === "aptos"`). NOTE (spec §2): this check runs before the project loads — format-only here is by design; chain-membership enforcement happens implicitly because tools only run against the project's configured chains.
- [ ] **Step 2:** actionsCtx gate: `chainId !== "solana"` becomes `!isNonEvmChain(chainId)` (import or inline `chainId !== "solana" && chainId !== "aptos"` — match file idiom).
- [ ] **Step 3:** Typecheck; live-probe: POST /api/chat (local or preview) with an Aptos walletAddress + chainId "aptos" on a test project → no 400. Commit `feat(chat): accept Aptos wallet addresses; exclude Aptos from Actions gate`.

### Task 12: Widget — Petra connect + manual paste + :615 fix

**Files:**
- Modify: `apps/app/app/widget/WidgetApp.tsx` (:611-619 manual paste + :615 chain assignment; connect flow ~:628-667; header labels ~:1070-1098; ActionCard render guard ~:1476-1493)

- [ ] **Step 1:** Detect: `const isAptosProject = config.chains.includes("aptos")`. Connect flow: branch before the EVM path — `const petra = (window as any).aptos ?? (window as any).martian; if (isAptosProject && petra) { const acct = await petra.connect(); address = acct.address; chainId = "aptos" }` with try/catch parity to the Phantom branch (silent no-op is NOT acceptable: on missing provider fall through to manual-input mode). Button label "Connect Petra" when `isAptosProject && !hasEvmWallet`.
- [ ] **Step 2:** Manual paste (:611): validation becomes chain-aware — accept 40-hex always (EVM), accept 1-64-hex when `isAptosProject`. Chain assignment (:615): input >40 hex → `"aptos"`; exactly 40 hex → first chain that is neither `"solana"` nor `"aptos"`, else `"aptos"` when Aptos-only project; keep `?? "0x1"` fallback.
- [ ] **Step 3:** ActionCard render guard: add `m.walletAction && walletSession?.chainId !== "aptos"` (mirror however Solana is excluded — read the guard first).
- [ ] **Step 4:** Typecheck + lint. Manual verification (needs deploy or local env): NOTE — `"aptos"` is still in PAUSED_CHAINS at this point, so no picker can create an Aptos demo; set the test project's chains server-side via `updateDemoConfig(id, { chains: ["aptos"] })` (the pause only filters pickers, not stored config), or defer this check to Task 13 Step 5. Then: open widget on that demo, paste a mainnet Aptos address, ask "what's my balance" → real APT balance. Commit `feat(widget): Petra connect + Aptos address paste with chain disambiguation`.

### Task 13: Dashboard contracts + demo creator

**Files:**
- Modify: `apps/app/lib/actions/contracts.ts:17-20` (zod), `apps/app/components/settings/AddContractDialog.tsx:44-58,97-163`, `apps/app/components/settings/AbiManager.tsx`, `refreshContractAbi` in contracts.ts
- Modify: `apps/app/lib/actions/demos.ts:146` (+ chain select source in `DemosManager.tsx` DEMO_CONTRACT_CHAINS)

- [ ] **Step 0:** Remove `"aptos"` from `PAUSED_CHAINS` (config.ts:58) — it was added in Task 5 purely as sequencing safety; from this commit Aptos is user-selectable, and the chat route (Task 11) + widget (Task 12) already handle it.
- [ ] **Step 1:** contracts.ts zod: address schema becomes a chain-discriminated refine — EVM regex for hex chains, `/^0x[0-9a-fA-F]{1,64}$/` for `"aptos"`. Add optional `moduleName` field (required for `"aptos"`? NO — optional; absent means all modules at the address).
- [ ] **Step 2:** AddContractDialog: chain picker already includes Aptos via SELECTABLE_CHAINS (Task 5); branch the validity regex (:45) and the auto-peek (:44-58): for Aptos call a new server action `peekAptosModules(address)` (thin wrapper over `getAptosModuleAbi`) listing modules + entry/view function names; add an optional "Module name" input shown only for Aptos.
- [ ] **Step 3:** AbiManager + `refreshContractAbi`: follow the Solana/IDL relabel precedent — `chain === "aptos"` → label "Move module ABI (on-chain)", check button fetches via `getAptosModuleAbi` and stores `JSON.stringify` of it in the existing `abi` field with `abiSource: "explorer"` (reuse field; the AI contract tools for Aptos read the on-chain ABI live anyway — stored copy is informational).
- [ ] **Step 4:** demos.ts:146: same chain-aware address validation (the demo add passes `chain`); DemosManager DEMO_CONTRACT_CHAINS currently filters only `"solana"` — keep Aptos IN the list. The Actions "Executable contract functions" section: skip contracts with `chain === "aptos"` (render the card with "Execution is EVM-only for now").
- [ ] **Step 5:** Typecheck + lint + live check (add the `0x1` coin module as an Aptos contract on a test project; peek lists functions). Commit `feat(dashboard): Aptos contract/module support (add, peek, ABI relabel, demo creator)`.

### Task 14 (stretch): ANS names + connected-wallet simulate

Skip unless weeks 1-3 are ahead of schedule. ANS: resolver in `names.ts` via `https://www.aptosnames.com/api/mainnet/v1/address/{name}`; wire into the ENS tool's Aptos branch. Simulate: `estimate_action` Aptos branch using Petra's public key (threaded from connect — new field on WalletSession), POST `/transactions/simulate`. Each its own commit.

### Task 15: Marketing + docs flip (only after 12-13 verified live)

**Files:**
- Modify: `apps/web/lib/chains.ts:248-260` (status `"coming-soon"` → `"live"`, rewrite tagline/intro), `apps/web/app/chains/page.tsx:13` (meta), `apps/web/lib/docs.ts` (chains help-center doc), `apps/web/components/sections/FAQ.tsx` (chain list), `apps/docs` chain references (grep "Avalanche" to find the lists), `CLAUDE.md` (chain support section)

- [ ] **Step 1:** Grep `apps/web` + `apps/docs` for `Aptos|coming.soon|on the way` and update every hit; keep claims read+diagnose-scoped (no execute claims).
- [ ] **Step 2:** `pnpm --filter @txid/web exec next build` → clean. Commit `feat(web): Aptos live on marketing + docs`. Push (end of phase 3).

**Phase 3 acceptance:** an Aptos demo built in the demo creator answers balance/tx/docs questions end-to-end on the deployed app, via both Petra and pasted address.

---

## Phase 4 — Hardening + rehearsal (week 4)

### Task 16: QA sweep

- [ ] Typecheck all 6 packages; `next build` both apps; eslint changed files.
- [ ] Annotate the eight EVM-only regex sites per spec §7 with a one-line "EVM-only by design (Aptos unsupported here)" comment: `route.ts:254`, `demos.ts:250`, `DemosManager.tsx:454`, `ActionsForm.tsx:174`, `check/page.tsx:358`, `sanctions.ts:47`, `events.ts:249`, `packages/ai/src/actions.ts:83` (re-locate by content — lines will have drifted).
- [ ] Dispatch an adversarial review agent over the full Aptos diff (session pattern: findings → verify → fix confirmed bugs).
- [ ] Regression: EVM demo (Uniswap) + an EVM tx hash + /check flow all behave unchanged.

### Task 17: Demo build + rehearsal

> **Demo strategy (user decision 2026-07-25): LIVE CREATION.** Howard creates the
> Decibel demo live on the call in the demo-creator UI — the setup speed IS part
> of the pitch ("watch me install this in 90 seconds"). No pre-built Decibel demo
> is shown; instead the live flow is: New demo → brand colours → add the Decibel
> package address (module-scoped) → crawl their docs → open widget → connect
> Petra / paste a trader's address → diagnose a real transaction. This makes the
> Task 9 errmap MORE important, not less: the live-created demo must answer well
> with zero on-call tuning.

- [x] **Docs-crawl pre-check — DONE 2026-07-25, verdict: GOOD.** docs.decibel.trade/quickstart/overview is server-rendered (784 words of real prose in raw HTML, all perp keywords present) and exposes `/llms.txt` as a page index — the RAG crawl will produce a quality KB (contrast app.uniswap.org's empty SPA shell). No subtree workaround needed.
- [x] **Module auto-fetch — DONE (Task 13 live probe):** the AddContractDialog peek returns all 91 Decibel modules (post-pagination fix).
- [x] **By-hash diagnosis — DONE (QA sweep live probe):** pasting `0x3f12a009…838b33` decodes to the crafted TP/SL perp reason via errmapFor.
- [ ] **Remaining pre-flight (needs Petra + APTOS_API_KEY, Howard):** full live click-through — create demo → Decibel address → crawl docs → open widget → connect Petra / paste a trader address → ask the headline questions; measure the docs-crawl duration for the talk-track.
- [x] **CSP pre-check of the Decibel app site — DONE 2026-07-25, verdict: BLOCKED.** app.decibel.trade enforces header CSP with `script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-src 'self' + wallet iframes only`, and a strict `connect-src` allowlist (no meta CSP; both layers checked). The bookmarklet cannot inject there. **Demo script therefore runs on OUR surfaces:** demo-creator → widget preview (`app.txid.support/widget?key=…`) and/or the share page (`txid.support/d/<key>`). Talk-track line for the call: "in production this runs on your own domain, so your CSP just allowlists app.txid.support — one line, same as Intercom/Zendesk;" optionally show the embed snippet to make 'easy to install' concrete. docs.decibel.trade confirmed reachable (HTTP 200) for the live docs-crawl step.
- [ ] **Build ONE hidden pre-built Decibel demo as the fallback** — identical config, tested — in case live creation hiccups (crawl slow, rate limit, wifi). Switching to it mid-call must take one click.
- [ ] Optionally pre-build Thala or Aries as a second "here's one we made earlier" example.
- [ ] Dry-run the LIVE-CREATION script end-to-end twice, timed: once with Petra, once paste-only. Every question in the script must have been asked at least once before the call.
- [ ] Fix list → final push.

---

## Execution notes for workers

- `packages/solana/src/` is the pattern-reference for everything in `packages/aptos` — read it before Task 1.
- Read the exact current code at every cited line number before editing — line numbers drift.
- Live probes hit public mainnet endpoints; they are part of the definition of done, not optional.
- Never touch: Actions/EVM pipeline semantics, /check public demo (stays EVM), Telegram.
- If an Aptos API response doesn't match the plan's assumed shape, STOP and verify against the live endpoint (curl) before adapting — do not guess mappings.
