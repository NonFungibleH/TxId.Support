# TxID Support

AI-powered Web3 support widget for DeFi protocols.

## Apps

| App | URL | Description |
|-----|-----|-------------|
| `apps/web` | txid.support | Marketing site |
| `apps/app` | app.txid.support | B2B Dashboard |
| `apps/docs` | docs.txid.support | Documentation |

## Packages

| Package | npm name | Description |
|---------|----------|-------------|
| `packages/ai` | `@txid/ai` | Claude streaming + RAG pipeline |
| `packages/blockchain` | `@txid/blockchain` | Moralis + block explorer integrations |
| `packages/ui` | `@txid/ui` | Shared UI components |
| `packages/widget` | `@txid/widget` | Embeddable JS widget |
| `packages/react` | `@txid/support` | React npm package |

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
