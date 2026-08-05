# TxID

AI support agent for DeFi protocols. Answers from the protocol's own documentation and live on-chain state, and records the conditions behind every answer.

## Apps

| App | URL | Description |
|-----|-----|-------------|
| `apps/web` | txid.support | Marketing site, and the live help centre at `/docs` |
| `apps/app` | app.txid.support | B2B dashboard, the widget, and every API route |
| `apps/docs` | not deployed | Standalone docs site. `docs.txid.support` does not resolve, so nothing here reaches a user. The live documentation is `apps/web/lib/docs.ts`. |

## Packages

| Package | npm name | Description |
|---------|----------|-------------|
| `packages/ai` | `@txid/ai` | Claude streaming, tools, RAG pipeline, prompt building |
| `packages/blockchain` | `@txid/blockchain` | EVM: Moralis, block explorers, transaction decoder |
| `packages/aptos` | `@txid/aptos` | Aptos: fullnode REST, Indexer GraphQL, Move abort decoding, protocol adapters |
| `packages/solana` | `@txid/solana` | Solana: Helius RPC and enhanced transactions. Paused in the interface |
| `packages/ui` | `@txid/ui` | Shared UI components |
| `packages/widget` | `@txid/widget` | Embeddable JS widget (stub: the shipping loader is `apps/app/public/widget.js`) |
| `packages/react` | `@txid/react` | React npm package |

## Setup

### Prerequisites

- Node >= 20
- pnpm >= 9
- Docker Desktop (for local Supabase)

### First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env vars and fill in real values
cp .env.example apps/app/.env.local
# Edit apps/app/.env.local with your Clerk and other API keys

# 3. Start local Supabase (requires Docker Desktop)
supabase start
supabase db reset

# 4. Generate TypeScript types from local schema
supabase gen types typescript --local > apps/app/lib/supabase/types.ts

# 5. Run dev servers
pnpm dev
```

### Dev ports

| App | Port |
|-----|------|
| apps/web | 3000 |
| apps/app | 3001 |
| apps/docs | 3002 |

## Database

- Local: `supabase start` (requires Docker)
- Reset + reseed: `supabase db reset`
- Regenerate types: `supabase gen types typescript --local > apps/app/lib/supabase/types.ts`

## Build

```bash
pnpm turbo run build
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Auth | Clerk v5 |
| Database | Supabase (Postgres + pgvector) |
| Styling | Tailwind CSS v3 + shadcn/ui |
| AI | Anthropic Claude API |
| Embeddings | Voyage AI (voyage-3, 1024 dims) |
| Blockchain | Moralis API |
| Monorepo | Turborepo + pnpm workspaces |
| Deployment | Vercel |
