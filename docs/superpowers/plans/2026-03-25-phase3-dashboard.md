# Phase 3: B2B Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Save this file to:** `/Users/howardpearce/Projects/txid-support/.worktrees/phase-1/docs/superpowers/plans/2026-03-25-phase3-dashboard.md`

**Goal:** Build the full B2B dashboard at `app.txid.support` where protocol teams log in (via Clerk v5 orgs), configure their embeddable support widget, and manage smart contracts, branding, docs, chains, content, and embed settings.

**Architecture:** Next.js 14 App Router. All `/dashboard/*` routes are server components by default — client components only for interactive forms and state. Project config read/written via server actions using `createServiceClient()` (bypasses RLS). Clerk `auth()` provides `orgId` which maps to a Supabase `organisations` row and its first `projects` row. First-time users (no org/project) see a "Create your project" splash.

**Tech Stack:** All existing deps (Next.js 14, Tailwind v3, shadcn/ui v4, Clerk v5.7.5, Supabase, zod, react-hook-form) plus four new packages: `react-colorful`, `@dnd-kit/core`, `@dnd-kit/sortable`, `nanoid`.

**Worktree:** `/Users/howardpearce/Projects/txid-support/.worktrees/phase-1`

---

## Pre-flight checks

```bash
node --version   # >= 20
pnpm --version   # >= 9
```

Confirm `apps/app` builds cleanly before starting:
```bash
pnpm --filter @txid/app build
```

---

## File Map

### New migration
- `supabase/migrations/20260325000003_watched_contracts_default.sql`

### New types
- `apps/app/lib/types/config.ts`

### New server actions
- `apps/app/lib/actions/project.ts`
- `apps/app/lib/actions/contracts.ts`

### New dashboard components
- `apps/app/components/dashboard/Sidebar.tsx`
- `apps/app/components/dashboard/DashboardHeader.tsx`
- `apps/app/components/dashboard/WidgetPreview.tsx`
- `apps/app/components/dashboard/StatsCard.tsx`
- `apps/app/components/dashboard/ProjectProvider.tsx`

### New settings components
- `apps/app/components/settings/BrandingForm.tsx`
- `apps/app/components/settings/ColorPicker.tsx`
- `apps/app/components/settings/TokenForm.tsx`
- `apps/app/components/settings/ContractList.tsx`
- `apps/app/components/settings/AddContractDialog.tsx`
- `apps/app/components/settings/DocsForm.tsx`
- `apps/app/components/settings/ChainToggles.tsx`
- `apps/app/components/settings/ContentBlockEditor.tsx`
- `apps/app/components/settings/EmbedCodeDisplay.tsx`

### New/modified pages
- `apps/app/app/page.tsx` — already redirects to /dashboard (no change needed)
- `apps/app/app/dashboard/layout.tsx`
- `apps/app/app/dashboard/page.tsx`
- `apps/app/app/dashboard/branding/page.tsx`
- `apps/app/app/dashboard/token/page.tsx`
- `apps/app/app/dashboard/contracts/page.tsx`
- `apps/app/app/dashboard/docs/page.tsx`
- `apps/app/app/dashboard/chains/page.tsx`
- `apps/app/app/dashboard/content/page.tsx`
- `apps/app/app/dashboard/embed/page.tsx`
- `apps/app/app/dashboard/team/page.tsx`
- `apps/app/app/dashboard/analytics/page.tsx`

---

## Shared constants (referenced throughout)

These values appear across multiple files. Define them once in `apps/app/lib/types/config.ts` and import from there.

```typescript
export const SUPPORTED_CHAINS = [
  { id: "0x1",    name: "Ethereum",  explorer: "etherscan.io" },
  { id: "0x2105", name: "Base",      explorer: "basescan.org" },
  { id: "0x38",   name: "BNB Chain", explorer: "bscscan.com" },
  { id: "0x89",   name: "Polygon",   explorer: "polygonscan.com" },
  { id: "0xa4b1", name: "Arbitrum",  explorer: "arbiscan.io" },
  { id: "0xa",    name: "Optimism",  explorer: "optimistic.etherscan.io" },
] as const

export const SUPPORTED_FONTS = [
  "Inter", "Sora", "Space Mono", "DM Sans", "IBM Plex Mono", "Outfit",
] as const
```

---

## Task 1: Install new dependencies + migration + config types

**Files:**
- Modify: `apps/app/package.json` (via pnpm install)
- Create: `supabase/migrations/20260325000003_watched_contracts_default.sql`
- Create: `apps/app/lib/types/config.ts`

### Step 1.1 — Install packages

```bash
cd /Users/howardpearce/Projects/txid-support/.worktrees/phase-1
pnpm --filter @txid/app add react-colorful @dnd-kit/core @dnd-kit/sortable nanoid
```

### Step 1.2 — Write migration

Create `supabase/migrations/20260325000003_watched_contracts_default.sql`:

```sql
-- Add watchedContracts array to the default config for new projects.
-- Existing projects keep whatever config they already have;
-- use jsonb_set to backfill the key if it is missing.

alter table projects
  alter column config set default '{
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
    "allowedDomains": [],
    "watchedContracts": []
  }'::jsonb;

-- Backfill existing rows that don't have watchedContracts yet
update projects
set config = jsonb_set(config, '{watchedContracts}', '[]'::jsonb, true)
where config -> 'watchedContracts' is null;
```

### Step 1.3 — Write config types

Create `apps/app/lib/types/config.ts`:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Project config JSONB shape — mirrors the `config` column in `projects`
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_CHAINS = [
  { id: "0x1",    name: "Ethereum",  explorer: "etherscan.io" },
  { id: "0x2105", name: "Base",      explorer: "basescan.org" },
  { id: "0x38",   name: "BNB Chain", explorer: "bscscan.com" },
  { id: "0x89",   name: "Polygon",   explorer: "polygonscan.com" },
  { id: "0xa4b1", name: "Arbitrum",  explorer: "arbiscan.io" },
  { id: "0xa",    name: "Optimism",  explorer: "optimistic.etherscan.io" },
] as const

export type ChainId = (typeof SUPPORTED_CHAINS)[number]["id"]

export const SUPPORTED_FONTS = [
  "Inter",
  "Sora",
  "Space Mono",
  "DM Sans",
  "IBM Plex Mono",
  "Outfit",
] as const

export type SupportedFont = (typeof SUPPORTED_FONTS)[number]

// ── Branding ──────────────────────────────────────────────────────────────────

export interface BrandingConfig {
  primaryColor: string        // hex e.g. "#6366f1"
  secondaryColor: string
  backgroundColor: string
  textColor: string
  font: SupportedFont
  logoUrl: string | null
  position: "bottom-right" | "bottom-left" | "inline"
  theme: "dark" | "light"
}

// ── Token ─────────────────────────────────────────────────────────────────────

export interface TokenConfig {
  address: string
  chain: ChainId
  dexUrl: string | null
  symbol: string | null
  name: string | null
}

// ── Watched Contracts ─────────────────────────────────────────────────────────

export interface WatchedContract {
  id: string          // nanoid
  name: string        // e.g. "Token Lock Contract"
  address: string     // "0x..."
  chain: ChainId
  description: string // AI uses this as context
}

// ── Content Blocks ────────────────────────────────────────────────────────────

export type ContentBlockType =
  | "video"
  | "text"
  | "tokenomics"
  | "link"
  | "image"
  | "html"

export interface ContentBlock {
  id: string
  type: ContentBlockType
  title: string
  content: unknown
  order: number
}

// ── Root config ───────────────────────────────────────────────────────────────

export interface ProjectConfig {
  branding: BrandingConfig
  token: TokenConfig | null
  chains: ChainId[]
  contentBlocks: ContentBlock[]
  docsUrl: string | null
  allowedDomains: string[]
  watchedContracts: WatchedContract[]
}

// Default config — matches the migration default
export const DEFAULT_CONFIG: ProjectConfig = {
  branding: {
    primaryColor: "#6366f1",
    secondaryColor: "#4f46e5",
    backgroundColor: "#0f0f0f",
    textColor: "#ffffff",
    font: "Inter",
    logoUrl: null,
    position: "bottom-right",
    theme: "dark",
  },
  token: null,
  chains: ["0x1", "0x2105", "0x38", "0x89", "0xa4b1", "0xa"],
  contentBlocks: [],
  docsUrl: null,
  allowedDomains: [],
  watchedContracts: [],
}

// ── Zod schemas (for form validation) ────────────────────────────────────────
// Import zod lazily in components; these are just the TS shapes above.
// Zod schemas live inline in each form component to keep this file clean.
```

### Step 1.4 — Verify

```bash
pnpm --filter @txid/app build
```

### Step 1.5 — Commit

```bash
git add supabase/migrations/20260325000003_watched_contracts_default.sql \
        apps/app/lib/types/config.ts \
        apps/app/package.json \
        pnpm-lock.yaml
git commit -m "feat(app): add watchedContracts migration and config types"
```

---

## Task 2: Server actions — project + contracts

**Files:**
- Create: `apps/app/lib/actions/project.ts`
- Create: `apps/app/lib/actions/contracts.ts`

### Step 2.1 — Write `apps/app/lib/actions/project.ts`

```typescript
"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import { DEFAULT_CONFIG } from "@/lib/types/config"
import { revalidatePath } from "next/cache"

// ─────────────────────────────────────────────────────────────────────────────
// getProject
// Returns the first project for the authenticated org.
// Creates org row (upsert) and a default project if none exist yet.
// ─────────────────────────────────────────────────────────────────────────────

export async function getProject() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) throw new Error("Unauthenticated")

  const supabase = createServiceClient()

  // Upsert org — safe to call on every page load
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .upsert(
      { clerk_org_id: orgId, name: "My Protocol" },
      { onConflict: "clerk_org_id" }
    )
    .select()
    .single()

  if (orgError || !org) throw new Error(`Org upsert failed: ${orgError?.message}`)

  // Get first project for this org
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at")
    .limit(1)
    .maybeSingle()

  // First-time user — return null so the page can show "Create project" splash
  return { org, project: project ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// createProject
// Called from the "Create your project" splash form.
// ─────────────────────────────────────────────────────────────────────────────

export async function createProject(name: string) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) throw new Error("Unauthenticated")

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organisations")
    .upsert(
      { clerk_org_id: orgId, name: "My Protocol" },
      { onConflict: "clerk_org_id" }
    )
    .select()
    .single()

  if (!org) throw new Error("Could not resolve organisation")

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: org.id,
      name,
      config: DEFAULT_CONFIG as unknown as import("@/lib/supabase/types").Json,
    })
    .select()
    .single()

  if (error || !project) throw new Error(`Create project failed: ${error?.message}`)

  revalidatePath("/dashboard")
  return project
}

// ─────────────────────────────────────────────────────────────────────────────
// updateConfig
// Merges a partial config update into the existing JSONB.
// Uses jsonb_set via RPC for atomic update (avoids race conditions).
// For simplicity we read-modify-write here; upgrade to RPC if needed.
// ─────────────────────────────────────────────────────────────────────────────

export async function updateConfig(
  projectId: string,
  partial: Partial<ProjectConfig>
) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) throw new Error("Unauthenticated")

  const supabase = createServiceClient()

  // Fetch current config first
  const { data: current, error: fetchError } = await supabase
    .from("projects")
    .select("config, org_id")
    .eq("id", projectId)
    .single()

  if (fetchError || !current) throw new Error("Project not found")

  // Verify ownership — org_id must match
  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgId)
    .single()

  if (!org || current.org_id !== org.id) throw new Error("Forbidden")

  const merged = {
    ...(current.config as unknown as ProjectConfig),
    ...partial,
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ config: merged as unknown as import("@/lib/supabase/types").Json })
    .eq("id", projectId)

  if (updateError) throw new Error(`Update failed: ${updateError.message}`)

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/branding`)
  revalidatePath(`/dashboard/token`)
  revalidatePath(`/dashboard/contracts`)
  revalidatePath(`/dashboard/docs`)
  revalidatePath(`/dashboard/chains`)
  revalidatePath(`/dashboard/content`)
}

// ─────────────────────────────────────────────────────────────────────────────
// toggleActive
// Pauses / resumes the widget
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleActive(projectId: string, isActive: boolean) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) throw new Error("Unauthenticated")

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgId)
    .single()

  if (!org) throw new Error("Org not found")

  const { error } = await supabase
    .from("projects")
    .update({ is_active: isActive })
    .eq("id", projectId)
    .eq("org_id", org.id)

  if (error) throw new Error(error.message)

  revalidatePath("/dashboard")
}
```

### Step 2.2 — Write `apps/app/lib/actions/contracts.ts`

```typescript
"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ProjectConfig, WatchedContract } from "@/lib/types/config"

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────────────────────

const AddContractSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid 0x address"),
  chain: z.string().min(1, "Chain is required"),
  description: z.string().min(1, "Description is required").max(500),
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function resolveProjectWithOwnership(projectId: string) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) throw new Error("Unauthenticated")

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgId)
    .single()

  if (!org) throw new Error("Org not found")

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, config, org_id")
    .eq("id", projectId)
    .eq("org_id", org.id)
    .single()

  if (error || !project) throw new Error("Project not found or forbidden")

  return { supabase, project }
}

// ─────────────────────────────────────────────────────────────────────────────
// addContract
// ─────────────────────────────────────────────────────────────────────────────

export async function addContract(
  projectId: string,
  input: {
    name: string
    address: string
    chain: string
    description: string
  }
) {
  const parsed = AddContractSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0].message)
  }

  const { supabase, project } = await resolveProjectWithOwnership(projectId)

  const config = project.config as unknown as ProjectConfig
  const existing = config.watchedContracts ?? []

  if (existing.length >= 20) {
    throw new Error("Maximum of 20 watched contracts per project")
  }

  const newContract: WatchedContract = {
    id: nanoid(),
    name: parsed.data.name,
    address: parsed.data.address.toLowerCase(),
    chain: parsed.data.chain as WatchedContract["chain"],
    description: parsed.data.description,
  }

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: [...existing, newContract],
  }

  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as import("@/lib/supabase/types").Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)

  revalidatePath("/dashboard/contracts")
  return newContract
}

// ─────────────────────────────────────────────────────────────────────────────
// removeContract
// ─────────────────────────────────────────────────────────────────────────────

export async function removeContract(projectId: string, contractId: string) {
  const { supabase, project } = await resolveProjectWithOwnership(projectId)

  const config = project.config as unknown as ProjectConfig
  const updated: ProjectConfig = {
    ...config,
    watchedContracts: (config.watchedContracts ?? []).filter(
      (c) => c.id !== contractId
    ),
  }

  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as import("@/lib/supabase/types").Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)

  revalidatePath("/dashboard/contracts")
}
```

### Step 2.3 — Verify

```bash
pnpm --filter @txid/app build
```

### Step 2.4 — Commit

```bash
git add apps/app/lib/actions/
git commit -m "feat(app): add project and contracts server actions"
```

---

## Task 3: Dashboard layout — sidebar, header, shell

**Files:**
- Create: `apps/app/app/dashboard/layout.tsx`
- Create: `apps/app/components/dashboard/Sidebar.tsx`
- Create: `apps/app/components/dashboard/DashboardHeader.tsx`
- Note: `apps/app/app/page.tsx` already redirects to `/dashboard` — no change needed.

### Step 3.1 — Write `apps/app/components/dashboard/Sidebar.tsx`

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Paintbrush,
  Coins,
  FileCode2,
  BookOpen,
  Link2,
  LayoutList,
  Code2,
  BarChart3,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard",           label: "Overview",        icon: LayoutDashboard },
  { href: "/dashboard/branding",  label: "Branding",        icon: Paintbrush },
  { href: "/dashboard/token",     label: "Token",           icon: Coins },
  { href: "/dashboard/contracts", label: "Smart Contracts", icon: FileCode2 },
  { href: "/dashboard/docs",      label: "Docs & KB",       icon: BookOpen },
  { href: "/dashboard/chains",    label: "Chains",          icon: Link2 },
  { href: "/dashboard/content",   label: "Content",         icon: LayoutList },
  { href: "/dashboard/embed",     label: "Embed",           icon: Code2 },
  { href: "/dashboard/analytics", label: "Analytics",       icon: BarChart3 },
  { href: "/dashboard/team",      label: "Team",            icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">TX</span>
        </div>
        <span className="font-semibold text-sm">TxID Support</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          // Exact match for overview, prefix match for everything else
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">app.txid.support</p>
      </div>
    </aside>
  )
}
```

### Step 3.2 — Write `apps/app/components/dashboard/DashboardHeader.tsx`

```tsx
import { auth, currentUser } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"

export async function DashboardHeader({ orgName }: { orgName: string }) {
  return (
    <header className="fixed inset-x-0 left-60 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <p className="text-sm font-medium text-foreground">{orgName}</p>
      <UserButton afterSignOutUrl="/sign-in" />
    </header>
  )
}
```

### Step 3.3 — Write `apps/app/app/dashboard/layout.tsx`

```tsx
import { Sidebar } from "@/components/dashboard/Sidebar"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { org } = await getProject()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <DashboardHeader orgName={org.name} />
      <main className="ml-60 mt-14 p-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
```

### Step 3.4 — Verify

```bash
pnpm --filter @txid/app build
```

### Step 3.5 — Commit

```bash
git add apps/app/app/dashboard/layout.tsx \
        apps/app/components/dashboard/Sidebar.tsx \
        apps/app/components/dashboard/DashboardHeader.tsx
git commit -m "feat(app): add dashboard layout with sidebar and header"
```

---

## Task 4: Overview page

**Files:**
- Create: `apps/app/components/dashboard/StatsCard.tsx`
- Create: `apps/app/components/dashboard/ProjectProvider.tsx`
- Create: `apps/app/app/dashboard/page.tsx`

### Step 4.1 — Write `apps/app/components/dashboard/StatsCard.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
}

export function StatsCard({ title, value, description, icon: Icon }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
```

### Step 4.2 — Write `apps/app/components/dashboard/ProjectProvider.tsx`

This client-side context allows child components to read and optimistically update the project config without a page reload.

```tsx
"use client"

import React, { createContext, useContext, useState } from "react"
import type { ProjectConfig } from "@/lib/types/config"

interface ProjectContextValue {
  projectId: string
  config: ProjectConfig
  setConfig: (config: ProjectConfig) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({
  projectId,
  initialConfig,
  children,
}: {
  projectId: string
  initialConfig: ProjectConfig
  children: React.ReactNode
}) {
  const [config, setConfig] = useState<ProjectConfig>(initialConfig)

  return (
    <ProjectContext.Provider value={{ projectId, config, setConfig }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProject must be used within ProjectProvider")
  return ctx
}
```

### Step 4.3 — Write `apps/app/app/dashboard/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  MessageSquare,
  Users,
  Zap,
  Globe,
  ArrowRight,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import type { ProjectConfig } from "@/lib/types/config"

export default async function DashboardPage() {
  const { org, project } = await getProject()

  // First-time user — no project yet
  if (!project) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Zap className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Welcome to TxID Support</h1>
          <p className="mt-2 text-muted-foreground max-w-md">
            You don't have a project yet. Create one to start configuring your
            embeddable support widget.
          </p>
        </div>
        {/* CreateProjectForm is a small client component — inline here for brevity */}
        <CreateProjectButton orgId={org.id} />
      </div>
    )
  }

  const supabase = createServiceClient()

  // Fetch stats in parallel
  const [convResult, msgResult, docsResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in(
        "conversation_id",
        // sub-select would be cleaner; approximate here
        []
      ),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id),
  ])

  const config = project.config as unknown as ProjectConfig

  const QUICK_LINKS = [
    { href: "/dashboard/branding",  label: "Configure branding",  desc: "Colors, fonts, widget position" },
    { href: "/dashboard/token",     label: "Add your token",      desc: "Address, chain, DEX link" },
    { href: "/dashboard/contracts", label: "Watched contracts",   desc: "Smart contracts for AI lookup" },
    { href: "/dashboard/docs",      label: "Upload docs",         desc: "Feed the AI knowledge base" },
    { href: "/dashboard/embed",     label: "Get embed code",      desc: "Drop the widget in minutes" },
  ]

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {project.publishable_key}
          </p>
        </div>
        <Badge variant={project.is_active ? "default" : "secondary"}>
          {project.is_active ? "Live" : "Paused"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard
          title="Conversations"
          value={convResult.count ?? 0}
          description="All time"
          icon={MessageSquare}
        />
        <StatsCard
          title="Users helped"
          value={convResult.count ?? 0}
          description="Unique sessions"
          icon={Users}
        />
        <StatsCard
          title="Knowledge docs"
          value={docsResult.count ?? 0}
          description="Indexed chunks"
          icon={Globe}
        />
        <StatsCard
          title="Chains enabled"
          value={config.chains.length}
          description={`of 6 supported`}
          icon={Zap}
        />
      </div>

      {/* Quick setup links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {QUICK_LINKS.map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-accent/50 transition-colors"
            >
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Inline client component for the "Create project" splash
// (small enough to not need its own file)
import { createProject } from "@/lib/actions/project"

function CreateProjectButton({ orgId }: { orgId: string }) {
  // Simple form action — name defaults to the org name for now
  async function action(formData: FormData) {
    "use server"
    const name = String(formData.get("name") || "My Project")
    await createProject(name)
  }

  return (
    <form action={action} className="flex flex-col gap-3 w-64">
      <input
        name="name"
        placeholder="Project name (e.g. My Protocol)"
        className="h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring"
        required
      />
      <Button type="submit" className="w-full">
        Create project
      </Button>
    </form>
  )
}
```

### Step 4.4 — Verify

```bash
pnpm --filter @txid/app build
```

### Step 4.5 — Commit

```bash
git add apps/app/app/dashboard/page.tsx \
        apps/app/components/dashboard/StatsCard.tsx \
        apps/app/components/dashboard/ProjectProvider.tsx
git commit -m "feat(app): add dashboard overview page with stats"
```

---

## Task 5: Branding page

**Files:**
- Create: `apps/app/components/settings/ColorPicker.tsx`
- Create: `apps/app/components/settings/BrandingForm.tsx`
- Create: `apps/app/app/dashboard/branding/page.tsx`

### Step 5.1 — Write `apps/app/components/settings/ColorPicker.tsx`

```tsx
"use client"

import { HexColorPicker, HexColorInput } from "react-colorful"
import { useState } from "react"
import { Popover } from "@base-ui/react/popover"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label: string
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-3">
      <Popover.Root>
        <Popover.Trigger className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
          <span
            className="inline-block size-4 rounded-sm border border-border"
            style={{ backgroundColor: value }}
          />
          <span className="font-mono text-xs">{value}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6}>
            <Popover.Popup className="z-50 rounded-xl border border-border bg-popover p-3 shadow-lg">
              <HexColorPicker color={value} onChange={onChange} />
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">#</span>
                <HexColorInput
                  color={value}
                  onChange={onChange}
                  prefixed={false}
                  className="h-7 w-24 rounded-md border border-input bg-transparent px-2 text-xs font-mono outline-none focus:border-ring"
                />
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
```

> **Note on Popover:** `@base-ui/react/popover` is already a transitive dep from the existing dialog/tooltip components. If it isn't available, swap the Popover for a simple inline `details` element or a `useState`-controlled div — the color picker itself doesn't require it.

### Step 5.2 — Write `apps/app/components/settings/BrandingForm.tsx`

```tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "./ColorPicker"
import { updateConfig } from "@/lib/actions/project"
import type { BrandingConfig, ProjectConfig } from "@/lib/types/config"
import { SUPPORTED_FONTS } from "@/lib/types/config"

const schema = z.object({
  primaryColor:     z.string().min(1),
  secondaryColor:   z.string().min(1),
  backgroundColor:  z.string().min(1),
  textColor:        z.string().min(1),
  font:             z.enum(SUPPORTED_FONTS),
  position:         z.enum(["bottom-right", "bottom-left", "inline"]),
  theme:            z.enum(["dark", "light"]),
})

type FormValues = z.infer<typeof schema>

interface BrandingFormProps {
  projectId: string
  initial: BrandingConfig
}

export function BrandingForm({ projectId, initial }: BrandingFormProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      primaryColor:    initial.primaryColor,
      secondaryColor:  initial.secondaryColor,
      backgroundColor: initial.backgroundColor,
      textColor:       initial.textColor,
      font:            initial.font,
      position:        initial.position,
      theme:           initial.theme,
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await updateConfig(projectId, {
          branding: {
            ...initial,
            ...values,
          },
        })
        toast.success("Branding saved")
      } catch (err) {
        toast.error("Failed to save branding")
      }
    })
  }

  const watchedValues = form.watch()

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Colors */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Colours</h3>
          {(
            [
              ["primaryColor",    "Primary"],
              ["secondaryColor",  "Secondary"],
              ["backgroundColor", "Background"],
              ["textColor",       "Text"],
            ] as const
          ).map(([field, label]) => (
            <FormField
              key={field}
              control={form.control}
              name={field}
              render={({ field: f }) => (
                <FormItem className="flex items-center justify-between space-y-0">
                  <FormLabel className="w-32 shrink-0">{label}</FormLabel>
                  <FormControl>
                    <ColorPicker
                      label=""
                      value={f.value}
                      onChange={f.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        {/* Font */}
        <FormField
          control={form.control}
          name="font"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Font</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SUPPORTED_FONTS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Position */}
        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Widget position</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom right</SelectItem>
                  <SelectItem value="bottom-left">Bottom left</SelectItem>
                  <SelectItem value="inline">Inline</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Theme */}
        <FormField
          control={form.control}
          name="theme"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Theme</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save branding"}
        </Button>
      </form>
    </Form>
  )
}
```

### Step 5.3 — Write `apps/app/app/dashboard/branding/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { BrandingForm } from "@/components/settings/BrandingForm"
import type { ProjectConfig } from "@/lib/types/config"

export default async function BrandingPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const config = project.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customise how your support widget looks.
        </p>
      </div>
      <BrandingForm projectId={project.id} initial={config.branding} />
    </div>
  )
}
```

### Step 5.4 — Verify

```bash
pnpm --filter @txid/app build
```

### Step 5.5 — Commit

```bash
git add apps/app/components/settings/ColorPicker.tsx \
        apps/app/components/settings/BrandingForm.tsx \
        apps/app/app/dashboard/branding/
git commit -m "feat(app): add branding settings page with color picker"
```

---

## Task 6: Token settings page

**Files:**
- Create: `apps/app/components/settings/TokenForm.tsx`
- Create: `apps/app/app/dashboard/token/page.tsx`

### Step 6.1 — Write `apps/app/components/settings/TokenForm.tsx`

```tsx
"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { updateConfig } from "@/lib/actions/project"
import type { TokenConfig } from "@/lib/types/config"
import { SUPPORTED_CHAINS } from "@/lib/types/config"

const schema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid address").or(z.literal("")),
  chain:   z.string().min(1, "Select a chain"),
  symbol:  z.string().max(10).nullable().optional(),
  name:    z.string().max(80).nullable().optional(),
  dexUrl:  z.string().url("Must be a valid URL").or(z.literal("")).nullable().optional(),
})

type FormValues = z.infer<typeof schema>

export function TokenForm({
  projectId,
  initial,
}: {
  projectId: string
  initial: TokenConfig | null
}) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      address: initial?.address ?? "",
      chain:   initial?.chain   ?? "",
      symbol:  initial?.symbol  ?? "",
      name:    initial?.name    ?? "",
      dexUrl:  initial?.dexUrl  ?? "",
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        const token: TokenConfig | null = values.address
          ? {
              address: values.address,
              chain:   values.chain as TokenConfig["chain"],
              symbol:  values.symbol ?? null,
              name:    values.name   ?? null,
              dexUrl:  values.dexUrl ?? null,
            }
          : null

        await updateConfig(projectId, { token })
        toast.success("Token settings saved")
      } catch {
        toast.error("Failed to save token settings")
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Token address</FormLabel>
              <FormControl>
                <Input placeholder="0x..." className="font-mono" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormDescription>Leave blank to remove token config.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="chain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chain</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select chain" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SUPPORTED_CHAINS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="symbol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ticker symbol</FormLabel>
                <FormControl>
                  <Input placeholder="ETH" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Token name</FormLabel>
                <FormControl>
                  <Input placeholder="Ethereum" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="dexUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DEX URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://app.uniswap.org/..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Direct link to your token on a DEX. Shown as "Buy" in the widget.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save token"}
        </Button>
      </form>
    </Form>
  )
}
```

### Step 6.2 — Write `apps/app/app/dashboard/token/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { TokenForm } from "@/components/settings/TokenForm"
import type { ProjectConfig } from "@/lib/types/config"

export default async function TokenPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const config = project.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Token</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell the widget about your project's token.
        </p>
      </div>
      <TokenForm projectId={project.id} initial={config.token} />
    </div>
  )
}
```

### Step 6.3 — Verify + Commit

```bash
pnpm --filter @txid/app build
git add apps/app/components/settings/TokenForm.tsx \
        apps/app/app/dashboard/token/
git commit -m "feat(app): add token settings page"
```

---

## Task 7: Smart Contracts page

**Files:**
- Create: `apps/app/components/settings/ContractList.tsx`
- Create: `apps/app/components/settings/AddContractDialog.tsx`
- Create: `apps/app/app/dashboard/contracts/page.tsx`

### Step 7.1 — Write `apps/app/components/settings/AddContractDialog.tsx`

```tsx
"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { addContract } from "@/lib/actions/contracts"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import { PlusIcon } from "lucide-react"

const schema = z.object({
  name:        z.string().min(1, "Name is required").max(80),
  address:     z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid 0x address"),
  chain:       z.string().min(1, "Select a chain"),
  description: z.string().min(1, "Description is required").max(500),
})

type FormValues = z.infer<typeof schema>

interface AddContractDialogProps {
  projectId: string
  onAdded: () => void
}

export function AddContractDialog({ projectId, onAdded }: AddContractDialogProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", address: "", chain: "", description: "" },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await addContract(projectId, values)
        toast.success(`Contract "${values.name}" added`)
        form.reset()
        onAdded()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to add contract"
        toast.error(msg)
      }
    })
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button>
            <PlusIcon className="size-4" />
            Add contract
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add watched contract</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Token Lock Contract" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract address</FormLabel>
                  <FormControl>
                    <Input placeholder="0x..." className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chain</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select chain" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUPPORTED_CHAINS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none resize-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                      placeholder="Users can check if their token is locked here. The AI uses this to answer lock-related questions."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Explain what this contract does so the AI can use it as context.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter showCloseButton>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding…" : "Add contract"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 7.2 — Write `apps/app/components/settings/ContractList.tsx`

```tsx
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { removeContract } from "@/lib/actions/contracts"
import type { WatchedContract } from "@/lib/types/config"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import { AddContractDialog } from "./AddContractDialog"
import { Trash2Icon, ExternalLinkIcon } from "lucide-react"

interface ContractListProps {
  projectId: string
  initial: WatchedContract[]
}

export function ContractList({ projectId, initial }: ContractListProps) {
  // Optimistic local state — server revalidation will sync on next navigation
  const [contracts, setContracts] = useState<WatchedContract[]>(initial)
  const [pendingDelete, startDelete] = useTransition()

  function chainName(id: string) {
    return SUPPORTED_CHAINS.find((c) => c.id === id)?.name ?? id
  }

  function chainExplorer(id: string) {
    return SUPPORTED_CHAINS.find((c) => c.id === id)?.explorer ?? ""
  }

  function handleDelete(contractId: string) {
    startDelete(async () => {
      try {
        setContracts((prev) => prev.filter((c) => c.id !== contractId))
        await removeContract(projectId, contractId)
        toast.success("Contract removed")
      } catch {
        toast.error("Failed to remove contract")
        // Re-fetch would happen on next navigation via revalidatePath
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {contracts.length} / 20 contracts
        </p>
        <AddContractDialog
          projectId={projectId}
          onAdded={() => {
            // The server action calls revalidatePath — next navigation will
            // pick up the new row. For immediate UX, refetch via router.refresh
            // is an option; for now we rely on the Sonner toast.
          }}
        />
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No contracts added yet. Add a contract so the AI can look it up.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {contracts.map((contract, i) => {
            const explorer = chainExplorer(contract.chain)
            const explorerUrl = explorer
              ? `https://${explorer}/address/${contract.address}`
              : null

            return (
              <div key={contract.id} className="flex items-start gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{contract.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {chainName(contract.chain)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {contract.address}
                    </span>
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {contract.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(contract.id)}
                  disabled={pendingDelete}
                  className="shrink-0 text-destructive hover:text-destructive"
                >
                  <Trash2Icon className="size-4" />
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

### Step 7.3 — Write `apps/app/app/dashboard/contracts/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { ContractList } from "@/components/settings/ContractList"
import type { ProjectConfig } from "@/lib/types/config"

export default async function ContractsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const config = project.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Smart Contracts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add contract addresses so the AI can look them up when users ask about
          token locks, staking, liquidity, or anything contract-related.
        </p>
      </div>
      <ContractList
        projectId={project.id}
        initial={config.watchedContracts ?? []}
      />
    </div>
  )
}
```

### Step 7.4 — Verify + Commit

```bash
pnpm --filter @txid/app build
git add apps/app/components/settings/ContractList.tsx \
        apps/app/components/settings/AddContractDialog.tsx \
        apps/app/app/dashboard/contracts/
git commit -m "feat(app): add Smart Contracts page with add/remove"
```

---

## Task 8: Docs + Chains pages

**Files:**
- Create: `apps/app/components/settings/DocsForm.tsx`
- Create: `apps/app/components/settings/ChainToggles.tsx`
- Create: `apps/app/app/dashboard/docs/page.tsx`
- Create: `apps/app/app/dashboard/chains/page.tsx`

### Step 8.1 — Write `apps/app/components/settings/DocsForm.tsx`

```tsx
"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateConfig } from "@/lib/actions/project"

const schema = z.object({
  docsUrl: z.string().url("Must be a valid URL").or(z.literal("")),
})

type FormValues = z.infer<typeof schema>

export function DocsForm({
  projectId,
  initial,
}: {
  projectId: string
  initial: string | null
}) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { docsUrl: initial ?? "" },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await updateConfig(projectId, {
          docsUrl: values.docsUrl || null,
        })
        toast.success("Docs URL saved — indexing will start shortly")
      } catch {
        toast.error("Failed to save docs URL")
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="docsUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Docs URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://docs.yourprotocol.xyz"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The root URL of your documentation site. TxID will crawl and
                index it for the AI knowledge base. Sitemap-based crawling
                is used when available.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* File upload stub — Phase 5 */}
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Direct file upload (PDF, Markdown, TXT) — coming in Phase 5
          </p>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save docs URL"}
        </Button>
      </form>
    </Form>
  )
}
```

### Step 8.2 — Write `apps/app/components/settings/ChainToggles.tsx`

```tsx
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateConfig } from "@/lib/actions/project"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import type { ChainId } from "@/lib/types/config"

interface ChainTogglesProps {
  projectId: string
  initial: ChainId[]
}

export function ChainToggles({ projectId, initial }: ChainTogglesProps) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initial))
  const [isPending, startTransition] = useTransition()

  function toggle(id: string) {
    setEnabled((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, {
          chains: Array.from(enabled) as ChainId[],
        })
        toast.success("Chain settings saved")
      } catch {
        toast.error("Failed to save chain settings")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-border rounded-xl border border-border">
        {SUPPORTED_CHAINS.map(({ id, name, explorer }) => (
          <div key={id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Label htmlFor={`chain-${id}`} className="text-sm font-medium cursor-pointer">
                {name}
              </Label>
              <p className="text-xs text-muted-foreground">{explorer}</p>
            </div>
            <Switch
              id={`chain-${id}`}
              checked={enabled.has(id)}
              onCheckedChange={() => toggle(id)}
            />
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save chains"}
      </Button>
    </div>
  )
}
```

### Step 8.3 — Write `apps/app/app/dashboard/docs/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { DocsForm } from "@/components/settings/DocsForm"
import { createServiceClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import type { ProjectConfig } from "@/lib/types/config"

export default async function DocsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const supabase = createServiceClient()
  const { count: docCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)

  const { data: recentJobs } = await supabase
    .from("indexing_jobs")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(5)

  const config = project.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Docs & Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Feed your docs to the AI — it'll answer questions from them.
          </p>
        </div>
        <Badge variant="secondary">{docCount ?? 0} chunks indexed</Badge>
      </div>

      <DocsForm projectId={project.id} initial={config.docsUrl} />

      {/* Indexing job history */}
      {recentJobs && recentJobs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Recent indexing jobs</h2>
          <div className="divide-y divide-border rounded-xl border border-border">
            {recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between px-4 py-2">
                <span className="font-mono text-xs text-muted-foreground truncate max-w-xs">
                  {job.source_url ?? "—"}
                </span>
                <div className="flex items-center gap-2">
                  {job.chunk_count != null && (
                    <span className="text-xs text-muted-foreground">
                      {job.chunk_count} chunks
                    </span>
                  )}
                  <Badge
                    variant={
                      job.status === "complete"
                        ? "default"
                        : job.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {job.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

### Step 8.4 — Write `apps/app/app/dashboard/chains/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { ChainToggles } from "@/components/settings/ChainToggles"
import type { ProjectConfig } from "@/lib/types/config"

export default async function ChainsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const config = project.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chains</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select which chains your protocol supports. The widget will use this
          list to resolve wallet addresses and contract lookups.
        </p>
      </div>
      <ChainToggles projectId={project.id} initial={config.chains} />
    </div>
  )
}
```

### Step 8.5 — Verify + Commit

```bash
pnpm --filter @txid/app build
git add apps/app/components/settings/DocsForm.tsx \
        apps/app/components/settings/ChainToggles.tsx \
        apps/app/app/dashboard/docs/ \
        apps/app/app/dashboard/chains/
git commit -m "feat(app): add Docs and Chains settings pages"
```

---

## Task 9: Content builder page

**Files:**
- Create: `apps/app/components/settings/ContentBlockEditor.tsx`
- Create: `apps/app/app/dashboard/content/page.tsx`

### Step 9.1 — Write `apps/app/components/settings/ContentBlockEditor.tsx`

This component uses `@dnd-kit` for drag-to-reorder. Each block has a type, title, and freeform content. For now content is stored as a string; structured types (e.g. video embeds) can be expanded in Phase 5.

```tsx
"use client"

import { useState, useTransition } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { nanoid } from "nanoid"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { updateConfig } from "@/lib/actions/project"
import type { ContentBlock, ContentBlockType } from "@/lib/types/config"
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react"

const BLOCK_TYPES: { value: ContentBlockType; label: string }[] = [
  { value: "text",       label: "Text" },
  { value: "video",      label: "Video" },
  { value: "link",       label: "Link" },
  { value: "image",      label: "Image" },
  { value: "tokenomics", label: "Tokenomics" },
  { value: "html",       label: "HTML" },
]

// ── Sortable row ──────────────────────────────────────────────────────────────

function SortableBlock({
  block,
  onRemove,
  onUpdate,
}: {
  block: ContentBlock
  onRemove: (id: string) => void
  onUpdate: (id: string, partial: Partial<ContentBlock>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab touch-none text-muted-foreground"
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Select
            defaultValue={block.type}
            onValueChange={(v) => onUpdate(block.id, { type: v as ContentBlockType })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_TYPES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Block title"
            defaultValue={block.title}
            onBlur={(e) => onUpdate(block.id, { title: e.target.value })}
            className="flex-1"
          />
        </div>
        <textarea
          className="min-h-16 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none resize-y focus:border-ring"
          placeholder="Block content (URL, text, HTML…)"
          defaultValue={typeof block.content === "string" ? block.content : ""}
          onBlur={(e) => onUpdate(block.id, { content: e.target.value })}
        />
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onRemove(block.id)}
        className="mt-1 text-destructive hover:text-destructive shrink-0"
      >
        <Trash2Icon className="size-4" />
      </Button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ContentBlockEditorProps {
  projectId: string
  initial: ContentBlock[]
}

export function ContentBlockEditor({ projectId, initial }: ContentBlockEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(
    [...initial].sort((a, b) => a.order - b.order)
  )
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setBlocks((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      return arrayMove(items, oldIndex, newIndex).map((b, i) => ({
        ...b,
        order: i,
      }))
    })
  }

  function addBlock() {
    const newBlock: ContentBlock = {
      id:      nanoid(),
      type:    "text",
      title:   "",
      content: "",
      order:   blocks.length,
    }
    setBlocks((prev) => [...prev, newBlock])
  }

  function removeBlock(id: string) {
    setBlocks((prev) =>
      prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i }))
    )
  }

  function updateBlock(id: string, partial: Partial<ContentBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...partial } : b))
    )
  }

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { contentBlocks: blocks })
        toast.success("Content saved")
      } catch {
        toast.error("Failed to save content")
      }
    })
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {blocks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No content blocks yet. Add one to show custom content in the widget.
                </p>
              </div>
            ) : (
              blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  onRemove={removeBlock}
                  onUpdate={updateBlock}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={addBlock}>
          <PlusIcon className="size-4" />
          Add block
        </Button>
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save content"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {blocks.length} block{blocks.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}
```

### Step 9.2 — Write `apps/app/app/dashboard/content/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { ContentBlockEditor } from "@/components/settings/ContentBlockEditor"
import type { ProjectConfig } from "@/lib/types/config"

export default async function ContentPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const config = project.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build a custom content menu inside the widget. Drag to reorder.
        </p>
      </div>
      <ContentBlockEditor
        projectId={project.id}
        initial={config.contentBlocks}
      />
    </div>
  )
}
```

### Step 9.3 — Verify + Commit

```bash
pnpm --filter @txid/app build
git add apps/app/components/settings/ContentBlockEditor.tsx \
        apps/app/app/dashboard/content/
git commit -m "feat(app): add Content builder page with drag-to-reorder"
```

---

## Task 10: Embed, Team, Analytics pages

**Files:**
- Create: `apps/app/components/settings/EmbedCodeDisplay.tsx`
- Create: `apps/app/app/dashboard/embed/page.tsx`
- Create: `apps/app/app/dashboard/team/page.tsx`
- Create: `apps/app/app/dashboard/analytics/page.tsx`

### Step 10.1 — Write `apps/app/components/settings/EmbedCodeDisplay.tsx`

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CopyIcon, CheckIcon } from "lucide-react"

interface EmbedCodeDisplayProps {
  publishableKey: string
  widgetVersion: string
}

export function EmbedCodeDisplay({
  publishableKey,
  widgetVersion,
}: EmbedCodeDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const CDN_BASE = "https://cdn.txid.support"
  const version = widgetVersion === "latest" ? "latest" : `@${widgetVersion}`

  const SNIPPETS = {
    script: `<!-- TxID Support Widget -->
<script
  src="${CDN_BASE}/widget${version}/txid.min.js"
  data-key="${publishableKey}"
  defer
></script>`,

    react: `import { TxIDWidget } from "@txid/react";

// In your root layout or App component:
<TxIDWidget publishableKey="${publishableKey}" />`,

    npm: `# Install
npm install @txid/react  # or pnpm add / yarn add

# Usage
import { TxIDWidget } from "@txid/react";
<TxIDWidget publishableKey="${publishableKey}" />`,
  }

  async function copy(key: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(null), 2000)
  }

  function CodeBlock({ id, code }: { id: string; code: string }) {
    return (
      <div className="relative">
        <pre className="overflow-x-auto rounded-xl bg-muted px-4 py-4 text-xs leading-relaxed font-mono">
          <code>{code}</code>
        </pre>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 top-2"
          onClick={() => copy(id, code)}
        >
          {copied === id ? (
            <CheckIcon className="size-3 text-green-500" />
          ) : (
            <CopyIcon className="size-3" />
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Publishable key */}
      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Publishable key</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => copy("pk", publishableKey)}
          >
            {copied === "pk" ? (
              <CheckIcon className="size-3 text-green-500" />
            ) : (
              <CopyIcon className="size-3" />
            )}
          </Button>
        </div>
        <code className="block font-mono text-xs text-muted-foreground break-all">
          {publishableKey}
        </code>
        <p className="text-xs text-muted-foreground">
          Safe to expose publicly. Never share your secret key.
        </p>
      </div>

      {/* Embed snippets */}
      <Tabs defaultValue="script">
        <TabsList>
          <TabsTrigger value="script">Script tag</TabsTrigger>
          <TabsTrigger value="react">React</TabsTrigger>
          <TabsTrigger value="npm">npm / pnpm</TabsTrigger>
        </TabsList>
        <TabsContent value="script" className="mt-4">
          <CodeBlock id="script" code={SNIPPETS.script} />
          <p className="mt-2 text-xs text-muted-foreground">
            Drop this into any HTML page — no bundler required.
          </p>
        </TabsContent>
        <TabsContent value="react" className="mt-4">
          <CodeBlock id="react" code={SNIPPETS.react} />
        </TabsContent>
        <TabsContent value="npm" className="mt-4">
          <CodeBlock id="npm" code={SNIPPETS.npm} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Step 10.2 — Write `apps/app/app/dashboard/embed/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { EmbedCodeDisplay } from "@/components/settings/EmbedCodeDisplay"

export default async function EmbedPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Embed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add the TxID Support widget to your site in minutes.
        </p>
      </div>
      <EmbedCodeDisplay
        publishableKey={project.publishable_key}
        widgetVersion={project.widget_version}
      />
    </div>
  )
}
```

### Step 10.3 — Write `apps/app/app/dashboard/team/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server"
import { OrganizationProfile } from "@clerk/nextjs"

export default async function TeamPage() {
  // Clerk's <OrganizationProfile /> component handles invitations,
  // member roles, and removal natively.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite team members and manage roles via your Clerk organisation.
        </p>
      </div>
      {/* Clerk's embedded org management UI */}
      <OrganizationProfile
        appearance={{
          elements: {
            card: "bg-card border border-border shadow-none rounded-xl",
            navbar: "hidden",
          },
        }}
      />
    </div>
  )
}
```

> **Note:** `<OrganizationProfile />` is a Client Component from `@clerk/nextjs`. If the build rejects it in a server page, add `"use client"` to this file and move the `auth()` call elsewhere.

### Step 10.4 — Write `apps/app/app/dashboard/analytics/page.tsx`

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export default async function AnalyticsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conversation volume, user satisfaction, and top questions.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <BarChart3 className="size-5 text-muted-foreground" />
          <CardTitle>Analytics — coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Full analytics charts will be available in a future release. For
            now, overview stats are visible on the{" "}
            <a href="/dashboard" className="underline underline-offset-3 hover:text-foreground">
              Overview page
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 10.5 — Verify + Commit

```bash
pnpm --filter @txid/app build
git add apps/app/components/settings/EmbedCodeDisplay.tsx \
        apps/app/app/dashboard/embed/ \
        apps/app/app/dashboard/team/ \
        apps/app/app/dashboard/analytics/
git commit -m "feat(app): add Embed, Team, and Analytics pages"
```

---

## Task 11: Widget preview panel

**Files:**
- Create: `apps/app/components/dashboard/WidgetPreview.tsx`
- Modify: `apps/app/app/dashboard/branding/page.tsx` (add preview panel)

The widget preview is a static mockup that accepts the current config as props and renders a visual approximation of how the live widget will look. It is intentionally not a real widget — Phase 4 builds that. The preview is a client component so it can re-render reactively when the branding form state changes.

### Step 11.1 — Write `apps/app/components/dashboard/WidgetPreview.tsx`

```tsx
"use client"

import type { BrandingConfig } from "@/lib/types/config"
import { SUPPORTED_FONTS } from "@/lib/types/config"
import { MessageCircleIcon, XIcon, SendIcon } from "lucide-react"

interface WidgetPreviewProps {
  branding: BrandingConfig
  projectName?: string
}

const FONT_CSS: Record<string, string> = {
  "Inter":          "'Inter', sans-serif",
  "Sora":           "'Sora', sans-serif",
  "Space Mono":     "'Space Mono', monospace",
  "DM Sans":        "'DM Sans', sans-serif",
  "IBM Plex Mono":  "'IBM Plex Mono', monospace",
  "Outfit":         "'Outfit', sans-serif",
}

export function WidgetPreview({
  branding,
  projectName = "Support",
}: WidgetPreviewProps) {
  const fontFamily = FONT_CSS[branding.font] ?? "'Inter', sans-serif"

  const positionClass =
    branding.position === "bottom-left"
      ? "items-end justify-start"
      : branding.position === "inline"
      ? "items-center justify-center"
      : "items-end justify-end"

  return (
    <div
      className={`relative flex h-[480px] w-full overflow-hidden rounded-xl border border-border bg-zinc-950 p-4 ${positionClass}`}
      aria-label="Widget preview"
    >
      {/* Grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff10 1px, transparent 1px), linear-gradient(to bottom, #ffffff10 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Mock widget panel */}
      <div
        className="relative z-10 flex w-72 flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          backgroundColor: branding.backgroundColor,
          color: branding.textColor,
          fontFamily,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <div className="flex items-center gap-2">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="size-6 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex size-6 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: branding.secondaryColor, color: branding.textColor }}
              >
                {projectName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold" style={{ color: branding.textColor }}>
              {projectName}
            </span>
          </div>
          <XIcon className="size-4 opacity-70" style={{ color: branding.textColor }} />
        </div>

        {/* Messages area */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
          {/* Assistant bubble */}
          <div className="flex items-start gap-2">
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: branding.primaryColor, color: branding.textColor }}
            >
              AI
            </div>
            <div
              className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed"
              style={{
                backgroundColor: branding.secondaryColor,
                color: branding.textColor,
              }}
            >
              Hi! I'm here to help with questions about the protocol, token, and
              smart contracts. What would you like to know?
            </div>
          </div>

          {/* User bubble */}
          <div className="flex items-start justify-end gap-2">
            <div
              className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed"
              style={{
                backgroundColor: branding.primaryColor,
                color: branding.textColor,
              }}
            >
              Is my token locked?
            </div>
          </div>

          {/* Assistant reply */}
          <div className="flex items-start gap-2">
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: branding.primaryColor, color: branding.textColor }}
            >
              AI
            </div>
            <div
              className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed"
              style={{
                backgroundColor: branding.secondaryColor,
                color: branding.textColor,
              }}
            >
              I checked the Team Finance lock contract and your token appears to
              be locked until 2026. You can verify on the explorer.
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div
          className="flex items-center gap-2 border-t px-3 py-2"
          style={{
            borderColor: `${branding.primaryColor}44`,
            backgroundColor: branding.backgroundColor,
          }}
        >
          <input
            readOnly
            placeholder="Ask anything…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-50"
            style={{ color: branding.textColor }}
          />
          <button
            className="flex size-6 items-center justify-center rounded-full"
            style={{ backgroundColor: branding.primaryColor }}
          >
            <SendIcon className="size-3" style={{ color: branding.textColor }} />
          </button>
        </div>
      </div>

      {/* FAB (shown when position is not inline) */}
      {branding.position !== "inline" && (
        <div className="absolute bottom-8 right-8 z-20">
          <button
            className="flex size-12 items-center justify-center rounded-full shadow-lg"
            style={{ backgroundColor: branding.primaryColor }}
          >
            <MessageCircleIcon className="size-5" style={{ color: branding.textColor }} />
          </button>
        </div>
      )}
    </div>
  )
}
```

### Step 11.2 — Update `apps/app/app/dashboard/branding/page.tsx` to show preview

Replace the branding page with a two-column layout: form on the left, live preview on the right. Since BrandingForm is already a client component that holds local form state, pass the watched values down through a wrapper.

```tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { BrandingPageClient } from "@/components/settings/BrandingPageClient"
import type { ProjectConfig } from "@/lib/types/config"

export default async function BrandingPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const config = project.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customise how your support widget looks.
        </p>
      </div>
      <BrandingPageClient
        projectId={project.id}
        projectName={project.name}
        initial={config.branding}
      />
    </div>
  )
}
```

### Step 11.3 — Create `apps/app/components/settings/BrandingPageClient.tsx`

This thin client wrapper composes BrandingForm and WidgetPreview, passing the live form values to the preview.

```tsx
"use client"

import { useState } from "react"
import { BrandingForm } from "./BrandingForm"
import { WidgetPreview } from "@/components/dashboard/WidgetPreview"
import type { BrandingConfig } from "@/lib/types/config"

export function BrandingPageClient({
  projectId,
  projectName,
  initial,
}: {
  projectId: string
  projectName: string
  initial: BrandingConfig
}) {
  // Live branding state driven by the form
  const [liveBranding, setLiveBranding] = useState<BrandingConfig>(initial)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <BrandingForm
        projectId={projectId}
        initial={initial}
        onBrandingChange={setLiveBranding}
      />
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs text-muted-foreground">Preview</p>
        <WidgetPreview branding={liveBranding} projectName={projectName} />
      </div>
    </div>
  )
}
```

> **Note:** `BrandingForm` needs a new optional `onBrandingChange` prop that calls back with the current `watch()` values on every change. Add this to `BrandingForm.tsx` alongside the existing `useForm` setup:
>
> ```tsx
> // In BrandingForm props:
> onBrandingChange?: (branding: BrandingConfig) => void
>
> // After the form.watch() call:
> React.useEffect(() => {
>   onBrandingChange?.({
>     ...initial,
>     ...watchedValues,
>   })
> }, [JSON.stringify(watchedValues)])
> ```

### Step 11.4 — Verify + Commit

```bash
pnpm --filter @txid/app build
git add apps/app/components/dashboard/WidgetPreview.tsx \
        apps/app/components/settings/BrandingPageClient.tsx \
        apps/app/app/dashboard/branding/
git commit -m "feat(app): add live WidgetPreview panel on branding page"
```

---

## Task 12: Final build check + push

### Step 12.1 — Full clean build

```bash
cd /Users/howardpearce/Projects/txid-support/.worktrees/phase-1
pnpm --filter @txid/app build
```

Expected: Build succeeds with no TypeScript errors and no Next.js warnings about missing page components.

### Step 12.2 — Checklist

Verify each dashboard route renders without error (can be checked with `next build` static analysis):

- [ ] `/dashboard` — overview with stats
- [ ] `/dashboard/branding` — color pickers + live preview
- [ ] `/dashboard/token` — token form
- [ ] `/dashboard/contracts` — contract list + add dialog
- [ ] `/dashboard/docs` — docs URL form + job history
- [ ] `/dashboard/chains` — chain toggles
- [ ] `/dashboard/content` — content block editor with DnD
- [ ] `/dashboard/embed` — embed code tabs
- [ ] `/dashboard/team` — Clerk OrganizationProfile
- [ ] `/dashboard/analytics` — coming soon stub
- [ ] Sidebar active states correct for all routes
- [ ] First-time user flow (no project) shows create splash

### Step 12.3 — Commit + push

```bash
git add -A
git commit -m "feat(app): Phase 3 complete — full B2B dashboard"
git push origin master
```

---

## Key implementation notes for the implementing agent

### Clerk v5 `auth()` is async

Always `await auth()` — calling it synchronously is a Clerk v4 pattern and will fail:

```typescript
// Correct (v5):
const { orgId, userId } = await auth()
```

### `createServiceClient()` for all server actions

The anon client (`createClient()`) is for user-facing reads that should respect RLS. Server actions always use `createServiceClient()` and perform their own ownership checks.

### `@base-ui/react` component APIs

The existing shadcn/ui components in this project use `@base-ui/react` primitives (not Radix). Key differences to note:
- `Dialog` uses `DialogPrimitive.Root`, not a `open`/`onOpenChange` prop pair — use `defaultOpen` or a controlled `open` state.
- `Select` uses `SelectPrimitive.Root` from `@base-ui/react/select`.
- `Button` wraps `@base-ui/react/button`, not a `<button>` element directly.
- Dialogs use `data-open` / `data-closed` attributes rather than Radix's `data-state`.

### `nanoid` usage

`nanoid` is a pure ESM package. Import as:

```typescript
import { nanoid } from "nanoid"
```

It works in both server actions and client components in Next.js 14 with the App Router.

### DnD Kit in Next.js 14

`@dnd-kit/core` and `@dnd-kit/sortable` require client-side rendering. All components using them must have `"use client"` at the top. The `ContentBlockEditor` already has this.

### `react-colorful` SSR

`react-colorful` renders fine on the server — no dynamic import needed. The `HexColorPicker` and `HexColorInput` components can be used directly in client components.

### `revalidatePath` scope

Server actions call `revalidatePath` for the specific route being updated. The layout itself (`/dashboard/layout.tsx`) does not need revalidation as it fetches org name which rarely changes.

### First-time user flow

`getProject()` returns `{ org, project: null }` when no project exists. Every dashboard page redirects to `/dashboard` if `project` is null, and the overview page shows the create splash. The `createProject()` action is called from an inline form action on the overview page — this avoids needing a separate route.

### Type casting `config` column

Supabase types the `config` column as `Json` (the generic JSON type). Cast it to `ProjectConfig` with:

```typescript
const config = project.config as unknown as ProjectConfig
```

When writing back, cast the other way:

```typescript
config: updated as unknown as import("@/lib/supabase/types").Json
```

---

## Dependency summary

| Package | Version constraint | Why |
|---|---|---|
| `react-colorful` | latest | Hex color picker in BrandingForm |
| `@dnd-kit/core` | latest | Drag context for ContentBlockEditor |
| `@dnd-kit/sortable` | latest | Sortable list items in ContentBlockEditor |
| `nanoid` | latest | ID generation for contracts + content blocks |

All other packages (`zod`, `react-hook-form`, `@hookform/resolvers`, `sonner`, `lucide-react`) are already in `apps/app/package.json`.

---

### Critical Files for Implementation

- `/Users/howardpearce/Projects/txid-support/.worktrees/phase-1/apps/app/lib/supabase/server.ts` - `createServiceClient()` pattern that all server actions must follow
- `/Users/howardpearce/Projects/txid-support/.worktrees/phase-1/apps/app/lib/supabase/types.ts` - Database types; the `projects.config` is typed as `Json` and must be cast to `ProjectConfig` at the boundary
- `/Users/howardpearce/Projects/txid-support/.worktrees/phase-1/apps/app/components/ui/dialog.tsx` - Uses `@base-ui/react/dialog` primitives (not Radix); all new dialogs must follow this pattern exactly
- `/Users/howardpearce/Projects/txid-support/.worktrees/phase-1/apps/app/components/ui/select.tsx` - Uses `@base-ui/react/select`; chain and font dropdowns must use these exports
- `/Users/howardpearce/Projects/txid-support/.worktrees/phase-1/supabase/migrations/20260325000001_initial_schema.sql` - Canonical schema reference; the migration in Task 1 amends the `config` column default defined here