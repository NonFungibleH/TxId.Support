# Phase 1: Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full TxID Support monorepo with Turborepo, configure all apps and shared packages, set up Supabase schema with migrations and pgvector, and establish environment variable conventions — giving every subsequent phase a clean foundation to build on.

**Architecture:** pnpm workspaces + Turborepo monorepo with three Next.js 14 apps (web, app, docs) and five shared packages (widget, react, ai, blockchain, ui). Supabase (Postgres + pgvector) for all persistence. Voyage AI (voyage-3, 1024 dims) for embeddings — cheaper than OpenAI, Anthropic's recommended partner.

**Tech Stack:** Node 20, pnpm 9, Turborepo 2, Next.js 14 (App Router), TypeScript 5, Tailwind CSS 3, shadcn/ui, Supabase (postgres + pgvector), Clerk, Voyage AI embeddings.

---

## Pre-flight checks

Before starting, confirm these are installed:
```bash
node --version   # must be >= 20
pnpm --version   # must be >= 9 (install: npm i -g pnpm)
```

Root directory for all work: `/Users/howardpearce/Projects/txid-support`

---

## Task 1: Initialise the monorepo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `tsconfig.base.json`
- Create: `.nvmrc`

- [ ] **Step 1.1: Initialise git and pnpm**

```bash
cd /Users/howardpearce/Projects/txid-support
git init
pnpm init
echo "20" > .nvmrc
```

- [ ] **Step 1.2: Write root package.json**

Replace the generated `package.json` with:

```json
{
  "name": "txid-support",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "prettier": "^3.2.0",
    "eslint": "^8.57.0"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 1.3: Write pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 1.4: Write turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 1.5: Write tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 1.6: Write .gitignore**

```
# Dependencies
node_modules
.pnpm-store

# Build outputs
.next
dist
.turbo
*.tsbuildinfo

# Supabase
supabase/.branches
supabase/.temp

# Env files
.env
.env.local
.env.*.local

# Misc
.DS_Store
*.log
.vercel
```

- [ ] **Step 1.7: Install root dependencies**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm install
```

Expected: `node_modules` created, lockfile generated.

- [ ] **Step 1.8: Commit**

```bash
git add .
git commit -m "chore: initialise monorepo with Turborepo and pnpm workspaces"
```

---

## Task 2: Scaffold shared packages (empty shells)

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/index.ts`
- Create: `packages/blockchain/package.json`
- Create: `packages/blockchain/tsconfig.json`
- Create: `packages/blockchain/src/index.ts`
- Create: `packages/widget/package.json`
- Create: `packages/widget/tsconfig.json`
- Create: `packages/widget/src/index.ts`
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/src/index.ts`

Each package follows the same pattern. Steps shown once; repeat for each.

- [ ] **Step 2.1: Create packages/ui**

```bash
mkdir -p /Users/howardpearce/Projects/txid-support/packages/ui/src
```

`packages/ui/package.json`:
```json
{
  "name": "@txid/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

`packages/ui/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

`packages/ui/src/index.ts`:
```ts
// Shared UI components — populated in Phase 3+
export {};
```

- [ ] **Step 2.2: Create packages/ai**

```bash
mkdir -p /Users/howardpearce/Projects/txid-support/packages/ai/src
```

`packages/ai/package.json`:
```json
{
  "name": "@txid/ai",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "voyageai": "^0.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

`packages/ai/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"]
  },
  "include": ["src"]
}
```

`packages/ai/src/index.ts`:
```ts
// AI package — Claude streaming + RAG pipeline — populated in Phase 2
export {};
```

- [ ] **Step 2.3: Create packages/blockchain**

```bash
mkdir -p /Users/howardpearce/Projects/txid-support/packages/blockchain/src
```

`packages/blockchain/package.json`:
```json
{
  "name": "@txid/blockchain",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "moralis": "^2.26.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

`packages/blockchain/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"]
  },
  "include": ["src"]
}
```

`packages/blockchain/src/index.ts`:
```ts
// Blockchain package — Moralis + explorer lookups — populated in Phase 2
export {};
```

- [ ] **Step 2.4: Create packages/widget**

```bash
mkdir -p /Users/howardpearce/Projects/txid-support/packages/widget/src
```

`packages/widget/package.json`:
```json
{
  "name": "@txid/widget",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.4.0"
  }
}
```

`packages/widget/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

`packages/widget/src/index.ts`:
```ts
// Embeddable widget — populated in Phase 3
export {};
```

- [ ] **Step 2.5: Create packages/react**

> **Note:** The directory is `packages/react` but the published npm package name is `@txid/support`. When using `pnpm --filter` in later phases, use `--filter @txid/support` to target this package.

```bash
mkdir -p /Users/howardpearce/Projects/txid-support/packages/react/src
```

`packages/react/package.json`:
```json
{
  "name": "@txid/support",
  "version": "0.0.1",
  "private": false,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

`packages/react/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

`packages/react/src/index.ts`:
```ts
// @txid/support React package — populated in Phase 6
export {};
```

- [ ] **Step 2.6: Install workspace dependencies**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm install
```

- [ ] **Step 2.7: Commit**

```bash
git add .
git commit -m "chore: scaffold shared packages (ai, blockchain, ui, widget, react)"
```

---

## Task 3: Scaffold Next.js apps

**Files:**
- Create: `apps/web/` — Marketing site (txid.support)
- Create: `apps/app/` — B2B Dashboard (app.txid.support)
- Create: `apps/docs/` — Docs site (docs.txid.support)

- [ ] **Step 3.1: Create apps/web (marketing site)**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm create next-app@14 apps/web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

- [ ] **Step 3.2: Update apps/web/package.json name**

Open `apps/web/package.json`, change the `"name"` field to `"@txid/web"`.

- [ ] **Step 3.3: Create apps/app (dashboard)**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm create next-app@14 apps/app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

Update `apps/app/package.json` name to `"@txid/app"`.

Then update `apps/app/package.json` `"dev"` script to run on port 3001:
```json
"dev": "next dev -p 3001"
```

- [ ] **Step 3.4: Create apps/docs (docs site)**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm create next-app@14 apps/docs \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

Update `apps/docs/package.json` name to `"@txid/docs"`.

Then update `apps/docs/package.json` `"dev"` script to run on port 3002:
```json
"dev": "next dev -p 3002"
```

- [ ] **Step 3.5: Verify all three apps build**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm install
pnpm turbo run build
```

Expected: All three apps build without errors. Warnings about missing env vars are fine.

- [ ] **Step 3.6: Verify dev servers start**

```bash
# In one terminal — confirm port 3000 responds
pnpm --filter @txid/web dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
kill %1
```

- [ ] **Step 3.7: Commit**

```bash
cd /Users/howardpearce/Projects/txid-support
git add apps/
git commit -m "chore: scaffold three Next.js 14 apps (web, app, docs)"
```

---

## Task 4: Install and configure shadcn/ui in apps/app

The dashboard (apps/app) needs shadcn/ui. The marketing site gets its own design treatment later.

- [ ] **Step 4.1: Initialise shadcn/ui in apps/app**

```bash
cd /Users/howardpearce/Projects/txid-support/apps/app
pnpm dlx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base colour: **Slate**
- CSS variables: **Yes**

- [ ] **Step 4.2: Install core components used across the dashboard**

```bash
cd /Users/howardpearce/Projects/txid-support/apps/app
pnpm dlx shadcn@latest add button input label card badge \
  tabs dialog sheet tooltip separator skeleton \
  dropdown-menu avatar progress switch select \
  form toast sonner
```

- [ ] **Step 4.3: Verify apps/app still builds**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm --filter @txid/app build
```

Expected: Build succeeds.

- [ ] **Step 4.4: Commit**

```bash
git add apps/app/
git commit -m "chore: install and configure shadcn/ui in dashboard app"
```

---

## Task 5: Install Clerk auth in apps/app

- [ ] **Step 5.1: Install Clerk packages**

```bash
cd /Users/howardpearce/Projects/txid-support/apps/app
pnpm add @clerk/nextjs
```

- [ ] **Step 5.2: Wrap app with ClerkProvider**

Open `apps/app/app/layout.tsx`. Replace the root layout with:

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TxID Support — Dashboard",
  description: "Configure your TxID Support widget",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 5.3: Create middleware for auth protection**

Create `apps/app/middleware.ts`:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 5.4: Create sign-in and sign-up pages**

Create `apps/app/app/sign-in/[[...sign-in]]/page.tsx`:
```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

Create `apps/app/app/sign-up/[[...sign-up]]/page.tsx`:
```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

- [ ] **Step 5.5: Add Clerk env vars to apps/app/.env.local**

Create `apps/app/.env.local`:
```
# Clerk — get these from https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
CLERK_SECRET_KEY=sk_test_placeholder
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

> **Note:** `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` are deprecated in Clerk v5. Pass redirect URLs as props on `<ClerkProvider>` instead. The layout already handles this — no env vars needed for redirects.

Update `apps/app/app/layout.tsx` to pass redirect URLs via props:

```tsx
<ClerkProvider
  afterSignInUrl="/dashboard"
  afterSignUpUrl="/onboarding"
>
```

- [ ] **Step 5.6: Type-check**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm --filter @txid/app type-check
```

Expected: No type errors.

- [ ] **Step 5.7: Commit**

```bash
git add apps/app/app/ apps/app/middleware.ts apps/app/package.json
git commit -m "feat: add Clerk auth with middleware and sign-in/sign-up pages"
```

> `.env.local` is intentionally excluded — it is git-ignored and must never be committed.

---

## Task 6: Set up Supabase project structure

**Files:**
- Create: `supabase/config.toml` *(generated by `supabase init` — do not write manually)*
- Create: `supabase/migrations/20260325000001_initial_schema.sql`
- Create: `supabase/migrations/20260325000002_rls_policies.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 6.1: Install Supabase CLI**

```bash
brew install supabase/tap/supabase
supabase --version
# Expected: supabase version >= 1.150.0
```

- [ ] **Step 6.2: Initialise Supabase in the monorepo**

```bash
cd /Users/howardpearce/Projects/txid-support
supabase init
```

This creates `supabase/config.toml`.

- [ ] **Step 6.3: Start local Supabase (requires Docker)**

```bash
supabase start
```

Wait for all services to start. Note the output — it will print:
- `API URL`: http://localhost:54321
- `anon key`: (local dev key)
- `service_role key`: (local dev key)
- `DB URL`: postgresql://postgres:postgres@localhost:54322/postgres

Save these for `.env.local` files.

- [ ] **Step 6.4: Write initial schema migration**

Create `supabase/migrations/20260325000001_initial_schema.sql`:

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- ============================================
-- ORGANISATIONS (Clerk org IDs map to these)
-- ============================================
create table organisations (
  id           uuid primary key default gen_random_uuid(),
  clerk_org_id text unique not null,
  name         text not null,
  logo_url     text,
  created_at   timestamptz not null default now()
);

-- ============================================
-- PROJECTS (one org can have multiple projects)
-- ============================================
create table projects (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  -- Public key — safe to expose in embed code
  publishable_key text unique not null default 'pk_' || replace(gen_random_uuid()::text, '-', ''),
  -- Secret key — never exposed publicly
  secret_key      text unique not null default 'sk_' || replace(gen_random_uuid()::text, '-', ''),
  widget_version  text not null default 'latest',
  is_active       boolean not null default true,
  -- All widget configuration stored as JSONB for schema flexibility
  config          jsonb not null default '{
    "branding": {
      "primaryColor": "#6366f1",
      "secondaryColor": "#4f46e5",
      "backgroundColor": "#0f0f0f",
      "textColor": "#ffffff",
      "font": "Inter",
      "logoUrl": null,
      "position": "bottom-right",
      "theme": "dark"
    },
    "token": null,
    "chains": ["0x1", "0x2105", "0x38", "0x89", "0xa4b1", "0xa"],
    "contentBlocks": [],
    "docsUrl": null,
    "allowedDomains": []
  }'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- ============================================
-- DOCUMENTS (RAG knowledge base per project)
-- Voyage AI voyage-3 = 1024 dimensions
-- ============================================
create table documents (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  content     text not null,
  -- voyage-3 produces 1024-dim vectors
  embedding   vector(1024),
  metadata    jsonb not null default '{}',
  source_url  text,
  created_at  timestamptz not null default now()
);

-- IVFFlat index for ANN search (build after data is loaded)
-- Run: CREATE INDEX documents_embedding_idx ON documents
--      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- after inserting at least 1000 rows.

-- ============================================
-- CONVERSATIONS
-- ============================================
create table conversations (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  wallet_address text,
  chain_id       text,
  session_id     text not null,
  created_at     timestamptz not null default now()
);

-- ============================================
-- MESSAGES
-- ============================================
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  -- 1 = thumbs up, -1 = thumbs down, 0 = no feedback
  feedback        smallint not null default 0 check (feedback in (-1, 0, 1)),
  created_at      timestamptz not null default now()
);

-- ============================================
-- RATE LIMITING (per project, per rolling window)
-- ============================================
create table rate_limits (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  window_start    timestamptz not null,
  conversation_count integer not null default 0,
  updated_at      timestamptz not null default now(),
  unique (project_id, window_start)
);

-- ============================================
-- DOCS INDEXING JOBS
-- ============================================
create table indexing_jobs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  source_url  text,
  status      text not null default 'pending' check (status in ('pending', 'running', 'complete', 'failed')),
  error       text,
  chunk_count integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger indexing_jobs_updated_at
  before update on indexing_jobs
  for each row execute function update_updated_at();

-- ============================================
-- INDEXES
-- ============================================
create index projects_org_id_idx on projects(org_id);
create index documents_project_id_idx on documents(project_id);
create index conversations_project_id_idx on conversations(project_id);
create index conversations_created_at_idx on conversations(created_at);
create index messages_conversation_id_idx on messages(conversation_id);
create index indexing_jobs_project_id_idx on indexing_jobs(project_id);
```

- [ ] **Step 6.5: Write RLS policies migration**

Create `supabase/migrations/20260325000002_rls_policies.sql`:

```sql
-- Enable RLS on all tables
alter table organisations    enable row level security;
alter table projects         enable row level security;
alter table documents        enable row level security;
alter table conversations    enable row level security;
alter table messages         enable row level security;
alter table rate_limits      enable row level security;
alter table indexing_jobs    enable row level security;

-- ============================================
-- SERVICE ROLE bypasses all RLS
-- (used by edge functions and server-side code)
-- ============================================

-- Organisations: users see only their own org
-- (Clerk org ID passed via JWT custom claim)
create policy "orgs_select_own" on organisations
  for select using (
    clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
  );

-- Projects: users see only their org's projects
create policy "projects_select_own_org" on projects
  for select using (
    org_id in (
      select id from organisations
      where clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
    )
  );

create policy "projects_insert_own_org" on projects
  for insert with check (
    org_id in (
      select id from organisations
      where clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
    )
  );

create policy "projects_update_own_org" on projects
  for update using (
    org_id in (
      select id from organisations
      where clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
    )
  );

-- Widget API: documents readable by publishable key (via service role edge function)
-- Edge functions use service role key — RLS bypassed. Public data served after key validation.

-- Conversations and messages: insert-only from widget (via service role edge function)
-- Dashboard reads via service role only.

-- Projects: allow users to delete their own org's projects
create policy "projects_delete_own_org" on projects
  for delete using (
    org_id in (
      select id from organisations
      where clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
    )
  );

-- Organisations: allow deletion of own org
create policy "orgs_delete_own" on organisations
  for delete using (
    clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
  );

-- Note: all widget-facing API calls go through Supabase Edge Functions using the
-- SERVICE_ROLE key. The anon key is never used in the widget path.
-- RLS above protects the dashboard (Clerk JWT) path only.
```

- [ ] **Step 6.6: Write seed data**

Create `supabase/seed.sql`:

```sql
-- Seed a demo organisation and project for local development
-- These IDs are stable for local dev only

insert into organisations (id, clerk_org_id, name)
values (
  '00000000-0000-0000-0000-000000000001',
  'org_demo_local',
  'TxID Support Demo'
) on conflict do nothing;

insert into projects (id, org_id, name, publishable_key, secret_key)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Demo Project',
  'pk_demo_local_key',
  'sk_demo_local_secret'
) on conflict do nothing;
```

- [ ] **Step 6.7: Apply migrations to local Supabase**

```bash
cd /Users/howardpearce/Projects/txid-support
supabase db reset
```

This runs all migrations from scratch and applies seed data. Expected output: "Finished supabase db reset."

- [ ] **Step 6.8: Verify schema in Supabase Studio**

Open http://localhost:54323 (Supabase Studio). Navigate to Table Editor. Verify these tables exist:
- organisations
- projects
- documents (with `embedding vector(1024)` column)
- conversations
- messages
- rate_limits
- indexing_jobs

- [ ] **Step 6.9: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema with pgvector, RLS policies, and seed data"
```

---

## Task 7: Install Supabase client in apps and packages

- [ ] **Step 7.1: Install Supabase packages**

```bash
cd /Users/howardpearce/Projects/txid-support

# Dashboard app (server + client components)
pnpm --filter @txid/app add @supabase/supabase-js @supabase/ssr

# AI package (server-side only)
pnpm --filter @txid/ai add @supabase/supabase-js

# Blockchain package (server-side only)
pnpm --filter @txid/blockchain add @supabase/supabase-js
```

- [ ] **Step 7.2: Create Supabase client utilities in apps/app**

Create `apps/app/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./types";

// Anon client — for authenticated dashboard routes (respects RLS via Clerk JWT)
export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — cookies are read-only in some contexts
          }
        },
      },
    }
  );
}

// Service client — bypasses RLS entirely. Only use in server actions and
// API routes where the caller has already been authorised.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

Create `apps/app/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 7.3: Generate TypeScript types from local schema**

```bash
cd /Users/howardpearce/Projects/txid-support
supabase gen types typescript --local > apps/app/lib/supabase/types.ts
```

Verify `apps/app/lib/supabase/types.ts` was created and contains `Database` type with all tables.

- [ ] **Step 7.4: Add Supabase env vars to apps/app/.env.local**

Append to `apps/app/.env.local` (get values from `supabase status` output):

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
```

Run `supabase status` to get the actual values.

- [ ] **Step 7.5: Type-check apps/app**

```bash
pnpm --filter @txid/app type-check
```

Expected: No errors.

- [ ] **Step 7.6: Commit**

```bash
git add apps/app/lib/
git commit -m "feat: add Supabase client utilities and generated TypeScript types"
```

> `.env.local` is git-ignored — never commit it. The generated `types.ts` should be committed as it is derived from the schema, not from secrets.

---

## Task 8: Root environment variables and .env.example

- [ ] **Step 8.1: Create root .env.example**

Create `/Users/howardpearce/Projects/txid-support/.env.example`:

```bash
# Anthropic
ANTHROPIC_API_KEY=

# Voyage AI (embeddings — https://www.voyageai.com/)
VOYAGE_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk — https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# Note: redirect URLs after sign-in/sign-up are set as props on <ClerkProvider> in layout.tsx
# Do NOT add NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL / AFTER_SIGN_UP_URL — deprecated in Clerk v5

# Blockchain
MORALIS_API_KEY=
ETHERSCAN_API_KEY=
BASESCAN_API_KEY=
BSCSCAN_API_KEY=

# DexScreener — no key required (public API)

# App URLs (local dev)
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_DOCS_URL=http://localhost:3002
NEXT_PUBLIC_WIDGET_URL=http://localhost:3003
```

- [ ] **Step 8.2: Update turbo.json to declare env vars**

Add `globalEnv` to `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": [
    "ANTHROPIC_API_KEY",
    "VOYAGE_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "MORALIS_API_KEY",
    "ETHERSCAN_API_KEY",
    "BASESCAN_API_KEY",
    "BSCSCAN_API_KEY",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_WEB_URL",
    "NEXT_PUBLIC_DOCS_URL",
    "NEXT_PUBLIC_WIDGET_URL"
  ],
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "dependsOn": ["^lint"] },
    "test": { "dependsOn": ["^build"] },
    "type-check": { "dependsOn": ["^build"] },
    "clean": { "cache": false }
  }
}
```

- [ ] **Step 8.3: Final build check**

```bash
cd /Users/howardpearce/Projects/txid-support
pnpm install
pnpm turbo run type-check
```

Expected: All packages type-check clean.

- [ ] **Step 8.4: Commit**

```bash
git add .env.example turbo.json
git commit -m "chore: add .env.example and declare env vars in turbo.json"
```

---

## Task 9: Vercel project configuration

- [ ] **Step 9.1: Create vercel.json for monorepo routing**

Create `vercel.json` at the monorepo root:

```json
{
  "framework": null,
  "buildCommand": "pnpm turbo run build",
  "installCommand": "pnpm install"
}
```

Note: Each app (web, app, docs) will be a separate Vercel project pointing to the monorepo root, with `Root Directory` set to `apps/web`, `apps/app`, and `apps/docs` respectively. This is configured in the Vercel dashboard, not in code.

- [ ] **Step 9.2: Add README.md with setup instructions**

Create `README.md`:

```markdown
# TxID Support

AI-powered Web3 support widget for DeFi protocols.

## Apps

| App | URL | Description |
|-----|-----|-------------|
| `apps/web` | txid.support | Marketing site |
| `apps/app` | app.txid.support | B2B Dashboard |
| `apps/docs` | docs.txid.support | Documentation |

## Packages

| Package | Description |
|---------|-------------|
| `packages/ai` | Claude streaming + RAG pipeline |
| `packages/blockchain` | Moralis + block explorer integrations |
| `packages/ui` | Shared UI components |
| `packages/widget` | Embeddable JS widget |
| `packages/react` | `@txid/support` React npm package |

## Setup

1. Install dependencies: `pnpm install`
2. Start Supabase: `supabase start`
3. Copy env vars: `cp .env.example apps/app/.env.local` and fill in values
4. Run dev: `pnpm dev`

## Database

- Local: `supabase start` (requires Docker)
- Reset: `supabase db reset`
- Generate types: `supabase gen types typescript --local > apps/app/lib/supabase/types.ts`
```

- [ ] **Step 9.3: Final commit**

```bash
cd /Users/howardpearce/Projects/txid-support
git add vercel.json README.md
git commit -m "chore: add vercel.json and project README"
```

---

## Phase 1 Complete — Verification Checklist

Run these to confirm Phase 1 is fully working before handing off to Phase 2:

```bash
cd /Users/howardpearce/Projects/txid-support

# 1. All packages type-check
pnpm turbo run type-check
# Expected: 0 errors across all packages

# 2. All apps build
pnpm turbo run build
# Expected: All three Next.js apps build successfully

# 3. Supabase schema is healthy
supabase db reset && supabase status
# Expected: Reset completes, all services running

# 4. Types are up to date
supabase gen types typescript --local | diff - apps/app/lib/supabase/types.ts
# Expected: No diff (types match schema)
```

---

## What Phase 2 Builds (next plan)

Phase 2 implements the two shared packages that everything else depends on:
- **`packages/blockchain`** — Moralis wallet history, tx lookup, chain detection
- **`packages/ai`** — Claude streaming chat, Voyage AI embeddings, RAG pipeline (vector search → context injection → streamed response)
