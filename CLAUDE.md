# TxID Support — CLAUDE.md

## What this project is

TxID Support is a B2B embeddable AI support widget for DeFi protocols. Protocol teams install a JS snippet on their site; their users get a chat assistant that knows the protocol's docs, smart contracts, and can look up live on-chain data for a connected wallet.

**Products:**
- `apps/web` — public marketing site (txid.support)
- `apps/app` — B2B dashboard where protocol teams configure their project (app.txid.support)
- `apps/docs` — documentation site (docs.txid.support)
- `packages/react` — published npm package (`@txid/react`) for React embed
- `packages/widget` — embeddable vanilla JS widget (Phase 3 stub, not yet built)

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
- `ETHERSCAN_API_KEY`
- `BASESCAN_API_KEY`
- `BSCSCAN_API_KEY`

### Blockchain (Solana)
- `HELIUS_API_KEY` — Helius RPC + enhanced transaction API (https://dev.helius.xyz)

### Billing (Stripe)
- `STRIPE_SECRET_KEY` — Stripe API key (enables live checkout + portal)
- `STRIPE_PRICE_PRO` — price ID of the recurring Pro product
- `STRIPE_WEBHOOK_SECRET` — signing secret for `/api/stripe/webhook`

### Rate limiting (optional)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — distributed limiter for `/api/chat`; falls back to per-instance in-memory when unset

### Platform
- `RESEND_API_KEY` — email notifications (optional)
- `WEBHOOK_SECRET` — HMAC for outbound webhooks
- `PREVIEW_HMAC_SECRET` — dashboard preview token signing
- `NEXT_PUBLIC_DEMO_WIDGET_KEY` — demo project key on marketing site
- `NEXT_PUBLIC_PLATFORM_WIDGET_KEY` — platform's own widget embed
- `ADMIN_EMAILS` — comma-separated emails with /admin access

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
// Returns Anthropic tool definitions for get_wallet_balance,
// get_recent_transactions, get_transaction_by_hash.
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

---

## packages/solana

Source: `packages/solana/src/`

Chain ID string: `"solana"` (not a hex value). Added to `SUPPORTED_CHAINS` in `lib/types/config.ts`.

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

## apps/docs

Next.js docs site. Pages mirror the sidebar sections: getting-started, contracts, branding, conversations, api.

Key updated page: `app/docs/contracts/page.tsx` — documents transaction diagnostics, ABI upload (three states: explorer-verified / uploaded / missing), and error glossary with example entries.

---

## Supabase schema (key tables)

| Table | Purpose |
|---|---|
| `organisations` | Clerk org → internal org mapping |
| `projects` | One per org (currently). Has `config JSONB`, `publishable_key`, `secret_key` |
| `documents` | RAG chunks with `embedding vector(1024)` |
| `conversations` | Chat sessions, `session_id`, `project_id` |
| `messages` | Individual chat turns |
| `support_tickets` | Escalated issues, `ref` unique constraint |
| `webhook_logs` | Outbound webhook event log |

---

## Features built

### Em dash cleanup (marketing site)
- Removed all em dashes across `apps/web` (FeatureGrid, ForWho, HowItWorks, FAQ, EmbedPreview, layout, opengraph-image, not-found)
- Updated FAQ: free tier is 150 conversations (was 200, then 50); branding included in free

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

## Plans / billing

Plans: `free | starter | pro | enterprise | custom`

| Plan | Chains | Conversations/mo |
|---|---|---|
| free | 1 | 150 |
| starter (legacy) | 1 | 200 |
| pro | 1 | 2500 |
| enterprise | unlimited | unlimited |
| custom | unlimited | unlimited |

Plan is stored in `projects.config.plan`. Stripe columns live on `organisations` (migrated in `20260701000001_stripe_admin.sql`).

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
