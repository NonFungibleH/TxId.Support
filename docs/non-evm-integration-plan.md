# Non-EVM Integration Plan — Stellar, Aptos, TON

_Executable plan. Companion to `non-evm-scoping.md` (the why/what). This is the
how: file-by-file, in the order to build. Ship order: **Stellar → Aptos → TON**._

The `@txid/solana` package is the working reference for every step below — when
in doubt, copy how Solana does it.

---

## Phase 0 — Shared groundwork (~2 days, do once)

Two EVM-only assumptions must be generalised before the first non-EVM chain, so
each chain slots in cleanly instead of bolting on more `if` branches.

### 0.1 A `ChainFamily` helper
- **New:** `packages/blockchain/src/family.ts` (or extend an existing shared
  module) exporting:
  ```ts
  export type ChainFamily = "evm" | "solana" | "stellar" | "ton" | "aptos"
  export function chainFamily(chainId: string): ChainFamily
  // "0x…"→evm, "solana"→solana, "stellar"→stellar, "ton"→ton, "aptos"→aptos
  ```
- Replace scattered `isSolanaChain(x)` checks and `x.startsWith("0x")` assumptions
  with `chainFamily(x)` switches. Keep `isSolanaChain` as a thin alias so nothing
  breaks mid-migration.
- **Touch:** `packages/ai/src/tools.ts` (the ~6 branch sites), any hex-id
  assumption in `packages/blockchain/src/diagnose.ts`.

### 0.2 Diagnosis dispatch
- **Edit:** `packages/blockchain/src/diagnose.ts` — `diagnoseTransaction()` is
  currently EVM-only. Add a family switch at the top that routes to the chain's
  own `diagnose<Chain>Transaction()` (added per chain below). EVM path unchanged.
- **Edit:** `apps/app/app/api/v1/diagnose/route.ts` — accept the non-hex `chain`
  values (`"stellar"`, `"aptos"`, `"ton"`) and a chain-appropriate id format
  (Stellar/Aptos hashes and TON hashes are not `0x…64`; relax `TX_RE` to a
  per-family validator).

### 0.3 Config + selectable chains
- **Edit:** `apps/app/lib/types/config.ts` — the chain literals already exist in
  `SUPPORTED_CHAINS`; make sure `SELECTABLE_CHAINS` gates each new chain behind a
  flag so we can ship the package before exposing it in the dashboard.

**Definition of done:** EVM + Solana behave exactly as before; `chainFamily()` is
the single source of truth; the REST endpoint no longer hard-codes hex.

---

## Per-chain template (repeat for Stellar, then Aptos, then TON)

Each chain is the same eight steps. Estimates in `non-evm-scoping.md` (§4).

### 1. The package — `packages/<chain>/`
Mirror `packages/solana` exactly. `package.json` (name `@txid/<chain>`), `tsconfig`,
`src/index.ts`, `src/types.ts`, `src/<client>.ts`. Expose the four primitives +
guard + a diagnosis function:
```ts
get<Chain>WalletBalance(address): Promise<...>
get<Chain>RecentTransactions(address, …): Promise<...>
get<Chain>TransactionById(idOrHash): Promise<...>       // signature/hash lookup
diagnose<Chain>Transaction(idOrHash): Promise<TxDiagnosis>  // → shared shape
is<Chain>Chain(chainId): boolean
```
Return the **same `TxDiagnosis` shape** the EVM engine returns (status, cause,
error, explanation, fix, …) so the REST API and prompt are chain-agnostic.

Per-chain specifics (from scoping doc):
- **Stellar** — Horizon (`horizon.stellar.org`); map `extras.result_codes`
  (tx + op level) → explanation/fix. Keyless.
- **Aptos** — Fullnode REST (`vm_status` + Move abort module/code) + Indexer
  GraphQL for activity; add a `simulate<Chain>` helper for pre-flight. Keyless.
- **TON** — TON Center v3 + TON API (tonapi.io) for decoded traces; map TVM
  compute/action exit codes → explanation/fix. Free tier.

### 2. AI tool wiring — `packages/ai/src/tools.ts`
Add a `chainFamily` branch at each of the six sites (wallet balance, recent txs,
tx lookup, chain-candidate resolution, token safety guard, action estimate) that
routes to the new package. Follow the existing Solana branches line-for-line.

### 3. Prompt — `packages/ai/src/prompt.ts`
Add a `CHAIN_NAMES` entry and a short chain-specific guidance block (how to read
that chain's failure output — mirrors the Solana block).

### 4. REST diagnosis — already wired via Phase 0.2's dispatch; just register the
new `diagnose<Chain>Transaction` in the family switch.

### 5. Widget wallet-connect — `apps/app/app/widget/WidgetApp.tsx`
Add a connect branch (mirrors `connectWallet`'s Phantom/EVM branches):
- **Stellar** — Freighter (`@stellar/freighter-api`), injected.
- **Aptos** — Aptos Wallet Adapter (Petra et al.), injected-style.
- **TON** — TON Connect (`@tonconnect/ui`), QR/deep-link — **needs its own UX
  pass**, not a drop-in.
Set `chainId` to the chain literal on connect; reuse the session persistence.

### 6. Config surface — flip the chain on in `SELECTABLE_CHAINS`; the dashboard
contract/chain selectors and `AbiManager` relabelling (as done for Solana IDL)
pick it up. Add any ABI/interface-source equivalent (Stellar has none classic;
Aptos Move modules; TON contract sources).

### 7. Marketing — flip `status: "coming-soon"` → `"live"` in
`apps/web/lib/chains.ts` and drop the official logo in `apps/web/public/chains/`.

### 8. Tests + live-verify — a `diagnose<Chain>Transaction` check against a known
failed tx on that chain (as we did for the EVM `diagnoseTransaction`), plus a
widget connect smoke test.

**Definition of done per chain:** a real failed tx on that chain returns a correct
structured diagnosis via both the bot and `POST /api/v1/diagnose`; the widget can
connect that chain's wallet; the `/chains/<slug>` page is flipped to live.

---

## Sequencing & dependencies

1. **Phase 0** (blocks everything).
2. **Stellar** — no new wallet-protocol risk (Freighter injected), cleanest codes.
3. **Aptos** — injected wallet, documented VM statuses, simulation bonus.
4. **TON** — last; budget extra time for TON Connect UX and async-trace reading.

**External prep to line up now (so integration isn't blocked):**
- Confirm free-tier limits: Horizon (keyless), Aptos Fullnode/Indexer (keyless),
  TON Center / TON API (key + free tier) — add `TON_API_KEY` to env plan.
- Official logos for `public/chains/`: `Stellar.*`, `Aptos.*`, `TON.*` (Solana
  already present). Marketing pages already fall back to a monogram until then.
- Wallet SDKs to add when each chain starts: `@stellar/freighter-api`,
  `@aptos-labs/wallet-adapter-react` (or the core adapter), `@tonconnect/ui`.

**Not in scope for v1 (deferred, see scoping §5):** Soroban (Stellar), multi-message
trace reconstruction (TON), arbitrary Move-abort naming without module source
(Aptos). Lead sales with "diagnosis + wallet context," not EVM-depth introspection.
