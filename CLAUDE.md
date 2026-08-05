# TxID — CLAUDE.md

> **Naming:** the product is **TxID**, not "TxID Support". Renamed across the whole
> codebase (108 replacements, 57 files). The domain stays txid.support and the
> contact stays team@txid.support. /terms and /privacy name TxID as the Service.

## What this project is

TxID is a B2B embeddable **AI support agent** for DeFi protocols. Protocol teams install a JS snippet on their site; their users get an assistant that knows the protocol's docs, smart contracts, and live on-chain state for a connected wallet, and that records the conditions behind every answer.

> **Naming, user-facing:** never call the product an "AI chatbot" or "support widget". It is an **AI support agent**, or "the assistant". The buyer is an institution, and "chatbot" describes the thing we beat. "Chatbot" stays ONLY in blog copy where it names a competitor.

**Products:**
- `apps/web` — public marketing site (txid.support)
- `apps/app` — B2B dashboard where protocol teams configure their project (app.txid.support)
- `apps/docs` — documentation site, NOT DEPLOYED (see Docs section)
- `packages/react` — published npm package (`@txid/react`) for React embed
- `packages/widget` — embeddable vanilla JS widget (package still a stub, BUT a working script-tag loader ships at `apps/app/public/widget.js`, served as `https://app.txid.support/widget.js` — that's the embed path the docs reference)

---

## Monorepo layout

```
txid-support/
├── apps/
│   ├── web/          Next.js 14, port 3000 — marketing site
│   ├── app/          Next.js 14, port 3001 — B2B dashboard
│   └── docs/         Next.js 14, port 3002 — docs site
├── packages/
│   ├── ai/           @txid/ai — Claude RAG pipeline, prompt building, streaming
│   ├── blockchain/   @txid/blockchain — Moralis, block explorers, tx decoder
│   ├── solana/       @txid/solana — Helius RPC, enhanced txs, IDL registry
│   ├── ui/           @txid/ui — shared shadcn/Radix components
│   ├── widget/       @txid/widget — embeddable JS (Phase 3 stub)
│   └── react/        @txid/react — published React component
├── supabase/
│   ├── migrations/   SQL migration files (apply in filename order)
│   └── config.toml
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Auth | Clerk v5 |
| Database | Supabase (Postgres + pgvector) |
| Styling | Tailwind CSS v3 + shadcn/ui |
| AI | Anthropic Claude (claude-haiku-4-5-20251001) |
| Fallback LLM | Groq (llama-3.3-70b-versatile) |
| Embeddings | Voyage AI (voyage-3, 1024 dims) or Cohere |
| Blockchain (EVM) | Moralis API + block explorer APIs (Etherscan etc.) |
| Blockchain (Solana) | Helius RPC + enhanced transaction API |
| Monorepo | Turborepo + pnpm workspaces |
| Deployment | Vercel |

---

## Running locally

```bash
pnpm install
cp .env.example apps/app/.env.local   # fill in keys
supabase start
supabase db reset                      # applies all migrations + seed
supabase gen types typescript --local > apps/app/lib/supabase/types.ts
pnpm dev                               # starts all three apps in parallel
```

Ports: web=3000, app=3001, docs=3002, widget=3003

---

## Environment variables

### AI / Embeddings
- `ANTHROPIC_API_KEY` — Claude API
- `GROQ_API_KEY` — Groq fallback LLM
- `VOYAGE_API_KEY` — Voyage AI embeddings
- `COHERE_API_KEY` — Cohere embeddings (alternative to Voyage)

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Auth (Clerk)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### Blockchain (EVM)
- `MORALIS_API_KEY`
- `ETHERSCAN_API_KEY` — Etherscan V2 unified key, covers ALL EVM chains (Base, BSC, etc.); the old per-chain BASESCAN/BSCSCAN keys are no longer used

### Blockchain (Solana)
- `HELIUS_API_KEY` — Helius RPC + enhanced transaction API (https://dev.helius.xyz)

### Billing (Stripe)
- `STRIPE_SECRET_KEY` — Stripe API key (enables live checkout + portal)
- `STRIPE_PRICE_PRO` — price ID of the recurring Pro product
- `STRIPE_WEBHOOK_SECRET` — signing secret for `/api/stripe/webhook`

### Rate limiting (optional)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — distributed limiter for `/api/chat`; falls back to per-instance in-memory when unset

### Platform
- `CRON_SECRET` — bearer token for manually invoking `/api/cron/*`. Vercel Cron's own scheduled calls are recognised by their `x-vercel-cron` header and do not need it
- `INTEGRATION_ENCRYPTION_KEY` — base64 32-byte AES-256-GCM key (`openssl rand -base64 32`) encrypting integration credentials in `projects.config`. Absent, values pass through in plaintext; rotating it makes stored secrets unreadable, so treat a rotation as a re-save of every integration
- `RESEND_API_KEY` — email notifications (optional)
- `WEBHOOK_SECRET` — HMAC for outbound webhooks
- `PREVIEW_HMAC_SECRET` — dashboard preview token signing
- `NEXT_PUBLIC_DEMO_WIDGET_KEY` — demo project key, baked into the apps/web client (/demo + /check)
- `DEMO_WIDGET_KEY` — same value, server-side on apps/app (demo-key recognition in chat + widget-config routes). NOTE: apps/web and apps/app are SEPARATE Vercel projects with separate env scopes; the robust demo exemption is the `publicDemo` config flag, not these vars
- `NEXT_PUBLIC_PLATFORM_WIDGET_KEY` — platform's own widget embed
- `ADMIN_EMAILS` — comma-separated emails with /admin access
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile verification on /api/chat (apps/app)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — invisible Turnstile widget on /check (apps/web)
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_WEB_URL` / `NEXT_PUBLIC_WIDGET_URL` — cross-app URLs

---

## packages/ai

Source: `packages/ai/src/`

### Key exports

```ts
// prompt.ts
buildSystemPrompt(params: StreamChatParams): string
// Builds the full Claude system prompt from project config + wallet context.
// Branches: mode="support" (full RAG + tools) vs mode="token" (lightweight FAQ mode).

// stream.ts
streamChatWithTools(systemPrompt, messages, walletConfig, watchedContracts, maxTokens)
// Agentic streaming loop. Claude path: tool use loop with up to 5 rounds.
// Groq path: keyword-detected tool use, same tool interface.

// tools.ts
buildWalletTools(watchedContracts): Tool[]
// Returns ~24 Anthropic tool definitions. Wallet: get_wallet_balance,
// get_recent_transactions, get_transaction_by_hash, get_wallet_approvals,
// diagnose_wallet. Contract: get_contract_info (verification/proxy),
// get_contract_state/data/functions/events/holdings/deployment/transactions,
// get_upgrade_history. Token: get_token_info/allowance/price,
// check_token_safety, get_native_price. Trust: check_address_sanctions
// (OFAC via Chainalysis on-chain oracle, packages/blockchain/src/sanctions.ts).
// Utility: resolve_ens_name, estimate_action, get_network_status,
// create_support_ticket.
executeTool(name, input, walletConfig, watchedContracts): Promise<unknown>
// Executes a tool call. Passes knownAbis map to getTransactionByHash
// so stored ABIs reach the decoder without an extra explorer fetch.

// types.ts
WatchedContractSnapshot   // runtime view passed into tools/stream
ErrorGlossaryEntry        // { error, explanation } for custom revert mapping
```

### System prompt structure (support mode)
1. Role intro
2. Protocol token details
3. Smart contracts list (with error glossary per contract)
4. User wallet section — connected or not, tool use rules, `decodedRevert` interpretation guide
5. Protocol documentation (RAG excerpts)
6. Escalation rules
7. Universal communication rules
8. Persona style block

### decodedRevert interpretation in prompts
The prompt instructs Claude to interpret each `cause`:
- `out_of_gas` → gas LIMIT (not ETH balance), tell user to increase in advanced wallet settings
- `revert_reason` → translate raw string to plain English
- `custom_error` → check error glossary first, then DeFi knowledge
- `panic` → programming error, explain in context
- `unknown_revert` → if `rawHex` present: mention ABI upload; if absent: common causes list

---

## packages/blockchain

Source: `packages/blockchain/src/`

### Key exports

```ts
// wallet.ts
getTransactionByHash(hash, chainId, knownAbis): Promise<Transaction>
// Fetches tx via Moralis. For failed txs, calls decodeTxRevert.
// knownAbis: Record<address, abiJsonString> — skips explorer fetch if present.
getRecentTransactions(address, chainId, contractAddress?): Promise<Transaction[]>
// Out-of-gas detected locally (gasUsed ≥ 99% of gasLimit) for recent txs.

// decoder.ts
decodeTxRevert(params): Promise<DecodedRevert>
// Replay chain: out-of-gas → eth_call replay → Error(string) → Panic(uint256)
// → 4byte.directory + explorer ABI in parallel → unknown_revert
fetchAbiFromExplorer(address, chainId): Promise<string | null>
// Checks Etherscan/Basescan/BscScan for verified contract ABI.
// Returns null if unverified or API key missing.

// types.ts
DecodedRevert {
  cause: "out_of_gas" | "revert_reason" | "custom_error" | "panic" | "unknown_revert"
  reason: string          // plain English (set by decoder)
  errorName?: string      // Solidity error name if decoded
  errorSignature?: string
  rawHex?: string         // raw revert data if cause is unknown_revert
  gasInfo: { used, limit, percentUsed }
}
// Transaction has decodedRevert?: DecodedRevert added
```

### Chain support
Chains are configured in `CHAIN_CONFIGS` in `types.ts`. Block explorer API keys map by chain ID. Out-of-gas detection is done purely in arithmetic (no RPC call) for the recent-tx list; full decode is only triggered on `get_transaction_by_hash`.

**Non-Moralis chains (e.g. Etherlink, `0xa729`/XTZ):** Moralis doesn't index every chain. A `ChainConfig` with NO `moralisChain` but a `blockscoutApi` base routes the wallet tools (balances, recent txs, single-tx) through `blockscout-wallet.ts` instead — Blockscout v2 REST for lists/token-balances, RPC (`eth_getTransactionByHash`/receipt/`eth_getBlockByNumber`) for single txs + the revert decoder. `usesBlockscoutWallet(chainId)` gates the dispatch inside `wallet.ts`. Approvals degrade to `[]` (no clean Blockscout endpoint). Explorer/ABI still works via `explorerQuery` (add the chain to `BLOCKSCOUT_BASES` in `blockscout.ts`). Adding such a chain touches: `CHAIN_CONFIGS`, `BLOCKSCOUT_BASES`, `SUPPORTED_CHAINS` (apps/app config), the CHAIN_NAMES maps (prompt.ts + ConversationList.tsx), and `apps/web/lib/chains.ts` (+ a `/public/chains/<Name>.png` logo, else ChainLogo shows a monogram).

---

## packages/solana

Source: `packages/solana/src/`

Chain ID string: `"solana"` (not a hex value). Added to `SUPPORTED_CHAINS` in `lib/types/config.ts`, but currently PAUSED in the UI: `PAUSED_CHAINS` contains `"solana"` and `SELECTABLE_CHAINS` filters it out of all pickers (config.ts:60-63). The plumbing below remains in place for when it's re-enabled.

### Key exports

```ts
// helius.ts
getSolanaWalletBalance(address): Promise<SolanaBalance>
// getBalance (lamports → SOL) + getTokenAccountsByOwner (max 30 tokens, skips zero-balance)

getSolanaRecentTransactions(address, programAddress?, limit): Promise<SolanaTransaction[]>
// GET https://api.helius.xyz/v0/addresses/{address}/transactions — enriched format

getSolanaTransactionBySignature(signature): Promise<SolanaTransaction | null>
// POST https://api.helius.xyz/v0/transactions — single enriched tx

// idl.ts
fetchIdlFromRegistry(programAddress): Promise<string | null>
// GET https://anchor.projectserum.com/idl/{programAddress} — null if not found

// index.ts
isSolanaChain(chainId: string): boolean
```

### Solana in AI tools
`packages/ai/src/tools.ts` branches on `isSolanaChain(wallet.chainId)`:
- `get_wallet_balance` → `getSolanaWalletBalance`
- `get_recent_transactions` → `getSolanaRecentTransactions`
- `get_transaction_by_hash` → `getSolanaTransactionBySignature` (accepts signature string)
- `get_contract_transactions` → `getSolanaRecentTransactions(programAddress, programAddress, limit)`

### Solana in the widget
`apps/app/app/widget/WidgetApp.tsx` detects Solana projects via `config.chains.includes("solana")`.
Phantom detection: `window.phantom?.solana || window.solana` (supports both new + legacy injection).
Connect flow: `phantom.connect()` → `resp.publicKey.toString()` → `chainId: "solana"`.

### Solana in the dashboard
ABI Manager relabels to "IDL" for `chain === "solana"`. "Check block explorer" → "Check Anchor registry".
`refreshContractAbi` in `contracts.ts` branches to `fetchIdlFromRegistry` for Solana contracts.

---

## packages/aptos

Source: `packages/aptos/src/`. Chain ID string: `"aptos"` (not hex). Move-VM L1, so a separate chain family like Solana — NOT another EVM chain. No Moralis/Etherscan coverage; built entirely on Aptos's own **fullnode REST** (`https://fullnode.mainnet.aptoslabs.com/v1`) + **Indexer GraphQL** (`https://api.mainnet.aptoslabs.com/v1/graphql`). Public/keyless, but set `APTOS_API_KEY` (Aptos Build, Bearer) to raise rate limits — `aptosAuthHeaders()` threads it to both fullnode and indexer. Spec: `docs/superpowers/specs/2026-07-24-aptos-integration-design.md`; plan: `docs/superpowers/plans/2026-07-24-aptos-integration.md`.

### Key exports
```ts
// fullnode.ts — REST: aptosFetch (10s timeout + single 429 retry, honors Retry-After),
//   getLedgerInfo, getAccount (via 0x1::account::Account resource — AIP-115 made the
//   plain /accounts endpoint return a synthetic stub, so it can't signal non-existence),
//   getAptosModuleAbi (single-module + list overloads; list PAGINATES via x-aptos-cursor,
//   limit=100, 6-page cap — Decibel has 91 modules), getAptosTransactionByHash(hashOrVersion, errmap?)
//   (numeric → /by_version; attaches decodedAbort on failure), viewFunction, getAptosNetworkStatus.
//   formatUnits/microsToIso are no-throw-guarded.
// indexer.ts — GraphQL: getAptosWalletBalance (current_fungible_asset_balances, unifies
//   legacy CoinStore + FA standard; APT detected by coin type OR 0xa+symbol), 
//   getAptosRecentTransactions(addr, moduleAddr?, limit, errmap?) (hydrates versions via fullnode,
//   threads the errmap so history failures decode with protocol reasons), diagnoseAptosWallet.
//   ALL client fns return null on FETCH FAILURE (distinct from empty) so the AI never reports
//   "empty wallet" during an outage.
// abort.ts — decodeAbort(vmStatus, errmap?): Move-abort decoder. std::error category via BigInt
//   (never >>, which truncates u64), FRAMEWORK_ERRORS table (0x1/0x3/0x4), name-fallback lookup
//   (fullnodes embed the constant name), honest module+code framing for unmapped codes. Never throws.
// errmap.ts — PROTOCOL_ERRMAPS (Decibel from its SDK error-reference docs; PancakeSwap/Amnis
//   harvested from on-chain PackageRegistry source; Thala observed codes). errmapFor(watchedContracts)
//   unions entries by watched-contract ADDRESS (not pinned module). Framework table is inside decodeAbort.
// names.ts — ANS: resolveAptosName / reverseAptosName (.apt) via the Indexer's
//   current_aptos_names table (the public aptosnames.com REST API was sunset 2026-04).
// address.ts — isAptosAddress (0x + 1-64 hex), normalizeAptosAddress (pads to 64).
// index.ts — isAptosChain(chainId): boolean.
```

### Aptos in AI tools
`packages/ai/src/tools.ts` branches EVERY `isSolanaChain` dispatch site with an `isAptosChain` arm (wallet balance/txs, tx-by-hash, contract info/functions/state/data via module ABIs + `viewFunction`, network status, wallet diagnosis). Tools without an Aptos equivalent (approvals, allowance, token safety, sanctions, estimate) return an honest execution-time note, never EVM data. **Tx-hash routing:** Aptos hashes are `0x`+64hex — format-identical to EVM — so `get_transaction_by_hash` queries the Aptos fullnode in PARALLEL with the EVM fan-out when the session/contracts involve Aptos; all-numeric input short-circuits to Aptos (a version). Actions (execute) are EVM-only — excluded for `"aptos"`.

### Aptos in the widget / dashboard
Widget (`WidgetApp.tsx`): Petra/Martian connect (`window.aptos ?? window.martian` → `connect()` → `chainId "aptos"`); missing provider falls through to address-paste (fixes the Solana silent-no-op dead-end). Chat route accepts `0x`+1-64hex wallet addresses only when `chainId === "aptos"`. Dashboard/demo-creator: chain-discriminated address validation + optional `WatchedContract.moduleName` (Aptos module scoping); `AddContractDialog` peeks modules via `peekAptosModules` (a Select, not free text); `AbiManager` relabels to "Move module ABI (on-chain)". Chain registry: `"aptos"` in `SUPPORTED_CHAINS`, unpaused (Task 13).

### Demo protocol
Decibel (Aptos Labs' on-chain perpetuals DEX) is the flagship demo target — mainnet package `0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06`. Its app CSP blocks the bookmarklet, so demos run on the widget preview / share page. Errmap voiced in perp-trader language.

### Delegated-trading history merge (Decibel session keys)
Decibel orders are signed by a delegated session key and execute against the trader's subaccount OBJECT, so the wallet's indexer history is empty for active traders. `getAptosRecentTransactionsMerged(accounts, moduleAddr?, limit, errmap?)` (indexer.ts) queries `account_transactions` for wallet + protocol account, dedupes/merges by version, hydrates only the top N, and tags each tx with `activityOn` labels. `resolveProtocolAccountAddress(adapter, wallet)` (protocols.ts) is the lightweight wallet→account resolver (`ok`/`none`/`failed`). Wired in `packages/ai/src/tools.ts`: `get_recent_transactions` merges when `adapterFor(watchedContracts)` matches (with a model note covering session-key senders + keeper-batch fills), and `diagnose_wallet` passes the protocol account into `diagnoseAptosWallet(address, extraAccounts?)` so failure counts cover both. Subaccount history includes keeper/oracle txs that touched the subaccount (fills, funding) — annotated, not filtered.

### Public Aptos demo page
`apps/web/app/check/aptos` — Move-native /check variant (PancakeSwap-on-Aptos preset, Petra/Martian connect + address paste, Aptos teal accent, no Aptos logo lockup by choice: reads as a collaboration claim). Chats through the normal publicDemo path with `chainId: "aptos"`, key from `NEXT_PUBLIC_APTOS_DEMO_WIDGET_KEY` (web Vercel project) with a `?key=pk_…` override for smoke-testing. No API changes; the EVM-only inspect/Turnstile branch does not apply (session cap 8 + per-IP/key rate limits do). Kept OUT of the Aptos BD email deliberately.

### Aptos Build → Geomi rename
The developer API gateway rebranded: build.aptoslabs.com redirects to geomi.dev (beta). `APTOS_API_KEY` comes from there; anonymous fullnode/indexer access is limited to 40k compute units per 300s per IP (hit twice during dev), so the key is demo-critical in Vercel.

---

## apps/app

### Important patterns

**Server actions** — all follow `resolveProjectWithOwnership(projectId)`:
```ts
async function resolveProjectWithOwnership(projectId) {
  // Auth via Clerk → look up org in Supabase → verify project belongs to org
  // Returns project row with { id, config, org_id }
}
```
Never read `projects` without verifying org membership first.

**Config JSONB** — all per-project settings live in `projects.config` (type: `ProjectConfig` in `apps/app/lib/types/config.ts`). Mutate by reading the full config, spreading the change, and writing back. Revalidate with `revalidatePath("/dashboard/contracts")` etc. after write.

**TypeScript** — `exactOptionalPropertyTypes: true` is set. Never assign `field: x | undefined`. Use conditional spreads:
```ts
// WRONG
{ preloadedAbi: abi }         // if abi could be undefined
// CORRECT
...(abi ? { preloadedAbi: abi } : {})
```

### Key lib files
- `lib/types/config.ts` — `ProjectConfig`, `WatchedContract`, `ErrorGlossaryEntry`, `BrandingConfig`, plan limits, supported chains
- `lib/actions/contracts.ts` — `addContract`, `removeContract`, `refreshContractAbi`, `saveContractAbi`, `clearContractAbi`, `upsertGlossaryEntry`, `removeGlossaryEntry`
- `lib/actions/project.ts` — project CRUD
- `lib/actions/ingest.ts` — doc ingest for RAG
- `lib/supabase/server.ts` — `createServiceClient()`

### Dashboard routes
- `/dashboard/contracts` — watched contracts, ABI/IDL upload, error glossary
- `/dashboard/branding` — widget appearance, persona, language, positioning
- `/dashboard/conversations` — conversation history (includes Telegram sessions, prefixed `tg-{chatId}`)
- `/dashboard/docs` — documentation ingest for RAG
- `/dashboard/telegram` — Telegram bot setup (connect/disconnect via BotFather token)
- `/dashboard/embed` — widget installation snippet
- `/dashboard/analytics` — usage stats
- `/dashboard/tickets` — support ticket management
- `/dashboard/upgrade` — plan/billing

### Key components
- `components/settings/ContractList.tsx` — lists contracts; renders `AbiManager` + `ErrorGlossaryManager` per contract
- `components/settings/AbiManager.tsx` — ABI/IDL status badge + check explorer/registry / paste UI (Solana-aware)
- `components/settings/ErrorGlossaryManager.tsx` — add/remove error→explanation mappings
- `components/settings/BrandingForm.tsx` — branding fields including language selector (16 languages)
- `components/settings/TelegramPageClient.tsx` — Telegram bot connect/disconnect UI

---

## Docs (two separate systems — don't conflate)

1. **`apps/docs`** — standalone docs site. ⚠️ **NOT DEPLOYED**: `docs.txid.support` does not resolve, so nothing here reaches a user. Verify before writing docs into it. Hardcoded JSX pages: quickstart, dashboard, embed, contracts, api, features. Sidebar: `apps/docs/components/Sidebar.tsx`.
2. **`apps/web/lib/docs.ts`** — data-driven help centre at txid.support/docs (`apps/web/app/docs/[slug]/page.tsx`). **This is the live one.** 16 docs: features (the full capability table), introduction, quick-start, branding, smart-contracts, sub-accounts, knowledge-base, chains, content-blocks, preview, embed, actions, integrations, conversations, tickets, analytics. Linked from the dashboard footer (`apps/app/app/dashboard/layout.tsx`), so a customer can reach it without leaving the product. Block types include `features`, a three-column table whose `status` field (`available`/`optional`/`coming`/`paused`) is REQUIRED, so a capability cannot be listed without stating whether it exists.

When a product fact changes (chains, plans, limits), update BOTH systems plus the marketing FAQ (`apps/web/components/sections/FAQ.tsx`).

---

## Supabase schema (key tables)

> **Production schema drifts.** On 2026-08-04 production was missing FIVE tables,
> the oldest since June: `webhook_logs`, `token_usage`, `action_events`, plus the
> two added that day. Migrations exist in the repo but had never been applied.
> `webhook_logs` being absent is why `tickets` was completely empty:
> `dispatchEscalation` writes to it on every escalation.
>
> **Never assume a migration is applied.** Check before diagnosing anything that
> touches the database:
> ```sql
> select t.name, to_regclass('public.'||t.name) is not null as exists
> from (values ('organisations'),('projects'),('documents'),('conversations'),
> ('messages'),('rate_limits'),('indexing_jobs'),('tickets'),('webhook_logs'),
> ('token_usage'),('action_events'),('case_access_log'),
> ('escalation_deliveries')) as t(name) order by exists, t.name;
> ```
>
> `supabase/RUN_IN_SQL_EDITOR.sql` is a regenerable catch-up file (every
> migration from `20260628000001` onward, guarded so it is safe to re-run).
> The CLI is not linked locally, so the dashboard SQL editor is the route.
>
> **Two migrations were unappliable until fixed** (both repaired 2026-08-04):
> `CREATE OR REPLACE FUNCTION` cannot change a return type, so widening
> `admin_token_usage()` needs a `drop function` first; and `CREATE POLICY` has
> no `IF NOT EXISTS`. Test migrations against a local Postgres reproduction of
> the current production table set before handing anyone SQL to run.


| Table | Purpose |
|---|---|
| `organisations` | Clerk org → internal org mapping |
| `projects` | One per org (currently). Has `config JSONB`, `publishable_key`, `secret_key` |
| `documents` | RAG chunks with `embedding vector(1024)` |
| `conversations` | Chat sessions, `session_id`, `project_id` |
| `messages` | Individual chat turns |
| `support_tickets` | Escalated issues, `ref` unique constraint |
| `webhook_logs` | Outbound webhook event log |
| `token_usage` | Per-message input/output token counts; aggregated by `admin_token_usage()` SQL function for the /admin cost cockpit (migration `20260706000003_token_usage.sql`) |
| `case_access_log` | Who viewed/exported/erased a case record. Append-only, no update or delete path (migration `20260803000002`) |

`messages.evidence` (jsonb, migration `20260803000001`) holds the conditions each assistant answer was produced under. See the Case Record section below.

---

## Features built

### No em dashes, anywhere user- or model-facing
- 250 replacements across apps/web, apps/docs, apps/web/public/llms*.txt and packages/ai
- The bulk were in `packages/ai` `prompt.ts` + `tools.ts`: em dashes in the system prompt and tool descriptions taught the MODEL to emit them in answers, which is where the rule actually bites
- Rule: colon after a bold/`<strong>` label, comma otherwise, full stop between two independent clauses. Left alone: code comments, dev-script console output
- Tiers are **Enterprise** and **Evaluation** (150 conversations/month). The word "Free" is retired as a tier name; "no credit card required" removed as a consumer signal

### Transaction decoder
- `packages/blockchain/src/decoder.ts` — replays failed txs via `eth_call` at mined block
- Fallback chain: out-of-gas → Error(string) → Panic(uint256) → 4byte.directory → unknown_revert
- Out-of-gas detected locally (gasUsed ≥ 99% gasLimit) for recent tx list — no extra RPC call
- `decodedRevert` field added to `Transaction` type
- `get_transaction_by_hash` tool label changed to "Diagnosing transaction…"

### ABI upload
- Auto-fetched from block explorer when contract is added
- `AbiManager` component: green/blue/amber badge, paste ABI textarea, re-check button
- Server actions: `refreshContractAbi`, `saveContractAbi`, `clearContractAbi`
- ABIs threaded into decoder at chat time via `knownAbis` map — no extra explorer call per message

### Error glossary
- Per-contract map of Solidity error name → plain English explanation
- Injected into system prompt — Claude uses the explanation verbatim when it matches
- `ErrorGlossaryManager` component for add/remove in the dashboard
- Server actions: `upsertGlossaryEntry`, `removeGlossaryEntry`

---

### Language setting
- `BrandingConfig.language?: string | null` — null/omitted means auto-detect user language
- 16 supported languages defined in `SUPPORTED_LANGUAGES` in `lib/types/config.ts`
- `buildSystemPrompt` accepts `language` param; routes to `buildUniversalRules(language)` in `packages/ai/src/prompt.ts`
- When non-English: AI responds in configured language, may briefly acknowledge user's language before switching
- When null/en: auto-detect from user's messages (default behaviour)

### Solana support
- `packages/solana` — new isolated package (`@txid/solana`) for all Solana tooling
- Chain ID `"solana"` added to `SUPPORTED_CHAINS`; shows alongside EVM chains in contract/chain selectors
- Helius RPC for wallet balance + enriched tx history + single tx lookup
- Phantom wallet connection in widget (detects `window.phantom?.solana` + `window.solana` fallback)
- ABI Manager relabels to IDL for Solana contracts; `refreshContractAbi` checks Anchor registry
- AI tools in `packages/ai/src/tools.ts` branch by `isSolanaChain(chainId)` for all four tools
- System prompt in `packages/ai/src/prompt.ts` has Solana-specific wallet/tx guidance (signature vs hash, Solscan, Phantom error patterns)
- Env var: `HELIUS_API_KEY`

### Public /check demo (marketing site)
- `apps/web/app/check/page.tsx` — "try it live" funnel: pick a curated protocol (Uniswap/Aave/Morpho/PancakeSwap), connect wallet or paste address, chat with the bot scoped to that protocol's real routers. Per-protocol brand theming via `accentVars()`; "Try asking" suggestion chips before the first question.
- Curated contracts hardcoded + on-chain-verified in `apps/app/lib/demo-protocols.ts`; the chat route expands `demoProtocol` to them (inspect mode in `apps/app/app/api/chat/route.ts`).
- Demo recognition: `isDemo = isDemoKey(key) || plan === "demo" || config.publicDemo === true`. The **`publicDemo` config flag** (toggle in /admin, `setProjectPublicDemo` in `lib/actions/admin.ts`) is the robust path: it exempts the project from the domain allowlist without env mirroring or a plan change.
- Abuse protection: invisible Cloudflare Turnstile + hard 3-messages-per-IP-per-24h rate cap (durable only with Upstash) + 5-message session cap.

### Admin console (apps/app /admin)
- Admin-gated by `ADMIN_EMAILS`. Projects table with per-project plan dropdown + Public demo toggle; token usage / est. cost columns fed by `admin_token_usage()`.
- `/admin/roadmap` — product roadmap board (data in `lib/roadmap.ts`, localStorage statuses/notes). `/admin/eval` — eval harness (`lib/eval.ts`).

### Demo creator (admin-only, sales tool)
- `/admin/demos` (`DemosManager`) — pre-build a themed demo widget per prospect. Actions in `lib/actions/demos.ts` (admin-gated via ADMIN_EMAILS): create/list/rename/delete/updateDemoConfig/addDemoContract. Demos are real `projects` rows under a sentinel **"Demos" org** (`clerk_org_id = "internal-txid-demos"`), `is_active: true` + `publicDemo: true` (works on any origin, no domain check), kept out of any customer org. `assertDemoProject` scopes every mutation to that org so admin actions can't touch real projects.
- Multi-project is possible because the "one project per org" rule is only a soft convention in `getProject()` (reads the first row); the schema already allows N projects per org.
- **Launch = a bookmarklet** per demo (inject `app.txid.support/widget.js?data-key=<key>` onto any page) — drag to toolbar, click on a prospect's live site during a call. React strips `javascript:` hrefs, so the anchor's href is set imperatively via a ref (see `BookmarkletLink` / `DemoBookmarklet`).
- **Public share page** `txid.support/d/[key]` (`apps/web/app/d/[key]`, noindex) — the prospect drags the same bookmarklet from there to try the demo on their own site, no account (publicDemo makes it work).
- Covers branding + watched contracts (real on-chain diagnosis) + **docs/RAG** (`addDemoDocs` crawls + embeds the prospect's docs into the demo's knowledge base). The crawl+embed core was extracted to `lib/ingest-core.ts` (`crawlAndIngestCore`, auth-free, NOT a server action) and is shared by both the org-scoped `crawlAndIngest` action and the admin `addDemoDocs` — same proven pipeline, two auth wrappers.

### Security & trust marketing
- `apps/web/app/security/page.tsx` — /security page for buyer security reviews: Safe-by-design vs Ask-and-verify framing, data handling, subprocessors (keep in sync with /privacy).
- Framing rule: sanctions screening + contract verification are ON-REQUEST tools (user asks, bot checks live and cites source) — never describe them as proactive interception.

### Actions (AI-prepared, user-signed transactions)
- Design doc: `docs/superpowers/specs/2026-07-17-actions-wallet-execution-design.md` (approved after 2-round spec review). Off by default; paid plans only (`demo`/`publicDemo` always excluded); TxID takes NO fee.
- Two sources, one path: swaps via KyberSwap aggregator (`packages/blockchain/src/actions.ts` — quote/build/allowance/preflight, majors map, `NATIVE_TOKEN` sentinel) + allowlisted contract write functions (static-args, non-payable, encoded from stored ABI).
- AI layer: `packages/ai/src/actions.ts` — `prepare_swap`/`prepare_contract_action` tools exist ONLY when the chat route passes an `ActionsContext` (policy gate passed). Per-invocation OFAC screen (fail-closed). `clientAction` payload stripped from model-facing tool results (`stripClientAction`), emitted as `wallet_action` StreamEvent/SSE.
- Policy gate: `apps/app/lib/actions-gate.ts` — toggle + paid plan + geo (fail-closed on missing header; `ACTIONS_GEO_DEV_BYPASS=1` for local) + `walletMode === "connected"`.
- Lifecycle: prepared actions persisted to `action_events` (migration `20260717000001`); approval-gated actions defer the main tx to `POST /api/actions/rebuild` (full re-gate + fresh quote, one 2s retry for RPC lag; sole writer of `expired`). Ack modal → `POST /api/actions/ack` (kind='ack').
- Follow-up contract: widget sends `actionResult {actionId, txHash, status, gasUsed, blockNumber}` to /api/chat — verified against the audit row, EXEMPT from session caps + forced escalation, receipt data injected as ground truth (beats Moralis lag), persisted with an "⚙️ Action update:" marker.
- Widget: `apps/app/app/widget/ActionCard.tsx` — connected-wallet-only, `eth_accounts` match check, approve→rebuild→sign stepper, 60s quote TTL, receipt polling (provider → public RPC fallback), origin note (iframe = wallet popup shows app.txid.support). `walletMode` field added to chat requests.
- Dashboard: `/dashboard/actions` (`ActionsForm`) — master toggle, per-swap USD cap (default $2k, ceiling $25k, 0 = swaps off), per-contract function allowlist with approval annotation (token + amountArg) and admin-name warnings.
- Prompt guardrail appended in chat route when actions enabled: execute-only, never recommend/solicit (SEC Covered-UI posture). Marketing: FeatureGrid card, /security "Actions (optional)" section, pricing Custom line, help-center `actions` doc, docs-site dashboard section.
- GA prerequisite (business): KyberSwap written consent for third-party apps (ToS §8.3(b)(v)).

### Conversation intelligence + team integrations
- Design doc: `docs/superpowers/specs/2026-07-18-conversation-intelligence-integrations-design.md` (2-round spec review).
- **Summaries + auto-tags:** each conversation gets a cached one-line AI summary + `category` (failed-tx/how-to/bug-report/feature-request/account/other) + `sentiment`, on `conversations` (migration `20260718000001`). Generated lazily by `summarizeStaleConversations` (`lib/actions/summarize.ts`) — one-shot per Conversations mount, 8 concurrent Haiku calls, stale rows picked via the `stale_conversations` SQL function (column-vs-column predicate PostgREST can't do). `last_message_at` stamped on both chat + telegram persist paths. Cost recorded to `token_usage`. Replaced the old on-expand `/api/conversations/[id]/summary` (deleted). Conversations page reads new columns via a guarded separate query (deploy-safe before migration).
- **Integrations:** `config.integrations` (server-only secrets, never in `publicConfig` / never sent raw to the client — dashboard derives `{configured}` booleans, write-only secret UI). Adapters + `dispatchEscalation` in `lib/integrations/escalation.ts`: notifications (Slack/Discord/Telegram) + issue trackers (Linear/GitHub/Jira, issue URL written back to `tickets.external_refs`, shown on the Tickets page). Fan-out is `Promise.allSettled` + 5s timeouts; logged to `webhook_logs` (now has a `target` column + nullable `webhook_url` — Slack/Discord URLs are secrets, never logged). Wired into BOTH ticket routes (`/api/tickets` widget-raised AND `/api/conversations/[id]/ticket` dashboard-raised). Dashboard `/dashboard/integrations` (`IntegrationsForm`) with per-integration card + "Send test" (`lib/actions/integrations.ts`). Migration `20260718000002`.

### Append-only tables and `on delete set null` (READ BEFORE WRITING A GUARD)
`on delete set null` is implemented by Postgres as an **UPDATE on the referencing table**. A blanket `before update` guard therefore does not protect the log, it makes deleting the PARENT fail outright, with an opaque "append-only" error a long way from its cause.

This shipped once: `case_access_log` blocked `admin_erase_project()`, so no project that had ever been viewed or exported could be deleted, and GDPR project erasure and demo cleanup were both broken (found and fixed 2026-08-04, migration `20260804000002`). `audit_logs` was written with the same flaw and fixed before it ever ran.

The pattern both tables now use: permit exactly one shape of update, the FK going to NULL with every other column identical, via `to_jsonb(new) - 'project_id' = to_jsonb(old) - 'project_id'`. A reference can be cleared, never repointed, and no content rides along. Deletes stay refused.

### Proactive opener
`lib/session-opener.ts` + `GET /api/widget/opener` (public in middleware). Replaces the widget's old "Wallet connected: 0x… I can look up your balance and transactions now", which announced a capability at the exact moment it could have used one.

**Rules that are not style preferences:**
- **NO AMOUNTS** in an unprompted greeting. Lead with the event ("your last swap didn't go through"), never the number. Amounts are fine once the user engages.
- **NOTHING EVALUATIVE.** The no-advice guardrail binds harder proactively: unsolicited financial commentary is a stronger form of advice than answering a question.
- **Silence is a valid output.** A failed lookup returns null and the plain greeting stands. Returning 204, not an error.
- **Never blocks.** The plain confirmation posts first; the opener is appended only if it arrives and only if the user has not already spoken.
- **Not an LLM call.** Runs on every connect, must feel instant, and would cost money for users who never ask anything.

**v1 scenarios:** `recent_failure` (leads with the decoded cause, not an offer to look), `no_activity` (activation, not support: a wallet that never traded is someone stuck before their first transaction), `active`, and silence. **Deliberately absent: "your transaction is stuck"** because history endpoints return only MINED transactions, so an unconfirmed one is invisible without a hash or mempool access. Roadmap `k-opener-stuck`.

### Conversation source
`lib/conversation-source.ts`. Derived from the session id prefix (`tg-` Telegram, `preview-` preview, else widget) rather than stored, so it works retroactively on existing rows. Badge + filter on Conversations, shown only when more than one source is in use. WHY: Telegram has no wallet and no on-chain tools, so judging its answers by the widget's standard compares two different products.

### Roles (four, enforced server-side)
`org_members` (migration `20260804000003`) + `lib/roles.ts` (matrix, labels, CLIENT-SAFE) and `lib/roles-server.ts` (`currentActor`, `requireCapability`, `rolesForOrg`). **The split is not cosmetic**: importing them together pulls `next/headers` into the browser bundle and fails the build.

Admin / Developer / Support / Auditor, expressed as CAPABILITIES (`settings`, `keys`, `billing`, `team`, `destroy`, `tickets`, `records`) rather than role-name checks. Auditor reads and exports and changes nothing, which is the account to hand an external auditor.

- **Clerk owns membership, we own permission.** No mirroring, so no sync problem. A member with no row takes `DEFAULT_ROLE`.
- **DEFAULT_ROLE is `admin`** so existing teams are not silently demoted on deploy.
- **`currentActor` returns the default when there is NO org row.** `createProject` upserts the organisation, so failing closed there throws "Unauthenticated" at every new signup. Before the org exists there is nothing to protect.
- Cannot change your own role; the last Admin cannot be demoted. Both enforced server-side.

### Docs auto-sync and change detection
`doc_sources` (migration `20260804000004`) holds a content hash + ETag + Last-Modified per page. `crawlAndIngestCore` sends conditional requests, treats 304 as nothing-to-do, and re-embeds ONLY pages whose hash moved. **It also prunes**: a page deleted from the docs used to keep its chunks forever, so the bot answered from documentation that no longer existed, with a citation. An all-304 crawl is a SUCCESS, not the old "no content found" failure. Cron `docs-resync` daily at 03:00; `config.docsSync` opts in.

### Ticket inbox
`ticket_events` (migration `20260804000005`) is append-only on UPDATE and **deliberately NOT on DELETE**: both FKs cascade, so blocking delete would break ticket deletion and `admin_erase_project()`. Same trap as `case_access_log`, different disguise. Records status changes, assignment, notes, and replies sent OUTSIDE TxID (email/CRM) with a channel and URL, because the trail otherwise stops at "escalated". TxID does not send the reply; inbound email capture is not built.

### Team access
`/dashboard/team` invites people through Clerk as `org:admin` or `org:member` (`lib/actions/team.ts`). **Clerk membership is not the permission model**: the TxID role in `org_members` is what every server action enforces, and it is what the team page displays. See "Roles (four, enforced server-side)" above.

Historical note worth keeping: the roadmap claimed "one user per org, no seats, no roles" for months. Two of those three were false, it was quoted to the user, and it delayed role enforcement on the false premise that seats had to be built first.

### Audit log
`audit_logs` (migration `20260804000001`) + `apps/app/lib/audit.ts`. `recordAudit()` NEVER fails the write it accompanies (auditing is a side effect; refusing to save a webhook URL because the log is down is worse than a gap) and **scrubs any metadata key matching `token|secret|key|password|webhookurl|apitoken|apikey|credential`** before writing, so one careless `metadata: patch` cannot put a customer's Jira token in the table we point reviewers at. Record that a credential CHANGED, never its value.

One hook on `updateConfig` covers every config change since they all funnel through it, recording only the changed KEYS. Named hooks on top: `integration.saved`, `escalation.redelivered`, `widget.enabled`/`disabled`. Shown on Account as "Change history". Clerk's `orgId` is a Clerk string, NOT our `organisations.id` UUID: callers pass the internal id, the helper never reads Clerk's.

### Ticket signals: why it reached you, and how founded it was
`lib/ticket-signals.ts`, computed in `getTickets` from the conversation's own messages. Works retroactively on every existing ticket, needs no new instrumentation.

**DERIVED, NOT DECLARED.** Tickets already had a `reason`, but the MODEL picks it from an enum, so it is the assistant's account of why it gave up. `ticketSignals()` reads the evidence instead: `docs_gap` (retrieval matched nothing), `read_failed` (failedLookups), `ungrounded`, `untraceable_figures`, `marked_unhelpful`, `no_answer`, `advice_declined`.

**NO CONFIDENCE SCORE, deliberately.** A percentage is a quantitative claim that must be defended when wrong, and it tells a support lead nothing actionable. "Your documentation does not cover withdrawals" is a task; "62%" is decoration. The badge is instead a `basis`: Verified / From docs / Unverified, taken as the **WORST** across the conversation, because averaging is exactly how the one unverifiable answer disappears.

Sortable by `BASIS_RANK` so the least verifiable reach a human first.

### Service updates (`config.incident`)
The PROTOCOL's own announcement channel, carried by the assistant. **FRAMING IS LOAD-BEARING IN EVERY STRING**: this is not an emergency switch for TxID and nothing may imply the assistant is broken. The customer is telling their users about their product. Copy says "your protocol", "your users", "your message". User-facing name is "service update", never "incident mode".

`activeStatusNotice(config)` resolves expiry ON READ, so a lapsed update stops appearing the moment it lapses rather than waiting for a job. Called in the chat route, the widget-config route and the dashboard.

**Three levels** because a binary switch does not get used for a partial issue, which is most issues: `notice` (message shown, assistant answers normally), `restricted` (holds back on named topics, keeps helping elsewhere, THE ONE TEAMS WANT), `announcement_only`.

**The prompt block is emitted FIRST, above the documentation, and explicitly outranks it.** The docs describe normal operation and are wrong the moment the protocol says otherwise. The model is forbidden from softening it, speculating on cause, estimating a fix time, or reassuring anyone their funds are safe: that is the team's to say.

**Scope beats severity.** "Withdrawals are paused" is actionable; "something is wrong" causes a bank run. Naming topics also means the assistant keeps answering the other 80%, so support load falls rather than rises.

**Auto-expiry is not optional** (default 4h). An update left up for weeks teaches users to ignore updates, costing the channel exactly when it is next needed.

**`POST /api/v1/status`** (Bearer `sk_…`, public in middleware) exists because at 3am the team is in their own runbook, not the dashboard. A control needing a browser session gets used an hour late.

Permission is `tickets`, NOT `settings`: whoever is on support at 3am must be able to reach it. Fully audited (`status_notice.raised`/`cleared`, wording included) which answers "when did you tell your users?" exactly. While one is up, escalations are still RECORDED but not fanned out, because one issue otherwise produces thousands of identical pages and buries the different ones.

### Anti-hallucination: verify the OUTPUT, do not trust the model
The claim is never "it does not hallucinate". It is that the class of error which would actually damage a protocol, **a confident specific wrong NUMBER about a user's own position**, is mechanically checkable, because every legitimate figure came from a tool result or a documentation excerpt.

`lib/numeric-check.ts` extracts every significant figure from the answer and traces it back to `mergeToolEvidence().numbers` (harvested from raw AND humanized forms) or the retrieved context. Untraceable figures land in `evidence.unverifiedNumbers`.

**Substring matching, not equality, and that is deliberate.** The model is SUPPOSED to format and round, so "$63,695.70" quoted from a raw `63695700000` shares a digit prefix rather than matching. Requiring equality would flag every correctly formatted number, the signal would be noise, and it would get switched off. Verified against realistic answers including that exact case.

**WE STREAM, so nothing here can suppress an answer.** The check finishes after the last token. What it does instead is append a caveat in the same turn, so the user sees it before acting and the one answer with nothing behind it never looks identical to the verified ones. Same for `grounding === "ungrounded"`.

Roadmapped, not built: policy checks as code (`c-policy-code`), intent classification used to RAISE the evidence bar rather than shortcut it (`k-intent-gate`).

### Provenance: `evidence.sources` and `evidence.grounding`
Every named thing an answer rested on, as a typed list (`EvidenceSource` in `packages/ai/src/evidence.ts`): `documentation` (with `version` = the `doc_sources` content hash, so "documentation vX" is real and checkable), `contract`, `transaction`, `price`, `position`, `parameter`.

**`transaction.origin` is load-bearing.** `user_supplied` (scraped from the user's own message by `userSuppliedHashes`) versus `looked_up` (found by a tool). A hash the user pasted is a claim about their history; one we found is a finding of ours. Merging them misrepresents who asserted what, which is what a dispute turns on. Shown in amber in the dashboard.

**`grounding` is COMPUTED, never self-reported:** `verified` (a live read succeeded) / `documented` (retrieval matched, no chain read) / `ungrounded` (neither). A model asked to rate its own confidence says it is confident, and the one answer you need flagged is the one it feels sure about. Ungrounded answers get their own bucket in the gaps view, which is the "flag it to the admin" mechanism.

### Retrieval evidence
`messages.evidence.retrieval` carries `matched`, `topScore`, `dropped`, `contextChars`, `sources`. WHY: an answer weakened by docs that do not cover a topic and one weakened by docs that cover it badly are identical in a transcript and have opposite fixes. `dropped` matters because a chunk cut by the 24k char budget looks exactly like one that was never retrieved. `contextChars` is prompt spend on every message, so the 24k budget and 0.35 threshold are now tunable against data rather than guesses. Surfaced as "Documentation coverage" in `GapsPanel`. Doc gaps are deliberately NOT counted in `withProblems`: a user can be well served from chain data while the docs covered nothing.

### Widget disclaimer
`branding.disclaimer`, `DEFAULT_DISCLAIMER` + `resolveDisclaimer()` in `lib/types/config.ts`. **Unset means the DEFAULT, not silence**; empty string is the explicit opt-out. Rendered under the composer in BOTH modes (one and not the other looks deliberate) and appended in `plainBody`, so all six escalation integrations carry it without touching an adapter. All three escalation paths pass it: widget, dashboard, Telegram.

### No financial advice (unconditional)
A policy block inside `buildUniversalRules` in `packages/ai/src/prompt.ts`, so it reaches BOTH modes and therefore the widget, Telegram and the API. Refuses buy/sell/hold/close/sizing, price predictions, good-investment judgements, tax, and legal or jurisdictional eligibility, including the same question reframed as an opinion, hypothetical, or role-play. Then gives the facts, because a refusal alone is bad support.

**It is deliberately not configurable.** A protocol cannot switch off the rule that protects it, and there is no case where a support bot should give investment advice.

WHY IT LIVES IN THE UNIVERSAL RULES: this language previously existed ONLY in the Actions guardrail, appended by the chat route when `actionsCtx` was non-null. `actionsCtx` excludes Aptos and Solana and requires a paid plan with Actions on, so the Decibel perps demo, the surface most likely to be asked "should I close?", had no advice guardrail at all. Never gate a safety rule behind an optional feature.

Conversations that asked for advice are categorised `advice-request` (`CONV_CATEGORIES` in `apps/app/lib/actions/summarize.ts`), labelling what the USER asked for rather than what the assistant answered, so a protocol can show how often it came up and that it was declined.

### Sub accounts
Opt-in via `config.subaccounts.enabled` (Dashboard > Smart Contracts > "Sub accounts"). OFF by default and deliberately so: most protocols keep funds in the wallet, and showing a second address there invents a concept the user does not have. The card reports whether `adapterFor(watchedContracts)` matched, and surfaces `adapter.accountLabel` ("subaccount" for Decibel), so the toggle is never a guess. **Dashboard copy never names the protocol**: it matches only the customer's OWN watched contracts, so it cannot leak another client, but "Decibel detected" still reads like we are talking about somebody else's product. Describe the capability, pass only the label. The WIDGET does name it ("Decibel subaccount"), which is right, since there it is the protocol's own users on the protocol's own site.

**One account per wallet, deliberately** (decided 2026-08-04). `resolveAccountFn` returns a single account (`primary_subaccount`) and the UI says "your sub account". If a protocol ever allows several per wallet, that phrasing becomes a confident lie and the resolver must return a list first.

`apps/app/lib/protocol-account.ts` is the ONLY resolver, shared by the widget's connect-time call (`GET /api/widget/protocol-account`, public in middleware) and the chat route, with a 5 minute in-process cache so the pair costs one view call. **Four states, and `failed` is not `none`:** `ok` / `none` (never deposited, a real answer) / `failed` (never rendered) / `off`. Failures are not cached.

Widget: `IdentityBar` under the header, collapsed to a labelled one-liner, expanding to FULL addresses with copy buttons. Never truncated-only, because lookalike scam addresses match the first and last characters exactly, and the bar says so.

Prompt: `StreamChatParams.protocolAccount` adds a "the user has TWO addresses" section before the wallet block, so the model knows this BEFORE the first question. WHY IT MATTERS: a tester asked why a different address was showing as connected and the bot answered "There is no confusion", then conceded two messages later that there are two. The rules added alongside it (give addresses in full, never tell a user they are not confused, check before contradicting, never blame software you have not read) exist because of that transcript.

### Escalation retry worker
`escalation_deliveries` (migration `20260803000003`) holds escalations that never reached their destination, with the payload needed to redeliver. `GET /api/cron/escalation-retry` drains it: 25 oldest-waiting rows per run, `deliverOne` per row, backoff `1m/5m/30m/2h/6h`, abandoned after five attempts rather than deleted. Scheduled from **`.github/workflows/cron.yml`**, NOT Vercel Cron: the Hobby plan caps crons at two per project and one run per day, which is useless for a retry worker. The routes accept `Bearer $CRON_SECRET`, so GitHub Actions hits the same endpoints. Needs `CRON_SECRET` and `APP_URL` as repository secrets. **Never run both schedulers**, or every escalation is delivered twice (the app is its own Vercel project, so the schedule lives there, not at the repo root). Authorised by the `x-vercel-cron` header or `Bearer $CRON_SECRET`; exempt from Clerk in `middleware.ts`. Surfaced on Dashboard > Tickets as "Escalations that did not arrive" (`UndeliveredEscalations`) with a per-row Retry now.

### No narration before tool calls
The Claude tool loop holds text back until a tool call proves it was narration (dropped) or the round ends without one (it was the answer), with a 200-char cap so long answers still stream (`NARRATION_CHARS` in `packages/ai/src/stream.ts`). WHY: the widget already renders a live label per tool call, so model text like "Let me list the available functions" was a second, worse status line, and consecutive rounds concatenated with no paragraph break. The prompt forbids it too, so the model mostly stops producing it. Consequence worth knowing: `anyTextThisTurn` now means text actually reached the user, which is what the never-blank-response fallback should have been keying on all along.

### Telegram bot integration
- One bot per protocol: protocol team creates a bot with @BotFather and pastes the token in Dashboard > Telegram
- `saveTelegramToken` validates via `getMe`, calls `setWebhook` pointing at `/api/telegram/{publishableKey}`, stores token + bot username in config
- Webhook secured: Telegram's `secret_token` set to `projects.secret_key`; route validates `X-Telegram-Bot-Api-Secret-Token` header
- Bot responds to: @mentions, /commands, replies-to-bot in groups; always in private chats
- Full AI pipeline: same system prompt as widget (docs, contracts, language, persona) but no wallet tools
- Conversation history: per-chat context stored in `conversations`/`messages` with session_id `tg-{chatId}`
- Reply format: markdown converted to Telegram HTML (`<b>`, `<i>`, `<code>`, `<pre>`)
- Server action: `lib/actions/telegram.ts`; webhook: `app/api/telegram/[key]/route.ts`

---

### The Case Record (compliance evidence)
The differentiator for institutional buyers, and the part they think they are buying.

**`messages.evidence` (jsonb)** — the conditions each assistant answer was produced under:
- `chain.ledgerVersion` — the ledger version the answer was true as of, so an auditor can REPLAY the exact chain state. Read AFTER the response has streamed, so it costs the user no latency (`apps/app/lib/evidence.ts` `chainStateAt`)
- `pricesAtRead` — the prices a figure rested on. "You were down $312" is unverifiable later without them
- `investigation.toolsUsed` / `.failedLookups` — what ran, and what did not
- `request` — country + region (Vercel edge headers), coarse device, surface, language
- `model`, `latencyMs`, `answer.sha256`

**PRIVACY, deliberate:** the raw IP is used for rate limiting and NEVER persisted (personal data under GDPR; only country granularity is ever needed). Device facts stop at platform + browser family and are never combined into an identifier. Do not "improve" this by adding IP or fingerprinting.

**Evidence extraction** lives in `packages/ai/src/evidence.ts`: the tool loop emits a `tool_evidence` StreamEvent per round, consumed server-side in the chat route and never forwarded to the client. Full tool results are far too large to store; only prices + failures are kept.

**Integrity (migration `20260803000002`)** — enforced in Postgres, not the app:
- `messages` append-only: content, role, evidence, timestamp, conversation_id cannot be rewritten. `feedback` stays writable (the widget thumbs legitimately changes later)
- DELETE on `messages`/`conversations` is REFUSED unless `app.erasure = 'on'` is set for the transaction. GDPR erasure goes through `erase_conversation(id, actor)`, which leaves a tombstone
- `admin_erase_project(id, actor)` is the ONLY way to delete a project (demo cleanup cascades into conversations). `deleteDemo` calls it, falling back to a direct delete pre-migration
- `case_access_log` records view/export/erase. Itself append-only. `project_id` is `on delete set null`, NOT cascade: a tombstone that dies with its project records nothing
- Access logging: `apps/app/lib/case-access.ts`, never allowed to fail a read

**Export** (`/api/conversations/export`) carries ledger version, state-read time, country, model and answer hash, and logs itself as a disclosure.

**Gaps view** (`apps/app/lib/gaps.ts` + `GapsPanel`) on Analytics: thumbs-down, escalated, and negative-sentiment-that-never-escalated (the ones who leave quietly). Splits KNOWLEDGE gaps from DATA gaps using `failedLookups` — different owners, and adding docs will not fix an indexer outage.

### Decibel / Aptos protocol adapters (`packages/aptos/src/protocols.ts`)
`ProtocolAdapter` declares how to get from a wallet to the protocol's own account object and which views describe it. **`humanize()` is not cosmetic**: Move views return fixed-point integers with no units, and the model will otherwise invent a scale and state a confidently wrong price.

**SCALING, verified against live mainnet — get this wrong and every number is wrong:**
- Prices are a flat **1e6** across all markets (BTC mark `63695700000` = $63,695.70)
- **SIZE decimals are PER MARKET** via `market_sz_decimals`, and none of the sampled markets use 6: BTC 8, ETH 8, GOLD 8, TSLA 7, APT 5, MEGA 4, CHIP 3. A flat 1e6 made every size and notional wrong by 10^(szDecimals-6)
- Notional = `entry_px_times_size_sum / (1e6 * 10^szDecimals)`
- USD formatting scales precision to magnitude: 2dp turns a $0.0371 small-cap entry into "$0.04", a different price

**`perMarket`** reads (oracle price, `is_position_liquidatable`, order constraints, funding, stops) run ONLY for markets the trader holds, capped at 5 (constraints at 2). A 29-position book at 8 markets x 11 views is 88 calls for one question, which throttles even with a key. The model is told an absent field means NOT READ, never zero.

**`walletViews`** exist because withdrawal queues key on the OWNER, not the subaccount: reading `get_pending_withdrawals` with the subaccount returns empty and would answer "there isn't one" to someone whose withdrawal is pending.

**429 handling:** `viewFunctionResult` treats 429/408/425 as `unreachable`, NOT `aborted`. `aborted` is read by `resolveProtocolAccountAddress` as "this wallet has no subaccount", so a rate-limited lookup previously told an active trader they had never traded on Decibel. Do not re-bucket all 4xx.

**Not answerable, correctly declined:** historical/realised PnL and tax basis. No view exposes it per account; reconstructing from trade history would be a guess presented as a number.

### Aptos demo page
`/check/aptos` has a "use a live trader wallet" escape hatch backed by `apps/web/app/api/aptos/sample-trader/route.ts`, which walks recent Decibel traders until one holds an open book (cached 5 min). `primary_subaccount` resolves for ANY wallet, so a reviewer connecting a fresh wallet otherwise sees a correct but empty answer.

---

## Plans / billing

Plans: `free | starter | pro | enterprise | custom | demo`

| Plan | Chains | Conversations/mo |
|---|---|---|
| free | 1 | 150 |
| starter (legacy) | 1 | 200 |
| pro | 1 | 2500 |
| enterprise | unlimited | unlimited |
| custom | unlimited | unlimited |
| demo | unlimited | unlimited (hand-provisioned early users; set in /admin) |

Public plans are Free + Custom. Plan is stored in `projects.config.plan`. Stripe columns live on `organisations` (migrated in `20260701000001_stripe_admin.sql`). Rate/usage limits are centralised in `apps/app/lib/limits.ts` (`CHAT_LIMITS`: 20 req/window/IP, 10 messages/session, 5 for the demo key; `PLAN_DAILY_CONV_LIMITS`).

### Stripe billing flow
- `lib/stripe.ts` — lazy client, `isStripeConfigured()`, `planFromSubStatus()` (active/trialing/past_due → pro; terminal → free)
- `lib/actions/billing.ts` — `createCheckoutSession()` (ensures a Stripe customer on the org), `createPortalSession()`
- `app/api/stripe/webhook/route.ts` — verifies signature, reconciles `checkout.session.completed` + subscription created/updated/deleted into `organisations` (sub id/status) and `projects.config.plan`. **The webhook is the only writer of the paid plan** — never granted client-side.
- Upgrade page + Account page show live Stripe buttons when configured, else the email fallback.
- Public webhook route is exempted in `middleware.ts` (alongside `/api/telegram`, `/api/tickets`, `/api/widget/feedback` — all self-authenticating).
- Setup needed in Stripe dashboard: create the Pro product/price, add the webhook endpoint (`/api/stripe/webhook`) subscribed to `checkout.session.completed` + `customer.subscription.*`, then set the three `STRIPE_*` env vars.

---

## TypeScript notes

- Base config: `tsconfig.base.json` at repo root, extended by all packages/apps
- `exactOptionalPropertyTypes: true` — use conditional spreads for optional fields
- `packages/ai` and `packages/blockchain` have their own `tsconfig.json` extending the base
- Run type checks: `cd packages/blockchain && npx tsc --noEmit` (same for packages/ai, apps/app)

---

## Coding conventions

- Server actions: always use `resolveProjectWithOwnership` before any DB read/write
- Config mutations: read full config → spread change → write back → `revalidatePath`
- No comments in code unless the WHY is non-obvious
- Client components: `"use client"` at top, `useTransition` for server action calls, `toast` for feedback
- Icons: `lucide-react`
- Toasts: `sonner`
- No em dashes in user-facing strings — use colons, commas, or periods
