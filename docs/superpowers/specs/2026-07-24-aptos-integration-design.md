# Aptos Chain Integration — Design Spec

**Date:** 2026-07-24
**Status:** Draft (pending review)
**Goal:** Chain-wide, read + diagnose Aptos support — the widget works on *any* Aptos protocol the way it works on any EVM chain — demo-ready for the Aptos partnership call in 3–4 weeks.
**Explicitly out of scope:** Actions/execute on Aptos, sanctions screening on Aptos (Chainalysis oracle is EVM-only; the tool is absent for Aptos sessions), Telegram changes (no wallet tools there anyway), token-mode.

---

## 1. Why this shape

Aptos is a Move-VM L1 — a different chain *family*, like Solana, not another EVM chain. None of our EVM providers cover it (Moralis: no; Etherscan: no). But Aptos has uniform, keyless public infra that makes a **generic** integration feasible:

- **Fullnode REST API** (`https://fullnode.mainnet.aptoslabs.com/v1`) — accounts, resources, **on-chain module ABIs** (no verification dependency — better than EVM), transactions by hash/version, **transaction simulation**.
- **Indexer GraphQL** (`https://api.mainnet.aptoslabs.com/v1/graphql`) — fungible-asset balances (covers both legacy CoinStore and new FA standard), per-account transaction history.
- **Move abort convention** — abort codes in `aptos_framework` modules embed a semantic category (invalid_argument, not_found, permission_denied, resource_exhausted…), so a *generic* decoder yields useful plain English for any conforming module; module error-constant names deepen it where available.

Precedent: `packages/solana` (`@txid/solana`). Aptos follows the same isolation pattern: one new package, thin branching at existing chain dispatch points.

## 2. Chain identity

- Chain id string: **`"aptos"`** (like `"solana"`; not hex).
- Address format: `0x` + 1–64 hex chars (fullnode accepts short forms; we normalise to padded 64 for comparisons, display short). New helper `isAptosAddress()`; **every** `/^0x[0-9a-fA-F]{40}$/` validation point must branch (see §7 list).
- Explorer: `explorer.aptoslabs.com` (txn/{version_or_hash}, account/{addr}).
- Registry additions: `SUPPORTED_CHAINS` gets `{ id: "aptos", name: "Aptos", explorer: "explorer.aptoslabs.com" }` (config.ts:41); NOT in `PAUSED_CHAINS`. CHAIN_NAMES maps in `packages/ai/src/prompt.ts` + `ConversationList.tsx`; `apps/web/lib/chains.ts` (logo `Aptos.png` already exists).

## 3. New package: `packages/aptos` (`@txid/aptos`)

Mirrors `@txid/solana` layout. No API key required (public endpoints; optional `APTOS_API_KEY` header support for Aptos Build rate-limit headroom later).

```
packages/aptos/src/
├── index.ts        // exports + isAptosChain(id) ("aptos")
├── types.ts        // AptosBalance, AptosTransaction, AptosModuleAbi, DecodedAbort
├── fullnode.ts     // REST: account resources, module ABIs, tx by hash/version, simulate
├── indexer.ts      // GraphQL: fungible_asset balances, account tx history
├── abort.ts        // Move abort decoder (generic + framework table + module constants)
└── names.ts        // ANS .apt resolution (nice-to-have, week 3)
```

### Key functions

- `getAptosWalletBalance(address)` — APT (0x1::aptos_coin::AptosCoin) + top fungible assets via Indexer `current_fungible_asset_balances` (covers CoinStore-migrated and FA-native tokens in one query). Cap ~30 tokens, skip zero balances (Solana parity).
- `getAptosRecentTransactions(address, moduleAddress?, limit)` — Indexer `account_transactions` → hydrate via fullnode by version. Map to a `Transaction`-compatible shape: hash, version, success, timestamp, function id (`0xaddr::module::function`), gas used, vm_status, events summary. Optional filter: entry function's module address matches a watched module.
- `getAptosTransactionByHash(hashOrVersion)` — fullnode `/transactions/by_hash/{h}` (fallback `/by_version/{v}` when numeric). On failure (`success: false`), attach `decodedAbort` from abort.ts.
- `getAptosModuleAbi(accountAddress, moduleName?)` — fullnode `/accounts/{addr}/modules` (or single `/module/{name}`) → exposed functions (entry/view flags, params, generics) + structs. This is the ABI story: **always available, on-chain**.
- `viewFunction(fn, typeArgs, args)` — fullnode `/view` for read calls (powers get_contract_state/data equivalents).
- `decodeAbort(vmStatus, moduleAbi?)` in abort.ts:
  1. Parse `Move abort in 0xADDR::module: 0xCODE` (also `EXECUTION_FAILURE`, `OUT_OF_GAS`, location-less aborts).
  2. Split canonical error code → category (upper 16 bits per `std::error` convention) → plain-English category ("invalid argument", "not found", "permission denied"…).
  3. Framework table: known `0x1`/`0x3`/`0x4` module+code pairs (insufficient balance, coin not registered, account not exists…) hardcoded.
  4. If the module ABI/source metadata names error constants (available via `/accounts/{addr}/module/{name}` `source_map`-adjacent metadata when published), surface the constant name (`EINSUFFICIENT_LIQUIDITY`) — best-effort.
  5. Return `{ cause, category, module, code, reason, raw }` — same spirit as EVM `DecodedRevert`; the prompt gets a matching interpretation guide.

### Failure-mode parity table (what each EVM capability maps to)

| EVM capability | Aptos equivalent | Depth |
|---|---|---|
| Balance + tokens | Indexer FA balances | full |
| Recent txs | Indexer account_transactions | full |
| Tx by hash + revert decode | Fullnode by_hash + abort decoder | full (category-level everywhere; constant-level best-effort) |
| Contract ABI (Etherscan) | On-chain module ABI | **better** (always available) |
| get_contract_state/data | `/view` calls | full |
| Approvals list | — (no allowance concept for coins; FA has transfer_ref not user approvals) | returns `[]` + prompt explains |
| Sanctions oracle | none | tool absent on Aptos |
| estimate_action | fullnode simulate (week-3 stretch) | stretch |

## 4. AI layer (`packages/ai`)

- `tools.ts`: branch `isAptosChain(wallet.chainId)` exactly like `isSolanaChain` for get_wallet_balance / get_recent_transactions / get_transaction_by_hash / get_contract_transactions. Contract toolset (info/state/data/functions) routes to module-ABI + `/view` equivalents; holdings via account resources; events via tx-events (best-effort); approvals `[]`.
- `prompt.ts`: Aptos wallet/tx guidance block (Solana precedent): version vs hash, Petra/Martian, Move aborts interpretation guide mirroring `decodedRevert` (category → user-facing framing; OUT_OF_GAS → max gas units not APT balance; `SEQUENCE_NUMBER_TOO_OLD` → resubmit guidance), explorer.aptoslabs.com links, "modules not contracts" vocabulary.
- Tool *labels* unchanged (WidgetApp TOOL_LABELS keys are tool names — no change needed).

## 5. Widget (`apps/app/app/widget/WidgetApp.tsx`)

- Detect Aptos project: `config.chains.includes("aptos")`.
- Wallet connect: `window.aptos` (Petra) → `connect()` → `{ address }`; fallback `window.martian`. chainId `"aptos"`. Button label "Connect Petra".
- **Manual paste path** accepts Aptos addresses when the project is Aptos (fixes the Solana-style dead-end: paste works without an extension).
- Chat route `EVM_ADDR|SOL_ADDR` wallet validation gains `APTOS_ADDR = /^0x[0-9a-fA-F]{1,64}$/` (route.ts:153).
- ActionCard: never renders (Actions gate already requires EVM; `chainId !== "solana"` check extended to exclude `"aptos"`).

## 6. Dashboard (`apps/app`)

- Contracts page: adding an Aptos "contract" = account address (+ optional module name). `AddContractDialog` + `contracts.ts` zod: branch address regex by chain; auto-peek lists module entry/view functions from on-chain ABI (replaces the Etherscan function-peek). `AbiManager` relabels: "Move module ABI — fetched on-chain" (auto; no paste needed, keep paste as override). `refreshContractAbi` branches to `getAptosModuleAbi` (Solana/IDL precedent at contracts.ts).
- Demo creator: `addDemoContract` regex branch + chain select includes Aptos; ABI auto-fetch via module ABI; Actions section hides Aptos contracts (execute is EVM-only).
- Docs/RAG: zero changes (chain-agnostic).

## 7. Complete EVM-regex branch list (audited)

`apps/app/lib/actions/contracts.ts:18` (zod), `apps/app/lib/actions/demos.ts:146` (+ approval check 250 stays EVM-only), `apps/app/components/settings/AddContractDialog.tsx:45,161`, `apps/app/app/api/chat/route.ts:153` (wallet addr), `route.ts:254` (inspect mode — stays EVM-only for /check), `apps/app/components/admin/DemosManager.tsx` manual-add path, widget manual-paste (`WidgetApp.tsx:611`). Each gets an Aptos branch or an explicit "EVM-only, unchanged" note in code review.

## 8. Delivery plan (3–4 weeks)

- **Week 1 — package + reads.** `@txid/aptos`: balances, tx history, tx-by-hash, module ABI, `/view`. Verified against live fullnode/indexer with real txs from top protocols (Thala, Aries, Amnis, PancakeSwap-Aptos). Chain registry + logos.
- **Week 2 — diagnosis + AI.** abort.ts decoder (+ framework table), tools.ts branching, prompt guidance. Curate a test set of ~20 real failed txs across protocols; tune until explanations read well.
- **Week 3 — surfaces.** Petra connect + manual paste in widget; dashboard contract flow (module ABI auto-fetch); demo creator support; build the actual Aptos demos (crawl Thala/Aries/Amnis docs); ANS + simulate as stretch.
- **Week 4 — hardening + rehearsal.** Full QA pass (typecheck sweep, adversarial review agent, live walkthrough), fix list, dry-run the exact call script.

Each week ends with a shippable commit; weeks 1–2 are pure backend (no user-visible risk).

## 9. Risks & mitigations

1. **Indexer/fullnode rate limits on shared endpoints** → keyless is fine for demo volume; add `APTOS_API_KEY` env passthrough day 1 so we can drop in an Aptos Build key if throttled.
2. **Abort decoding shallower than EVM on non-conforming modules** → category-level is guaranteed; the curated failed-tx test set (week 2) validates depth on the protocols we'll demo; prompt instructs honest framing when only a raw code is known ("aborted in thala::stable_pool with code 12 — commonly means X; check …").
3. **FA vs CoinStore duality** → use Indexer `current_fungible_asset_balances` which unifies both; verified in week 1 against wallets holding legacy coins.
4. **Third chain family increases branching debt** → accepted consciously; keep every branch behind `isAptosChain()` in the same files that branch for Solana (no new dispatch sites), and note a future chain-adapter refactor in the roadmap.
5. **Petra not installed during the live call** → manual address-paste path is first-class; rehearse with both.

## 10. Acceptance criteria (demo-ready)

- Connect Petra (or paste any Aptos address) on a demo widget → correct APT + token balances, recent txs with readable function names.
- Paste any Aptos tx hash → correct success/failure story; for the curated failed set, plain-English causes.
- Ask protocol questions on Thala/Aries/Amnis demos → answers from their indexed docs.
- All existing EVM/Solana behaviour unchanged (regression: typecheck sweep + existing flows spot-checked).
