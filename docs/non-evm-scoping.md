# Non-EVM Support — Scoping (Stellar & TON)

_Status: scoping only, nothing built. Written 2026-07-11; revised same day to add Aptos._

The pitch deck now says "EVM today, non-EVM on the roadmap." This document scopes
what it actually takes to diagnose transactions on **Stellar** and **TON**, so we
can speak credibly in ecosystem conversations and size the build before committing.

---

## TL;DR

- **We already have a non-EVM template.** Solana is fully integrated (currently
  paused in the UI, code intact) as its own `packages/solana` package with an
  `isSolanaChain()` guard threaded through ~6 branch points in the AI tool layer.
  Stellar, TON and Aptos follow the exact same shape: a new package + a chain
  guard + the same wiring points. **The architecture does not need re-plumbing.**
- **The hard part is not wiring — it's the diagnosis semantics.** EVM, Stellar,
  TON and Aptos (Move) have four genuinely different transaction models. "Why did
  it fail" means something different on each, so the failure-decoding logic is
  net-new per chain (it can't be shared the way the plumbing can).
- **Rough effort:** ~1–1.5 weeks per chain for a solid v1 (wallet balance, recent
  activity, transaction diagnosis, explorer links, widget wallet-connect), on top
  of ~2 days of shared groundwork to generalise a couple of EVM-only assumptions.
- **Recommendation:** order by difficulty — **Stellar → Aptos → TON**. Stellar and
  Aptos both have documented, closed failure-code sets and injected-style wallets;
  TON is hardest (async message model + QR-based TON Connect). Promise "diagnosis +
  wallet context" in conversations; do **not** promise EVM-depth contract
  introspection on day one — Stellar classic has no EVM-style contracts, Aptos/TON
  custom codes need module source to name precisely, and TON's async model makes
  tracing multi-message flows materially harder.

---

## 1. What's already reusable (the Solana precedent)

Solana proved the abstraction. To add a non-EVM chain today you:

1. **Create a chain package** — `packages/solana` exposes exactly four primitives
   plus a guard and typed shapes:
   - `getSolanaWalletBalance(address)`
   - `getSolanaRecentTransactions(address, …)`
   - `getSolanaTransactionBySignature(sig)`
   - `fetchIdlFromRegistry(programId)` — the ABI/IDL equivalent
   - `isSolanaChain(chainId)` + `Solana*` types
2. **Wire the guard** into `packages/ai/src/tools.ts` at the branch points
   (currently ~6: wallet balance, recent txs, tx lookup, chain-candidate
   resolution, token safety, action estimate). Each does
   `if (isSolanaChain(...)) return solanaImpl() else evmImpl()`.
3. **Chain identity** — EVM chains are hex (`"0x1"`, `"0x2105"`); Solana is the
   literal `"solana"`. New chains get their own literal id (`"stellar"`, `"ton"`).
4. **Config + UI** — add to `SUPPORTED_CHAINS`/`SELECTABLE_CHAINS` in
   `apps/app/lib/types/config.ts`, add `CHAIN_NAMES` in `packages/ai/src/prompt.ts`,
   add a chain logo, and add a wallet-connect path in the widget.

**This is the good news:** the seams exist and are proven. Nothing about adding a
chain requires touching the core request/stream/persistence flow.

### The seams to touch (concrete checklist per chain)
- [ ] `packages/<chain>/` — new package: balance, recent txs, tx-by-id, explorer
      helpers, `is<Chain>Chain()` guard, types.
- [ ] `packages/ai/src/tools.ts` — add branch at each `isSolanaChain` site.
- [ ] `packages/ai/src/prompt.ts` — `CHAIN_NAMES` entry + chain-specific guidance.
- [ ] `apps/app/lib/types/config.ts` — `SUPPORTED_CHAINS` / `SELECTABLE_CHAINS`.
- [ ] `apps/app/app/widget/WidgetApp.tsx` — wallet-connect branch (see §2/§3).
- [ ] `apps/web/public/chains/<Chain>.svg` — logo.
- [ ] `packages/blockchain/src/diagnose.ts` + `/api/v1/diagnose` — dispatch to the
      chain's diagnosis when the id isn't EVM (the REST API is currently EVM-only).

---

## 2. Stellar

**Transaction model.** A Stellar transaction is a bundle of up to ~100 *operations*
(payment, path-payment, change-trust, manage-offer, etc.). "Smart contracts" are
**Soroban**, a separate newer layer; Stellar "classic" has no EVM-style contract
reverts. Most support questions will be classic-payment failures, not contract reverts.

**Why-it-failed is unusually clean.** Horizon returns failures as HTTP 400 with an
`extras.result_codes` object: a transaction-level code plus a per-operation array.
This is a *closed, documented set* — far friendlier than EVM's arbitrary custom
errors. Examples we'd map to plain-English fixes:
- `tx_bad_seq` → wrong sequence number (may become valid later; resubmit with the
  right seq).
- `tx_insufficient_fee` → fee below network minimum; raise it.
- `tx_insufficient_balance` → can't cover amount + min-balance reserve.
- op codes like `op_underfunded`, `op_no_trust` (recipient hasn't added a trustline
  for the asset), `op_no_destination`, `op_line_full`.

The `op_no_trust` / trustline class is a huge share of real Stellar support pain and
maps to a crisp fix — a strong early win.

**Data surfaces (all keyless / generous free tiers):**
- **Horizon API** (`horizon.stellar.org`) — accounts, balances, transactions,
  operations, and the `result_codes` on failures.
- **Stellar Expert** — explorer links; also has a directory/tags API useful for
  address labelling.
- **Soroban RPC** — only if/when we diagnose Soroban contract calls (phase 2).

**Wallet-connect (widget):** **Freighter** (`@stellar/freighter-api`) is the de-facto
injected wallet. This is net-new per-chain UI work, parallel to how the widget does
MetaMask (EVM) / Phantom (Solana).

**Compliance angle:** Stellar has first-class asset issuers and trustlines; sanctions/
issuer-reputation screening is a natural extension of our existing compliance story.

**v1 scope:** balances + recent activity + classic-transaction diagnosis via
`result_codes` + Freighter connect + explorer links. **Defer:** Soroban contract
introspection.

---

## 3. TON

**Transaction model — the genuinely hard one.** TON is **asynchronous and
message-based**: a single user action fans out into a *tree* of messages hopping
between contracts, each with its own compute + action phase. There is no single
"the transaction reverted" like EVM; you often have to follow the message chain to
find where it actually broke.

**Why-it-failed = TVM exit codes.** Each compute phase yields a 32-bit exit code
(0 and 1 = success). Non-zero = an exception. Standard codes are documented and
mappable:
- `2/3` stack issues, `4` integer overflow, `13` out of gas,
- `32/33/34` action-phase (invalid/too-many/failed actions),
- `35–40` message/address/fee problems,
- `65535 (0xffff)` / `130` — "unknown opcode": the contract had no receiver for the
  message (a very common real-world failure).

Contracts also define **custom exit codes** (Tact/FunC), analogous to EVM custom
errors — so, like EVM, we won't always have a human name without the contract's
source/ABI.

**Data surfaces:**
- **TON Center API** v2/v3 (v3 preferred) — transactions, traces, account state.
- **TON API** (tonapi.io) — higher-level, gives decoded/traced events which help
  reconstruct the message tree (this decoding is exactly the part that's hard to do
  ourselves).
- **Tonviewer / Tonscan** — explorer links.

**Wallet-connect (widget):** **TON Connect** (`@tonconnect/ui`) — a QR/deep-link
protocol, not an injected `window.ethereum`. This is a meaningfully different
connect UX than EVM/Solana and is the biggest single piece of net-new widget work.

**v1 scope:** balances + recent activity + single-transaction exit-code diagnosis +
TON Connect + explorer links. **Defer:** full multi-message trace reconstruction
("follow the whole flow") — lean on TON API's decoded traces before building our own.

---

## 3b. Aptos

**Transaction model.** Aptos runs the **Move VM**. Transactions are synchronous
and atomic (closer to EVM's mental model than TON's async messages), which makes
Aptos the *easiest* of the three to diagnose after Stellar. Smart-contract logic
lives in Move modules; failures surface as **Move aborts** or VM status codes.

**Why-it-failed = VM status + Move abort codes.** When a transaction fails the
Fullnode REST API returns `success: false` and a `vm_status` describing why. Two
big buckets:
- **Move aborts** — the module that aborted (its address + name) plus a numeric
  **abort code** the contract chose. Like EVM custom errors / TON custom exit
  codes, naming it precisely needs the module's source, but the module+code pair
  is always available and many are conventional.
- **Execution/validation statuses** — `OUT_OF_GAS` (raise max gas and resubmit),
  `SEQUENCE_NUMBER_TOO_OLD` / `_TOO_NEW` (sequence reuse or gap — resubmit with
  the right one), `INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE`, and the standard
  Move categories (resource already/doesn't exist, arithmetic error).

This is a **documented, closed set** at the framework level — friendly to map to
plain-English fixes, on par with Stellar.

**Data surfaces (keyless / generous):**
- **Fullnode REST API** — accounts, resources, transactions, `vm_status`, and
  **transaction simulation** (a genuine advantage: we can dry-run and explain a
  failure *before* the user even submits).
- **Indexer GraphQL API** — richer queries (coin/token activity, history) for
  wallet context.
- **Aptos Explorer** — explorer links.

**Wallet-connect (widget):** the **Aptos Wallet Adapter** (Petra, Pontem, etc.) —
a standard adapter interface, closer to EVM's injected model than TON Connect, so
lower widget risk than TON.

**v1 scope:** balances + coin/token activity + Move-abort / VM-status diagnosis +
Wallet Adapter connect + explorer links. Simulation-based "this *will* fail
because…" is a strong differentiator to add early. **Defer:** naming arbitrary
custom abort codes without the module source (same limitation as EVM/TON).

**Effort:** ~1 week — between Stellar (easiest) and TON (hardest). Synchronous
atomic model + simulation API keep it tractable.

---

## 4. Effort & phasing

| Phase | Work | Est. |
|------|------|------|
| 0 | Shared groundwork: generalise the two EVM-only assumptions — the REST `diagnoseTransaction` dispatch and any place that assumes hex chain ids — plus a `ChainFamily` notion so guards compose. | ~2 days |
| 1 | **Stellar v1**: `packages/stellar`, Horizon client, `result_codes` → fix mapping, Freighter connect, config/prompt/logo, REST dispatch. | ~1 week |
| 2 | **Aptos v1**: `packages/aptos`, Fullnode REST + Indexer client, VM-status / Move-abort → fix mapping, Wallet Adapter connect, config/prompt/logo, REST dispatch. Simulation-based pre-flight as a fast-follow. | ~1 week |
| 3 | **TON v1**: `packages/ton`, TON Center/TON API client, exit-code → fix mapping, TON Connect, config/prompt/logo, REST dispatch. | ~1.5 weeks |
| 4 | Depth (later): Soroban (Stellar) + multi-message trace (TON) + arbitrary Move-abort naming (Aptos) contract-level introspection. | open-ended |

_These assume one engineer and reuse of the Solana pattern. The estimates are for a
credible v1 a protocol could actually use, not a demo._

---

## 5. Risks & open questions

- **Contract-level depth is the ceiling, not the floor.** We can diagnose
  transactions and wallet context well on both chains quickly. EVM-parity contract
  introspection (read state, decode every event, upgrade history) is a much bigger
  lift and, on TON's async model, partly a research problem. Set expectations
  accordingly in ecosystem conversations.
- **Custom exit/result codes** on both chains still need the protocol's source/ABI
  to name precisely — same limitation we have with EVM custom errors, so the
  "add your contract" onboarding flow generalises.
- **API rate limits / keys** — Horizon and TON Center have free tiers; confirm
  limits before launch (we already track provider limits for EVM/Solana RPC).
- **Wallet-connect UX divergence** — TON Connect (QR/deep-link) is the most
  different piece from today's injected-wallet flow and deserves its own design pass.
- **Moralis dependency** — the current EVM diagnosis leans on Moralis; the non-EVM
  chains use their own native APIs, so this is naturally decoupled.

## 6. Recommendation

Lead ecosystem conversations with **"transaction diagnosis + wallet context + plain-
English fixes,"** which we can deliver on Stellar and TON on the same timeline shown
above. Position deep contract introspection as a fast-follow. Ship in
difficulty order — **Stellar → Aptos → TON**: Stellar (cleanest failure model,
trustline/compliance wins) and Aptos (documented VM statuses, injected wallet,
plus a simulation API for pre-flight "this will fail because…") are both low-risk;
TON last, where the async model and TON Connect add the most work.

---

### Sources
- Stellar result codes: <https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors/result-codes>
- Stellar transaction failed: <https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors/http-status-codes/horizon-specific/transaction-failed>
- TON exit codes: <https://docs.ton.org/v3/documentation/tvm/exit-codes>
- TON transaction exploration / APIs: <https://docs.ton.org/v3/guidelines/dapps/transactions/explore-transactions>
- Aptos error codes: <https://aptos.dev/reference/error-codes/>
- Aptos transactions & states (vm_status): <https://aptos.dev/network/blockchain/txns-states>
- Aptos Fullnode REST API: <https://aptos.dev/build/apis/fullnode-rest-api>
