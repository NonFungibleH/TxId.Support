# TxID Support — CLAUDE.md

## What this project is

TxID Support is a B2B embeddable AI support widget for DeFi protocols. Protocol teams install a JS snippet on their site; their users get a chat assistant that knows the protocol's docs, smart contracts, and can look up live on-chain data for a connected wallet.

**Products:**
- `apps/web` — public marketing site (txid.support)
- `apps/app` — B2B dashboard where protocol teams configure their project (app.txid.support)
- `apps/docs` — documentation site (docs.txid.support)
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

1. **`apps/docs`** — standalone docs site (docs.txid.support). Hardcoded JSX pages: quickstart, dashboard, embed, contracts, api. Sidebar: `apps/docs/components/Sidebar.tsx`. Key page: `app/docs/contracts/page.tsx` (transaction diagnostics, ABI upload three-states, error glossary).
2. **`apps/web/lib/docs.ts`** — data-driven help center rendered at txid.support/docs (`apps/web/app/docs/[slug]/page.tsx`). 12 docs: introduction, quick-start, branding, smart-contracts, knowledge-base, chains, content-blocks, preview, embed, conversations, tickets, analytics.

When a product fact changes (chains, plans, limits), update BOTH systems plus the marketing FAQ (`apps/web/components/sections/FAQ.tsx`).

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
| `token_usage` | Per-message input/output token counts; aggregated by `admin_token_usage()` SQL function for the /admin cost cockpit (migration `20260706000003_token_usage.sql`) |

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
