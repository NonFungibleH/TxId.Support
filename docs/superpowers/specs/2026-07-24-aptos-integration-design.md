# Aptos Chain Integration — Design Spec

**Date:** 2026-07-24 (rev 2 — post spec-review)
**Status:** Draft (pending review round 2)
**Goal:** Chain-wide, read + diagnose Aptos support — the widget works on *any* Aptos protocol the way it works on any EVM chain — demo-ready for the Aptos partnership call in 3–4 weeks.
**Explicitly out of scope:** Actions/execute on Aptos, Telegram changes (no wallet tools there anyway), token-mode. Sanctions screening on Aptos: the `check_address_sanctions` tool **stays present** (Solana precedent — tool lists are not chain-conditional) but its executor returns an honest execution-time note on Aptos ("screening uses an EVM oracle; not available for Aptos addresses") — no new tool-construction dispatch surface.

---

## 1. Why this shape

Aptos is a Move-VM L1 — a different chain *family*, like Solana, not another EVM chain. None of our EVM providers cover it (Moralis: no; Etherscan: no). But Aptos has uniform, keyless public infra that makes a **generic** integration feasible (all verified live during review):

- **Fullnode REST API** (`https://fullnode.mainnet.aptoslabs.com/v1`) — accounts, resources, **on-chain module ABIs** (`/accounts/{addr}/module/{name}` returns `{bytecode, abi}` with `is_entry`/`is_view` flags, anonymously — no verification dependency, better than EVM), transactions by hash/version, `/view` calls, ledger info, simulation.
- **Indexer GraphQL** (`https://api.mainnet.aptoslabs.com/v1/graphql`) — `current_fungible_asset_balances` (unifies legacy CoinStore + new FA standard), `account_transactions` — both answer keyless.
- **Move abort convention** — modules using the canonical `std::error` constructors encode a semantic category (invalid_argument, not_found, permission_denied…) in the upper bits of the abort code, so a generic decoder yields useful plain English **for conforming modules**; many third-party modules abort with raw small constants where only module+code is known (see §3 decoder, honest-framing rule).

Precedent: `packages/solana` (`@txid/solana`). Aptos follows the same isolation pattern: one new package, branching at the existing chain dispatch points.

## 2. Chain identity

- Chain id string: **`"aptos"`** (like `"solana"`; not hex). It passes through `normalizeChainId` in analytics unchanged (verified).
- Address format: `0x` + 1–64 hex chars. **Disambiguation policy (addresses):** every EVM address is a syntactically valid Aptos address, so format alone can't decide in mixed-chain projects. Rule: hex length > 40 → Aptos; exactly 40 → EVM **unless the project's chains are Aptos-only**, in which case Aptos. Applies to widget manual-paste (`WidgetApp.tsx:611-619` and the chain-assignment line **:615**, which currently does `chains.find(c => c !== "solana") ?? "0x1"` — must also skip `"aptos"` when picking an EVM default, and pick `"aptos"` for >40-hex input) and chat-route wallet validation (route.ts:153 gains `APTOS_ADDR = /^0x[0-9a-fA-F]{1,64}$/`, accepted only when the project supports Aptos).
- Explorer: `explorer.aptoslabs.com` (txn/{hash_or_version}, account/{addr}).
- Registry additions: `SUPPORTED_CHAINS` gets `{ id: "aptos", name: "Aptos", explorer: "explorer.aptoslabs.com" }` (config.ts:41); NOT in `PAUSED_CHAINS`. Name/logo maps: `packages/ai/src/prompt.ts` CHAIN_NAMES, `ConversationList.tsx`, **`apps/app/app/dashboard/analytics/page.tsx:23-49` CHAIN_NAMES + CHAIN_LOGOS** (also backfill the existing `"solana"` gap there), `apps/web/lib/chains.ts` (see §9 — entry exists as "coming-soon"; flip to live).

## 3. New package: `packages/aptos` (`@txid/aptos`)

Mirrors `@txid/solana` layout. No API key required; `APTOS_API_KEY` env passthrough (Aptos Build) supported from day 1 for rate-limit headroom.

```
packages/aptos/src/
├── index.ts        // exports + isAptosChain(id) ("aptos")
├── types.ts        // AptosBalance, AptosTransaction, AptosModuleAbi, DecodedAbort
├── fullnode.ts     // REST: resources, module ABIs, tx by hash/version, /view, ledger info, simulate
├── indexer.ts      // GraphQL: FA balances, account tx history
├── abort.ts        // Move abort decoder
└── names.ts        // ANS .apt resolution (nice-to-have, week 3)
```

### Key functions

- `getAptosWalletBalance(address)` — APT + top fungible assets via Indexer `current_fungible_asset_balances` (covers CoinStore-migrated and FA-native in one query). Cap ~30 tokens, skip zero balances.
- `getAptosRecentTransactions(address, moduleAddress?, limit)` — Indexer `account_transactions` → hydrate via fullnode by version. Map to a `Transaction`-compatible shape: hash, version, success, timestamp, function id (`0xaddr::module::function`), gas used, vm_status, events summary. Optional module filter for watched modules.
- `getAptosTransactionByHash(hashOrVersion)` — fullnode `/transactions/by_hash/{h}` (fallback `/by_version/{v}` when numeric). On `success: false`, attach `decodedAbort`.
- `getAptosModuleAbi(accountAddress, moduleName?)` — `/accounts/{addr}/modules` or `/module/{name}` → exposed functions (entry/view, params, generics) + structs.
- `viewFunction(fn, typeArgs, args)` — fullnode `/view` (powers get_contract_state/data equivalents).
- `getAptosNetworkStatus()` — fullnode ledger info (`/`) → chain up, latest version/timestamp (real implementation, not a degrade — see §4 table).
- `diagnoseAptosWallet(address)` — account existence + sequence number + APT balance + recent failed txs (real implementation).
- `decodeAbort(vmStatus, moduleAbi?)` in abort.ts:
  1. Parse `Move abort in 0xADDR::module: 0xCODE` (also `EXECUTION_FAILURE`, `OUT_OF_GAS`, location-less aborts, `SEQUENCE_NUMBER_TOO_OLD` and friends).
  2. If the code follows canonical `std::error` layout (upper bits non-zero), map category → plain English ("invalid argument", "not found", "permission denied"…). **Where the module used a raw constant (category bits zero), we know only module + code — the decoder says so honestly.**
  3. Framework table: known `0x1`/`0x3`/`0x4` module+code pairs (insufficient balance, coin not registered, account does not exist…) hardcoded.
  4. Best-effort constant names: fetch published package source from `0x1::code::PackageRegistry` when non-empty and grep error constants (`const E… : u64 = code`); this is the only on-chain source of names (module ABI carries **no** constants — verified). Ship a small offline errmap for the top demo protocols as fallback.
  5. Return `{ cause, category?, module, code, reason, raw }` — same spirit as EVM `DecodedRevert`; prompt gets a matching interpretation guide with an explicit honest-framing rule when only module+code is known.

### Capability parity table

| EVM capability | Aptos equivalent | Depth |
|---|---|---|
| Balance + tokens | Indexer FA balances | full |
| Recent txs | Indexer account_transactions | full |
| Tx by hash + revert decode | Fullnode by_hash + abort decoder | full lookup; decode = category-level for canonical-`std::error` modules, module+code honest framing otherwise, deepest via framework table + errmap |
| Contract ABI (Etherscan) | On-chain module ABI | **better** (always available) |
| get_contract_state/data | `/view` calls | full |
| get_network_status | Fullnode ledger info | full (real impl) |
| diagnose_wallet | Account existence + sequence + balance + recent fails | full (real impl) |
| Approvals list | no user-approval concept for coins/FA | `[]` + prompt explains |
| Sanctions oracle | none (EVM-only oracle) | tool present; execution-time honest note |
| estimate_action / simulate | fullnode simulate — needs sender **public key**, which only a connected Petra session provides (not recoverable from a pasted address) | stretch, **connected-wallet-only** |

## 4. AI layer (`packages/ai`)

**Blanket rule: every `isSolanaChain` call site in `tools.ts` gains an `isAptosChain` branch** — introduce a shared `isNonEvmChain(id)` helper where the two behave identically. Audited sites (all must be addressed, none may fall through to EVM): wallet tools (get_wallet_balance :196, get_recent_transactions :212, get_wallet_approvals :225), tx lookup (:238-316, see hash routing below), contract toolset (:341+), `get_token_info` :535, `get_token_allowance` :546, `get_native_price` :561 (CoinGecko has APT — real impl), `get_network_status` :566 (real impl via ledger info), `diagnose_wallet` :573 (real impl), switch-chain guard :588 (no EIP-3326 on Aptos — suppress), `check_token_safety` :610 (honest note: GoPlus-style source is EVM-only; offer FA metadata basics), `estimate_action` :637 (absent-note or simulate when connected), sanctions executor :646 (honest note). Per-tool disposition is listed in the parity table.

**Tx-hash routing (MAJOR fix):** Aptos tx hashes are `0x`+64 hex — **format-identical to EVM hashes**, so the Solana-style format disambiguation (`looksEvm` at tools.ts:238) cannot route them. Design: (a) exclude `"aptos"` from the EVM candidate collector (`pushEvm` :252-253); (b) when the session/project involves Aptos (wallet chainId `"aptos"` or a watched contract on `"aptos"`), query the Aptos fullnode **in parallel** with the EVM candidate fan-out and use whichever chain actually has the tx (the fan-out already tolerates per-chain misses); (c) an all-numeric input (a version) routes straight to Aptos.

**Prompt** (`prompt.ts`): Aptos guidance block (Solana precedent): version vs hash, Petra/Martian, Move-abort interpretation guide mirroring `decodedRevert` (category framing; honest module+code framing; OUT_OF_GAS → max gas units not APT balance; SEQUENCE_NUMBER_TOO_OLD → resubmit guidance), explorer.aptoslabs.com links, "modules not contracts" vocabulary. TOOL_LABELS in WidgetApp: no changes (keys are tool names — verified).

## 5. Widget (`apps/app/app/widget/WidgetApp.tsx`)

- Detect Aptos project: `config.chains.includes("aptos")`.
- Wallet connect: `window.aptos` (Petra) → `connect()` → `{ address }`; fallback `window.martian`. chainId `"aptos"`. Button label "Connect Petra".
- **Manual paste is first-class** (works with no extension): accepts Aptos addresses per the §2 disambiguation policy, including the :615 chain-assignment fix.
- ActionCard: never renders for Aptos (extend the existing `chainId !== "solana"` exclusion to a shared non-EVM check — chat route actionsCtx gate route.ts:459 and any ActionCard render guard).

## 6. Dashboard (`apps/app`)

- Contracts page: adding an Aptos "contract" = account address **+ optional module name**. Type change: `WatchedContract` (`apps/app/lib/types/config.ts`) and `WatchedContractSnapshot` (`packages/ai/src/types.ts`) gain optional `moduleName?: string`, threaded through the snapshot path into tools (mind `exactOptionalPropertyTypes` — conditional spreads). `AddContractDialog` + `contracts.ts` zod branch address regex by chain; auto-peek lists module entry/view functions from on-chain ABI (replaces Etherscan peek). `AbiManager` relabels: "Move module ABI — fetched on-chain" (auto-fetch; keep paste as override). `refreshContractAbi` branches to `getAptosModuleAbi` (Solana/IDL precedent).
- Demo creator: `addDemoContract` regex branch (demos.ts:146) + chain select includes Aptos; module-ABI auto-fetch; the Actions "Executable contract functions" section hides Aptos contracts (execute is EVM-only).
- Docs/RAG: zero changes (chain-agnostic).

## 7. EVM-regex audit (complete; each site → Aptos branch or explicit EVM-only)

**Branch for Aptos:** `apps/app/lib/actions/contracts.ts:18` (zod), `apps/app/lib/actions/demos.ts:146` (demo contract add), `apps/app/components/settings/AddContractDialog.tsx:45,161`, `apps/app/app/api/chat/route.ts:153` (wallet addr), `WidgetApp.tsx:611` + chain assignment `:615`.
**EVM-only, unchanged (annotate in code):** `route.ts:254` (inspect mode — /check stays EVM), `demos.ts:250` (Actions approval token), `DemosManager.tsx:454` (Actions approval-token input; note: this is NOT the demo contract-add — that validation is server-side at demos.ts:146), `apps/app/components/settings/ActionsForm.tsx:174` (approval token), `apps/web/app/check/page.tsx:358` (public demo is EVM), `packages/blockchain/src/sanctions.ts:47`, `packages/blockchain/src/events.ts:249`, `packages/ai/src/actions.ts:83` (Actions pipeline is EVM-only).

## 8. Delivery plan (3–4 weeks)

- **Week 1 — package + reads.** `@txid/aptos`: balances, tx history, tx-by-hash, module ABI, `/view`, ledger info, wallet diagnosis. Verified against live fullnode/indexer with real txs from top protocols (Thala, Aries, Amnis, PancakeSwap-Aptos), including wallets holding legacy CoinStore coins. Chain registry + name/logo maps (incl. analytics page + solana backfill).
- **Week 2 — diagnosis + AI.** abort.ts decoder (framework table + PackageRegistry constant harvesting + offline errmap for demo protocols); the full tools.ts branch sweep (every site in §4's audit); tx-hash parallel routing; prompt guidance. Curate ~20 real failed txs across protocols; tune until explanations read well and honest-framing cases read honestly.
- **Week 3 — surfaces.** Petra connect + manual paste (+ :615 fix) in widget; dashboard contract flow (module ABI auto-fetch, `moduleName` type threading); demo creator support; build the Aptos demos (crawl Thala/Aries/Amnis docs); marketing/docs sweep (§9); ANS + connected-wallet simulate as stretch.
- **Week 4 — hardening + rehearsal.** Full QA (typecheck sweep, adversarial review agent, live walkthrough on real wallets with and without Petra), fix list, dry-run the exact call script.

Each week ends with a shippable commit; weeks 1–2 are pure backend.

## 9. Marketing + docs surfaces (CLAUDE.md rule: chain changes touch BOTH docs systems + FAQ)

- `apps/web/lib/chains.ts` — Aptos entry **already exists with `status: "coming-soon"`** (:248-260): flip to `"live"`, rewrite tagline/intro (remove "on the roadmap" copy).
- `apps/web/app/chains/page.tsx:13` — meta description says "…Aptos on the way": update.
- Help-center `chains` doc (`apps/web/lib/docs.ts`) + `apps/docs` site chain references + `apps/web/components/sections/FAQ.tsx` chain list.
- These ship in week 3 *behind the reality* — copy flips only when the integration actually works (a partner opening the chains page mid-call must not find stale "coming soon" OR premature "live").

## 10. Risks & mitigations

1. **Rate limits on keyless endpoints** → fine for demo volume; `APTOS_API_KEY` passthrough from day 1.
2. **Abort decoding depth varies** → category-level for canonical-`std::error` modules; module+code honest framing otherwise; framework table + per-protocol errmap guarantee depth on the protocols we demo; the week-2 curated failed-tx set validates it.
3. **FA vs CoinStore duality** → Indexer `current_fungible_asset_balances` unifies both; verified week 1 against legacy-coin wallets.
4. **Third chain family increases branching debt** → accepted; every branch goes through `isAptosChain`/`isNonEvmChain` at the *existing* Solana dispatch sites (the sanctions/token tools follow the Solana "present tool, execution-time note" precedent precisely so no new dispatch surface is created); chain-adapter refactor noted on the roadmap.
5. **Petra not installed during the live call** → manual paste is first-class; rehearse both paths.
6. **Tx-hash ambiguity** (EVM-identical format) → parallel-query routing (§4); acceptance test includes pasting an Aptos hash into an EVM+Aptos mixed demo.

## 11. Acceptance criteria (demo-ready)

- Connect Petra (or paste any Aptos address, incl. into a mixed-chain demo) → correct APT + token balances, recent txs with readable function names.
- Paste any Aptos tx hash → correct success/failure story; for the curated failed set, plain-English causes; for raw-constant aborts, honest module+code framing.
- "Is Aptos having issues?" → real ledger-info answer (not the EVM "RPC did not respond" fallback). "Why can't I transact?" → real Aptos wallet diagnosis.
- Ask protocol questions on Thala/Aries/Amnis demos → answers from their indexed docs.
- Marketing chains page shows Aptos live (no "coming soon") — flipped only in week 3 when true.
- All existing EVM/Solana behaviour unchanged (typecheck sweep + spot-check of EVM flows).
